"""
Document Models
===============
Document   → represents an uploaded file (metadata + file path)
Chunk      → a piece of a document after splitting (stores the text + embedding info)

Why split into chunks?
  LLMs have a context window limit (e.g., 128K tokens for GPT-4o).
  A 50-page PDF has ~25,000 tokens — too large to send as context.
  We split it into chunks of ~1000 chars, embed each, then at query time
  we only retrieve the 4 most relevant chunks.
"""

import os
from django.db import models
from apps.authentication.models import User


def upload_to(instance, filename):
    """
    Dynamic upload path: media/documents/<user_id>/<filename>
    This separates each user's files so they can't see each other's docs.
    """
    return os.path.join("documents", str(instance.user.id), filename)


class Document(models.Model):
    """
    Stores metadata about an uploaded document.
    The actual file lives on disk at MEDIA_ROOT/documents/<user_id>/<file>.
    """

    STATUS_PENDING = "pending"
    STATUS_PROCESSING = "processing"
    STATUS_READY = "ready"
    STATUS_FAILED = "failed"

    STATUS_CHOICES = [
        (STATUS_PENDING, "Pending"),
        (STATUS_PROCESSING, "Processing"),
        (STATUS_READY, "Ready"),
        (STATUS_FAILED, "Failed"),
    ]

    user = models.ForeignKey(
        User,
        on_delete=models.CASCADE,
        related_name="documents",
    )
    title = models.CharField(max_length=255)
    file = models.FileField(upload_to=upload_to)
    file_type = models.CharField(max_length=10)  # pdf, docx, txt
    file_size = models.PositiveIntegerField(default=0)  # bytes
    status = models.CharField(
        max_length=20,
        choices=STATUS_CHOICES,
        default=STATUS_PENDING,
    )
    error_message = models.TextField(blank=True)
    chunk_count = models.PositiveIntegerField(default=0)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = "documents"
        ordering = ["-created_at"]

    def __str__(self):
        return f"{self.title} ({self.user.email})"


class DocumentChunk(models.Model):
    """
    A single chunk of text extracted from a document.

    After ingestion, we don't query this table directly for retrieval —
    FAISS does the vector search much faster. But we keep the text here
    so we can return source quotes alongside AI answers.
    """

    document = models.ForeignKey(
        Document,
        on_delete=models.CASCADE,
        related_name="chunks",
    )
    content = models.TextField()              # the actual text
    chunk_index = models.PositiveIntegerField()  # order within the document
    # FAISS stores embeddings in its index file — we track the ID here
    faiss_vector_id = models.PositiveIntegerField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = "document_chunks"
        ordering = ["chunk_index"]

    def __str__(self):
        return f"Chunk {self.chunk_index} of {self.document.title}"
