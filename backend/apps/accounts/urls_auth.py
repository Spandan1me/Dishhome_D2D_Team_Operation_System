from django.urls import path
from .views import LoginView, LogoutView, MeView, ChangePasswordView

urlpatterns = [
    path('login/', LoginView.as_view(), name='auth_login'),
    path('logout/', LogoutView.as_view(), name='auth_logout'),
    path('me/', MeView.as_view(), name='auth_me'),
    path('password/change/', ChangePasswordView.as_view(), name='auth_password_change'),
]
