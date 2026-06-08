from django.db import models

class College(models.Model):
    college_name = models.CharField(max_length=255)
    credits = models.IntegerField(default=0)
    allocated_credits = models.IntegerField(default=0) # To track total purchased credits and compute 20% warning threshold
    contact_email = models.EmailField(blank=True, null=True)
    created_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return self.college_name