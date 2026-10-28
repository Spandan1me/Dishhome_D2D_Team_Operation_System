from django.utils import timezone
from django.db import transaction
from rest_framework import views, status, generics
from rest_framework.response import Response

from apps.accounts.permissions import IsSupervisorOrAdmin
from apps.accounts.models import User, RoleChoices
from apps.customers.models import Customer
from apps.imports.models import ImportBatch
from .models import CustomerAssignment, AssignmentStatus
from .serializers import (
    CustomerAssignmentSerializer,
    SingleAllocationSerializer,
    BulkAllocationSerializer,
    ReassignmentSerializer
)
from apps.audit.models import AuditLog, AuditAction

class BatchAllocationDataView(views.APIView):
    """
    Returns data needed for the dedicated 'Allocate Team' screen for an import batch.
    - Batch metadata and allocation counters
    - All customers in the batch with current assignment status
    - Eligible agents under this supervisor
    """
    permission_classes = [IsSupervisorOrAdmin]

    def get(self, request, batch_id):
        try:
            batch = ImportBatch.objects.get(pk=batch_id)
        except ImportBatch.DoesNotExist:
            return Response({'detail': 'Batch not found.'}, status=status.HTTP_404_NOT_FOUND)

        # Eligible agents
        agents_qs = User.objects.filter(role=RoleChoices.AGENT, is_active=True)

        agents_data = [
            {
                'id': a.id,
                'username': a.username,
                'full_name': a.full_name or a.username,
                'assigned_count': a.assignments.filter(status='ACTIVE').count()
            }
            for a in agents_qs
        ]

        # Batch customers
        records = batch.batch_records.select_related('customer').all()
        customers_data = []
        allocated_count = 0
        unallocated_count = 0

        for r in records:
            c = r.customer
            active_assign = c.active_assignment
            if active_assign:
                allocated_count += 1
                assigned_agent_id = active_assign.assigned_agent_id
                assigned_agent_name = active_assign.assigned_agent.full_name or active_assign.assigned_agent.username
            else:
                unallocated_count += 1
                assigned_agent_id = None
                assigned_agent_name = None

            customers_data.append({
                'id': c.id,
                'customer_id': c.customer_id,
                'customer_name': c.customer_name,
                'phone_number': c.phone_number,
                'churn_days': c.churn_days,
                'package': c.package,
                'assigned_agent_id': assigned_agent_id,
                'assigned_agent_name': assigned_agent_name,
                'is_allocated': active_assign is not None
            })

        return Response({
            'batch_id': batch.id,
            'filename': batch.filename,
            'total_customers': len(customers_data),
            'allocated_count': allocated_count,
            'unallocated_count': unallocated_count,
            'allocation_status': batch.allocation_status,
            'eligible_agents': agents_data,
            'customers': customers_data
        })

class SingleAssignView(views.APIView):
    permission_classes = [IsSupervisorOrAdmin]

    def post(self, request):
        serializer = SingleAllocationSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        customer_id = serializer.validated_data['customer_id']
        agent_id = serializer.validated_data['agent_id']
        batch_id = serializer.validated_data.get('batch_id')

        try:
            customer = Customer.objects.get(pk=customer_id)
            agent = User.objects.get(pk=agent_id, role=RoleChoices.AGENT, is_active=True)
        except (Customer.DoesNotExist, User.DoesNotExist):
            return Response({'detail': 'Invalid customer or agent ID.'}, status=status.HTTP_404_NOT_FOUND)

        with transaction.atomic():
            # Deactivate current active assignment if any
            active_assignment = customer.active_assignment
            if active_assignment:
                if active_assignment.assigned_agent == agent:
                    return Response({'detail': 'Customer is already assigned to this agent.'})
                active_assignment.status = AssignmentStatus.REASSIGNED
                active_assignment.unassigned_at = timezone.now()
                active_assignment.reassignment_reason = 'Reassigned via single allocation'
                active_assignment.save()

            new_assign = CustomerAssignment.objects.create(
                customer=customer,
                assigned_agent=agent,
                assigned_by=request.user,
                status=AssignmentStatus.ACTIVE
            )

            if batch_id:
                try:
                    batch = ImportBatch.objects.get(pk=batch_id)
                    batch.update_allocation_status()
                except ImportBatch.DoesNotExist:
                    pass

            AuditLog.objects.create(
                user=request.user,
                action=AuditAction.ALLOCATE,
                entity_type='CustomerAssignment',
                entity_id=str(new_assign.id),
                after_values={'customer_id': customer.customer_id, 'agent': agent.username},
                reason=f"Assigned customer {customer.customer_id} to agent {agent.username}"
            )

        return Response({
            'detail': 'Customer assigned successfully.',
            'assignment': CustomerAssignmentSerializer(new_assign).data
        })

class BulkAssignView(views.APIView):
    """
    Allocates multiple customers in bulk.
    Supports either:
    1. Assigning all selected customers to a single agent (agent_id).
    2. Distributing selected customers evenly across a list of agents (distribute_evenly=True, agent_ids).
    """
    permission_classes = [IsSupervisorOrAdmin]

    def post(self, request):
        serializer = BulkAllocationSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        customer_ids = serializer.validated_data['customer_ids']
        distribute_evenly = serializer.validated_data.get('distribute_evenly', False)
        agent_id = serializer.validated_data.get('agent_id')
        agent_ids = serializer.validated_data.get('agent_ids', [])
        batch_id = serializer.validated_data.get('batch_id')

        customers = list(Customer.objects.filter(id__in=customer_ids))
        if not customers:
            return Response({'detail': 'No valid customers found.'}, status=status.HTTP_400_BAD_REQUEST)

        with transaction.atomic():
            if distribute_evenly:
                target_agents = list(User.objects.filter(id__in=agent_ids, role=RoleChoices.AGENT, is_active=True))
                if not target_agents:
                    return Response({'detail': 'No active agents found in agent_ids.'}, status=status.HTTP_400_BAD_REQUEST)

                num_agents = len(target_agents)
                assigned_map = {a.id: 0 for a in target_agents}

                for idx, customer in enumerate(customers):
                    selected_agent = target_agents[idx % num_agents]

                    # Deactivate old assignment
                    CustomerAssignment.objects.filter(
                        customer=customer,
                        status=AssignmentStatus.ACTIVE
                    ).update(
                        status=AssignmentStatus.REASSIGNED,
                        unassigned_at=timezone.now(),
                        reassignment_reason='Bulk distributed'
                    )

                    CustomerAssignment.objects.create(
                        customer=customer,
                        assigned_agent=selected_agent,
                        assigned_by=request.user,
                        status=AssignmentStatus.ACTIVE
                    )
                    assigned_map[selected_agent.id] += 1

            else:
                agent = User.objects.get(pk=agent_id, role=RoleChoices.AGENT, is_active=True)
                for customer in customers:
                    CustomerAssignment.objects.filter(
                        customer=customer,
                        status=AssignmentStatus.ACTIVE
                    ).update(
                        status=AssignmentStatus.REASSIGNED,
                        unassigned_at=timezone.now(),
                        reassignment_reason='Bulk assigned'
                    )

                    CustomerAssignment.objects.create(
                        customer=customer,
                        assigned_agent=agent,
                        assigned_by=request.user,
                        status=AssignmentStatus.ACTIVE
                    )

            if batch_id:
                try:
                    batch = ImportBatch.objects.get(pk=batch_id)
                    batch.update_allocation_status()
                except ImportBatch.DoesNotExist:
                    pass

            AuditLog.objects.create(
                user=request.user,
                action=AuditAction.ALLOCATE,
                entity_type='CustomerAssignment',
                entity_id=f"bulk_{len(customers)}",
                after_values={
                    'count': len(customers),
                    'distribute_evenly': distribute_evenly,
                },
                reason=f"Bulk allocated {len(customers)} customers"
            )

        return Response({
            'detail': f"Successfully allocated {len(customers)} customers.",
            'allocated_count': len(customers)
        })

class ReassignView(views.APIView):
    """
    Reassigns a customer to another agent with audit reason.
    """
    permission_classes = [IsSupervisorOrAdmin]

    def post(self, request):
        serializer = ReassignmentSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        customer_id = serializer.validated_data['customer_id']
        new_agent_id = serializer.validated_data['new_agent_id']
        reason = serializer.validated_data['reason']

        try:
            customer = Customer.objects.get(pk=customer_id)
            new_agent = User.objects.get(pk=new_agent_id, role=RoleChoices.AGENT, is_active=True)
        except (Customer.DoesNotExist, User.DoesNotExist):
            return Response({'detail': 'Invalid customer or agent ID.'}, status=status.HTTP_404_NOT_FOUND)

        with transaction.atomic():
            old_assignment = customer.active_assignment
            old_agent_name = old_assignment.assigned_agent.username if old_assignment else 'Unassigned'

            if old_assignment:
                old_assignment.status = AssignmentStatus.REASSIGNED
                old_assignment.unassigned_at = timezone.now()
                old_assignment.reassignment_reason = reason
                old_assignment.save()

            new_assign = CustomerAssignment.objects.create(
                customer=customer,
                assigned_agent=new_agent,
                assigned_by=request.user,
                status=AssignmentStatus.ACTIVE,
                reassignment_reason=reason
            )

            AuditLog.objects.create(
                user=request.user,
                action=AuditAction.REASSIGN,
                entity_type='CustomerAssignment',
                entity_id=str(new_assign.id),
                before_values={'agent': old_agent_name},
                after_values={'agent': new_agent.username},
                reason=f"Reassigned {customer.customer_id} from {old_agent_name} to {new_agent.username}: {reason}"
            )

        return Response({
            'detail': 'Customer successfully reassigned.',
            'assignment': CustomerAssignmentSerializer(new_assign).data
        })

class AllocateEntireBatchView(views.APIView):
    """
    Allocates ALL customers in a specific import batch to a single selected agent in 1 click.
    Eliminates row-by-row assignment when an entire upload file represents a specific area.
    """
    permission_classes = [IsSupervisorOrAdmin]

    def post(self, request):
        batch_id = request.data.get('batch_id')
        agent_id = request.data.get('agent_id')

        if not batch_id or not agent_id:
            return Response(
                {'detail': 'Both batch_id and agent_id are required.'},
                status=status.HTTP_400_BAD_REQUEST
            )

        try:
            batch = ImportBatch.objects.get(pk=batch_id)
        except ImportBatch.DoesNotExist:
            return Response({'detail': 'Import batch not found.'}, status=status.HTTP_404_NOT_FOUND)

        try:
            agent = User.objects.get(pk=agent_id, role=RoleChoices.AGENT, is_active=True)
        except User.DoesNotExist:
            return Response({'detail': 'Selected agent is invalid or inactive.'}, status=status.HTTP_400_BAD_REQUEST)

        batch_records = batch.batch_records.select_related('customer').all()
        if not batch_records.exists():
            return Response({'detail': 'No customer records found in this batch.'}, status=status.HTTP_400_BAD_REQUEST)

        now = timezone.now()
        allocated_count = 0

        with transaction.atomic():
            for rec in batch_records:
                cust = rec.customer
                CustomerAssignment.objects.filter(
                    customer=cust,
                    status=AssignmentStatus.ACTIVE
                ).update(
                    status=AssignmentStatus.REASSIGNED,
                    unassigned_at=now,
                    reassignment_reason=f'Batch #{batch.id} allocated to {agent.username}'
                )

                CustomerAssignment.objects.create(
                    customer=cust,
                    assigned_agent=agent,
                    assigned_by=request.user,
                    status=AssignmentStatus.ACTIVE
                )
                allocated_count += 1

            batch.update_allocation_status()

            AuditLog.objects.create(
                user=request.user,
                action=AuditAction.ALLOCATE,
                entity_type='ImportBatch',
                entity_id=str(batch.id),
                after_values={
                    'batch_id': batch.id,
                    'agent': agent.username,
                    'allocated_count': allocated_count
                },
                reason=f"Allocated entire batch #{batch.id} ({allocated_count} customers) to {agent.username}"
            )

        return Response({
            'detail': f"Successfully allocated all {allocated_count} customers in Batch #{batch.id} to {agent.full_name or agent.username}.",
            'batch_id': batch.id,
            'agent_id': agent.id,
            'agent_name': agent.full_name or agent.username,
            'allocated_count': allocated_count,
            'allocation_status': batch.allocation_status
        })
