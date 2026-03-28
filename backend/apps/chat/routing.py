"""
WebSocket URL Routing
======================
Maps WebSocket URLs to consumers (similar to how urls.py maps HTTP to views).

ws://localhost:8000/ws/chat/<conversation_id>/
  → ChatStreamConsumer handles this connection
"""

from django.urls import re_path
from .consumers import ChatStreamConsumer

websocket_urlpatterns = [
    re_path(
        r"^ws/chat/(?P<conversation_id>\d+)/$",
        ChatStreamConsumer.as_asgi(),
    ),
]
