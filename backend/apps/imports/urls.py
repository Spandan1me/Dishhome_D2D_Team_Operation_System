from django.urls import path
from .views import (
    TemplateDownloadView,
    UploadPreviewView,
    ConfirmImportView,
    ImportBatchListView,
    ImportBatchDetailView
)

urlpatterns = [
    path('template/', TemplateDownloadView.as_view(), name='import_template_download'),
    path('preview/', UploadPreviewView.as_view(), name='import_preview'),
    path('<int:pk>/confirm/', ConfirmImportView.as_view(), name='import_confirm'),
    path('', ImportBatchListView.as_view(), name='import_batch_list'),
    path('<int:pk>/', ImportBatchDetailView.as_view(), name='import_batch_detail'),
]
