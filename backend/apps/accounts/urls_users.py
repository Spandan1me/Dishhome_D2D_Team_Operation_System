from django.urls import path, include
from rest_framework.routers import DefaultRouter
from .views import AgentManagementViewSet, EligibleAgentsView

router = DefaultRouter()
router.register(r'', AgentManagementViewSet, basename='user_management')

urlpatterns = [
    path('eligible-agents/', EligibleAgentsView.as_view(), name='eligible_agents'),
    path('', include(router.urls)),
]
