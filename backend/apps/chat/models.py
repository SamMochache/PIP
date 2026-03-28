"""
Chat Models
============
Conversation → a single chat session (has many messages)
Message      → one turn in a conversation (user or assistant)

Why store messages in a DB?
  1. Conversation history is fed back into the LLM prompt to maintain context
  2. Users can see their past conversations
  3. Analytics / debugging
"""

from django.db import models
from apps.authentication.models import User


class Conversation(models.Model):
    """
    A conversation thread.
    One user can have many conversations.
    """

    user = models.ForeignKey(
        User,
        on_delete=models.CASCADE,
        related_name="conversations",
    )
    title = models.CharField(max_length=255, default="New Conversation")
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = "conversations"
        ordering = ["-updated_at"]

    def __str__(self):
        return f"{self.title} ({self.user.email})"

    def get_history(self, limit: int = 10) -> list:
        """
        Returns the last `limit` messages formatted for LLM prompts.
        Format: [{"role": "user", "content": "..."}, {"role": "assistant", "content": "..."}]
        """
        messages = self.messages.order_by("-created_at")[:limit]
        return [
            {"role": msg.role, "content": msg.content}
            for msg in reversed(list(messages))
        ]


class Message(models.Model):
    """
    A single message in a conversation.

    role = "user"      → sent by the human
    role = "assistant" → sent by the AI

    sources: JSON array of source documents used to generate the answer.
             Stored as JSON so we don't need a separate Source table.
    """

    ROLE_USER = "user"
    ROLE_ASSISTANT = "assistant"
    ROLE_CHOICES = [
        (ROLE_USER, "User"),
        (ROLE_ASSISTANT, "Assistant"),
    ]

    conversation = models.ForeignKey(
        Conversation,
        on_delete=models.CASCADE,
        related_name="messages",
    )
    role = models.CharField(max_length=20, choices=ROLE_CHOICES)
    content = models.TextField()
    sources = models.JSONField(default=list, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = "messages"
        ordering = ["created_at"]

    def __str__(self):
        return f"[{self.role}] {self.content[:50]}"
