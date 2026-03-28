"""
Root URL Configuration
======================
This is the "router" for the entire backend.
Each app mounts its own URLs under a prefix:

  /api/auth/      → authentication app  (login, register, token refresh)
  /api/chat/      → chat app            (conversations, messages)
  /api/documents/ → documents app       (upload, list, delete)
  /api/rag/       → rag app             (direct RAG query endpoint)
  /ws/            → WebSocket consumers (streaming responses)
"""

from django.contrib import admin
from django.urls import path, include
from django.conf import settings
from django.conf.urls.static import static

urlpatterns = [
    path("admin/", admin.site.urls),

    # REST API routes — all prefixed with /api/
    path("api/auth/", include("apps.authentication.urls")),
    path("api/chat/", include("apps.chat.urls")),
    path("api/documents/", include("apps.documents.urls")),
    path("api/rag/", include("apps.rag.urls")),
]

# Serve uploaded files during development
# In production, Nginx / S3 would serve these instead
if settings.DEBUG:
    urlpatterns += static(settings.MEDIA_URL, document_root=settings.MEDIA_ROOT)
