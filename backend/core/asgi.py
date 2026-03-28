"""
ASGI Configuration
==================
ASGI (Async Server Gateway Interface) is the modern replacement for WSGI.
It supports both HTTP and WebSocket connections — essential for streaming.

How it works:
  - HTTP requests → handled by Django's normal view system
  - WebSocket connections → handled by Django Channels consumers

The ProtocolTypeRouter inspects each incoming connection and routes it
to the right handler based on its type ("http" or "websocket").
"""

import os
from django.core.asgi import get_asgi_application
from channels.routing import ProtocolTypeRouter, URLRouter
from channels.auth import AuthMiddlewareStack

os.environ.setdefault("DJANGO_SETTINGS_MODULE", "core.settings")

# Import WebSocket URL patterns from the chat app
from apps.chat.routing import websocket_urlpatterns  # noqa: E402

application = ProtocolTypeRouter(
    {
        # Regular HTTP — handled by Django as normal
        "http": get_asgi_application(),

        # WebSocket — wrapped with AuthMiddlewareStack so we can
        # identify the logged-in user inside the consumer
        "websocket": AuthMiddlewareStack(
            URLRouter(websocket_urlpatterns)
        ),
    }
)
