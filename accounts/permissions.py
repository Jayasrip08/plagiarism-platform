from rest_framework import permissions

class IsSuperAdmin(permissions.BasePermission):
    """
    Allows access only to Super Admins.
    """
    def has_permission(self, request, view):
        return (
            request.user and 
            request.user.is_authenticated and 
            (request.user.role == 'super_admin' or request.user.is_superuser)
        )

class IsCollegeAdmin(permissions.BasePermission):
    """
    Allows access only to College Admins.
    """
    def has_permission(self, request, view):
        return (
            request.user and 
            request.user.is_authenticated and 
            request.user.role == 'college_admin'
        )

class IsNormalUser(permissions.BasePermission):
    """
    Allows access only to normal users (Students / Researchers).
    """
    def has_permission(self, request, view):
        return (
            request.user and 
            request.user.is_authenticated and 
            request.user.role == 'user'
        )
