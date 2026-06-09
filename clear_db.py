import os
import django

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'core.settings')
django.setup()

from accounts.models import User
from colleges.models import College
from orders.models import Order
from payments.models import Payment

def clear_all():
    print("Starting absolute database cleanup...")
    
    # 1. Delete all payments
    payments_count = Payment.objects.all().delete()[0]
    print(f"Deleted {payments_count} payments.")
    
    # 2. Delete all orders
    orders_count = Order.objects.all().delete()[0]
    print(f"Deleted {orders_count} orders.")
    
    # 3. Delete all colleges
    colleges_count = College.objects.all().delete()[0]
    print(f"Deleted {colleges_count} colleges.")
    
    # 4. Delete all users except superusers
    non_superusers = User.objects.filter(is_superuser=False).exclude(role='super_admin')
    users_count = non_superusers.count()
    non_superusers.delete()
    print(f"Deleted {users_count} user accounts (except super admin).")
    
    print("Database cleanup complete. All portals are now empty of mock/test data.")

if __name__ == '__main__':
    clear_all()
