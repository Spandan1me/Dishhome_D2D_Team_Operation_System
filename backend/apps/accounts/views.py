from rest_framework import status, views, viewsets
from rest_framework.response import Response
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.authtoken.models import Token
from django.db.models import Count, Q

from .models import User, RoleChoices
from .permissions import IsSupervisorOrAdmin, IsSupervisorUserRole, IsAdminUserRole
from .serializers import (
    UserSerializer,
    LoginSerializer,
    ChangePasswordSerializer,
    AgentListSerializer,
    ManagedUserCreateSerializer,
)

class LoginView(views.APIView):
    permission_classes = [AllowAny]

    def post(self, request):
        serializer = LoginSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        user = serializer.validated_data['user']
        token, _ = Token.objects.get_or_create(user=user)

        # Audit login action if audit app is ready
        try:
            from apps.audit.models import AuditLog, AuditAction
            AuditLog.objects.create(
                user=user,
                action=AuditAction.LOGIN,
                entity_type='User',
                entity_id=str(user.id),
                reason='User logged in successfully'
            )
        except Exception:
            pass

        return Response({
            'token': token.key,
            'user': UserSerializer(user).data
        })

class LogoutView(views.APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request):
        try:
            Token.objects.filter(user=request.user).delete()
        except Exception:
            pass

        try:
            from apps.audit.models import AuditLog, AuditAction
            AuditLog.objects.create(
                user=request.user,
                action=AuditAction.LOGOUT,
                entity_type='User',
                entity_id=str(request.user.id),
                reason='User logged out'
            )
        except Exception:
            pass

        return Response({'detail': 'Successfully logged out.'})

class MeView(views.APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        return Response(UserSerializer(request.user).data)

class ChangePasswordView(views.APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request):
        serializer = ChangePasswordSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        user = request.user
        if not user.check_password(serializer.validated_data['old_password']):
            return Response({'old_password': ['Wrong password.']}, status=status.HTTP_400_BAD_REQUEST)
        user.set_password(serializer.validated_data['new_password'])
        user.save()
        return Response({'detail': 'Password changed successfully.'})

class EligibleAgentsView(views.APIView):
    """
    Returns active D2D agents eligible for assignment.
    Supervisors only see active agents supervised by them.
    Admins see all active agents.
    """
    permission_classes = [IsSupervisorOrAdmin]

    def get(self, request):
        qs = User.objects.filter(role=RoleChoices.AGENT, is_active=True)
        if not request.user.is_admin_user:
            qs = qs.filter(supervisor=request.user)

        # Annotate with active pending assignments
        qs = qs.annotate(
            assigned_customers_count=Count(
                'assignments',
                filter=Q(assignments__status='ACTIVE'),
                distinct=True
            ),
            completed_visits_count=Count(
                'visits',
                filter=Q(visits__visit_status='COMPLETED'),
                distinct=True
            )
        )
        serializer = AgentListSerializer(qs, many=True)
        return Response(serializer.data)

from rest_framework.decorators import action
from django.db import transaction
from django.utils import timezone

class AgentManagementViewSet(viewsets.ModelViewSet):
    """Manage a supervisor's agents or, for admins, all agents and supervisors."""
    permission_classes = [IsSupervisorOrAdmin]
    serializer_class = UserSerializer

    def get_serializer_class(self):
        if self.action == 'create':
            return ManagedUserCreateSerializer
        return UserSerializer

    def get_queryset(self):
        if self.request.user.is_admin_user:
            qs = User.objects.filter(role__in=[RoleChoices.AGENT, RoleChoices.SUPERVISOR])
            role_filter = self.request.query_params.get('role')
            if role_filter:
                qs = qs.filter(role=role_filter)
        else:
            qs = User.objects.filter(role=RoleChoices.AGENT, supervisor=self.request.user)
        return qs.annotate(
            assigned_customers_count=Count(
                'assignments',
                filter=Q(assignments__status='ACTIVE'),
                distinct=True
            ),
            completed_visits_count=Count(
                'visits',
                filter=Q(visits__visit_status='COMPLETED'),
                distinct=True
            )
        ).order_by('-created_at')

    def create(self, request, *args, **kwargs):
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        managed_user = serializer.save()

        try:
            from apps.audit.models import AuditLog, AuditAction
            AuditLog.objects.create(
                user=request.user,
                action=AuditAction.CREATE,
                entity_type='User',
                entity_id=str(managed_user.id),
                after_values={
                    'username': managed_user.username,
                    'full_name': managed_user.full_name,
                    'role': managed_user.role,
                },
                reason=f"Created {managed_user.get_role_display().lower()} account {managed_user.username}"
            )
        except Exception:
            pass

        return Response(UserSerializer(managed_user).data, status=status.HTTP_201_CREATED)

    @action(detail=True, methods=['post'], url_path='toggle-active')
    def toggle_active(self, request, pk=None):
        managed_user = self.get_object()
        if managed_user.is_superuser or managed_user.role == RoleChoices.ADMIN or managed_user == request.user:
            return Response(
                {'detail': 'Administrator accounts and your own account cannot be deactivated here.'},
                status=status.HTTP_400_BAD_REQUEST
            )
        if not request.user.is_admin_user and (
            managed_user.role != RoleChoices.AGENT or managed_user.supervisor != request.user
        ):
            return Response(
                {'detail': 'You can only manage agents created under your supervision.'},
                status=status.HTTP_403_FORBIDDEN
            )

        old_status = managed_user.is_active
        managed_user.is_active = not old_status
        managed_user.save(update_fields=['is_active', 'updated_at'])

        status_text = "activated" if managed_user.is_active else "deactivated"

        try:
            from apps.audit.models import AuditLog, AuditAction
            AuditLog.objects.create(
                user=request.user,
                action=AuditAction.STATUS_CHANGE,
                entity_type='User',
                entity_id=str(managed_user.id),
                before_values={'is_active': old_status},
                after_values={'is_active': managed_user.is_active},
                reason=f"{status_text.capitalize()} user {managed_user.username}"
            )
        except Exception:
            pass

        return Response({
            'detail': f"User '{managed_user.username}' {status_text} successfully.",
            'is_active': managed_user.is_active,
            'user': UserSerializer(managed_user).data
        })

    def destroy(self, request, *args, **kwargs):
        managed_user = self.get_object()
        if managed_user.is_superuser or managed_user.role == RoleChoices.ADMIN or managed_user == request.user:
            return Response(
                {'detail': 'Administrator accounts and your own account cannot be deleted here.'},
                status=status.HTTP_400_BAD_REQUEST
            )
        if not request.user.is_admin_user and (
            managed_user.role != RoleChoices.AGENT or managed_user.supervisor != request.user
        ):
            return Response(
                {'detail': 'You can only delete agents created under your supervision.'},
                status=status.HTTP_403_FORBIDDEN
            )

        has_visits = managed_user.visits.exists()
        force = request.query_params.get('force') == 'true'

        if has_visits and not force:
            return Response({
                'detail': f"User '{managed_user.username}' has {managed_user.visits.count()} visit logs. It is recommended to deactivate this account instead. If you still wish to permanently delete, confirm permanent deletion.",
                'has_visits': True,
                'visit_count': managed_user.visits.count()
            }, status=status.HTTP_400_BAD_REQUEST)

        username = managed_user.username
        user_id = managed_user.id
        role_name = managed_user.get_role_display().lower()

        with transaction.atomic():
            from apps.allocations.models import CustomerAssignment, AssignmentStatus
            CustomerAssignment.objects.filter(
                assigned_agent=managed_user,
                status=AssignmentStatus.ACTIVE
            ).update(
                status=AssignmentStatus.UNASSIGNED,
                unassigned_at=timezone.now(),
                reassignment_reason=f"Assigned user '{username}' was deleted"
            )

            try:
                from apps.audit.models import AuditLog, AuditAction
                AuditLog.objects.create(
                    user=request.user,
                    action=AuditAction.DELETE,
                    entity_type='User',
                    entity_id=str(user_id),
                    before_values={
                        'username': username,
                        'full_name': managed_user.full_name,
                        'role': managed_user.role,
                    },
                    reason=f"Deleted {role_name} account {username} (ID: {user_id})"
                )
            except Exception:
                pass

            managed_user.delete()

        return Response({
            'detail': f"User '{username}' deleted successfully."
        }, status=status.HTTP_200_OK)
