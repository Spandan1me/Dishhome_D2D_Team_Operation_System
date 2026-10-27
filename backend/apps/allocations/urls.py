from django.urls import path
from .views import (
    BatchAllocationDataView,
    SingleAssignView,
    BulkAssignView,
    ReassignView,
    AllocateEntireBatchView
)

urlpatterns = [
    path('batch/<int:batch_id>/', BatchAllocationDataView.as_view(), name='batch_allocation_data'),
    path('assign/', SingleAssignView.as_view(), name='single_assign'),
    path('assign-batch/', AllocateEntireBatchView.as_view(), name='assign_entire_batch'),
    path('bulk/', BulkAssignView.as_view(), name='bulk_assign'),
    path('reassign/', ReassignView.as_view(), name='reassign'),
]
