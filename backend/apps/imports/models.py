from django.db import models
from django.conf import settings

class ImportStatus(models.TextChoices):
    PENDING = 'PENDING', 'Pending Confirmation'
    CONFIRMED = 'CONFIRMED', 'Confirmed & Imported'
    FAILED = 'FAILED', 'Failed'

class AllocationStatus(models.TextChoices):
    UNALLOCATED = 'UNALLOCATED', 'Unallocated'
    PARTIALLY_ALLOCATED = 'PARTIALLY_ALLOCATED', 'Partially Allocated'
    FULLY_ALLOCATED = 'FULLY_ALLOCATED', 'Fully Allocated'

class ImportBatch(models.Model):
    uploaded_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        related_name='uploaded_batches'
    )
    filename = models.CharField(max_length=255)
    total_rows = models.IntegerField(default=0)
    valid_rows = models.IntegerField(default=0)
    invalid_rows = models.IntegerField(default=0)
    duplicate_rows = models.IntegerField(default=0)
    import_status = models.CharField(
        max_length=20,
        choices=ImportStatus.choices,
        default=ImportStatus.PENDING,
        db_index=True
    )
    allocation_status = models.CharField(
        max_length=30,
        choices=AllocationStatus.choices,
        default=AllocationStatus.UNALLOCATED,
        db_index=True
    )
    error_summary = models.JSONField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True, db_index=True)

    class Meta:
        ordering = ['-created_at']

    def __str__(self):
        return f"Batch #{self.id} - {self.filename} ({self.get_import_status_display()})"

    def update_allocation_status(self):
        """Calculates and updates whether batch customers are all allocated."""
        total_customers = self.batch_records.count()
        if total_customers == 0:
            return

        allocated_count = 0
        for rec in self.batch_records.select_related('customer').all():
            if rec.customer.assignments.filter(status='ACTIVE').exists():
                allocated_count += 1

        if allocated_count == 0:
            self.allocation_status = AllocationStatus.UNALLOCATED
        elif allocated_count >= total_customers:
            self.allocation_status = AllocationStatus.FULLY_ALLOCATED
        else:
            self.allocation_status = AllocationStatus.PARTIALLY_ALLOCATED
        self.save(update_fields=['allocation_status'])

class CustomerBatchRecord(models.Model):
    customer = models.ForeignKey(
        'customers.Customer',
        on_delete=models.CASCADE,
        related_name='batch_records'
    )
    batch = models.ForeignKey(
        ImportBatch,
        on_delete=models.CASCADE,
        related_name='batch_records'
    )
    imported_data_snapshot = models.JSONField(null=True, blank=True)
    created_from_batch = models.BooleanField(default=False)
    imported_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['-imported_at']
        indexes = [
            models.Index(fields=['customer', 'batch']),
        ]

    def __str__(self):
        return f"{self.customer.customer_id} in Batch #{self.batch_id}"
