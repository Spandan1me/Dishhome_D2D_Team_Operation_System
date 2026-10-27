from django.urls import path
from .views import (
    DashboardStatsView,
    AllocationReportView,
    VisitFindingsReportView,
    AgentPerformanceReportView,
    ChurnAnalysisReportView,
    ExportReportView
)

urlpatterns = [
    path('dashboard/', DashboardStatsView.as_view(), name='report_dashboard'),
    path('allocations/', AllocationReportView.as_view(), name='report_allocations'),
    path('visits/', VisitFindingsReportView.as_view(), name='report_visits'),
    path('agents/', AgentPerformanceReportView.as_view(), name='report_agents'),
    path('churn/', ChurnAnalysisReportView.as_view(), name='report_churn'),
    path('export/', ExportReportView.as_view(), name='report_export'),
]
