from rest_framework import serializers
from .models import AuditLog

class AuditLogSerializer(serializers.ModelSerializer):
    user_name = serializers.ReadOnlyField(source='user.full_name')
    username = serializers.ReadOnlyField(source='user.username')

    class Meta:
        model = AuditLog
        fields = [
            'id', 'user', 'username', 'user_name', 'action',
            'entity_type', 'entity_id', 'before_values',
            'after_values', 'reason', 'ip_address', 'timestamp'
        ]
