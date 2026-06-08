from django.urls import path
from .views import (
    CollegeListCreateView,
    CollegeDetailView,
    AllocateCreditsView,
    CollegeAdminDashboardView,
    CSVStudentUploadView
)

urlpatterns = [
    path('', CollegeListCreateView.as_view(), name='college_list_create'),
    path('<int:pk>/', CollegeDetailView.as_view(), name='college_detail'),
    path('<int:pk>/allocate-credits/', AllocateCreditsView.as_view(), name='allocate_credits'),
    path('dashboard/', CollegeAdminDashboardView.as_view(), name='college_dashboard_stats'),
    path('upload-students/', CSVStudentUploadView.as_view(), name='csv_student_upload'),
]
