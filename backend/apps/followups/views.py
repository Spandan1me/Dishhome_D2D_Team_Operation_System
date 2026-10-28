from django.utils import timezone
from rest_framework import generics, status, views
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated

from .models import FollowUp, FollowUpStatus
from .serializers import FollowUpSerializer, FollowUpStatusUpdateSerializer
from apps.audit.models import AuditLog, AuditAction

class FollowUpListView(generics.ListAPIView):
    permission_classes = [IsAuthenticated]
    serializer_class = FollowUpSerializer

    def get_queryset(self):
        user = self.request.user
        today = timezone.localdate()

        # Automatically flag pending past-date follow-ups as OVERDUE
        FollowUp.objects.filter(
            status=FollowUpStatus.PENDING,
            follow_up_date__lt=today
        ).update(status=FollowUpStatus.OVERDUE)

        qs = FollowUp.objects.select_related('customer', 'assigned_agent', 'related_visit').all()

        if user.is_agent_user:
            qs = qs.filter(assigned_agent=user)
        elif user.is_supervisor_user:
            qs = qs.all()

        filter_type = self.request.query_params.get('filter')
        if filter_type == 'today':
            qs = qs.filter(follow_up_date=today, status=FollowUpStatus.PENDING)
        elif filter_type == 'upcoming':
            qs = qs.filter(follow_up_date__gt=today, status=FollowUpStatus.PENDING)
        elif filter_type == 'overdue':
            qs = qs.filter(status=FollowUpStatus.OVERDUE)
        elif filter_type == 'completed':
            qs = qs.filter(status=FollowUpStatus.COMPLETED)

        agent_id = self.request.query_params.get('agent')
        if agent_id:
            qs = qs.filter(assigned_agent_id=agent_id)

        return qs.order_by('follow_up_date')

class FollowUpUpdateStatusView(views.APIView):
    permission_classes = [IsAuthenticated]

    def patch(self, request, pk):
        try:
            followup = FollowUp.objects.select_related('assigned_agent__supervisor').get(pk=pk)
        except FollowUp.DoesNotExist:
            return Response({'detail': 'Follow-up not found.'}, status=status.HTTP_404_NOT_FOUND)

        user = request.user
        if not user.is_admin_user:
            if user.is_agent_user and followup.assigned_agent != user:
                return Response({'detail': 'You can only update your own follow-up tasks.'}, status=status.HTTP_403_FORBIDDEN)
            elif user.is_supervisor_user and followup.assigned_agent.supervisor != user:
                return Response({'detail': 'You can only update follow-up tasks for your supervised agents.'}, status=status.HTTP_403_FORBIDDEN)

        serializer = FollowUpStatusUpdateSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        old_status = followup.status
        followup.status = serializer.validated_data['status']
        if serializer.validated_data.get('notes'):
            followup.notes = f"{followup.notes}\n{serializer.validated_data['notes']}".strip()
        followup.save()

        AuditLog.objects.create(
            user=request.user,
            action=AuditAction.STATUS_CHANGE,
            entity_type='FollowUp',
            entity_id=str(followup.id),
            before_values={'status': old_status},
            after_values={'status': followup.status},
            reason=f"Updated follow-up status to {followup.status}"
        )

        return Response(FollowUpSerializer(followup).data)
