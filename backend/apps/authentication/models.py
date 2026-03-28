"""
User Model
==========
We extend Django's built-in AbstractUser so we keep all the
standard fields (username, email, password hash) but can add our own.

Extra fields:
  - company: which company this user belongs to
             (useful for multi-tenant document separation)
  - avatar_url: profile picture URL
  - created_at / updated_at: automatic timestamps
"""

from django.contrib.auth.models import AbstractUser
from django.db import models


class User(AbstractUser):
    """
    Custom user model.

    AUTH_USER_MODEL in settings.py points here, so all of Django's
    built-in auth machinery (login, password reset, etc.) uses this.
    """

    email = models.EmailField(unique=True)  # enforce unique emails
    company = models.CharField(max_length=200, blank=True)
    avatar_url = models.URLField(blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    # Use email as the login field instead of username
    USERNAME_FIELD = "email"
    REQUIRED_FIELDS = ["username"]

    class Meta:
        db_table = "users"
        verbose_name = "User"
        verbose_name_plural = "Users"

    def __str__(self):
        return self.email
