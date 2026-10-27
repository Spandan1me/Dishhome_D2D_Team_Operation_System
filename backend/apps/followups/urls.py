from django.urls import path
from .views import FollowUpListView, FollowUpUpdateStatusView

urlpatterns = [
    path('', FollowUpListView.as_view(), name='followup_list'),
    path('<int:pk>/status/', FollowUpUpdateStatusView.as_view(), name='followup_update_status'),
]
