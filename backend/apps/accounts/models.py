from django.db import models
from django.contrib.auth.models import AbstractUser

class RoleChoices(models.TextChoices):
    ADMIN = 'ADMIN', 'System Administrator'
    SUPERVISOR = 'SUPERVISOR', 'Supervisor'
    AGENT = 'AGENT', 'D2D Agent'

class User(AbstractUser):
    role = models.CharField(
        max_length=20,
        choices=RoleChoices.choices,
        default=RoleChoices.AGENT,
        db_index=True
    )
    full_name = models.CharField(max_length=150, blank=True)
    phone_number = models.CharField(max_length=30, blank=True)
    supervisor = models.ForeignKey(
        'self',
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='supervised_agents',
        help_text="The supervisor managing this agent"
    )
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['username']

    def __str__(self):
        name = self.full_name or self.username
        return f"{name} ({self.get_role_display()})"

    @property
    def is_admin_user(self):
        return self.role == RoleChoices.ADMIN or self.is_superuser

    @property
    def is_supervisor_user(self):
        return self.role == RoleChoices.SUPERVISOR

    @property
    def is_agent_user(self):
        return self.role == RoleChoices.AGENT

    def save(self, *args, **kwargs):
        if not self.full_name and (self.first_name or self.last_name):
            self.full_name = f"{self.first_name} {self.last_name}".strip()
        super().save(*args, **kwargs)
