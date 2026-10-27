from django.db import models
from django.conf import settings

class RecordSource(models.TextChoices):
    SUPERVISOR_UPLOAD = 'SUPERVISOR_UPLOAD', 'Supervisor Excel Upload'
    AGENT_MANUAL = 'AGENT_MANUAL', 'Agent Manual Entry'

class ReviewStatus(models.TextChoices):
    APPROVED = 'APPROVED', 'Approved'
    PENDING_REVIEW = 'PENDING_REVIEW', 'Pending Review'
    REJECTED = 'REJECTED', 'Rejected'
    CORRECTION_REQUESTED = 'CORRECTION_REQUESTED', 'Correction Requested'

class Customer(models.Model):
    customer_id = models.CharField(
        max_length=60,
        unique=True,
        db_index=True,
        help_text="Authoritative unique DishHome Customer ID"
    )
    customer_name = models.CharField(max_length=150, blank=True)
    phone_number = models.CharField(max_length=50, blank=True)
    churn_days = models.IntegerField(default=0, help_text="Number of days since service churn")
    package = models.CharField(max_length=100, blank=True)
    record_source = models.CharField(
        max_length=30,
        choices=RecordSource.choices,
        default=RecordSource.SUPERVISOR_UPLOAD,
        db_index=True
    )
    review_status = models.CharField(
        max_length=30,
        choices=ReviewStatus.choices,
        default=ReviewStatus.APPROVED,
        db_index=True
    )
    review_notes = models.TextField(blank=True)
    created_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='created_customers'
    )
    created_at = models.DateTimeField(auto_now_add=True, db_index=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['-created_at']
        indexes = [
            models.Index(fields=['customer_id']),
            models.Index(fields=['record_source', 'review_status']),
            models.Index(fields=['churn_days']),
        ]

    def __str__(self):
        return f"{self.customer_id} - {self.customer_name or 'Unknown'}"

    @property
    def active_assignment(self):
        return self.assignments.filter(status='ACTIVE').select_related('assigned_agent').first()

    @property
    def current_assigned_agent(self):
        active = self.active_assignment
        return active.assigned_agent if active else None

    @property
    def latest_visit(self):
        return self.visits.order_by('-completed_at', '-created_at').first()

    @property
    def latest_followup(self):
        return self.followups.order_by('-follow_up_date', '-created_at').first()
