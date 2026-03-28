"""
Authentication Serializers
===========================
Serializers convert between Python objects ↔ JSON.

Think of them as forms that:
  1. Validate incoming request data (registration fields, etc.)
  2. Convert Django model instances to JSON for responses

RegisterSerializer   → validates + creates new users
UserSerializer       → converts a User object to JSON (for profile responses)
"""

from rest_framework import serializers
from django.contrib.auth.password_validation import validate_password
from .models import User


class RegisterSerializer(serializers.ModelSerializer):
    """
    Handles new user registration.

    The 'password' and 'password2' fields are write_only — they appear
    in requests but are NEVER sent back in responses (security!).
    """

    password = serializers.CharField(
        write_only=True,
        required=True,
        validators=[validate_password],  # Django's built-in password rules
    )
    password2 = serializers.CharField(write_only=True, required=True)

    class Meta:
        model = User
        fields = ("username", "email", "password", "password2", "company")

    def validate(self, attrs):
        """Check that both passwords match."""
        if attrs["password"] != attrs["password2"]:
            raise serializers.ValidationError(
                {"password": "Password fields didn't match."}
            )
        return attrs

    def create(self, validated_data):
        """
        Create the user safely.
        - Remove password2 (not a model field)
        - Use create_user() so the password is hashed, never stored plaintext
        """
        validated_data.pop("password2")
        user = User.objects.create_user(
            username=validated_data["username"],
            email=validated_data["email"],
            password=validated_data["password"],
            company=validated_data.get("company", ""),
        )
        return user


class UserSerializer(serializers.ModelSerializer):
    """Converts a User instance to a safe JSON representation."""

    class Meta:
        model = User
        fields = ("id", "username", "email", "company", "avatar_url", "created_at")
        read_only_fields = ("id", "created_at")
