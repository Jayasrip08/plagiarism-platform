from django.urls import path
from .views import CreateRazorpayOrderView, VerifyPaymentView

urlpatterns = [
    path('create/', CreateRazorpayOrderView.as_view(), name='payment_create'),
    path('verify/', VerifyPaymentView.as_view(), name='payment_verify'),
]
