from rest_framework import serializers
from .models import College
from accounts.models import User

class CollegeSerializer(serializers.ModelSerializer):
    admin_username = serializers.SerializerMethodField()
    admin_email = serializers.SerializerMethodField()
    student_count = serializers.SerializerMethodField()

    class Meta:
        model = College
        fields = [
            'id',
            'college_name',
            'credits',
            'allocated_credits',
            'contact_email',
            'created_at',
            'admin_username',
            'admin_email',
            'student_count',
        ]

    def get_admin_username(self, obj):
        admin = User.objects.filter(college=obj, role='college_admin').first()
        return admin.username if admin else None

    def get_admin_email(self, obj):
        admin = User.objects.filter(college=obj, role='college_admin').first()
        return admin.email if admin else None

    def get_student_count(self, obj):
        return User.objects.filter(college=obj, role='user').count()
