from django.db import models
from django.contrib.auth.models import AbstractUser

class User(AbstractUser):
    ROLE_CHOICES = (
        ('b2c_student', 'B2C Student'),
        ('b2b_student', 'B2B Student'),
        ('college_admin', 'College Admin'),
        ('super_admin', 'Super Admin'),
    )

    role = models.CharField(
        max_length=20,
        choices=ROLE_CHOICES,
        default='b2c_student'
    )

    phone = models.CharField(
        max_length=15,
        blank=True,
        null=True
    )

    # B2B Relationship
    college = models.ForeignKey(
        'colleges.College',
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='users'
    )

    department = models.CharField(
        max_length=100,
        blank=True,
        null=True
    )

    def __str__(self):
        return f"{self.username} ({self.role})"