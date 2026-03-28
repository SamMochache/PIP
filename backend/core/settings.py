"""
Django Settings for AI Customer Support Backend
================================================
This file configures every major component:
  - PostgreSQL database
  - Redis (caching + channels)
  - JWT authentication
  - CORS for the React frontend
  - Django Channels for WebSocket streaming
  - Celery for background tasks
"""

import os
from pathlib import Path
from datetime import timedelta
import environ

# ---------------------------------------------------------------------------
# Base directory — everything is relative to this
# ---------------------------------------------------------------------------
BASE_DIR = Path(__file__).resolve().parent.parent

# Load .env file (never hard-code secrets!)
env = environ.Env()
environ.Env.read_env(BASE_DIR / ".env")

# ---------------------------------------------------------------------------
# Security
# ---------------------------------------------------------------------------
SECRET_KEY = env("SECRET_KEY", default="change-me-in-production-please")
DEBUG = env.bool("DEBUG", default=True)
ALLOWED_HOSTS = env.list("ALLOWED_HOSTS", default=["*"])

# ---------------------------------------------------------------------------
# Installed Apps
# ---------------------------------------------------------------------------
INSTALLED_APPS = [
    # Django built-ins
    "django.contrib.admin",
    "django.contrib.auth",
    "django.contrib.contenttypes",
    "django.contrib.sessions",
    "django.contrib.messages",
    "django.contrib.staticfiles",

    # Third-party
    "rest_framework",            # DRF — builds REST APIs
    "rest_framework_simplejwt",  # JWT tokens
    "corsheaders",               # allow React frontend to call us
    "channels",                  # WebSocket support for streaming

    # Our apps (each handles one concern)
    "apps.authentication",       # user accounts + JWT
    "apps.chat",                 # conversations + messages
    "apps.documents",            # document upload + ingestion
    "apps.rag",                  # RAG pipeline (embed → retrieve → generate)
]

# ---------------------------------------------------------------------------
# Middleware (runs on every request, in order)
# ---------------------------------------------------------------------------
MIDDLEWARE = [
    "corsheaders.middleware.CorsMiddleware",   # MUST be first
    "django.middleware.security.SecurityMiddleware",
    "django.contrib.sessions.middleware.SessionMiddleware",
    "django.middleware.common.CommonMiddleware",
    "django.middleware.csrf.CsrfViewMiddleware",
    "django.contrib.auth.middleware.AuthenticationMiddleware",
    "django.contrib.messages.middleware.MessageMiddleware",
    "django.middleware.clickjacking.XFrameOptionsMiddleware",
]

ROOT_URLCONF = "core.urls"

TEMPLATES = [
    {
        "BACKEND": "django.template.backends.django.DjangoTemplates",
        "DIRS": [],
        "APP_DIRS": True,
        "OPTIONS": {
            "context_processors": [
                "django.template.context_processors.debug",
                "django.template.context_processors.request",
                "django.contrib.auth.context_processors.auth",
                "django.contrib.messages.context_processors.messages",
            ],
        },
    },
]

# ---------------------------------------------------------------------------
# ASGI — needed for WebSockets (streaming responses)
# Django Channels replaces the normal WSGI server with an async ASGI server
# ---------------------------------------------------------------------------
ASGI_APPLICATION = "core.asgi.application"

# ---------------------------------------------------------------------------
# Database — PostgreSQL
# Why PostgreSQL? It's production-grade, supports full-text search,
# and stores our conversations, users, and document metadata.
# ---------------------------------------------------------------------------
DATABASES = {
    "default": {
        "ENGINE": "django.db.backends.postgresql",
        "NAME": env("DB_NAME", default="pip_support"),
        "USER": env("DB_USER", default="postgres"),
        "PASSWORD": env("DB_PASSWORD", default="postgres"),
        "HOST": env("DB_HOST", default="localhost"),
        "PORT": env("DB_PORT", default="5432"),
    }
}

# ---------------------------------------------------------------------------
# Redis — used for TWO things:
#   1. Django cache (fast key-value store, avoids hitting the DB repeatedly)
#   2. Django Channels layer (routes WebSocket messages between workers)
# ---------------------------------------------------------------------------
REDIS_URL = env("REDIS_URL", default="redis://localhost:6379")

CACHES = {
    "default": {
        "BACKEND": "django_redis.cache.RedisCache",
        "LOCATION": REDIS_URL,
        "OPTIONS": {
            "CLIENT_CLASS": "django_redis.client.DefaultClient",
        },
    }
}

CHANNEL_LAYERS = {
    "default": {
        "BACKEND": "channels_redis.core.RedisChannelLayer",
        "CONFIG": {
            "hosts": [REDIS_URL],
        },
    },
}

# ---------------------------------------------------------------------------
# Authentication — JWT (JSON Web Tokens)
# How it works:
#   1. User logs in → we return an access token + refresh token
#   2. React stores the access token and sends it in every request header
#   3. Django verifies the token WITHOUT hitting the database (stateless!)
# ---------------------------------------------------------------------------
AUTH_USER_MODEL = "authentication.User"

REST_FRAMEWORK = {
    "DEFAULT_AUTHENTICATION_CLASSES": [
        "rest_framework_simplejwt.authentication.JWTAuthentication",
    ],
    "DEFAULT_PERMISSION_CLASSES": [
        "rest_framework.permissions.IsAuthenticated",
    ],
}

SIMPLE_JWT = {
    "ACCESS_TOKEN_LIFETIME": timedelta(hours=1),
    "REFRESH_TOKEN_LIFETIME": timedelta(days=7),
    "ROTATE_REFRESH_TOKENS": True,
    "AUTH_HEADER_TYPES": ("Bearer",),
}

# ---------------------------------------------------------------------------
# CORS — Cross-Origin Resource Sharing
# The React frontend (localhost:3000) is on a different origin than Django
# (localhost:8000). Without CORS headers, the browser blocks the requests.
# ---------------------------------------------------------------------------
CORS_ALLOWED_ORIGINS = env.list(
    "CORS_ALLOWED_ORIGINS",
    default=["http://localhost:3000", "http://127.0.0.1:3000"],
)
CORS_ALLOW_CREDENTIALS = True

# ---------------------------------------------------------------------------
# File Uploads — where uploaded documents are saved
# ---------------------------------------------------------------------------
MEDIA_URL = "/media/"
MEDIA_ROOT = BASE_DIR / "media"

STATIC_URL = "/static/"
STATIC_ROOT = BASE_DIR / "staticfiles"

# Max upload size: 50 MB
DATA_UPLOAD_MAX_MEMORY_SIZE = 52428800
FILE_UPLOAD_MAX_MEMORY_SIZE = 52428800

# ---------------------------------------------------------------------------
# OpenAI — the LLM + Embedding provider
# ---------------------------------------------------------------------------
OPENAI_API_KEY = env("OPENAI_API_KEY", default="")
OPENAI_EMBEDDING_MODEL = "text-embedding-3-small"  # cheap, fast, 1536 dims
OPENAI_CHAT_MODEL = "gpt-4o-mini"                  # affordable GPT-4 class

# ---------------------------------------------------------------------------
# RAG Configuration
# CHUNK_SIZE: how many characters per document chunk (bigger = more context,
#             but embedding quality drops for very long texts)
# CHUNK_OVERLAP: overlap between chunks so we don't lose context at boundaries
# TOP_K: how many chunks to retrieve for each query
# ---------------------------------------------------------------------------
RAG_CHUNK_SIZE = 1000
RAG_CHUNK_OVERLAP = 200
RAG_TOP_K = 4

# Where FAISS index files are stored on disk
FAISS_INDEX_PATH = BASE_DIR / "faiss_indexes"

# ---------------------------------------------------------------------------
# Celery — background task queue
# Used for: document ingestion (slow), scheduled re-indexing
# ---------------------------------------------------------------------------
CELERY_BROKER_URL = REDIS_URL
CELERY_RESULT_BACKEND = REDIS_URL
CELERY_TASK_SERIALIZER = "json"

# ---------------------------------------------------------------------------
# Misc
# ---------------------------------------------------------------------------
DEFAULT_AUTO_FIELD = "django.db.models.BigAutoField"
LANGUAGE_CODE = "en-us"
TIME_ZONE = "UTC"
USE_TZ = True
