from rest_framework import serializers
from .models import ImportBatch, CustomerBatchRecord

class ImportBatchSerializer(serializers.ModelSerializer):
    uploaded_by_name = serializers.ReadOnlyField(source='uploaded_by.full_name')

    class Meta:
        model = ImportBatch
        fields = [
            'id', 'uploaded_by', 'uploaded_by_name', 'filename',
            'total_rows', 'valid_rows', 'invalid_rows', 'duplicate_rows',
            'import_status', 'allocation_status', 'error_summary', 'created_at'
        ]

class CustomerBatchRecordSerializer(serializers.ModelSerializer):
    customer_id = serializers.ReadOnlyField(source='customer.customer_id')
    customer_name = serializers.ReadOnlyField(source='customer.customer_name')
    phone_number = serializers.ReadOnlyField(source='customer.phone_number')
    churn_days = serializers.ReadOnlyField(source='customer.churn_days')
    package = serializers.ReadOnlyField(source='customer.package')

    class Meta:
        model = CustomerBatchRecord
        fields = [
            'id', 'customer', 'customer_id', 'customer_name',
            'phone_number', 'churn_days', 'package', 'batch', 'imported_at'
        ]
