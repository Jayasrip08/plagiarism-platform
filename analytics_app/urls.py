from django.urls import path
from .views import SuperAdminDashboardView

urlpatterns = [
    path('dashboard/', SuperAdminDashboardView.as_view(), name='super_admin_dashboard_stats'),
]
