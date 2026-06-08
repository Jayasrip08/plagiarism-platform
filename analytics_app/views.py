from django.utils import timezone
from rest_framework import status, permissions
from rest_framework.views import APIView
from rest_framework.response import Response
from django.db.models import Sum, Count, Q
from datetime import timedelta

from orders.models import Order
from colleges.models import College
from accounts.models import User
from accounts.permissions import IsSuperAdmin
from payments.models import Payment

class SuperAdminDashboardView(APIView):
    permission_classes = [IsSuperAdmin]

    def get(self, request):
        now = timezone.now()
        today = now.date()

        # Key Metrics
        today_orders = Order.objects.filter(created_at__date=today).count()
        
        # B2C Revenue (Paid payments)
        b2c_revenue = Payment.objects.filter(status='Paid').aggregate(total=Sum('amount'))['total'] or 0.00
        # B2B Revenue: We estimate B2B credits are billed at ₹150 per credit allocated
        b2b_revenue = College.objects.aggregate(total=Sum('allocated_credits'))['total'] or 0
        b2b_revenue = b2b_revenue * 150.00
        
        total_revenue = float(b2c_revenue) + float(b2b_revenue)

        # Pending checks
        pending_checks = Order.objects.filter(status__in=['Submitted', 'Processing']).count()
        active_colleges = College.objects.count()
        total_registered_users = User.objects.count()

        # Revenue Charts split B2C and B2B (last 6 months)
        monthly_trends = []
        for i in range(5, -1, -1):
            month_date = now - timedelta(days=30 * i)
            m_start = month_date.replace(day=1, hour=0, minute=0, second=0, microsecond=0)
            if m_start.month == 12:
                m_end = m_start.replace(year=m_start.year + 1, month=1)
            else:
                m_end = m_start.replace(month=m_start.month + 1)

            # Monthly B2C payments
            m_b2c = Payment.objects.filter(
                status='Paid',
                created_at__gte=m_start,
                created_at__lt=m_end
            ).aggregate(total=Sum('amount'))['total'] or 0.00

            # Monthly B2B credits allocated in this period (simulated)
            # Find colleges created in this month or count allocations
            m_colleges = College.objects.filter(
                created_at__gte=m_start,
                created_at__lt=m_end
            ).aggregate(total=Sum('allocated_credits'))['total'] or 0
            m_b2b = m_colleges * 150.00

            monthly_trends.append({
                "month": m_start.strftime("%b %Y"),
                "B2C": round(float(m_b2c), 2),
                "B2B": round(float(m_b2b), 2),
                "total": round(float(m_b2c) + float(m_b2b), 2)
            })

        # Calculate MoM growth (Comparing last month vs current month)
        current_month_total = monthly_trends[-1]["total"]
        last_month_total = monthly_trends[-2]["total"] if len(monthly_trends) > 1 else 0.0

        if last_month_total > 0:
            growth_pct = round(((current_month_total - last_month_total) / last_month_total) * 100, 2)
        else:
            growth_pct = 100.0 if current_month_total > 0 else 0.0

        # Top Users by B2C Spend
        top_spenders = User.objects.filter(role='user', college__isnull=True).annotate(
            total_spend=Sum('orders__price', filter=Q(orders__payment__status='Paid'))
        ).filter(total_spend__gt=0).order_by('-total_spend')[:5]

        spenders_list = []
        for user in top_spenders:
            spenders_list.append({
                "id": user.id,
                "username": user.username,
                "email": user.email,
                "total_spend": round(float(user.total_spend), 2)
            })

        return Response({
            "today_orders": today_orders,
            "total_revenue": round(total_revenue, 2),
            "b2c_revenue_total": round(float(b2c_revenue), 2),
            "b2b_revenue_total": round(float(b2b_revenue), 2),
            "pending_checks": pending_checks,
            "active_colleges": active_colleges,
            "total_registered_users": total_registered_users,
            "monthly_trends": monthly_trends,
            "mom_growth_percent": growth_pct,
            "top_spenders": spenders_list
        })
