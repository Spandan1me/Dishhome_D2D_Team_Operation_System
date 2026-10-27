from django.http import HttpResponse
from django.utils import timezone
from rest_framework import views, status, generics
from rest_framework.response import Response
from rest_framework.parsers import MultiPartParser, FormParser
from django.db import transaction

from apps.accounts.permissions import IsSupervisorOrAdmin
from .models import ImportBatch, ImportStatus, AllocationStatus, CustomerBatchRecord
from .serializers import ImportBatchSerializer
from .services import generate_excel_template, parse_and_validate_file
from apps.customers.models import Customer, RecordSource, ReviewStatus
from apps.audit.models import AuditLog, AuditAction

class TemplateDownloadView(views.APIView):
    """
    Download the standard 5-column Excel upload template.
    Columns: Customer ID, Customer Name, Phone Number, No. of Churn Days, Package.
    """
    permission_classes = [IsSupervisorOrAdmin]

    def get(self, request):
        buffer = generate_excel_template()
        response = HttpResponse(
            buffer.getvalue(),
            content_type='application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
        )
        response['Content-Disposition'] = 'attachment; filename="DishHome_D2D_Upload_Template.xlsx"'
        return response

class UploadPreviewView(views.APIView):
    """
    Receives Excel/CSV file, validates rows against rules, detects duplicates,
    creates a PENDING ImportBatch, and returns preview data to the supervisor.
    """
    permission_classes = [IsSupervisorOrAdmin]
    parser_classes = [MultiPartParser, FormParser]

    def post(self, request):
        file_obj = request.FILES.get('file')
        if not file_obj:
            return Response({'detail': 'No file provided.'}, status=status.HTTP_400_BAD_REQUEST)

        filename = file_obj.name
        if not (filename.endswith('.xlsx') or filename.endswith('.xls') or filename.endswith('.csv')):
            return Response(
                {'detail': 'Unsupported file format. Please upload an Excel (.xlsx) file.'},
                status=status.HTTP_400_BAD_REQUEST
            )

        try:
            parsed = parse_and_validate_file(file_obj, filename)
        except Exception as e:
            return Response({'detail': str(e)}, status=status.HTTP_400_BAD_REQUEST)

        # Create pending batch
        batch = ImportBatch.objects.create(
            uploaded_by=request.user,
            filename=filename,
            total_rows=parsed['total_rows'],
            valid_rows=parsed['valid_count'],
            invalid_rows=parsed['invalid_count'],
            duplicate_rows=parsed['duplicate_count'],
            import_status=ImportStatus.PENDING,
            allocation_status=AllocationStatus.UNALLOCATED,
            error_summary={
                'errors': parsed['errors'],
                'duplicate_rows': parsed['duplicate_rows'],
                'cached_rows': parsed['all_valid_rows']
            }
        )

        return Response({
            'batch_id': batch.id,
            'filename': filename,
            'total_rows': parsed['total_rows'],
            'valid_rows': parsed['valid_count'],
            'invalid_rows': parsed['invalid_count'],
            'duplicate_rows': parsed['duplicate_count'],
            'preview_rows': parsed['preview_rows'],
            'errors': parsed['errors'],
            'duplicate_records': parsed['duplicate_rows']
        })

class ConfirmImportView(views.APIView):
    """
    Supervisor confirms the batch import.
    Creates or links Customer records, creates CustomerBatchRecords,
    marks ImportBatch as CONFIRMED, and optionally allocates the entire batch
    to a selected D2D agent in a single step.
    """
    permission_classes = [IsSupervisorOrAdmin]

    def post(self, request, pk):
        try:
            batch = ImportBatch.objects.get(pk=pk)
        except ImportBatch.DoesNotExist:
            return Response({'detail': 'Import batch not found.'}, status=status.HTTP_404_NOT_FOUND)

        if batch.import_status == ImportStatus.CONFIRMED:
            return Response({'detail': 'Batch has already been confirmed.'}, status=status.HTTP_400_BAD_REQUEST)

        cached_rows = batch.error_summary.get('cached_rows', []) if batch.error_summary else []
        if not cached_rows:
            return Response({'detail': 'No valid rows found in this batch to import.'}, status=status.HTTP_400_BAD_REQUEST)

        assigned_agent = None
        agent_id = request.data.get('agent_id')
        if agent_id:
            from apps.accounts.models import User, RoleChoices
            try:
                assigned_agent = User.objects.get(pk=agent_id, role=RoleChoices.AGENT, is_active=True)
                if not request.user.is_admin_user and assigned_agent.supervisor != request.user:
                    return Response({'detail': 'Selected agent does not belong to your team.'}, status=status.HTTP_403_FORBIDDEN)
            except User.DoesNotExist:
                return Response({'detail': 'Selected agent is invalid or inactive.'}, status=status.HTTP_400_BAD_REQUEST)

        created_count = 0
        existing_linked_count = 0
        now = timezone.now()

        with transaction.atomic():
            for row in cached_rows:
                cid = row['customer_id']
                customer, created = Customer.objects.get_or_create(
                    customer_id=cid,
                    defaults={
                        'customer_name': row.get('customer_name', ''),
                        'phone_number': row.get('phone_number', ''),
                        'churn_days': row.get('churn_days', 0),
                        'package': row.get('package', ''),
                        'record_source': RecordSource.SUPERVISOR_UPLOAD,
                        'review_status': ReviewStatus.APPROVED,
                        'created_by': request.user
                    }
                )

                if created:
                    created_count += 1
                else:
                    existing_linked_count += 1
                    # Update churn_days and package if changed in latest upload
                    customer.churn_days = row.get('churn_days', customer.churn_days)
                    if row.get('package'):
                        customer.package = row.get('package')
                    customer.save()

                # Link to batch record
                CustomerBatchRecord.objects.get_or_create(
                    customer=customer,
                    batch=batch,
                    defaults={
                        'imported_data_snapshot': row,
                        'created_from_batch': created,
                    }
                )

                # Direct batch allocation to selected agent if provided
                if assigned_agent:
                    from apps.allocations.models import CustomerAssignment, AssignmentStatus
                    CustomerAssignment.objects.filter(
                        customer=customer,
                        status=AssignmentStatus.ACTIVE
                    ).update(
                        status=AssignmentStatus.REASSIGNED,
                        unassigned_at=now,
                        reassignment_reason=f'Direct allocation on batch import #{batch.id}'
                    )
                    CustomerAssignment.objects.create(
                        customer=customer,
                        assigned_agent=assigned_agent,
                        assigned_by=request.user,
                        status=AssignmentStatus.ACTIVE
                    )

            batch.import_status = ImportStatus.CONFIRMED
            batch.allocation_status = AllocationStatus.FULLY_ALLOCATED if assigned_agent else AllocationStatus.UNALLOCATED
            # Clear large cached rows from summary to keep DB lean, preserve error report
            errors = batch.error_summary.get('errors', []) if batch.error_summary else []
            duplicates = batch.error_summary.get('duplicate_rows', []) if batch.error_summary else []
            batch.error_summary = {'errors': errors, 'duplicate_rows': duplicates}
            batch.save()

            log_reason = f"Confirmed import batch #{batch.id} ({created_count} new, {existing_linked_count} existing linked)"
            if assigned_agent:
                log_reason += f" and allocated all to {assigned_agent.username}"

            AuditLog.objects.create(
                user=request.user,
                action=AuditAction.IMPORT,
                entity_type='ImportBatch',
                entity_id=str(batch.id),
                after_values={
                    'batch_id': batch.id,
                    'created_customers': created_count,
                    'existing_linked': existing_linked_count,
                    'filename': batch.filename,
                    'allocated_to': assigned_agent.username if assigned_agent else None
                },
                reason=log_reason
            )

        allocated_msg = f" and allocated to {assigned_agent.full_name or assigned_agent.username}" if assigned_agent else ""
        return Response({
            'detail': f'Batch confirmed and imported successfully{allocated_msg}.',
            'batch_id': batch.id,
            'created_customers': created_count,
            'existing_linked': existing_linked_count,
            'total_imported': created_count + existing_linked_count,
            'ready_for_allocation': assigned_agent is None,
            'allocated_to_agent': assigned_agent.username if assigned_agent else None,
            'allocated_to_name': (assigned_agent.full_name or assigned_agent.username) if assigned_agent else None,
            'allocation_status': batch.allocation_status
        })

class ImportBatchListView(generics.ListAPIView):
    permission_classes = [IsSupervisorOrAdmin]
    serializer_class = ImportBatchSerializer

    def get_queryset(self):
        qs = ImportBatch.objects.all().select_related('uploaded_by')
        if not self.request.user.is_admin_user:
            qs = qs.filter(uploaded_by=self.request.user)
        return qs.order_by('-created_at')

class ImportBatchDetailView(views.APIView):
    permission_classes = [IsSupervisorOrAdmin]

    def get(self, request, pk):
        try:
            batch = ImportBatch.objects.select_related('uploaded_by').get(pk=pk)
        except ImportBatch.DoesNotExist:
            return Response({'detail': 'Batch not found.'}, status=status.HTTP_404_NOT_FOUND)

        data = ImportBatchSerializer(batch).data
        # Include list of customers in this batch
        records = batch.batch_records.select_related('customer').all()[:200]
        data['customers'] = [
            {
                'id': rec.customer.id,
                'customer_id': rec.customer.customer_id,
                'customer_name': rec.customer.customer_name,
                'phone_number': rec.customer.phone_number,
                'churn_days': rec.customer.churn_days,
                'package': rec.customer.package,
                'is_allocated': rec.customer.assignments.filter(status='ACTIVE').exists(),
                'assigned_agent': (
                    rec.customer.active_assignment.assigned_agent.full_name
                    if rec.customer.active_assignment else None
                )
            }
            for rec in records
        ]
        return Response(data)

    def delete(self, request, pk):
        try:
            batch = ImportBatch.objects.get(pk=pk)
        except ImportBatch.DoesNotExist:
            return Response({'detail': 'Batch not found.'}, status=status.HTTP_404_NOT_FOUND)

        if not request.user.is_admin_user and batch.uploaded_by_id != request.user.id:
            return Response(
                {'detail': 'You can only delete batches that you uploaded.'},
                status=status.HTTP_403_FORBIDDEN
            )

        with transaction.atomic():
            records = list(batch.batch_records.select_related('customer'))
            deleted_customer_ids = []
            preserved_customer_count = 0

            for record in records:
                customer = record.customer
                can_remove_customer = (
                    record.created_from_batch
                    and not customer.batch_records.exclude(batch=batch).exists()
                    and not customer.assignments.exists()
                    and not customer.visits.exists()
                    and not customer.followups.exists()
                )
                if can_remove_customer:
                    deleted_customer_ids.append(customer.id)
                else:
                    preserved_customer_count += 1

            if deleted_customer_ids:
                Customer.objects.filter(id__in=deleted_customer_ids).delete()

            batch_id = batch.id
            filename = batch.filename
            AuditLog.objects.create(
                user=request.user,
                action=AuditAction.DELETE,
                entity_type='ImportBatch',
                entity_id=str(batch_id),
                before_values={
                    'filename': filename,
                    'import_status': batch.import_status,
                    'customer_count': len(records),
                },
                after_values={
                    'deleted_customers': len(deleted_customer_ids),
                    'preserved_customers': preserved_customer_count,
                },
                reason=f"Deleted uploaded batch #{batch_id} ({filename})"
            )
            batch.delete()

        return Response({
            'detail': f"Batch #{batch_id} ({filename}) deleted.",
            'deleted_customers': len(deleted_customer_ids),
            'preserved_customers': preserved_customer_count,
        })
