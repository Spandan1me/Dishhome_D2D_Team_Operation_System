from django.urls import path
from .views import (
    VisitChoicesView,
    VisitEvidenceUploadView,
    VisitListCreateView,
    VisitDetailView,
    VisitEvidenceView,
)

urlpatterns = [
    path('choices/', VisitChoicesView.as_view(), name='visit_choices'),
    path('evidence-uploads/', VisitEvidenceUploadView.as_view(), name='visit_evidence_upload'),
    path('evidence-uploads/<int:pk>/', VisitEvidenceUploadView.as_view(), name='visit_evidence_upload_detail'),
    path('<int:pk>/evidence/<str:evidence_type>/', VisitEvidenceView.as_view(), name='visit_evidence'),
    path('', VisitListCreateView.as_view(), name='visit_list_create'),
    path('<int:pk>/', VisitDetailView.as_view(), name='visit_detail'),
]
