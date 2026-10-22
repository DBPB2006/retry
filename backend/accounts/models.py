from django.contrib.auth.models import AbstractUser
from django.db import models


class User(AbstractUser):
    email = models.EmailField(unique=True)
    phone = models.CharField(max_length=20, blank=True, default='')
    is_identity_verified = models.BooleanField(default=False)
    verified_legal_name = models.CharField(max_length=255, blank=True, default='')
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)


class SetuKYCRecord(models.Model):
    STATUS_CHOICES = [
        ('NOT_STARTED', 'Not Started'),
        ('INITIATED', 'Initiated'),
        ('VERIFIED', 'Verified'),
        ('REJECTED', 'Rejected'),
        ('EXPIRED', 'Expired'),
        ('FAILED', 'Failed'),
    ]

    user = models.ForeignKey(User, on_delete=models.CASCADE, related_name='kyc_records')
    setu_request_id = models.CharField(max_length=128, unique=True)
    status = models.CharField(max_length=32, choices=STATUS_CHOICES, default='NOT_STARTED')
    verified_legal_name = models.CharField(max_length=255, blank=True, default='')
    digilocker_url = models.TextField(blank=True, default='')
    error_message = models.TextField(blank=True, default='')
    created_at = models.DateTimeField(auto_now_add=True)
    verified_at = models.DateTimeField(null=True, blank=True)
