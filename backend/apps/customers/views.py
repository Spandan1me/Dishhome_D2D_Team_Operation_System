from rest_framework import generics, status, views
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated
from django.db.models import Q
from django.db import transaction

from apps.accounts.permissions import IsSupervisorOrAdmin, IsAgentUserRole
from apps.accounts.models import RoleChoices
from .models import Customer, RecordSource, ReviewStatus
from .serializers import (
    CustomerListSerializer,
    ManualCustomerCreateSerializer,
    CustomerReviewActionSerializer
)
from apps.audit.models import AuditLog, AuditAction

class CustomerListView(generics.ListAPIView):
    """
    List customers with role-based access filtering:
    - Agents: only assigned to them (ACTIVE) or manually added by them
    - Supervisors: customers belonging to their team
    - Admins: all customers
    """
    permission_classes = [IsAuthenticated]
    serializer_class = CustomerListSerializer

    def get_queryset(self):
        user = self.request.user
        qs = Customer.objects.all().select_related('created_by')

        if user.is_agent_user:
            qs = qs.filter(
                Q(assignments__assigned_agent=user, assignments__status='ACTIVE') |
                Q(created_by=user, record_source=RecordSource.AGENT_MANUAL)
            ).distinct()
        elif user.is_supervisor_user:
            # Supervisors should see all uploaded customer batches in the shared workspace,
            # plus customers assigned to their team or created by their team. This keeps
            # uploaded data visible across supervisors while preserving team-level access.
            team_agents = user.supervised_agents.all()
            qs = qs.filter(
                Q(assignments__assigned_agent__in=team_agents) |
                Q(created_by=user) |
                Q(created_by__in=team_agents) |
                Q(assignments__assigned_by=user) |
                Q(batch_records__batch__uploaded_by__isnull=False) |
                Q(assignments__isnull=True)
            ).distinct()

        # Query filters
        search = self.request.query_params.get('search')
        if search:
            search = search.strip()
            qs = qs.filter(
                Q(customer_id__icontains=search) |
                Q(customer_name__icontains=search) |
                Q(phone_number__icontains=search)
            )

        record_source = self.request.query_params.get('record_source')
        if record_source:
            qs = qs.filter(record_source=record_source)

        review_status = self.request.query_params.get('review_status')
        if review_status:
            qs = qs.filter(review_status=review_status)

        assigned_agent = self.request.query_params.get('assigned_agent')
        if assigned_agent:
            qs = qs.filter(assignments__assigned_agent_id=assigned_agent, assignments__status='ACTIVE')

        is_assigned = self.request.query_params.get('is_assigned')
        if is_assigned == 'true':
            qs = qs.filter(assignments__status='ACTIVE')
        elif is_assigned == 'false':
            qs = qs.exclude(assignments__status='ACTIVE')

        # Sorting
        ordering = self.request.query_params.get('ordering', '-created_at')
        allowed_ordering = ['churn_days', '-churn_days', 'created_at', '-created_at', 'customer_id', '-customer_id']
        if ordering in allowed_ordering:
            qs = qs.order_by(ordering)

        return qs

class CustomerDetailView(views.APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request, pk):
        pk_str = str(pk).strip()
        try:
            if pk_str.isdigit():
                customer = Customer.objects.get(pk=int(pk_str))
            else:
                customer = Customer.objects.get(customer_id=pk_str)
        except Customer.DoesNotExist:
            return Response({'detail': f'Customer "{pk}" not found.'}, status=status.HTTP_404_NOT_FOUND)

        # Enforce agent access check
        if request.user.is_agent_user:
            has_assignment = customer.assignments.filter(
                assigned_agent=request.user,
                status='ACTIVE'
            ).exists()
            is_creator = customer.created_by == request.user
            if not has_assignment and not is_creator:
                return Response(
                    {'detail': 'You do not have permission to view this customer.'},
                    status=status.HTTP_403_FORBIDDEN
                )

        data = CustomerListSerializer(customer).data

        # Embed detailed visit logs
        from apps.visits.serializers import VisitLogSerializer
        from apps.followups.serializers import FollowUpSerializer
        from apps.allocations.serializers import CustomerAssignmentSerializer

        data['visits'] = VisitLogSerializer(customer.visits.all().order_by('-created_at'), many=True).data
        data['followups'] = FollowUpSerializer(customer.followups.all().order_by('-follow_up_date'), many=True).data
        data['assignment_history'] = CustomerAssignmentSerializer(
            customer.assignments.all().order_by('-assigned_at'), many=True
        ).data

        return Response(data)

class ManualCustomerCreateView(views.APIView):
    """
    Agents can manually add a customer ID that was not part of an uploaded Excel file.
    Creates the customer, marks it PENDING_REVIEW, and automatically assigns it to the creating agent.
    """
    permission_classes = [IsAuthenticated]

    def post(self, request):
        serializer = ManualCustomerCreateSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        customer_id = serializer.validated_data['customer_id']
        notes = serializer.validated_data.get('additional_notes', '')

        with transaction.atomic():
            customer = Customer.objects.create(
                customer_id=customer_id,
                customer_name=serializer.validated_data.get('customer_name', ''),
                phone_number=serializer.validated_data.get('phone_number', ''),
                churn_days=serializer.validated_data.get('churn_days', 0),
                package=serializer.validated_data.get('package', ''),
                record_source=RecordSource.AGENT_MANUAL,
                review_status=ReviewStatus.PENDING_REVIEW,
                review_notes=notes,
                created_by=request.user
            )

            # Auto-assign to creating agent if user is an agent
            if request.user.is_agent_user:
                from apps.allocations.models import CustomerAssignment
                CustomerAssignment.objects.create(
                    customer=customer,
                    assigned_agent=request.user,
                    assigned_by=request.user,
                    status='ACTIVE',
                    reassignment_reason='Self-assigned via manual field entry'
                )

            # Audit record
            AuditLog.objects.create(
                user=request.user,
                action=AuditAction.CREATE,
                entity_type='Customer',
                entity_id=customer.customer_id,
                after_values={
                    'customer_id': customer.customer_id,
                    'customer_name': customer.customer_name,
                    'source': 'AGENT_MANUAL'
                },
                reason=f"Manually added customer {customer.customer_id}"
            )

        return Response(CustomerListSerializer(customer).data, status=status.HTTP_201_CREATED)

class CustomerReviewView(views.APIView):
    """
    Supervisors and admins can approve, reject, or request corrections on agent-added customers.
    """
    permission_classes = [IsAuthenticated, IsSupervisorOrAdmin]
    def post(self, request, pk):
        pk_str = str(pk).strip()
        try:
            if pk_str.isdigit():
                customer = Customer.objects.get(pk=int(pk_str))
            else:
                customer = Customer.objects.get(customer_id=pk_str)
        except Customer.DoesNotExist:
            return Response({'detail': f'Customer "{pk}" not found.'}, status=status.HTTP_404_NOT_FOUND)

        serializer = CustomerReviewActionSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        action = serializer.validated_data['action']
        review_notes = serializer.validated_data.get('review_notes', '')

        old_status = customer.review_status
        if action == 'APPROVE':
            customer.review_status = ReviewStatus.APPROVED
        elif action == 'REJECT':
            customer.review_status = ReviewStatus.REJECTED
        elif action == 'CORRECTION_REQUESTED':
            customer.review_status = ReviewStatus.CORRECTION_REQUESTED

        if review_notes:
            customer.review_notes = review_notes
        customer.save()

        AuditLog.objects.create(
            user=request.user,
            action=AuditAction.STATUS_CHANGE,
            entity_type='Customer',
            entity_id=customer.customer_id,
            before_values={'review_status': old_status},
            after_values={'review_status': customer.review_status},
            reason=f"Review decision: {customer.review_status}. Notes: {review_notes}"
        )

        return Response(CustomerListSerializer(customer).data)
