from rest_framework import permissions
from .models import RoleChoices

class IsAdminUserRole(permissions.BasePermission):
    def has_permission(self, request, view):
        return bool(request.user and request.user.is_authenticated and request.user.is_admin_user)

class IsSupervisorUserRole(permissions.BasePermission):
    def has_permission(self, request, view):
        return bool(
            request.user and request.user.is_authenticated and (
                request.user.is_supervisor_user or request.user.is_admin_user
            )
        )

class IsAgentUserRole(permissions.BasePermission):
    def has_permission(self, request, view):
        return bool(
            request.user and request.user.is_authenticated and (
                request.user.is_agent_user or request.user.is_admin_user
            )
        )

class IsSupervisorOrAdmin(permissions.BasePermission):
    def has_permission(self, request, view):
        return bool(
            request.user and request.user.is_authenticated and (
                request.user.is_supervisor_user or request.user.is_admin_user
            )
        )
