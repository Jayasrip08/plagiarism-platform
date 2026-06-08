import os
import django

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'core.settings')
django.setup()

from accounts.models import User
from colleges.models import College
from orders.models import PricingConfig

def seed():
    print("Seeding database...")
    
    # 1. Create Default Pricing Config
    config, created = PricingConfig.objects.get_or_create(
        id=1,
        defaults={
            'per_word_rate': 0.50,
            'express_fee': 500.00,
            'editing_suggestions_fee': 299.00,
            'referral_credit': 100.00
        }
    )
    if created:
        print("Created PricingConfig.")
    else:
        print("PricingConfig already exists.")

    # 2. Create Super Admin
    if not User.objects.filter(username='admin').exists():
        admin = User.objects.create_superuser(
            username='admin',
            email='admin@plagiarismplatform.com',
            password='admin123',
            role='super_admin'
        )
        print("Created Super Admin user 'admin' (password: admin123).")
    else:
        print("Super Admin 'admin' already exists.")

    # 3. Create College B2B
    college, created = College.objects.get_or_create(
        college_name="Demo B2B College",
        defaults={
            'credits': 150,
            'allocated_credits': 150,
            'contact_email': 'admin@democollege.edu'
        }
    )
    if created:
        print("Created College 'Demo B2B College'.")
    else:
        print("College already exists.")

    # 4. Create College Admin
    if not User.objects.filter(username='college_admin').exists():
        User.objects.create_user(
            username='college_admin',
            email='admin@democollege.edu',
            password='admin123',
            role='college_admin',
            college=college
        )
        print("Created College Admin user 'college_admin' (password: admin123).")
    else:
        print("College Admin already exists.")

    # 5. Create B2B Student
    if not User.objects.filter(username='b2b_student').exists():
        User.objects.create_user(
            username='b2b_student',
            email='student@democollege.edu',
            password='student123',
            role='user',
            college=college,
            department='Computer Science'
        )
        print("Created B2B Student user 'b2b_student' (password: student123) under Computer Science department.")
    else:
        print("B2B Student already exists.")

    # 6. Create B2C Normal Student
    if not User.objects.filter(username='student_b2c').exists():
        User.objects.create_user(
            username='student_b2c',
            email='student_b2c@gmail.com',
            password='student123',
            role='user'
        )
        print("Created B2C Student user 'student_b2c' (password: student123).")
    else:
        print("B2C Student already exists.")

    print("Seeding complete.")

if __name__ == '__main__':
    seed()
