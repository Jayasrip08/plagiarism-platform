import re

from django.conf import settings
from rest_framework import serializers
from rest_framework_simplejwt.serializers import TokenObtainPairSerializer
from .models import User

class UserSerializer(serializers.ModelSerializer):
    college_name = serializers.CharField(source='college.college_name', read_only=True)

    class Meta:
        model = User
        fields = [
            'id',
            'username',
            'email',
            'first_name',
            'last_name',
            'role',
            'phone',
            'college',
            'college_name',
            'department',
            'is_active',
        ]


class RegisterSerializer(serializers.ModelSerializer):
    role = serializers.ChoiceField(choices=User.ROLE_CHOICES, default='b2c_student')
    college_id = serializers.IntegerField(required=False, write_only=True)
    admin_secret = serializers.CharField(required=False, write_only=True, allow_blank=True)
    department = serializers.CharField(required=False, allow_blank=True)
    first_name = serializers.CharField(required=False, allow_blank=True)
    last_name = serializers.CharField(required=False, allow_blank=True)

    class Meta:
        model = User
        fields = ['username', 'email', 'password', 'phone', 'role', 'first_name', 'last_name', 'college_id', 'admin_secret', 'department']
        extra_kwargs = {'password': {'write_only': True}}

    def validate_college_id(self, value):
        from colleges.models import College
        try:
            College.objects.get(id=value)
        except College.DoesNotExist:
            raise serializers.ValidationError('College does not exist.')
        return value

    PASSWORD_PATTERN = re.compile(r'^(?=.{8}$)(?=.*[!@#$%^&*()_+\-=[\]{};\'":\\|,.<>/?])[A-Z][A-Za-z0-9!@#$%^&*()_+\-=[\]{};\'":\\|,.<>/?]{7}$')

    def validate_email(self, value):
        if User.objects.filter(email__iexact=value).exists():
            raise serializers.ValidationError('This email is already registered. One email can only be used for a single role.')
        return value

    def validate_phone(self, value):
        if value and not re.match(r'^(?:\+91)?\d{10}$', value):
            raise serializers.ValidationError('Phone number must be 10 digits and may include the +91 prefix.')
        return value

    def validate_password(self, value):
        if not self.PASSWORD_PATTERN.match(value):
            raise serializers.ValidationError('Password must be exactly 8 characters, start with an uppercase letter, and include at least one special character.')
        return value

    def validate(self, attrs):
        if attrs.get('role') == 'super_admin':
            expected_secret = getattr(settings, 'SUPER_ADMIN_SECRET', 'super_admin_secret_key_123')
            if attrs.get('admin_secret') != expected_secret:
                raise serializers.ValidationError({'admin_secret': 'Invalid admin secret. Use the configured SUPER_ADMIN_SECRET value.'})
        return attrs

    def create(self, validated_data):
        role = validated_data.pop('role', 'b2c_student')
        admin_secret = validated_data.pop('admin_secret', None)
        college_id = validated_data.pop('college_id', None)
        department = validated_data.pop('department', '')
        first_name = validated_data.pop('first_name', '')
        last_name = validated_data.pop('last_name', '')

        username = validated_data.get('username') or validated_data.get('email')
        if not username:
            raise serializers.ValidationError({'username': 'Username or email is required.'})

        college = None
        if college_id:
            from colleges.models import College
            college = College.objects.get(id=college_id)

        user = User.objects.create_user(
            username=username,
            email=validated_data['email'],
            password=validated_data['password'],
            phone=validated_data.get('phone', ''),
            first_name=first_name,
            last_name=last_name,
            role=role,
            college=college,
            department=department,
        )
        return user


class B2BStudentCreateSerializer(serializers.ModelSerializer):
    class Meta:
        model = User
        fields = ['username', 'email', 'password', 'first_name', 'last_name', 'department']
        extra_kwargs = {'password': {'write_only': True}}

    def create(self, validated_data):
        college = self.context['request'].user.college
        user = User.objects.create_user(
            username=validated_data['username'],
            email=validated_data['email'],
            password=validated_data['password'],
            first_name=validated_data.get('first_name', ''),
            last_name=validated_data.get('last_name', ''),
            department=validated_data.get('department', ''),
            college=college,
            role='b2b_student'
        )
        return user


class CustomTokenObtainPairSerializer(TokenObtainPairSerializer):
    @classmethod
    def get_token(cls, user):
        token = super().get_token(user)
        # Add custom claims
        token['username'] = user.username
        token['email'] = user.email
        token['role'] = user.role
        token['college_id'] = user.college.id if user.college else None
        token['college_name'] = user.college.college_name if user.college else None
        token['department'] = user.department
        return token

    def validate(self, attrs):
        username = attrs.get('username')
        if username and '@' in username:
            try:
                user = User.objects.get(email__iexact=username)
                attrs['username'] = user.username
            except User.DoesNotExist:
                pass

        data = super().validate(attrs)
        # Return user details in JSON response
        data['user'] = {
            'id': self.user.id,
            'username': self.user.username,
            'email': self.user.email,
            'role': self.user.role,
            'phone': self.user.phone,
            'college_id': self.user.college.id if self.user.college else None,
            'college_name': self.user.college.college_name if self.user.college else None,
            'department': self.user.department
        }
        return data