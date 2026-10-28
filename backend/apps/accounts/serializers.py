from rest_framework import serializers
from django.contrib.auth import authenticate
from .models import User, RoleChoices

class UserSerializer(serializers.ModelSerializer):
    supervisor_name = serializers.ReadOnlyField(source='supervisor.full_name')
    assigned_customers_count = serializers.IntegerField(read_only=True, default=0)
    completed_visits_count = serializers.IntegerField(read_only=True, default=0)

    class Meta:
        model = User
        fields = [
            'id', 'username', 'email', 'full_name', 'phone_number',
            'role', 'supervisor', 'supervisor_name', 'is_active', 'created_at',
            'assigned_customers_count', 'completed_visits_count'
        ]
        read_only_fields = [
            'id', 'created_at', 'role', 'supervisor', 'is_active',
            'assigned_customers_count', 'completed_visits_count'
        ]


class ManagedUserCreateSerializer(serializers.ModelSerializer):
    password = serializers.CharField(write_only=True, min_length=6)
    role = serializers.ChoiceField(
        choices=[(RoleChoices.AGENT, 'D2D Agent'), (RoleChoices.SUPERVISOR, 'Supervisor')],
        required=False,
        default=RoleChoices.AGENT,
    )
    supervisor = serializers.PrimaryKeyRelatedField(
        queryset=User.objects.filter(role=RoleChoices.SUPERVISOR, is_active=True),
        required=False,
        allow_null=True,
    )

    class Meta:
        model = User
        fields = [
            'id', 'username', 'email', 'full_name', 'phone_number',
            'password', 'role', 'supervisor'
        ]

    def validate(self, attrs):
        request = self.context['request']
        if not request.user.is_admin_user:
            if attrs.get('role', RoleChoices.AGENT) != RoleChoices.AGENT:
                raise serializers.ValidationError({'role': 'Only administrators can create supervisors.'})
            if attrs.get('supervisor'):
                raise serializers.ValidationError({'supervisor': 'Only administrators can choose a supervisor.'})
        elif attrs.get('role', RoleChoices.AGENT) == RoleChoices.SUPERVISOR and attrs.get('supervisor'):
            raise serializers.ValidationError({'supervisor': 'A supervisor account cannot be assigned to another supervisor.'})
        return attrs

    def create(self, validated_data):
        request = self.context['request']
        role = validated_data.pop('role', RoleChoices.AGENT)
        supervisor = validated_data.pop('supervisor', None)
        if role == RoleChoices.AGENT and not request.user.is_admin_user:
            supervisor = request.user

        return User.objects.create_user(
            password=validated_data.pop('password'),
            role=role,
            supervisor=supervisor,
            **validated_data,
        )

class CreateAgentSerializer(serializers.ModelSerializer):
    password = serializers.CharField(write_only=True, min_length=6)

    class Meta:
        model = User
        fields = ['id', 'username', 'email', 'full_name', 'phone_number', 'password']

    def create(self, validated_data):
        user = User.objects.create_user(
            username=validated_data['username'],
            email=validated_data.get('email', ''),
            password=validated_data['password'],
            full_name=validated_data.get('full_name', ''),
            phone_number=validated_data.get('phone_number', ''),
            role=RoleChoices.AGENT,
            supervisor=self.context['request'].user
        )
        return user

class LoginSerializer(serializers.Serializer):
    username = serializers.CharField(required=True)
    password = serializers.CharField(required=True, write_only=True)

    def validate(self, attrs):
        username = attrs.get('username')
        password = attrs.get('password')

        # Allow logging in with username or email
        user = authenticate(username=username, password=password)
        if not user and username:
            # Try finding user by email safely without throwing MultipleObjectsReturned
            user_obj = User.objects.filter(email__iexact=username).exclude(email='').first()
            if user_obj:
                user = authenticate(username=user_obj.username, password=password)

        if not user:
            raise serializers.ValidationError('Invalid username or password.')
        if not user.is_active:
            raise serializers.ValidationError('This account has been deactivated.')

        attrs['user'] = user
        return attrs

class ChangePasswordSerializer(serializers.Serializer):
    old_password = serializers.CharField(required=True)
    new_password = serializers.CharField(required=True, min_length=6)

class ResetUserPasswordSerializer(serializers.Serializer):
    new_password = serializers.CharField(required=True, min_length=6)

class AgentListSerializer(serializers.ModelSerializer):
    pending_customers_count = serializers.IntegerField(read_only=True, default=0)
    assigned_customers_count = serializers.IntegerField(read_only=True, default=0)
    completed_visits_count = serializers.IntegerField(read_only=True, default=0)

    class Meta:
        model = User
        fields = [
            'id', 'username', 'full_name', 'phone_number', 'role',
            'supervisor', 'is_active',
            'pending_customers_count', 'assigned_customers_count', 'completed_visits_count'
        ]
