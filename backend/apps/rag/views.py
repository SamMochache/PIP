"""
RAG Direct Query Endpoint
=========================
POST /api/rag/query/

This is a standalone endpoint for direct RAG queries (no conversation context).
The chat app uses the same pipeline but with conversation history attached.
"""

from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated
from rest_framework import status


class RAGQueryView(APIView):
    """
    POST /api/rag/query/
    Body: { "query": "What is the refund policy?" }
    Returns: { "answer": "...", "sources": [...] }
    """

    permission_classes = [IsAuthenticated]

    def post(self, request):
        query = request.data.get("query", "").strip()

        if not query:
            return Response(
                {"error": "Query is required."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        from .pipeline import run_rag_pipeline

        result = run_rag_pipeline(
            user_id=request.user.id,
            query=query,
        )

        return Response(result)
