"""
Chat Views
===========
POST /api/chat/                  → send a message, get AI response
GET  /api/chat/conversations/    → list all conversations
GET  /api/chat/conversations/<id>/ → get one conversation with messages
DELETE /api/chat/conversations/<id>/ → delete a conversation
"""

from rest_framework import generics, status
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated

from .models import Conversation, Message
from .serializers import (
    ChatRequestSerializer,
    ConversationSerializer,
    ConversationDetailSerializer,
    MessageSerializer,
)


class ChatView(APIView):
    """
    POST /api/chat/
    Body: { "query": "...", "conversation_id": 123 (optional) }

    This is the main chat endpoint. It:
      1. Gets or creates a conversation
      2. Saves the user's message
      3. Runs the RAG pipeline
      4. Saves the AI's response
      5. Returns { message, sources, conversation_id }

    For streaming: use the WebSocket consumer instead (ws://localhost:8000/ws/chat/<id>/)
    """

    permission_classes = [IsAuthenticated]

    def post(self, request):
        serializer = ChatRequestSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        query = serializer.validated_data["query"]
        conversation_id = serializer.validated_data.get("conversation_id")

        # ── Get or create the conversation ────────────────────────────────
        if conversation_id:
            try:
                conversation = Conversation.objects.get(
                    id=conversation_id,
                    user=request.user,  # security: can't access other users' chats
                )
            except Conversation.DoesNotExist:
                return Response(
                    {"error": "Conversation not found."},
                    status=status.HTTP_404_NOT_FOUND,
                )
        else:
            # Auto-generate a title from the first 50 chars of the query
            title = query[:50] + "..." if len(query) > 50 else query
            conversation = Conversation.objects.create(
                user=request.user,
                title=title,
            )

        # ── Save user's message ───────────────────────────────────────────
        Message.objects.create(
            conversation=conversation,
            role=Message.ROLE_USER,
            content=query,
        )

        # ── Get conversation history for context ──────────────────────────
        history = conversation.get_history(limit=10)

        # ── Run the RAG pipeline ──────────────────────────────────────────
        from apps.rag.pipeline import run_rag_pipeline

        result = run_rag_pipeline(
            user_id=request.user.id,
            query=query,
            conversation_history=history,
        )

        # ── Enrich sources with document titles ───────────────────────────
        # The RAG pipeline only has document_id; look up titles here so the
        # frontend can display "Employee_Handbook.pdf" instead of "Document #5".
        sources = result["sources"]
        if sources:
            from apps.documents.models import Document as Doc
            doc_ids = [s["document_id"] for s in sources if s.get("document_id")]
            title_map = {
                d.id: d.title
                for d in Doc.objects.filter(id__in=doc_ids).only("id", "title")
            }
            for s in sources:
                s["document_title"] = title_map.get(s.get("document_id"), "Unknown Document")

        # ── Save AI's response ────────────────────────────────────────────
        ai_message = Message.objects.create(
            conversation=conversation,
            role=Message.ROLE_ASSISTANT,
            content=result["answer"],
            sources=sources,
        )

        # Update conversation timestamp (triggers ordering update)
        conversation.save(update_fields=["updated_at"])

        return Response(
            {
                "conversation_id": conversation.id,
                "message": MessageSerializer(ai_message).data,
            }
        )


class ConversationListView(generics.ListAPIView):
    """GET /api/chat/conversations/"""

    serializer_class = ConversationSerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        return Conversation.objects.filter(user=self.request.user)


class ConversationDetailView(generics.RetrieveDestroyAPIView):
    """GET/DELETE /api/chat/conversations/<id>/"""

    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        return Conversation.objects.filter(user=self.request.user)

    def get_serializer_class(self):
        return ConversationDetailSerializer
