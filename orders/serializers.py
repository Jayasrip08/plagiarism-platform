from rest_framework import serializers
from .models import Order, PricingConfig
from accounts.serializers import UserSerializer

class PricingConfigSerializer(serializers.ModelSerializer):
    class Meta:
        model = PricingConfig
        fields = ['per_word_rate', 'express_fee', 'editing_suggestions_fee', 'referral_credit']


class OrderSerializer(serializers.ModelSerializer):
    user_details = UserSerializer(source='user', read_only=True)
    college_name = serializers.CharField(source='college.college_name', read_only=True)
    is_expired = serializers.SerializerMethodField()
    secure_download_url = serializers.SerializerMethodField()

    class Meta:
        model = Order
        fields = [
            'id',
            'user',
            'user_details',
            'document',
            'report_file',
            'word_count',
            'price',
            'similarity_score',
            'status',
            'is_express',
            'has_editing_suggestions',
            'is_b2b',
            'college',
            'college_name',
            'department',
            'report_uploaded_at',
            'is_expired',
            'secure_download_url',
            'created_at',
        ]
        read_only_fields = ['user', 'word_count', 'price', 'report_file', 'similarity_score', 'status', 'report_uploaded_at']

    def get_is_expired(self, obj):
        if obj.report_uploaded_at:
            from django.utils import timezone
            from datetime import timedelta
            return timezone.now() > obj.report_uploaded_at + timedelta(hours=48)
        return False

    def get_secure_download_url(self, obj):
        if obj.report_file and obj.report_uploaded_at:
            # Generate signed token
            from django.core.signing import TimestampSigner
            signer = TimestampSigner()
            token = signer.sign(str(obj.id))
            request = self.context.get('request')
            if request:
                return request.build_absolute_uri(f"/api/orders/{obj.id}/download-report/?token={token}")
            return f"/api/orders/{obj.id}/download-report/?token={token}"
        return None
