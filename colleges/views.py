import csv
import io
from django.utils.crypto import get_random_string
from django.utils import timezone
from django.db.models import Avg, Count
from rest_framework import status, permissions, generics
from rest_framework.views import APIView
from rest_framework.response import Response
from datetime import timedelta

from .models import College
from .serializers import CollegeSerializer
from accounts.models import User
from accounts.permissions import IsSuperAdmin, IsCollegeAdmin
from orders.models import Order

class CollegeListCreateView(generics.ListCreateAPIView):
    queryset = College.objects.all().order_by('-created_at')
    serializer_class = CollegeSerializer
    permission_classes = [IsSuperAdmin]

    def perform_create(self, serializer):
        # When creating a college, set initial allocated_credits same as current credits
        college = serializer.save()
        college.allocated_credits = college.credits
        college.save()


class CollegeDetailView(generics.RetrieveUpdateDestroyAPIView):
    queryset = College.objects.all()
    serializer_class = CollegeSerializer
    permission_classes = [IsSuperAdmin]


class AllocateCreditsView(APIView):
    permission_classes = [IsSuperAdmin]

    def post(self, request, pk):
        try:
            college = College.objects.get(pk=pk)
        except College.DoesNotExist:
            return Response({"error": "College not found"}, status=status.HTTP_404_NOT_FOUND)

        credits_to_add = request.data.get('credits')
        if not credits_to_add:
            return Response({"error": "credits field is required"}, status=status.HTTP_400_BAD_REQUEST)
        
        try:
            credits_to_add = int(credits_to_add)
            if credits_to_add <= 0:
                raise ValueError
        except ValueError:
            return Response({"error": "Credits must be a positive integer"}, status=status.HTTP_400_BAD_REQUEST)

        college.credits += credits_to_add
        college.allocated_credits += credits_to_add
        college.save()

        # Check if we need to create/update college admin user from request data
        admin_email = request.data.get('admin_email')
        admin_username = request.data.get('admin_username')
        admin_password = request.data.get('admin_password')

        if admin_email and admin_username:
            # Create a college admin user for this college if not exists
            user, created = User.objects.get_or_create(
                username=admin_username,
                defaults={
                    'email': admin_email,
                    'role': 'college_admin',
                    'college': college
                }
            )
            if created and admin_password:
                user.set_password(admin_password)
                user.save()
            elif not created:
                # Update existing user to be admin of this college
                user.role = 'college_admin'
                user.college = college
                user.email = admin_email
                if admin_password:
                    user.set_password(admin_password)
                user.save()

        return Response({
            "message": f"Successfully allocated {credits_to_add} credits to {college.college_name}",
            "credits": college.credits,
            "allocated_credits": college.allocated_credits
        })


class CollegeAdminDashboardView(APIView):
    permission_classes = [IsCollegeAdmin]

    def get(self, request):
        user = request.user
        college = user.college
        if not college:
            return Response({"error": "No college associated with this admin account"}, status=status.HTTP_400_BAD_REQUEST)

        now = timezone.now()
        start_of_month = now.replace(day=1, hour=0, minute=0, second=0, microsecond=0)

        # Monthly submissions by this college
        submissions_this_month = Order.objects.filter(
            college=college,
            created_at__gte=start_of_month
        ).count()

        # Department analytics
        dept_stats_qs = Order.objects.filter(
            college=college,
            similarity_score__isnull=False
        ).values('department').annotate(
            avg_similarity=Avg('similarity_score'),
            count=Count('id')
        ).order_by('department')

        dept_stats = []
        for stat in dept_stats_qs:
            dept_stats.append({
                "department": stat['department'] or "Unknown",
                "avg_similarity": round(stat['avg_similarity'], 2),
                "count": stat['count']
            })

        # Submission volumes for the last 6 months
        monthly_volume = []
        for i in range(5, -1, -1):
            month_date = now - timedelta(days=30 * i)
            m_start = month_date.replace(day=1, hour=0, minute=0, second=0, microsecond=0)
            
            # calculate end of month
            if m_start.month == 12:
                m_end = m_start.replace(year=m_start.year + 1, month=1)
            else:
                m_end = m_start.replace(month=m_start.month + 1)

            count = Order.objects.filter(
                college=college,
                created_at__gte=m_start,
                created_at__lt=m_end
            ).count()

            monthly_volume.append({
                "month": m_start.strftime("%b %Y"),
                "count": count
            })

        # Low credit alert if credits < 20% of allocated_credits
        low_credit_alert = False
        if college.allocated_credits > 0:
            if (college.credits / college.allocated_credits) < 0.20:
                low_credit_alert = True

        return Response({
            "college_id": college.id,
            "college_name": college.college_name,
            "credits_remaining": college.credits,
            "allocated_credits": college.allocated_credits,
            "submissions_this_month": submissions_this_month,
            "low_credit_alert": low_credit_alert,
            "dept_stats": dept_stats,
            "monthly_volume": monthly_volume
        })


class CSVStudentUploadView(APIView):
    permission_classes = [IsCollegeAdmin]

    def post(self, request):
        if 'file' not in request.FILES:
            return Response({"error": "No CSV file uploaded"}, status=status.HTTP_400_BAD_REQUEST)

        csv_file = request.FILES['file']
        if not csv_file.name.endswith('.csv'):
            return Response({"error": "Uploaded file must be a CSV file"}, status=status.HTTP_400_BAD_REQUEST)

        college = request.user.college
        if not college:
            return Response({"error": "No college associated with your account"}, status=status.HTTP_400_BAD_REQUEST)

        try:
            file_data = csv_file.read().decode("utf-8")
            io_string = io.StringIO(file_data)
            reader = csv.reader(io_string)
        except Exception as e:
            return Response({"error": f"Failed to parse CSV: {str(e)}"}, status=status.HTTP_400_BAD_REQUEST)

        # Skip headers if present
        header = next(reader, None)
        # Expected cols: username, email, first_name, last_name, department
        
        created_users = []
        errors = []

        for index, row in enumerate(reader, start=1):
            if not row or len(row) < 2:
                continue
            username = row[0].strip()
            email = row[1].strip()
            first_name = row[2].strip() if len(row) > 2 else ''
            last_name = row[3].strip() if len(row) > 3 else ''
            department = row[4].strip() if len(row) > 4 else ''

            if not username or not email:
                errors.append(f"Row {index}: Username and Email are required.")
                continue

            if User.objects.filter(username=username).exists():
                errors.append(f"Row {index}: Username '{username}' already exists.")
                continue

            if User.objects.filter(email=email).exists():
                errors.append(f"Row {index}: Email '{email}' already exists.")
                continue

            # Generate random password
            password = get_random_string(8)
            try:
                user = User.objects.create_user(
                    username=username,
                    email=email,
                    password=password,
                    first_name=first_name,
                    last_name=last_name,
                    department=department,
                    college=college,
                    role='user'
                )
                created_users.append({
                    "username": username,
                    "email": email,
                    "password": password,
                    "first_name": first_name,
                    "last_name": last_name,
                    "department": department
                })
            except Exception as e:
                errors.append(f"Row {index}: Failed to create user. Error: {str(e)}")

        return Response({
            "message": f"Processed CSV. Successfully registered {len(created_users)} students.",
            "created": created_users,
            "errors": errors
        })
