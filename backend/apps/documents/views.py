"""
Document Views
==============
POST /api/documents/upload/  → upload a file, trigger ingestion
GET  /api/documents/         → list user's documents
DELETE /api/documents/<id>/  → delete a document + its chunks + FAISS vectors
"""

import os
from rest_framework import status, generics
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated
from rest_framework.parsers import MultiPartParser, FormParser

from .models import Document
from .serializers import DocumentSerializer, DocumentUploadSerializer
from .tasks import ingest_document_task


class DocumentUploadView(APIView):
    """
    POST /api/documents/upload/
    Content-Type: multipart/form-data
    Body: { file: <the file> }

    Flow:
      1. Validate file type/size
      2. Save Document record (status=pending)
      3. Save file to disk
      4. Kick off background Celery task for ingestion
      5. Return immediately — don't make the user wait!
    """

    permission_classes = [IsAuthenticated]
    parser_classes = [MultiPartParser, FormParser]

    def post(self, request):
        serializer = DocumentUploadSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        uploaded_file = serializer.validated_data["file"]
        file_name = uploaded_file.name
        file_ext = os.path.splitext(file_name)[1].lower().strip(".")

        # Create the DB record — status starts as "pending"
        document = Document.objects.create(
            user=request.user,
            title=file_name,
            file=uploaded_file,
            file_type=file_ext,
            file_size=uploaded_file.size,
            status=Document.STATUS_PENDING,
        )

        # Trigger the background task — this returns IMMEDIATELY
        # The actual work (parsing, embedding) happens in a Celery worker
        ingest_document_task.delay(document.id)

        return Response(
            {
                "document": DocumentSerializer(document).data,
                "message": "File uploaded. Processing in background.",
            },
            status=status.HTTP_202_ACCEPTED,  # 202 = accepted but not done yet
        )


class DocumentListView(generics.ListAPIView):
    """
    GET /api/documents/
    Returns all documents belonging to the logged-in user.
    Other users' documents are NEVER returned.
    """

    serializer_class = DocumentSerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        # Critical: filter by user so users can't see each other's docs
        return Document.objects.filter(user=self.request.user)


class DocumentDetailView(generics.RetrieveDestroyAPIView):
    """
    GET    /api/documents/<id>/  → document details
    DELETE /api/documents/<id>/  → delete document, file, and FAISS vectors
    """

    serializer_class = DocumentSerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        return Document.objects.filter(user=self.request.user)

    def destroy(self, request, *args, **kwargs):
        document = self.get_object()

        # Delete the physical file from disk
        if document.file and os.path.exists(document.file.path):
            os.remove(document.file.path)

        # Delete the DB record (cascade deletes chunks too)
        document.delete()

        return Response(
            {"message": "Document deleted."},
            status=status.HTTP_200_OK,
        )
