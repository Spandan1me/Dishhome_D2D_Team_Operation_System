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

VISIT_REMARKS_STRUCTURE = [
    {
        "category": "Call not received/Not Connected",
        "remarks": [
            "Busy/ Not Available",
            "Wrong Number",
        ],
    },
    {
        "category": "Financial issue",
        "remarks": [
            "Will Recharge After Financial Arrangement",
            "Requested some time to arrange payment",
        ],
    },
    {
        "category": "Interested — Callback required",
        "remarks": [
            "Will recharge after 3 days",
            "Will recharge after 7 days",
            "Will recharge after 15 days",
            "Relocation required",
            "Extra benefit required",
            "Using sharing basis",
            "Due Out of Valley",
            "Due to drop wire charge policy",
        ],
    },
    {
        "category": "Ready To recharge",
        "remarks": [
            "Will recharge today",
            "Recharge done",
            "Package Upgrade/Recharge done",
            "Extra benefit required",
            "Using sharing basis",
            "Due Out of Valley",
            "Due to drop wire charge policy",
        ],
    },
    {
        "category": "Interested — Will recharge soon",
        "remarks": [
            "Will recharge after 3 days",
            "Will recharge after 7 days",
            "Will recharge after 15 days",
        ],
    },
    {
        "category": "Waiting for festival offer",
        "remarks": [
            "Extra benefit required",
            "Low bandwidth Package",
            "Cash discount",
            "BTL/ Special renew package price",
        ],
    },
    {
        "category": "Router Collection",
        "remarks": [
            "Poor Customer Support / Service Response",
            "Due to bad service",
            "Higher Price vs. Competitors",
            "Competitor's Better Offer",
            "Multiple Connection of DishHome Internet",
            "Not Ready to provide Router",
            "Customer wants additional offer",
            "Highly dissatisfied after price increment",
            "Network unavailable/relocation cancelled",
            "Out of valley / abroad",
        ],
        "remarks_1": [
            "Switched to other ISP",
            "Still not switched to other ISP",
        ],
        "isps": [
            "CG Net",
            "WorldLink",
            "Vainet",
            "Classic Tech",
            "Subisu",
            "NT Fiber",
            "Local ISP",
            "WiFi Nepal",
            "Not specified (another ISP)",
            "Date use",
            "Sharing basis",
            "Out of valley/home/abroad",
            "Internet not using",
        ],
    },
]

FOLLOW_UP_REMARKS = [
    remark
    for category in VISIT_REMARKS_STRUCTURE
    for remark in category['remarks']
]

ROUTER_COLLECTION_REMARKS_1 = [
    "Switched to other ISP",
    "Still not switched to other ISP",
]

ROUTER_COLLECTION_SWITCHED_ISPS = [
    "CG Net",
    "WorldLink",
    "Vainet",
    "Classic Tech",
    "Subisu",
    "NT Fiber",
    "Local ISP",
    "WiFi Nepal",
    "Not specified (another ISP)",
]

ROUTER_COLLECTION_NOT_SWITCHED_ISPS = [
    "Date use",
    "Sharing basis",
    "Out of valley/home/abroad",
    "Internet not using",
]

ROUTER_COLLECTION_ISPS = ROUTER_COLLECTION_SWITCHED_ISPS + ROUTER_COLLECTION_NOT_SWITCHED_ISPS
ROUTER_COLLECTION_ISP_OPTIONS = {
    'Switched to other ISP': ROUTER_COLLECTION_SWITCHED_ISPS,
    'Still not switched to other ISP': ROUTER_COLLECTION_NOT_SWITCHED_ISPS,
}

SWITCHING_REASONS = ROUTER_COLLECTION_REMARKS_1
SWITCHING_TO_ISPS = ROUTER_COLLECTION_ISPS

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
    visit_category = models.CharField(max_length=80, blank=True, default='', db_index=True)
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
