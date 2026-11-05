import csv
from django.http import HttpResponse
from rest_framework import views, status
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated
from django.db.models import Count, Q

from apps.accounts.permissions import IsSupervisorOrAdmin
from apps.customers.models import Customer
from apps.allocations.models import CustomerAssignment
from apps.visits.models import (
    VisitLog,
    FOLLOW_UP_REMARKS,
    SWITCHING_REASONS,
    SWITCHING_TO_ISPS,
    VISIT_REMARKS_STRUCTURE,
)
from apps.followups.models import FollowUp, FollowUpStatus
from apps.accounts.models import User, RoleChoices
from .services import (
    get_supervisor_dashboard_stats,
    get_agent_dashboard_stats,
    create_excel_report,
    normalize_export_value,
)
from apps.audit.models import AuditLog, AuditAction

OTHER_ISP_SWITCH_REASON_COLUMNS = [
    'Busy / Not Available',
    "Competitor's Better Offer",
    'Customer wants additional offer',
    'Due to bad service',
    'Higher Price vs. Competitors',
    'Highly dissatisfied after price increment',
    'Multiple Connection of DishHome Internet',
    'Network unavailable / e-relocation cancelled',
    'Poor Customer Support / Service Response',
    'Out of valley / abroad',
]

OTHER_ISP_SWITCH_ROWS = [
    'WorldLink',
    'CG Net',
    'NT Fiber',
    'Lead',
    'Not specified (another ISP)',
    'Classic Tech',
    'Not in use',
    'Vianet',
    'Subisu',
]

VISIT_SUMMARY_CATEGORIES = [
    'Interested — Will recharge soon',
    'Call not received/Not Connected',
    'Router Collection',
    'Interested — Callback required',
    'Waiting for festival offer',
    'Financial issue',
    'Ready To Recharge',
]


def normalize_other_isp_name(value):
    if value is None:
        return ''
    normalized = str(value).strip()
    aliases = {
        'worldlink': 'WorldLink',
        'cg net': 'CG Net',
        'nt fiber': 'NT Fiber',
        'not specified (another isp)': 'Not specified (another ISP)',
        'classic tech': 'Classic Tech',
        'classictech': 'Classic Tech',
        'not in use': 'Not in use',
        'vianet': 'Vianet',
        'subisu': 'Subisu',
        'lead': 'Lead',
    }
    return aliases.get(normalized.lower(), normalized)


def normalize_summary_reason_name(value):
    if value is None:
        return ''
    normalized = str(value).strip()
    aliases = {
        'busy/ not available': 'Busy / Not Available',
        'busy / not available': 'Busy / Not Available',
        "competitor's better offer": "Competitor's Better Offer",
        'customer wants additional offer': 'Customer wants additional offer',
        'due to bad service': 'Due to bad service',
        'higher price vs. competitors': 'Higher Price vs. Competitors',
        'higher price vs competitors': 'Higher Price vs. Competitors',
        'highly dissatisfied after price increment': 'Highly dissatisfied after price increment',
        'multiple connection of dishhome internet': 'Multiple Connection of DishHome Internet',
        'network unavailable/relocation cancelled': 'Network unavailable / e-relocation cancelled',
        'network unavailable / e-relocation cancelled': 'Network unavailable / e-relocation cancelled',
        'poor customer support / service response': 'Poor Customer Support / Service Response',
        'out of valley / abroad': 'Out of valley / abroad',
    }
    return aliases.get(normalized.lower(), normalized)


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
                'pod_station': a.customer.pod_station,
                'pod': a.customer.pod,
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

        category = request.query_params.get('category')
        if category:
            visits = visits.filter(visit_category=category)

        remark = request.query_params.get('remark')
        if remark:
            visits = visits.filter(follow_up_remark=remark)

        remarks_1 = request.query_params.get('remarks_1') or request.query_params.get('switching_reason')
        if remarks_1:
            visits = visits.filter(switching_reason=remarks_1)

        isp = request.query_params.get('isp') or request.query_params.get('switching_to')
        if isp:
            visits = visits.filter(switching_to=isp)

        date_from = request.query_params.get('date_from')
        if date_from:
            visits = visits.filter(completed_at__date__gte=date_from)

        date_to = request.query_params.get('date_to')
        if date_to:
            visits = visits.filter(completed_at__date__lte=date_to)

        data = [
            {
                'customer_id': v.customer.customer_id,
                'customer_name': v.customer.customer_name,
                'phone_number': v.customer.phone_number,
                'churn_days': v.customer.churn_days,
                'package': v.customer.package,
                'pod_station': v.customer.pod_station,
                'pod': v.customer.pod,
                'agent_name': v.agent.full_name or v.agent.username,
                'visit_status': v.get_visit_status_display(),
                'visit_category': v.visit_category,
                'collection_type': v.collection_type,
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

        visit_summary_counts = {
            category: 0 for category in VISIT_SUMMARY_CATEGORIES
        }
        for item in VisitLog.objects.values('visit_category').annotate(count=Count('id')):
            category = item.get('visit_category', '')
            if category in visit_summary_counts:
                visit_summary_counts[category] = item['count']

        visit_summary = [
            {'category': category, 'total': visit_summary_counts.get(category, 0)}
            for category in VISIT_SUMMARY_CATEGORIES
        ]
        total_visit_summary = sum(item['total'] for item in visit_summary)
        visit_summary.append({'category': 'Total', 'total': total_visit_summary})

        other_isp_rows = []
        other_isp_totals = [0 for _ in OTHER_ISP_SWITCH_REASON_COLUMNS]
        reason_matrix = {
            isp: {column: 0 for column in OTHER_ISP_SWITCH_REASON_COLUMNS}
            for isp in OTHER_ISP_SWITCH_ROWS
        }

        for visit in VisitLog.objects.exclude(switching_to='').exclude(follow_up_remark=''):
            normalized_isp = normalize_other_isp_name(visit.switching_to)
            if normalized_isp not in reason_matrix:
                continue
            normalized_reason = normalize_summary_reason_name(visit.follow_up_remark)
            if normalized_reason not in OTHER_ISP_SWITCH_REASON_COLUMNS:
                continue
            reason_matrix[normalized_isp][normalized_reason] += 1

        for isp in OTHER_ISP_SWITCH_ROWS:
            values = [reason_matrix[isp][column] for column in OTHER_ISP_SWITCH_REASON_COLUMNS]
            row_total = sum(values)
            for idx, value in enumerate(values):
                other_isp_totals[idx] += value
            other_isp_rows.append({'isp': isp, 'values': values, 'total': row_total})

        other_isp_switch_reason = {
            'columns': OTHER_ISP_SWITCH_REASON_COLUMNS,
            'rows': other_isp_rows,
            'total': {'isp': 'Total', 'values': other_isp_totals, 'total': sum(other_isp_totals)},
        }

        # Churn days buckets
        churn_0_30 = Customer.objects.filter(churn_days__lte=30).count()
        churn_31_60 = Customer.objects.filter(churn_days__gt=30, churn_days__lte=60).count()
        churn_61_90 = Customer.objects.filter(churn_days__gt=60, churn_days__lte=90).count()
        churn_90_plus = Customer.objects.filter(churn_days__gt=90).count()

        return Response({
            'remark_counts': list(remark_counts),
            'switching_reasons': list(reason_counts),
            'competitor_isps': list(isp_counts),
            'visit_summary': visit_summary,
            'other_isp_switch_reason': other_isp_switch_reason,
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
                'Churn Days', 'Package', 'Pod Station', 'Pod Name', 'Record Source',
                'Assigned Agent', 'Assigned By', 'Assigned At', 'Status'
            ]
            qs = CustomerAssignment.objects.select_related('customer', 'assigned_agent', 'assigned_by').all()
            if not request.user.is_admin_user:
                qs = qs.filter(assigned_agent__role=RoleChoices.AGENT)
            agent_id = request.query_params.get('agent')
            if agent_id:
                qs = qs.filter(assigned_agent_id=agent_id)
            for a in qs:
                rows.append([
                    normalize_export_value(a.customer.customer_id),
                    normalize_export_value(a.customer.customer_name),
                    normalize_export_value(a.customer.phone_number),
                    normalize_export_value(a.customer.churn_days),
                    normalize_export_value(a.customer.package),
                    normalize_export_value(a.customer.pod_station),
                    normalize_export_value(a.customer.pod),
                    normalize_export_value(a.customer.get_record_source_display()),
                    normalize_export_value(a.assigned_agent.full_name or a.assigned_agent.username),
                    normalize_export_value(a.assigned_by.full_name if a.assigned_by else ''),
                    normalize_export_value(a.assigned_at.strftime('%Y-%m-%d %H:%M') if a.assigned_at else ''),
                    normalize_export_value(a.status)
                ])

        elif report_type == 'visits':
            filename_prefix = "Visit_Findings"
            headers = [
                'Customer ID', 'Customer Name', 'Contact', 'Package', 'Churn Days', 'Pod Station', 'Pod Name',
                'Agent Name', 'Visit Date', 'Category', 'Collection Type', 'Remarks', 'Remarks 1', 'ISP',
                'Visit Status', 'Notes', 'GPS latitude', 'GPS longitude',
                'GPS accuracy', 'Record Source'
            ]
            qs = VisitLog.objects.select_related('customer', 'agent').all()
            if not request.user.is_admin_user:
                qs = qs.filter(agent__role=RoleChoices.AGENT)

            category = request.query_params.get('category')
            if category:
                qs = qs.filter(visit_category=category)
            remark = request.query_params.get('remark')
            if remark:
                qs = qs.filter(follow_up_remark=remark)
            remarks_1 = request.query_params.get('remarks_1') or request.query_params.get('switching_reason')
            if remarks_1:
                qs = qs.filter(switching_reason=remarks_1)
            collection_type = request.query_params.get('collection_type')
            if collection_type:
                qs = qs.filter(collection_type=collection_type)
            isp = request.query_params.get('isp') or request.query_params.get('switching_to')
            if isp:
                qs = qs.filter(switching_to=isp)
            date_from = request.query_params.get('date_from')
            if date_from:
                qs = qs.filter(completed_at__date__gte=date_from)
            date_to = request.query_params.get('date_to')
            if date_to:
                qs = qs.filter(completed_at__date__lte=date_to)

            for v in qs:
                rows.append([
                    normalize_export_value(v.customer.customer_id),
                    normalize_export_value(v.customer.customer_name),
                    normalize_export_value(v.customer.phone_number),
                    normalize_export_value(v.customer.package),
                    normalize_export_value(v.customer.churn_days),
                    normalize_export_value(v.customer.pod_station),
                    normalize_export_value(v.customer.pod),
                    normalize_export_value(v.agent.full_name or v.agent.username),
                    normalize_export_value(v.completed_at.strftime('%Y-%m-%d %H:%M') if v.completed_at else ''),
                    normalize_export_value(v.visit_category),
                    normalize_export_value(v.collection_type),
                    normalize_export_value(v.follow_up_remark),
                    normalize_export_value(v.switching_reason),
                    normalize_export_value(v.switching_to),
                    normalize_export_value(v.get_visit_status_display()),
                    normalize_export_value(v.notes),
                    normalize_export_value(str(v.gps_latitude) if v.gps_latitude is not None else ''),
                    normalize_export_value(str(v.gps_longitude) if v.gps_longitude is not None else ''),
                    normalize_export_value(v.gps_accuracy),
                    normalize_export_value(v.customer.get_record_source_display())
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
                    normalize_export_value(agent.full_name or agent.username),
                    normalize_export_value(agent.username),
                    normalize_export_value(agent.phone_number),
                    normalize_export_value(assigned_count),
                    normalize_export_value(unique_visited),
                    normalize_export_value(total_visits),
                    normalize_export_value(max(0, assigned_count - unique_visited)),
                    normalize_export_value(completed_fu),
                    normalize_export_value(overdue_fu),
                    normalize_export_value(gps_visits),
                    normalize_export_value(agent_added)
                ])

        elif report_type == 'churn':
            filename_prefix = "Customer_Churn_Report"
            headers = [
                'Customer ID', 'Customer Name', 'Phone Number',
                'Churn Days', 'Package', 'Pod Station', 'Pod Name', 'Record Source'
            ]
            qs = Customer.objects.all().order_by('-churn_days', 'customer_id')
            if not request.user.is_admin_user:
                qs = qs.filter(assignments__assigned_agent__role=RoleChoices.AGENT).distinct()
            for customer in qs:
                rows.append([
                    normalize_export_value(customer.customer_id),
                    normalize_export_value(customer.customer_name),
                    normalize_export_value(customer.phone_number),
                    normalize_export_value(customer.churn_days),
                    normalize_export_value(customer.package),
                    normalize_export_value(customer.pod_station),
                    normalize_export_value(customer.pod),
                    normalize_export_value(customer.get_record_source_display())
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
