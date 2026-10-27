from django.urls import path
from .views import (
    CustomerListView,
    CustomerDetailView,
    ManualCustomerCreateView,
    CustomerReviewView
)

urlpatterns = [
    path('', CustomerListView.as_view(), name='customer_list'),
    path('manual/', ManualCustomerCreateView.as_view(), name='customer_manual_create'),
    path('<str:pk>/', CustomerDetailView.as_view(), name='customer_detail'),
    path('<str:pk>/review/', CustomerReviewView.as_view(), name='customer_review'),
]
