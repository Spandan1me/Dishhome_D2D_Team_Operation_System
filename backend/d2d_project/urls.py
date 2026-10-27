from django.contrib import admin
from django.urls import path, include
from django.conf import settings
from django.conf.urls.static import static
from django.http import JsonResponse
from drf_spectacular.views import SpectacularAPIView, SpectacularSwaggerView, SpectacularRedocView


def health_check(request):
    return JsonResponse({'status': 'ok'})


urlpatterns = [
    path('health/', health_check, name='health_check'),
    path('admin/', admin.site.urls),

    # OpenAPI 3 Schema & Swagger UI
    path('api/schema/', SpectacularAPIView.as_view(), name='schema'),
    path('api/docs/', SpectacularSwaggerView.as_view(url_name='schema'), name='swagger-ui'),
    path('api/redoc/', SpectacularRedocView.as_view(url_name='schema'), name='redoc'),

    # API v1 routes
    path('api/v1/auth/', include('apps.accounts.urls_auth')),
    path('api/v1/users/', include('apps.accounts.urls_users')),
    path('api/v1/imports/', include('apps.imports.urls')),
    path('api/v1/allocations/', include('apps.allocations.urls')),
    path('api/v1/customers/', include('apps.customers.urls')),
    path('api/v1/visits/', include('apps.visits.urls')),
    path('api/v1/followups/', include('apps.followups.urls')),
    path('api/v1/reports/', include('apps.reports.urls')),
    path('api/v1/audit/', include('apps.audit.urls')),
]

if settings.DEBUG:
    urlpatterns += static(settings.MEDIA_URL, document_root=settings.MEDIA_ROOT)
