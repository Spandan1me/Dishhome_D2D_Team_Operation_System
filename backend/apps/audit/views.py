from rest_framework import generics
from rest_framework.permissions import IsAuthenticated
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
