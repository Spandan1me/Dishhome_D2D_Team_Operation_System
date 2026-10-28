from django.utils import timezone
from django.db import transaction
from django.http import FileResponse
from django.shortcuts import get_object_or_404
from rest_framework import views, status, generics
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated
from rest_framework.parsers import MultiPartParser, FormParser
from datetime import timedelta

from .models import (
    VisitLog,
    VisitEvidenceUpload,
    VisitStatus,
    FOLLOW_UP_REMARKS,
    SWITCHING_REASONS,
    SWITCHING_TO_ISPS
)
from .serializers import (
    VisitLogSerializer,
    RecordVisitSerializer,
    VisitEvidenceUploadSerializer,
)
from apps.customers.models import Customer
from apps.followups.models import FollowUp, FollowUpStatus
from apps.audit.models import AuditLog, AuditAction

class VisitChoicesView(views.APIView):
    """
    Returns reference dropdown choices for Visit Findings:
    - 19 Follow-up Remarks
    - 9 Switching Reasons
    - 9 Competitor ISPs
    - Visit Statuses
    """
    permission_classes = [IsAuthenticated]

    def get(self, request):
        return Response({
            'remarks': FOLLOW_UP_REMARKS,
            'switching_reasons': SWITCHING_REASONS,
            'switching_to_isps': SWITCHING_TO_ISPS,
            'visit_statuses': [
                {'value': c[0], 'label': c[1]} for c in VisitStatus.choices
            ]
        })

class VisitListCreateView(views.APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        user = request.user
        qs = VisitLog.objects.select_related('customer', 'agent').all()

        if user.is_agent_user:
            qs = qs.filter(agent=user)
        elif user.is_supervisor_user:
            qs = qs.all()

        # Filters
        customer_id = request.query_params.get('customer')
        if customer_id:
            qs = qs.filter(customer_id=customer_id)

        agent_id = request.query_params.get('agent')
        if agent_id:
            qs = qs.filter(agent_id=agent_id)

        visit_status = request.query_params.get('status')
        if visit_status:
            qs = qs.filter(visit_status=visit_status)

        remark = request.query_params.get('remark')
        if remark:
            qs = qs.filter(follow_up_remark=remark)

        has_gps = request.query_params.get('has_gps')
        if has_gps == 'true':
            qs = qs.filter(gps_latitude__isnull=False, gps_longitude__isnull=False)
        elif has_gps == 'false':
            qs = qs.filter(gps_latitude__isnull=True)

        date_from = request.query_params.get('date_from')
        if date_from:
            qs = qs.filter(completed_at__date__gte=date_from)

        date_to = request.query_params.get('date_to')
        if date_to:
            qs = qs.filter(completed_at__date__lte=date_to)

        serializer = VisitLogSerializer(qs[:100], many=True)
        return Response(serializer.data)

    def post(self, request):
        serializer = RecordVisitSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        customer_identifier = str(serializer.validated_data['customer_id']).strip()
        try:
            if customer_identifier.isdigit():
                customer = Customer.objects.get(pk=int(customer_identifier))
            else:
                customer = Customer.objects.get(customer_id=customer_identifier)
        except Customer.DoesNotExist:
            return Response({'detail': f'Customer "{customer_identifier}" not found.'}, status=status.HTTP_404_NOT_FOUND)

        photo_evidence_id = serializer.validated_data.get('photo_evidence_id')
        video_evidence_id = serializer.validated_data.get('video_evidence_id')
        if photo_evidence_id and video_evidence_id:
            return Response(
                {'detail': 'Only one uploaded photo or video can be attached per evidence slot.'},
                status=status.HTTP_400_BAD_REQUEST,
            )
        evidence_upload_id = photo_evidence_id or video_evidence_id
        pending_evidence = None
        if evidence_upload_id:
            pending_evidence = VisitEvidenceUpload.objects.filter(
                pk=evidence_upload_id,
                agent=request.user,
                customer=customer,
            ).first()
            if not pending_evidence:
                return Response(
                    {'detail': 'Uploaded evidence was not found for this customer. Capture it again.'},
                    status=status.HTTP_400_BAD_REQUEST,
                )
            if photo_evidence_id and not pending_evidence.photo:
                return Response(
                    {'detail': 'Selected uploaded evidence does not contain a photo.'},
                    status=status.HTTP_400_BAD_REQUEST,
                )
            if video_evidence_id and not pending_evidence.video:
                return Response(
                    {'detail': 'Selected uploaded evidence does not contain a video.'},
                    status=status.HTTP_400_BAD_REQUEST,
                )

        now = timezone.now()
        has_gps_coords = (
            serializer.validated_data.get('gps_latitude') is not None and
            serializer.validated_data.get('gps_longitude') is not None
        )

        with transaction.atomic():
            visit = VisitLog.objects.create(
                customer=customer,
                agent=request.user,
                visit_status=serializer.validated_data.get('visit_status', VisitStatus.COMPLETED),
                follow_up_remark=serializer.validated_data['follow_up_remark'],
                switching_reason=serializer.validated_data.get('switching_reason', ''),
                switching_to=serializer.validated_data.get('switching_to', ''),
                notes=serializer.validated_data.get('notes', ''),
                photo=(
                    pending_evidence.photo if photo_evidence_id
                    else serializer.validated_data.get('photo')
                ),
                video=(
                    pending_evidence.video if video_evidence_id
                    else serializer.validated_data.get('video')
                ),
                gps_latitude=serializer.validated_data.get('gps_latitude'),
                gps_longitude=serializer.validated_data.get('gps_longitude'),
                gps_accuracy=serializer.validated_data.get('gps_accuracy'),
                gps_captured_at=now if has_gps_coords else None,
                completed_at=now
            )
            if pending_evidence:
                pending_evidence.delete()

            # Follow-up scheduling if date provided
            follow_up_date = serializer.validated_data.get('follow_up_date')
            followup_obj = None
            if follow_up_date:
                followup_obj = FollowUp.objects.create(
                    customer=customer,
                    related_visit=visit,
                    assigned_agent=request.user,
                    follow_up_date=follow_up_date,
                    status=FollowUpStatus.PENDING,
                    notes=serializer.validated_data.get('follow_up_notes') or f"Scheduled during visit: {visit.follow_up_remark}"
                )

            # Audit record
            AuditLog.objects.create(
                user=request.user,
                action=AuditAction.VISIT_COMPLETE,
                entity_type='VisitLog',
                entity_id=str(visit.id),
                after_values={
                    'customer_id': customer.customer_id,
                    'remark': visit.follow_up_remark,
                    'status': visit.visit_status,
                    'has_gps': has_gps_coords,
                    'has_photo': bool(visit.photo),
                    'has_video': bool(visit.video),
                },
                reason=f"Recorded visit on {customer.customer_id} ({visit.visit_status})"
            )

        response_data = VisitLogSerializer(visit).data
        if followup_obj:
            response_data['scheduled_followup_id'] = followup_obj.id

        return Response(response_data, status=status.HTTP_201_CREATED)


class VisitEvidenceUploadView(views.APIView):
    permission_classes = [IsAuthenticated]
    parser_classes = [MultiPartParser, FormParser]

    def post(self, request):
        serializer = VisitEvidenceUploadSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        customer_identifier = serializer.validated_data['customer_id'].strip()
        try:
            if customer_identifier.isdigit():
                customer = Customer.objects.get(pk=int(customer_identifier))
            else:
                customer = Customer.objects.get(customer_id=customer_identifier)
        except Customer.DoesNotExist:
            return Response(
                {'detail': f'Customer "{customer_identifier}" not found.'},
                status=status.HTTP_404_NOT_FOUND,
            )

        # Remove abandoned captures older than one day for this agent.
        expired = VisitEvidenceUpload.objects.filter(
            agent=request.user,
            created_at__lt=timezone.now() - timedelta(days=1),
        )
        for old_upload in expired:
            if old_upload.photo:
                old_upload.photo.delete(save=False)
            if old_upload.video:
                old_upload.video.delete(save=False)
        expired.delete()

        evidence = VisitEvidenceUpload.objects.create(
            agent=request.user,
            customer=customer,
            photo=serializer.validated_data.get('photo'),
            video=serializer.validated_data.get('video'),
        )
        return Response({
            'id': evidence.id,
            'evidence_type': 'photo' if evidence.photo else 'video',
            'detail': 'Evidence uploaded successfully.',
        }, status=status.HTTP_201_CREATED)

    def delete(self, request, pk):
        evidence = get_object_or_404(
            VisitEvidenceUpload,
            pk=pk,
            agent=request.user,
        )
        if evidence.photo:
            evidence.photo.delete(save=False)
        if evidence.video:
            evidence.video.delete(save=False)
        evidence.delete()
        return Response(status=status.HTTP_204_NO_CONTENT)


class VisitDetailView(generics.RetrieveAPIView):
    permission_classes = [IsAuthenticated]
    queryset = VisitLog.objects.select_related('customer', 'agent').all()
    serializer_class = VisitLogSerializer


class VisitEvidenceView(views.APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request, pk, evidence_type):
        if evidence_type not in {'photo', 'video'}:
            return Response(
                {'detail': 'Evidence type must be photo or video.'},
                status=status.HTTP_404_NOT_FOUND,
            )
        visit = get_object_or_404(
            VisitLog.objects.select_related('agent'),
            pk=pk,
        )
        user = request.user
        can_view = (
            user.is_admin_user
            or visit.agent_id == user.id
            or (user.is_supervisor_user and visit.agent.supervisor_id == user.id)
        )
        if not can_view:
            return Response(
                {'detail': 'You do not have permission to view this visit evidence.'},
                status=status.HTTP_403_FORBIDDEN,
            )

        evidence = visit.photo if evidence_type == 'photo' else visit.video
        if not evidence:
            return Response(
                {'detail': f'This visit has no {evidence_type} evidence.'},
                status=status.HTTP_404_NOT_FOUND,
            )

        try:
            evidence.open('rb')
        except OSError:
            return Response(
                {'detail': 'The evidence file could not be opened.'},
                status=status.HTTP_404_NOT_FOUND,
            )

        content_type = (
            'image/jpeg' if evidence_type == 'photo' and evidence.name.lower().endswith(('.jpg', '.jpeg'))
            else 'image/png' if evidence_type == 'photo' and evidence.name.lower().endswith('.png')
            else 'image/webp' if evidence_type == 'photo' and evidence.name.lower().endswith('.webp')
            else 'video/mp4' if evidence.name.lower().endswith('.mp4')
            else 'video/quicktime' if evidence.name.lower().endswith('.mov')
            else 'video/webm' if evidence.name.lower().endswith('.webm')
            else 'application/octet-stream'
        )
        return FileResponse(evidence, content_type=content_type)
