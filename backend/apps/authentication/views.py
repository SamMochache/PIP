"""
Authentication Views
====================
These are the API endpoints for user management.

POST /api/auth/register/   → create account, return JWT tokens
POST /api/auth/login/      → verify credentials, return JWT tokens
POST /api/auth/refresh/    → swap an expired access token for a new one
GET  /api/auth/me/         → return current user's profile
"""

from rest_framework import generics, status
from rest_framework.response import Response
from rest_framework.views import APIView
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework_simplejwt.tokens import RefreshToken
from django.contrib.auth import authenticate

from .models import User
from .serializers import RegisterSerializer, UserSerializer


def get_tokens_for_user(user):
    """
    Generate a pair of JWT tokens for a user.

    Access token  → short-lived (1 hour), sent with every API request
    Refresh token → long-lived (7 days), used ONLY to get new access tokens
    """
    refresh = RefreshToken.for_user(user)
    return {
        "access": str(refresh.access_token),
        "refresh": str(refresh),
    }


class RegisterView(generics.CreateAPIView):
    """
    POST /api/auth/register/
    Body: { username, email, password, password2, company }
    Returns: { user, tokens }
    """

    queryset = User.objects.all()
    serializer_class = RegisterSerializer
    permission_classes = [AllowAny]  # no auth needed to register!

    def create(self, request, *args, **kwargs):
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        user = serializer.save()

        tokens = get_tokens_for_user(user)

        return Response(
            {
                "user": UserSerializer(user).data,
                "tokens": tokens,
                "message": "Account created successfully.",
            },
            status=status.HTTP_201_CREATED,
        )


class LoginView(APIView):
    """
    POST /api/auth/login/
    Body: { email, password }
    Returns: { user, tokens }

    Uses Django's authenticate() which checks password hash safely.
    """

    permission_classes = [AllowAny]

    def post(self, request):
        email = request.data.get("email")
        password = request.data.get("password")

        if not email or not password:
            return Response(
                {"error": "Email and password are required."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        # authenticate() returns None if credentials are wrong
        user = authenticate(request, username=email, password=password)

        if not user:
            return Response(
                {"error": "Invalid credentials."},
                status=status.HTTP_401_UNAUTHORIZED,
            )

        tokens = get_tokens_for_user(user)

        return Response(
            {
                "user": UserSerializer(user).data,
                "tokens": tokens,
            }
        )


class MeView(generics.RetrieveUpdateAPIView):
    """
    GET  /api/auth/me/  → current user profile
    PATCH /api/auth/me/ → update profile fields
    """

    serializer_class = UserSerializer
    permission_classes = [IsAuthenticated]

    def get_object(self):
        # request.user is set by JWTAuthentication middleware
        return self.request.user
