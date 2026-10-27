from rest_framework import serializers
from .models import Customer, RecordSource, ReviewStatus

class CustomerListSerializer(serializers.ModelSerializer):
    assigned_agent_name = serializers.SerializerMethodField()
    assigned_agent_id = serializers.SerializerMethodField()
    latest_visit_status = serializers.SerializerMethodField()
    latest_visit_date = serializers.SerializerMethodField()
    latest_followup_date = serializers.SerializerMethodField()
    created_by_name = serializers.ReadOnlyField(source='created_by.full_name')

    class Meta:
        model = Customer
        fields = [
            'id', 'customer_id', 'customer_name', 'phone_number',
            'churn_days', 'package', 'record_source', 'review_status',
            'review_notes', 'assigned_agent_id', 'assigned_agent_name',
            'latest_visit_status', 'latest_visit_date', 'latest_followup_date',
            'created_by_name', 'created_at', 'updated_at'
        ]

    def get_assigned_agent_name(self, obj):
        agent = obj.current_assigned_agent
        return agent.full_name or agent.username if agent else None

    def get_assigned_agent_id(self, obj):
        agent = obj.current_assigned_agent
        return agent.id if agent else None

    def get_latest_visit_status(self, obj):
        visit = obj.latest_visit
        return visit.visit_status if visit else None

    def get_latest_visit_date(self, obj):
        visit = obj.latest_visit
        return visit.completed_at or visit.created_at if visit else None

    def get_latest_followup_date(self, obj):
        fu = obj.latest_followup
        return fu.follow_up_date if fu else None

class ManualCustomerCreateSerializer(serializers.ModelSerializer):
    additional_notes = serializers.CharField(required=False, allow_blank=True, write_only=True)

    class Meta:
        model = Customer
        fields = [
            'id', 'customer_id', 'customer_name', 'phone_number',
            'churn_days', 'package', 'additional_notes'
        ]

    def validate_customer_id(self, value):
        cleaned_id = str(value).strip()
        if not cleaned_id:
            raise serializers.ValidationError("Customer ID is required.")
        if Customer.objects.filter(customer_id__iexact=cleaned_id).exists():
            raise serializers.ValidationError(
                f"Customer ID '{cleaned_id}' already exists in the system."
            )
        return cleaned_id

    def validate_churn_days(self, value):
        if value is not None and value < 0:
            raise serializers.ValidationError("Churn days cannot be negative.")
        return value or 0

class CustomerReviewActionSerializer(serializers.Serializer):
    action = serializers.ChoiceField(choices=['APPROVE', 'REJECT', 'CORRECTION_REQUESTED'])
    review_notes = serializers.CharField(required=False, allow_blank=True)
