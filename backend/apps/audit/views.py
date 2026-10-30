from rest_framework import generics, status
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from apps.accounts.permissions import IsSupervisorOrAdmin
from .models import AuditLog
from .serializers import AuditLogSerializer

class AuditLogListView(generics.ListAPIView):
    """
    List audit logs. Available to supervisors and administrators.
    """
    permission_classes = [IsAuthenticated, IsSupervisorOrAdmin]
    serializer_class = AuditLogSerializer

    def get_queryset(self):
        qs = AuditLog.objects.select_related('user').all()
        entity_type = self.request.query_params.get('entity_type')
        action = self.request.query_params.get('action')
        search = self.request.query_params.get('search')

        if entity_type:
            qs = qs.filter(entity_type__iexact=entity_type)
        if action:
            qs = qs.filter(action=action)
        if search:
            qs = qs.filter(reason__icontains=search)

        return qs.order_by('-timestamp')


class AuditLogDetailView(generics.RetrieveDestroyAPIView):
    """Delete an individual audit log entry when a mistake needs to be corrected."""
    permission_classes = [IsAuthenticated, IsSupervisorOrAdmin]
    queryset = AuditLog.objects.select_related('user').all()
    serializer_class = AuditLogSerializer

    def delete(self, request, *args, **kwargs):
        instance = self.get_object()
        instance.delete()
        return Response({'detail': 'Audit log deleted successfully.'}, status=status.HTTP_200_OK)
