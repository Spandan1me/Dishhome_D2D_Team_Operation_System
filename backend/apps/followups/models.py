from django.db import models
from django.conf import settings
from django.utils import timezone

class FollowUpStatus(models.TextChoices):
    PENDING = 'PENDING', 'Pending'
    COMPLETED = 'COMPLETED', 'Completed'
    OVERDUE = 'OVERDUE', 'Overdue'
    CANCELLED = 'CANCELLED', 'Cancelled'

class FollowUp(models.Model):
    customer = models.ForeignKey(
        'customers.Customer',
        on_delete=models.CASCADE,
        related_name='followups'
    )
    related_visit = models.ForeignKey(
        'visits.VisitLog',
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='followups'
    )
    assigned_agent = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name='followups'
    )
    follow_up_date = models.DateField(db_index=True)
    status = models.CharField(
        max_length=20,
        choices=FollowUpStatus.choices,
        default=FollowUpStatus.PENDING,
        db_index=True
    )
    notes = models.TextField(blank=True)
    created_at = models.DateTimeField(auto_now_add=True, db_index=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['follow_up_date', '-created_at']
        indexes = [
            models.Index(fields=['assigned_agent', 'status']),
            models.Index(fields=['follow_up_date', 'status']),
        ]

    def __str__(self):
        return f"Follow-up on {self.customer.customer_id} by {self.assigned_agent.username} due {self.follow_up_date}"

    @property
    def is_overdue(self):
        return self.status == FollowUpStatus.PENDING and self.follow_up_date < timezone.localdate()
