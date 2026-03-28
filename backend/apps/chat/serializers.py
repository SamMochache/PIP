from rest_framework import serializers
from .models import Conversation, Message


class MessageSerializer(serializers.ModelSerializer):
    class Meta:
        model = Message
        fields = ("id", "role", "content", "sources", "created_at")
        read_only_fields = fields


class ConversationSerializer(serializers.ModelSerializer):
    """Used for listing conversations — includes the last message as preview."""

    last_message = serializers.SerializerMethodField()

    class Meta:
        model = Conversation
        fields = ("id", "title", "last_message", "created_at", "updated_at")

    def get_last_message(self, obj):
        last = obj.messages.order_by("-created_at").first()
        if last:
            return {"role": last.role, "content": last.content[:100]}
        return None


class ConversationDetailSerializer(serializers.ModelSerializer):
    """Used for a single conversation — includes ALL messages."""

    messages = MessageSerializer(many=True, read_only=True)

    class Meta:
        model = Conversation
        fields = ("id", "title", "messages", "created_at", "updated_at")


class ChatRequestSerializer(serializers.Serializer):
    """Validates the body of POST /api/chat/."""

    query = serializers.CharField(min_length=1, max_length=2000)
    conversation_id = serializers.IntegerField(required=False, allow_null=True)
