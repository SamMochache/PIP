"""
WebSocket Consumer — Streaming Chat
=====================================
This handles WebSocket connections for real-time streaming responses.

How streaming works:
  1. Frontend connects: ws://localhost:8000/ws/chat/<conversation_id>/
  2. Frontend sends: { "query": "What is the refund policy?" }
  3. Backend starts streaming tokens back in real-time:
     → { "type": "token", "content": "The" }
     → { "type": "token", "content": " refund" }
     → { "type": "token", "content": " policy" }
     → { "type": "done", "sources": [...], "message_id": 42 }
  4. Frontend renders each token as it arrives (the "typing" effect)

Why WebSockets instead of HTTP?
  HTTP is request-response: you send a request, wait for the FULL response.
  WebSockets are bidirectional: the server can PUSH data to the client at any time.
  Streaming over HTTP (SSE) is also possible but WebSockets work better with
  Django Channels which we already have for other features.

Django Channels concepts:
  - AsyncWebsocketConsumer: base class for async WebSocket handling
  - channel_name: unique ID for this connection
  - channel_layer: Redis pub/sub bus for messaging between workers
"""

import json
import logging
from channels.generic.websocket import AsyncWebsocketConsumer
from channels.db import database_sync_to_async

logger = logging.getLogger(__name__)


class ChatStreamConsumer(AsyncWebsocketConsumer):
    """
    Handles a single WebSocket connection for streaming chat.
    """

    async def connect(self):
        """
        Called when the WebSocket handshake completes.
        We verify the user is authenticated before accepting.
        """
        # self.scope["user"] is set by AuthMiddlewareStack in asgi.py
        if not self.scope["user"].is_authenticated:
            await self.close(code=4001)  # custom code: unauthorized
            return

        self.conversation_id = self.scope["url_route"]["kwargs"]["conversation_id"]
        self.user = self.scope["user"]

        # Join a room group named after the conversation
        # (useful if you want to support multi-user rooms in the future)
        self.room_group_name = f"chat_{self.user.id}_{self.conversation_id}"
        await self.channel_layer.group_add(self.room_group_name, self.channel_name)

        await self.accept()
        logger.info(f"WebSocket connected: user={self.user.id} conv={self.conversation_id}")

    async def disconnect(self, close_code):
        """Called when the WebSocket connection closes."""
        await self.channel_layer.group_discard(self.room_group_name, self.channel_name)

    async def receive(self, text_data):
        """
        Called when the frontend sends a message over the WebSocket.
        We expect: { "query": "..." }
        """
        try:
            data = json.loads(text_data)
            query = data.get("query", "").strip()

            if not query:
                await self.send_error("Query cannot be empty.")
                return

            await self.stream_rag_response(query)

        except json.JSONDecodeError:
            await self.send_error("Invalid JSON.")
        except Exception as e:
            logger.exception(f"WebSocket error: {e}")
            await self.send_error("An error occurred.")

    async def stream_rag_response(self, query: str):
        """
        The streaming pipeline:
          1. Save user message to DB
          2. Get conversation history
          3. Stream tokens from the LLM
          4. Save the complete AI message to DB
          5. Send "done" event with sources
        """
        from apps.rag.vectorstore import similarity_search

        # Save user message
        user_msg = await self.save_message("user", query)

        # Get conversation history (runs DB query in thread pool)
        history = await self.get_conversation_history()

        # Step 1: Retrieve relevant chunks
        retrieved = await database_sync_to_async(similarity_search)(
            user_id=self.user.id,
            query=query,
        )

        if not retrieved:
            # No documents — send fallback
            fallback = (
                "I couldn't find relevant information in your documents. "
                "Please upload relevant documents or rephrase your question."
            )
            await self.send(text_data=json.dumps({
                "type": "token",
                "content": fallback,
            }))
            await self.save_message("assistant", fallback, sources=[])
            await self.send(text_data=json.dumps({"type": "done", "sources": []}))
            return

        # Look up document titles for source attribution
        from apps.documents.models import Document as Doc
        doc_ids = [
            doc.metadata.get("document_id")
            for doc, _ in retrieved
            if doc.metadata.get("document_id")
        ]
        title_map = {
            d.id: d.title
            for d in Doc.objects.filter(id__in=doc_ids).only("id", "title")
        }

        # Build context from retrieved chunks
        context_parts = []
        sources = []
        for i, (doc, score) in enumerate(retrieved):
            doc_id = doc.metadata.get("document_id")
            context_parts.append(f"[Source {i+1}]\n{doc.page_content}")
            sources.append({
                "index": i + 1,
                "content": doc.page_content[:300],
                "document_id": doc_id,
                "document_title": title_map.get(doc_id, "Unknown Document"),
                "chunk_index": doc.metadata.get("chunk_index"),
                "relevance_score": round(float(score), 4),
            })

        context = "\n\n".join(context_parts)
        history_text = "\n".join(
            f"{m['role'].capitalize()}: {m['content']}" for m in history[-6:]
        ) or "No previous conversation."

        # Step 2: Stream from OpenAI
        full_response = await self.stream_from_llm(query, context, history_text)

        # Step 3: Save the complete assistant message
        await self.save_message("assistant", full_response, sources=sources)

        # Step 4: Send completion signal with sources
        await self.send(text_data=json.dumps({
            "type": "done",
            "sources": sources,
        }))

    async def stream_from_llm(self, query: str, context: str, history_text: str) -> str:
        """
        Stream tokens from OpenAI and send each one over the WebSocket.
        Returns the full assembled response string.
        """
        from openai import AsyncOpenAI
        from django.conf import settings

        client = AsyncOpenAI(api_key=settings.OPENAI_API_KEY)

        system_prompt = f"""You are a helpful customer support AI.
Answer using ONLY the provided context. Cite sources as [Source N].

Context:
{context}

Conversation history:
{history_text}"""

        full_response = ""

        # stream=True means OpenAI sends chunks as they're generated
        async with client.chat.completions.create(
            model=settings.OPENAI_CHAT_MODEL,
            messages=[
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": query},
            ],
            temperature=0.1,
            stream=True,   # ← this is what enables streaming!
        ) as stream:
            async for chunk in stream:
                delta = chunk.choices[0].delta
                if delta.content:
                    token = delta.content
                    full_response += token

                    # Send each token to the frontend immediately
                    await self.send(text_data=json.dumps({
                        "type": "token",
                        "content": token,
                    }))

        return full_response

    # ── Database helpers (must be async) ─────────────────────────────────────

    @database_sync_to_async
    def save_message(self, role: str, content: str, sources=None):
        """Save a message to the DB (runs in a thread pool, not the async loop)."""
        from apps.chat.models import Conversation, Message

        conversation, _ = Conversation.objects.get_or_create(
            id=self.conversation_id,
            user=self.user,
        )
        return Message.objects.create(
            conversation=conversation,
            role=role,
            content=content,
            sources=sources or [],
        )

    @database_sync_to_async
    def get_conversation_history(self):
        """Get the conversation history from the DB."""
        from apps.chat.models import Conversation

        try:
            conversation = Conversation.objects.get(
                id=self.conversation_id,
                user=self.user,
            )
            return conversation.get_history(limit=10)
        except Conversation.DoesNotExist:
            return []

    async def send_error(self, message: str):
        """Send an error message to the frontend."""
        await self.send(text_data=json.dumps({
            "type": "error",
            "message": message,
        }))
