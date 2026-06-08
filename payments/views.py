import razorpay
from django.conf import settings
from django.utils import timezone
from rest_framework import status, permissions
from rest_framework.views import APIView
from rest_framework.response import Response

from orders.models import Order
from .models import Payment

class CreateRazorpayOrderView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def post(self, request):
        order_id = request.data.get('order_id')
        if not order_id:
            return Response({"error": "order_id is required"}, status=status.HTTP_400_BAD_REQUEST)

        try:
            # Ensure the order belongs to the logged-in user
            order = Order.objects.get(pk=order_id, user=request.user)
        except Order.DoesNotExist:
            return Response({"error": "Order not found"}, status=status.HTTP_404_NOT_FOUND)

        amount_in_paise = int(order.price * 100)

        # Fallback to simulation mode if Razorpay is not configured
        if not settings.RAZORPAY_KEY_ID or not settings.RAZORPAY_KEY_SECRET:
            mock_order_id = f"mock_order_{order.id}_{int(timezone.now().timestamp())}"
            
            payment, created = Payment.objects.get_or_create(
                order=order,
                defaults={
                    'razorpay_order_id': mock_order_id,
                    'amount': order.price,
                    'status': 'Pending'
                }
            )
            if not created:
                payment.razorpay_order_id = mock_order_id
                payment.amount = order.price
                payment.save()

            return Response({
                "id": mock_order_id,
                "amount": amount_in_paise,
                "currency": "INR",
                "is_mock": True,
                "key": "mock_key_id"
            })

        # Real Razorpay execution
        try:
            client = razorpay.Client(auth=(settings.RAZORPAY_KEY_ID, settings.RAZORPAY_KEY_SECRET))
            razorpay_order = client.order.create({
                "amount": amount_in_paise,
                "currency": "INR",
                "receipt": f"receipt_order_{order.id}"
            })

            payment, created = Payment.objects.get_or_create(
                order=order,
                defaults={
                    'razorpay_order_id': razorpay_order['id'],
                    'amount': order.price,
                    'status': 'Pending'
                }
            )
            if not created:
                payment.razorpay_order_id = razorpay_order['id']
                payment.amount = order.price
                payment.save()

            return Response({
                "id": razorpay_order['id'],
                "amount": razorpay_order['amount'],
                "currency": razorpay_order['currency'],
                "is_mock": False,
                "key": settings.RAZORPAY_KEY_ID
            })
        except Exception as e:
            return Response({"error": f"Razorpay connection failed: {str(e)}"}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)


class VerifyPaymentView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def post(self, request):
        payment_id = request.data.get('razorpay_payment_id')
        signature = request.data.get('razorpay_signature')
        razorpay_order_id = request.data.get('razorpay_order_id')

        if not razorpay_order_id or not payment_id:
            return Response({"error": "Missing signature verification details"}, status=status.HTTP_400_BAD_REQUEST)

        try:
            payment = Payment.objects.get(razorpay_order_id=razorpay_order_id)
            order = payment.order
        except Payment.DoesNotExist:
            return Response({"error": "Payment records for this order ID do not exist"}, status=status.HTTP_404_NOT_FOUND)

        # Fallback verification for simulation
        if razorpay_order_id.startswith('mock_') or not settings.RAZORPAY_KEY_ID:
            payment.razorpay_payment_id = payment_id
            payment.razorpay_signature = signature or "mocked_signature"
            payment.status = 'Paid'
            payment.save()

            order.status = 'Submitted'
            order.save()

            return Response({
                "status": "Payment verified (Mocked)",
                "order_id": order.id,
                "payment_status": payment.status
            })

        # Real verification using Razorpay SDK
        try:
            client = razorpay.Client(auth=(settings.RAZORPAY_KEY_ID, settings.RAZORPAY_KEY_SECRET))
            params_dict = {
                'razorpay_order_id': razorpay_order_id,
                'razorpay_payment_id': payment_id,
                'razorpay_signature': signature
            }
            client.utility.verify_payment_signature(params_dict)

            payment.razorpay_payment_id = payment_id
            payment.razorpay_signature = signature
            payment.status = 'Paid'
            payment.save()

            order.status = 'Submitted'
            order.save()

            return Response({
                "status": "Payment verified",
                "order_id": order.id,
                "payment_status": payment.status
            })
        except Exception as e:
            payment.status = 'Failed'
            payment.save()
            return Response({"error": f"Razorpay signature check failed: {str(e)}"}, status=status.HTTP_400_BAD_REQUEST)
