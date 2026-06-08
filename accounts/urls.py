from django.urls import path
from .views import (
    RegisterView,
    CustomTokenObtainPairView,
    GoogleLoginView,
    B2BStudentCreateView,
    B2BStudentListView,
    SuperAdminUserListView,
    SuperAdminBlockUserView,
    ProfileView
)

urlpatterns = [
    path('register/', RegisterView.as_view(), name='register'),
    path('login/', CustomTokenObtainPairView.as_view(), name='login'),
    path('google-login/', GoogleLoginView.as_view(), name='google_login'),
    path('students/', B2BStudentListView.as_view(), name='b2b_students_list'),
    path('students/create/', B2BStudentCreateView.as_view(), name='b2b_student_create'),
    path('super/users/', SuperAdminUserListView.as_view(), name='super_users_list'),
    path('super/users/<int:pk>/block/', SuperAdminBlockUserView.as_view(), name='super_user_block'),
    path('profile/', ProfileView.as_view(), name='profile'),
]