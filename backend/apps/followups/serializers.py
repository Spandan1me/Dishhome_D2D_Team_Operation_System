from rest_framework import serializers
from .models import FollowUp, FollowUpStatus

class FollowUpSerializer(serializers.ModelSerializer):
    customer_id = serializers.ReadOnlyField(source='customer.id')
    customer_code = serializers.ReadOnlyField(source='customer.customer_id')
    customer_name = serializers.ReadOnlyField(source='customer.customer_name')
    phone_number = serializers.ReadOnlyField(source='customer.phone_number')
    package = serializers.ReadOnlyField(source='customer.package')
    agent_name = serializers.ReadOnlyField(source='assigned_agent.full_name')
    agent_username = serializers.ReadOnlyField(source='assigned_agent.username')
    remark = serializers.ReadOnlyField(source='related_visit.follow_up_remark')

    class Meta:
        model = FollowUp
        fields = [
            'id', 'customer', 'customer_id', 'customer_code',
            'customer_name', 'phone_number', 'package',
            'related_visit', 'remark', 'assigned_agent',
            'agent_name', 'agent_username', 'follow_up_date',
            'status', 'notes', 'created_at', 'updated_at'
        ]

class FollowUpStatusUpdateSerializer(serializers.Serializer):
    status = serializers.ChoiceField(choices=FollowUpStatus.choices)
    notes = serializers.CharField(required=False, allow_blank=True)
