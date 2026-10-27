from django.db import models
from django.conf import settings
from uuid import uuid4


def visit_evidence_upload_path(instance, filename):
    extension = filename.rsplit('.', 1)[-1].lower()
    return f'visit-evidence/{instance.agent_id}/{uuid4().hex}.{extension}'

class VisitStatus(models.TextChoices):
    PENDING = 'PENDING', 'Pending'
    IN_PROGRESS = 'IN_PROGRESS', 'In Progress'
    COMPLETED = 'COMPLETED', 'Completed'
    CUSTOMER_NOT_FOUND = 'CUSTOMER_NOT_FOUND', 'Customer Not Found'
    UNABLE_TO_REACH = 'UNABLE_TO_REACH', 'Unable to Reach'
    FOLLOW_UP_REQUIRED = 'FOLLOW_UP_REQUIRED', 'Follow-up Required'

# 19 exact business remarks
FOLLOW_UP_REMARKS = [
    "Call not received",
    "Connected",
    "Busy - Call back later",
    "Interested - Will recharge soon",
    "Ready to recharge",
    "Ready to recharge within 3 days",
    "Ready to recharge within 7 days",
    "Interested - Callback required",
    "Financial issue",
    "Waiting for festival offer",
    "Router refund in process",
    "Non-fibernet user (Invalid KYC)",
    "Denied - Higher pricing than other ISPs",
    "Highly dissatisfied after price increment",
    "Denied - Poor service",
    "Multiple DishHome Internet connections",
    "Switching to another ISP",
    "Credit done",
    "Customer wants additional offer",
]

# 9 exact switching reasons
SWITCHING_REASONS = [
    "High package price of DH",
    "Low package price than ours",
    "Better Service Quality",
    "Network unavailable/relocation cancelled",
    "Drop Wire Charge Policy",
    "Multiple connection",
    "Using Customer's Relative Internet",
    "Better Offers",
    "Due to bad service",
]

# 9 exact competitor ISPs
SWITCHING_TO_ISPS = [
    "Worldlink",
    "NT Fiber",
    "CG net",
    "Vianet",
    "Classic tech",
    "Sky tv",
    "Local net",
    "smart link",
    "Wifi Nepal",
]

class VisitLog(models.Model):
    customer = models.ForeignKey(
        'customers.Customer',
        on_delete=models.CASCADE,
        related_name='visits'
    )
    agent = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name='visits'
    )
    visit_status = models.CharField(
        max_length=30,
        choices=VisitStatus.choices,
        default=VisitStatus.COMPLETED,
        db_index=True
    )
    follow_up_remark = models.CharField(max_length=100, db_index=True)
    switching_reason = models.CharField(max_length=100, blank=True)
    switching_to = models.CharField(max_length=50, blank=True)
    notes = models.TextField(blank=True)
    photo = models.ImageField(upload_to=visit_evidence_upload_path, blank=True, null=True)
    video = models.FileField(upload_to=visit_evidence_upload_path, blank=True, null=True)

    # GPS coordinates captured at visit completion
    gps_latitude = models.DecimalField(max_digits=10, decimal_places=7, null=True, blank=True)
    gps_longitude = models.DecimalField(max_digits=10, decimal_places=7, null=True, blank=True)
    gps_accuracy = models.FloatField(null=True, blank=True, help_text="Accuracy in meters")
    gps_captured_at = models.DateTimeField(null=True, blank=True)

    completed_at = models.DateTimeField(null=True, blank=True, db_index=True)
    created_at = models.DateTimeField(auto_now_add=True, db_index=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['-completed_at', '-created_at']
        indexes = [
            models.Index(fields=['customer', 'completed_at']),
            models.Index(fields=['agent', 'visit_status']),
            models.Index(fields=['follow_up_remark']),
            models.Index(fields=['switching_reason']),
            models.Index(fields=['switching_to']),
        ]

    def __str__(self):
        return f"Visit on {self.customer.customer_id} by {self.agent.username} [{self.visit_status}]"

    @property
    def has_gps(self):
        return self.gps_latitude is not None and self.gps_longitude is not None


class VisitEvidenceUpload(models.Model):
    agent = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name='pending_visit_evidence',
    )
    customer = models.ForeignKey(
        'customers.Customer',
        on_delete=models.CASCADE,
        related_name='pending_visit_evidence',
    )
    photo = models.ImageField(upload_to=visit_evidence_upload_path, blank=True, null=True)
    video = models.FileField(upload_to=visit_evidence_upload_path, blank=True, null=True)
    created_at = models.DateTimeField(auto_now_add=True, db_index=True)
