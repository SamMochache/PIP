from django.contrib import admin
from django.contrib.auth.admin import UserAdmin as BaseUserAdmin
from .models import User


@admin.register(User)
class UserAdmin(BaseUserAdmin):
    list_display = ("email", "username", "company", "is_staff", "created_at")
    list_filter = ("is_staff", "is_active", "company")
    search_fields = ("email", "username", "company")
    ordering = ("-created_at",)

    fieldsets = BaseUserAdmin.fieldsets + (
        ("Profile", {"fields": ("company", "avatar_url")}),
    )
