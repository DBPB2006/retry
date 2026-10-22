from django.contrib import admin
from django.contrib.auth.admin import UserAdmin as BaseUserAdmin
from .models import User, SetuKYCRecord


@admin.register(User)
class UserAdmin(BaseUserAdmin):
    list_display = ('username', 'email', 'is_identity_verified', 'verified_legal_name', 'is_staff')
    list_filter = ('is_identity_verified', 'is_staff', 'is_superuser')
    fieldsets = BaseUserAdmin.fieldsets + (
        ('Setu DigiLocker Identity Verification', {
            'fields': ('is_identity_verified', 'verified_legal_name', 'phone')
        }),
    )


@admin.register(SetuKYCRecord)
class SetuKYCRecordAdmin(admin.ModelAdmin):
    list_display = ('user', 'setu_request_id', 'status', 'verified_legal_name', 'created_at', 'verified_at')
    list_filter = ('status', 'created_at')
    search_fields = ('user__username', 'setu_request_id', 'verified_legal_name')
