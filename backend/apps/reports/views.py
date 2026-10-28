import csv
from django.http import HttpResponse
from rest_framework import views, status
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated
from django.db.models import Count, Q

from apps.accounts.permissions import IsSupervisorOrAdmin
from apps.customers.models import Customer
from apps.allocations.models import CustomerAssignment
from apps.visits.models import VisitLog, FOLLOW_UP_REMARKS, SWITCHING_REASONS, SWITCHING_TO_ISPS
from apps.followups.models import FollowUp, FollowUpStatus
from apps.accounts.models import User, RoleChoices
from .services import (
    get_supervisor_dashboard_stats,
    get_agent_dashboard_stats,
    create_excel_report
)
from apps.audit.models import AuditLog, AuditAction

class DashboardStatsView(views.APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        user = request.user
        if user.is_agent_user:
            data = get_agent_dashboard_stats(user)
            return Response(data)
        else:
            data = get_supervisor_dashboard_stats(user)
            return Response(data)

class AllocationReportView(views.APIView):
    permission_classes = [IsSupervisorOrAdmin]

    def get(self, request):
        assignments = CustomerAssignment.objects.select_related(
            'customer', 'assigned_agent', 'assigned_by'
        ).all().order_by('-assigned_at')

        if not request.user.is_admin_user:
            assignments = assignments.all()

        agent_id = request.query_params.get('agent')
        if agent_id:
            assignments = assignments.filter(assigned_agent_id=agent_id)

        data = [
            {
                'customer_id': a.customer.customer_id,
                'customer_name': a.customer.customer_name,
                'phone_number': a.customer.phone_number,
                'churn_days': a.customer.churn_days,
                'package': a.customer.package,
                'record_source': a.customer.get_record_source_display(),
                'assigned_agent': a.assigned_agent.full_name or a.assigned_agent.username,
                'assigned_by': a.assigned_by.full_name if a.assigned_by else '',
                'assigned_at': a.assigned_at.strftime('%Y-%m-%d %H:%M'),
                'status': a.status
            }
            for a in assignments[:500]
        ]
        return Response(data)

class VisitFindingsReportView(views.APIView):
    permission_classes = [IsSupervisorOrAdmin]

    def get(self, request):
        visits = VisitLog.objects.select_related('customer', 'agent').all().order_by('-completed_at')

        if not request.user.is_admin_user:
            visits = visits.all()

        agent_id = request.query_params.get('agent')
        if agent_id:
            visits = visits.filter(agent_id=agent_id)

        status_val = request.query_params.get('status')
        if status_val:
            visits = visits.filter(visit_status=status_val)

        remark = request.query_params.get('remark')
        if remark:
            visits = visits.filter(follow_up_remark=remark)

        data = [
            {
                'customer_id': v.customer.customer_id,
                'customer_name': v.customer.customer_name,
                'phone_number': v.customer.phone_number,
                'churn_days': v.customer.churn_days,
                'package': v.customer.package,
                'agent_name': v.agent.full_name or v.agent.username,
                'visit_status': v.get_visit_status_display(),
                'follow_up_remark': v.follow_up_remark,
                'switching_reason': v.switching_reason,
                'switching_to': v.switching_to,
                'notes': v.notes,
                'gps_latitude': str(v.gps_latitude) if v.gps_latitude else '',
                'gps_longitude': str(v.gps_longitude) if v.gps_longitude else '',
                'gps_accuracy': v.gps_accuracy,
                'completed_at': v.completed_at.strftime('%Y-%m-%d %H:%M') if v.completed_at else '',
                'record_source': v.customer.get_record_source_display()
            }
            for v in visits[:500]
        ]
        return Response(data)

class AgentPerformanceReportView(views.APIView):
    permission_classes = [IsSupervisorOrAdmin]

    def get(self, request):
        agents = User.objects.filter(role=RoleChoices.AGENT, is_active=True)

        data = []
        for agent in agents:
            assigned_count = CustomerAssignment.objects.filter(assigned_agent=agent, status='ACTIVE').count()
            unique_visited = VisitLog.objects.filter(agent=agent, visit_status='COMPLETED').values('customer').distinct().count()
            total_visits = VisitLog.objects.filter(agent=agent).count()
            completed_followups = FollowUp.objects.filter(assigned_agent=agent, status=FollowUpStatus.COMPLETED).count()
            overdue_followups = FollowUp.objects.filter(assigned_agent=agent, status=FollowUpStatus.OVERDUE).count()
            gps_visits = VisitLog.objects.filter(agent=agent, gps_latitude__isnull=False).count()
            agent_added = Customer.objects.filter(created_by=agent, record_source='AGENT_MANUAL').count()

            data.append({
                'agent_id': agent.id,
                'agent_name': agent.full_name or agent.username,
                'username': agent.username,
                'phone_number': agent.phone_number,
                'assigned_count': assigned_count,
                'unique_visited': unique_visited,
                'total_visits': total_visits,
                'pending_customers': max(0, assigned_count - unique_visited),
                'completed_followups': completed_followups,
                'overdue_followups': overdue_followups,
                'gps_captured_visits': gps_visits,
                'agent_added_count': agent_added
            })
        return Response(data)

class ChurnAnalysisReportView(views.APIView):
    permission_classes = [IsSupervisorOrAdmin]

    def get(self, request):
        # Remark distribution
        remark_counts = (
            VisitLog.objects.values('follow_up_remark')
            .annotate(count=Count('id'))
            .order_by('-count')
        )

        # Switching reasons
        reason_counts = (
            VisitLog.objects.exclude(switching_reason='')
            .values('switching_reason')
            .annotate(count=Count('id'))
            .order_by('-count')
        )

        # Competitor ISPs
        isp_counts = (
            VisitLog.objects.exclude(switching_to='')
            .values('switching_to')
            .annotate(count=Count('id'))
            .order_by('-count')
        )

        # Churn days buckets
        churn_0_30 = Customer.objects.filter(churn_days__lte=30).count()
        churn_31_60 = Customer.objects.filter(churn_days__gt=30, churn_days__lte=60).count()
        churn_61_90 = Customer.objects.filter(churn_days__gt=60, churn_days__lte=90).count()
        churn_90_plus = Customer.objects.filter(churn_days__gt=90).count()

        return Response({
            'remark_counts': list(remark_counts),
            'switching_reasons': list(reason_counts),
            'competitor_isps': list(isp_counts),
            'churn_brackets': [
                {'bracket': '0 - 30 days', 'count': churn_0_30},
                {'bracket': '31 - 60 days', 'count': churn_31_60},
                {'bracket': '61 - 90 days', 'count': churn_61_90},
                {'bracket': '90+ days', 'count': churn_90_plus},
            ]
        })

class ExportReportView(views.APIView):
    """
    Exports filtered reports to Excel (.xlsx) or CSV.
    Supports report_type: 'allocations', 'visits', 'agents', 'churn'
    """
    permission_classes = [IsSupervisorOrAdmin]

    def get(self, request):
        report_type = request.query_params.get('report_type', 'allocations')
        export_format = request.query_params.get('file_format', 'excel')
        if export_format not in {'excel', 'csv'}:
            return Response(
                {'detail': 'Unsupported export format. Choose excel or csv.'},
                status=status.HTTP_400_BAD_REQUEST,
            )
        if report_type not in {'allocations', 'visits', 'agents', 'churn'}:
            return Response(
                {'detail': 'Unsupported report type.'},
                status=status.HTTP_400_BAD_REQUEST,
            )

        headers = []
        rows = []
        filename_prefix = "DishHome_D2D_Report"

        if report_type == 'allocations':
            filename_prefix = "Customer_Allocations"
            headers = [
                'Customer ID', 'Customer Name', 'Phone Number',
                'Churn Days', 'Package', 'Record Source',
                'Assigned Agent', 'Assigned By', 'Assigned At', 'Status'
            ]
            qs = CustomerAssignment.objects.select_related('customer', 'assigned_agent', 'assigned_by').all()
            if not request.user.is_admin_user:
                qs = qs.filter(assigned_agent__in=request.user.supervised_agents.all())
            agent_id = request.query_params.get('agent')
            if agent_id:
                qs = qs.filter(assigned_agent_id=agent_id)
            for a in qs:
                rows.append([
                    a.customer.customer_id,
                    a.customer.customer_name,
                    a.customer.phone_number,
                    a.customer.churn_days,
                    a.customer.package,
                    a.customer.get_record_source_display(),
                    a.assigned_agent.full_name or a.assigned_agent.username,
                    a.assigned_by.full_name if a.assigned_by else '',
                    a.assigned_at.strftime('%Y-%m-%d %H:%M'),
                    a.status
                ])

        elif report_type == 'visits':
            filename_prefix = "Visit_Findings"
            headers = [
                'Customer ID', 'Customer Name', 'Phone Number',
                'Churn Days', 'Package', 'Agent Name',
                'Visit Status', 'Follow-up Remark', 'Switching Reason',
                'Switching To', 'Notes', 'GPS Latitude', 'GPS Longitude',
                'Completed At', 'Record Source'
            ]
            qs = VisitLog.objects.select_related('customer', 'agent').all()
            if not request.user.is_admin_user:
                qs = qs.filter(agent__in=request.user.supervised_agents.all())
            for v in qs:
                rows.append([
                    v.customer.customer_id,
                    v.customer.customer_name,
                    v.customer.phone_number,
                    v.customer.churn_days,
                    v.customer.package,
                    v.agent.full_name or v.agent.username,
                    v.get_visit_status_display(),
                    v.follow_up_remark,
                    v.switching_reason,
                    v.switching_to,
                    v.notes,
                    str(v.gps_latitude) if v.gps_latitude else '',
                    str(v.gps_longitude) if v.gps_longitude else '',
                    v.completed_at.strftime('%Y-%m-%d %H:%M') if v.completed_at else '',
                    v.customer.get_record_source_display()
                ])

        elif report_type == 'agents':
            filename_prefix = "Agent_Performance"
            headers = [
                'Agent Name', 'Username', 'Phone Number',
                'Assigned Customers', 'Unique Visited', 'Total Visits',
                'Pending Customers', 'Follow-ups Completed', 'Overdue Follow-ups',
                'GPS Captured Visits', 'Agent-Added Customers'
            ]
            agents = User.objects.filter(role=RoleChoices.AGENT, is_active=True)
            if not request.user.is_admin_user:
                agents = agents.filter(supervisor=request.user)
            for agent in agents:
                assigned_count = CustomerAssignment.objects.filter(assigned_agent=agent, status='ACTIVE').count()
                unique_visited = VisitLog.objects.filter(agent=agent, visit_status='COMPLETED').values('customer').distinct().count()
                total_visits = VisitLog.objects.filter(agent=agent).count()
                completed_fu = FollowUp.objects.filter(assigned_agent=agent, status=FollowUpStatus.COMPLETED).count()
                overdue_fu = FollowUp.objects.filter(assigned_agent=agent, status=FollowUpStatus.OVERDUE).count()
                gps_visits = VisitLog.objects.filter(agent=agent, gps_latitude__isnull=False).count()
                agent_added = Customer.objects.filter(created_by=agent, record_source='AGENT_MANUAL').count()
                rows.append([
                    agent.full_name or agent.username,
                    agent.username,
                    agent.phone_number,
                    assigned_count,
                    unique_visited,
                    total_visits,
                    max(0, assigned_count - unique_visited),
                    completed_fu,
                    overdue_fu,
                    gps_visits,
                    agent_added
                ])

        # Audit the export action
        AuditLog.objects.create(
            user=request.user,
            action=AuditAction.CREATE,
            entity_type='ReportExport',
            entity_id=report_type,
            reason=f"Exported {report_type} report in {export_format.upper()} format ({len(rows)} records)"
        )

        if export_format == 'csv':
            response = HttpResponse(content_type='text/csv')
            response['Content-Disposition'] = f'attachment; filename="{filename_prefix}.csv"'
            writer = csv.writer(response)
            writer.writerow(headers)
            for r in rows:
                writer.writerow(r)
            return response
        else:
            buffer = create_excel_report(filename_prefix, headers, rows)
            response = HttpResponse(
                buffer.getvalue(),
                content_type='application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
            )
            response['Content-Disposition'] = f'attachment; filename="{filename_prefix}.xlsx"'
            return response
