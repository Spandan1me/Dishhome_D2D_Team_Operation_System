from django.db import models
from django.conf import settings

class AuditAction(models.TextChoices):
    LOGIN = 'LOGIN', 'Login'
    LOGOUT = 'LOGOUT', 'Logout'
    CREATE = 'CREATE', 'Create'
    UPDATE = 'UPDATE', 'Update'
    DELETE = 'DELETE', 'Delete'
    IMPORT = 'IMPORT', 'Excel Import'
    ALLOCATE = 'ALLOCATE', 'Customer Allocation'
    REASSIGN = 'REASSIGN', 'Customer Reassignment'
    VISIT_COMPLETE = 'VISIT_COMPLETE', 'Visit Completed'
    STATUS_CHANGE = 'STATUS_CHANGE', 'Status Changed'

class AuditLog(models.Model):
    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='audit_logs'
    )
    action = models.CharField(max_length=30, choices=AuditAction.choices, db_index=True)
    entity_type = models.CharField(max_length=50, db_index=True)
    entity_id = models.CharField(max_length=50, blank=True)
    before_values = models.JSONField(null=True, blank=True)
    after_values = models.JSONField(null=True, blank=True)
    reason = models.TextField(blank=True)
    ip_address = models.CharField(max_length=45, blank=True)
    timestamp = models.DateTimeField(auto_now_add=True, db_index=True)

    class Meta:
        ordering = ['-timestamp']
        indexes = [
            models.Index(fields=['entity_type', 'entity_id']),
            models.Index(fields=['action', 'timestamp']),
        ]

    def __str__(self):
        user_str = self.user.username if self.user else 'System'
        return f"[{self.timestamp:%Y-%m-%d %H:%M}] {user_str} - {self.action} on {self.entity_type} ({self.entity_id})"
