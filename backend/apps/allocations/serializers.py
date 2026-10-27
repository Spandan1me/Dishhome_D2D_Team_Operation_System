from rest_framework import serializers
from .models import CustomerAssignment

class CustomerAssignmentSerializer(serializers.ModelSerializer):
    agent_name = serializers.ReadOnlyField(source='assigned_agent.full_name')
    agent_username = serializers.ReadOnlyField(source='assigned_agent.username')
    assigned_by_name = serializers.ReadOnlyField(source='assigned_by.full_name')

    class Meta:
        model = CustomerAssignment
        fields = [
            'id', 'customer', 'assigned_agent', 'agent_name',
            'agent_username', 'assigned_by', 'assigned_by_name',
            'status', 'reassignment_reason', 'assigned_at', 'unassigned_at'
        ]

class SingleAllocationSerializer(serializers.Serializer):
    customer_id = serializers.IntegerField(required=True)
    agent_id = serializers.IntegerField(required=True)
    batch_id = serializers.IntegerField(required=False, allow_null=True)

class BulkAllocationSerializer(serializers.Serializer):
    customer_ids = serializers.ListField(
        child=serializers.IntegerField(),
        allow_empty=False
    )
    agent_id = serializers.IntegerField(required=False, allow_null=True)
    agent_ids = serializers.ListField(
        child=serializers.IntegerField(),
        required=False,
        allow_empty=True
    )
    distribute_evenly = serializers.BooleanField(default=False)
    batch_id = serializers.IntegerField(required=False, allow_null=True)

    def validate(self, attrs):
        if not attrs.get('distribute_evenly'):
            if not attrs.get('agent_id'):
                raise serializers.ValidationError("agent_id is required when not distributing evenly.")
        else:
            if not attrs.get('agent_ids') or len(attrs['agent_ids']) == 0:
                raise serializers.ValidationError("agent_ids list is required for even distribution.")
        return attrs

class ReassignmentSerializer(serializers.Serializer):
    customer_id = serializers.IntegerField(required=True)
    new_agent_id = serializers.IntegerField(required=True)
    reason = serializers.CharField(required=True, min_length=3)
