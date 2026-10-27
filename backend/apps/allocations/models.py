from django.db import models
from django.conf import settings

class AssignmentStatus(models.TextChoices):
    ACTIVE = 'ACTIVE', 'Active'
    REASSIGNED = 'REASSIGNED', 'Reassigned'
    UNASSIGNED = 'UNASSIGNED', 'Unassigned'

class CustomerAssignment(models.Model):
    customer = models.ForeignKey(
        'customers.Customer',
        on_delete=models.CASCADE,
        related_name='assignments'
    )
    assigned_agent = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name='assignments'
    )
    assigned_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        related_name='assigned_tasks'
    )
    status = models.CharField(
        max_length=20,
        choices=AssignmentStatus.choices,
        default=AssignmentStatus.ACTIVE,
        db_index=True
    )
    reassignment_reason = models.TextField(blank=True)
    assigned_at = models.DateTimeField(auto_now_add=True, db_index=True)
    unassigned_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        ordering = ['-assigned_at']
        indexes = [
            models.Index(fields=['customer', 'status']),
            models.Index(fields=['assigned_agent', 'status']),
            models.Index(fields=['assigned_at']),
        ]
        constraints = [
            models.UniqueConstraint(
                fields=['customer'],
                condition=models.Q(status='ACTIVE'),
                name='unique_active_assignment_per_customer'
            )
        ]

    def __str__(self):
        return f"{self.customer.customer_id} -> {self.assigned_agent.username} ({self.status})"
