import re

from rest_framework import status, permissions, generics
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework_simplejwt.views import TokenObtainPairView
from rest_framework_simplejwt.tokens import RefreshToken
from django.db.models import Q
from .models import User
from .serializers import (
    RegisterSerializer,
    B2BStudentCreateSerializer,
    UserSerializer,
    CustomTokenObtainPairSerializer
)
from .permissions import IsCollegeAdmin, IsSuperAdmin

class CustomTokenObtainPairView(TokenObtainPairView):
    serializer_class = CustomTokenObtainPairSerializer


class RegisterView(generics.CreateAPIView):
    queryset = User.objects.all()
    serializer_class = RegisterSerializer
    permission_classes = [permissions.AllowAny]


class GoogleLoginView(APIView):
    permission_classes = [permissions.AllowAny]

    def post(self, request):
        email = request.data.get('email')
        name = request.data.get('name', '')
        mode = request.data.get('mode', 'login')
        role = request.data.get('role', 'b2c_student')
        college_id = request.data.get('college_id')
        department = request.data.get('department', '')

        if not email:
            return Response({"error": "Email is required"}, status=status.HTTP_400_BAD_REQUEST)

        if mode not in ('login', 'register'):
            return Response({"error": "Invalid Google auth mode."}, status=status.HTTP_400_BAD_REQUEST)

        username = email.split('@')[0]
        base_username = username
        counter = 1
        user = None

        try:
            user = User.objects.get(email=email)
            if mode == 'register':
                if user.role != role:
                    return Response({"error": "This email is already registered with a different role. One email can only be used for one role."}, status=status.HTTP_400_BAD_REQUEST)
        except User.DoesNotExist:
            if mode == 'login':
                return Response({"error": "No account found for this Google email. Please register first."}, status=status.HTTP_400_BAD_REQUEST)

            while User.objects.filter(username=username).exists():
                username = f"{base_username}_{counter}"
                counter += 1

            college = None
            if college_id:
                from colleges.models import College
                try:
                    college = College.objects.get(id=college_id)
                except College.DoesNotExist:
                    return Response({"error": "College not found"}, status=status.HTTP_400_BAD_REQUEST)

            user = User.objects.create_user(
                username=username,
                email=email,
                first_name=name,
                role=role,
                college=college,
                department=department,
            )

        if not user.is_active:
            return Response({"error": "Account is blocked"}, status=status.HTTP_403_FORBIDDEN)
            
        refresh = RefreshToken.for_user(user)
        # Custom claims matching CustomTokenObtainPairSerializer
        refresh['username'] = user.username
        refresh['email'] = user.email
        refresh['role'] = user.role
        refresh['college_id'] = user.college.id if user.college else None
        refresh['college_name'] = user.college.college_name if user.college else None
        refresh['department'] = user.department
        
        return Response({
            'refresh': str(refresh),
            'access': str(refresh.access_token),
            'user': {
                'id': user.id,
                'username': user.username,
                'email': user.email,
                'role': user.role,
                'phone': user.phone,
                'college_id': user.college.id if user.college else None,
                'college_name': user.college.college_name if user.college else None,
                'department': user.department
            }
        })


class B2BStudentCreateView(generics.CreateAPIView):
    serializer_class = B2BStudentCreateSerializer
    permission_classes = [IsCollegeAdmin]


class B2BStudentListView(generics.ListAPIView):
    serializer_class = UserSerializer
    permission_classes = [IsCollegeAdmin]

    def get_queryset(self):
        # Return only students belonging to the college admin's college
        college = self.request.user.college
        if not college:
            return User.objects.none()
        return User.objects.filter(college=college, role='b2b_student')


class SuperAdminUserListView(generics.ListAPIView):
    serializer_class = UserSerializer
    permission_classes = [IsSuperAdmin]

    def get_queryset(self):
        queryset = User.objects.all().order_by('-date_joined')
        search_query = self.request.query_params.get('search', None)
        if search_query:
            queryset = queryset.filter(
                Q(username__icontains=search_query) |
                Q(email__icontains=search_query) |
                Q(first_name__icontains=search_query) |
                Q(last_name__icontains=search_query)
            )
        return queryset


class SuperAdminBlockUserView(APIView):
    permission_classes = [IsSuperAdmin]

    def post(self, request, pk):
        try:
            user = User.objects.get(pk=pk)
        except User.DoesNotExist:
            return Response({"error": "User not found"}, status=status.HTTP_404_NOT_FOUND)

        if user.is_superuser or user.role == 'super_admin':
            return Response({"error": "Cannot block super admin"}, status=status.HTTP_400_BAD_REQUEST)

        # Toggle is_active status
        user.is_active = not user.is_active
        user.save()
        
        return Response({
            "message": f"User {'blocked' if not user.is_active else 'unblocked'} successfully",
            "is_active": user.is_active
        })


PASSWORD_PATTERN = re.compile(r'^(?=.{8}$)(?=.*[!@#$%^&*()_+\-=[\]{};\'":\\|,.<>/?])[A-Z][A-Za-z0-9!@#$%^&*()_+\-=[\]{};\'":\\|,.<>/?]{7}$')
PHONE_PATTERN = re.compile(r'^(?:\+91)?\d{10}$')

class ProfileView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request):
        serializer = UserSerializer(request.user)
        return Response(serializer.data)

    def put(self, request):
        user = request.user
        data = request.data

        new_username = data.get('username', user.username)
        new_email = data.get('email', user.email)

        if new_username != user.username:
            if User.objects.filter(username=new_username).exclude(pk=user.pk).exists():
                return Response({"error": "This user ID is already taken."}, status=status.HTTP_400_BAD_REQUEST)
            user.username = new_username

        if new_email != user.email:
            if User.objects.filter(email__iexact=new_email).exclude(pk=user.pk).exists():
                return Response({"error": "This email is already registered."}, status=status.HTTP_400_BAD_REQUEST)
            user.email = new_email

        if 'password' in data and data.get('password'):
            password_value = data.get('password')
            if not PASSWORD_PATTERN.match(password_value):
                return Response(
                    {"error": "Password must be exactly 8 characters, start with an uppercase letter, and include at least one special character."},
                    status=status.HTTP_400_BAD_REQUEST
                )
            user.set_password(password_value)

        user.first_name = data.get('first_name', user.first_name)
        user.last_name = data.get('last_name', user.last_name)
        phone_value = data.get('phone')
        if phone_value is not None:
            if phone_value and not PHONE_PATTERN.match(phone_value):
                return Response(
                    {"error": "Phone number must be 10 digits and may include the +91 prefix."},
                    status=status.HTTP_400_BAD_REQUEST
                )
            user.phone = phone_value or user.phone
        if 'department' in data:
            user.department = data.get('department', user.department)
        user.save()

        serializer = UserSerializer(user)
        return Response(serializer.data)