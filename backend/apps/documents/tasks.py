"""
Document Ingestion Task (Celery)
=================================
This is the heart of document processing.

Pipeline:
  File on disk
    → Load text (PDF/DOCX/TXT handler)
    → Split into overlapping chunks (LangChain TextSplitter)
    → Embed each chunk (OpenAI text-embedding-3-small)
    → Store embeddings in FAISS index (per-user)
    → Store chunk text in PostgreSQL (for source retrieval)
    → Update document status → "ready"

Why run this in Celery (background)?
  A 20-page PDF takes ~5–15 seconds to embed.
  If we did this synchronously, the HTTP request would time out.
  Celery runs it in a separate process and the user can poll the status.
"""

import os
import logging
from celery import shared_task
from django.conf import settings

logger = logging.getLogger(__name__)


@shared_task(bind=True, max_retries=3)
def ingest_document_task(self, document_id: int):
    """
    Celery task: ingest a document into the RAG vector store.

    bind=True    → gives us access to `self` (the task instance)
    max_retries=3 → auto-retry on failure up to 3 times
    """
    from .models import Document, DocumentChunk
    from apps.rag.vectorstore import get_or_create_vectorstore

    try:
        document = Document.objects.get(id=document_id)
        document.status = Document.STATUS_PROCESSING
        document.save(update_fields=["status"])

        # ── Step 1: Load the file into raw text ──────────────────────────
        text = _load_document(document.file.path, document.file_type)

        # ── Step 2: Split into chunks ─────────────────────────────────────
        chunks = _split_text(text)

        # ── Step 3: Embed + store in FAISS ────────────────────────────────
        vectorstore = get_or_create_vectorstore(user_id=document.user.id)
        chunk_ids = vectorstore.add_texts(
            texts=[c.page_content for c in chunks],
            metadatas=[{"document_id": document.id, "chunk_index": i}
                       for i, c in enumerate(chunks)],
        )

        # ── Step 4: Save chunk text to PostgreSQL ─────────────────────────
        # We keep the text in SQL so we can retrieve the exact quote later
        db_chunks = []
        for i, (chunk, vector_id) in enumerate(zip(chunks, chunk_ids)):
            db_chunks.append(
                DocumentChunk(
                    document=document,
                    content=chunk.page_content,
                    chunk_index=i,
                    faiss_vector_id=int(vector_id) if str(vector_id).isdigit() else None,
                )
            )
        DocumentChunk.objects.bulk_create(db_chunks)

        # ── Step 5: Mark document as ready ───────────────────────────────
        document.status = Document.STATUS_READY
        document.chunk_count = len(chunks)
        document.save(update_fields=["status", "chunk_count"])

        logger.info(f"Document {document_id} ingested: {len(chunks)} chunks")

    except Document.DoesNotExist:
        logger.error(f"Document {document_id} not found")

    except Exception as exc:
        logger.exception(f"Ingestion failed for document {document_id}: {exc}")

        # Retry with exponential backoff: 60s, 120s, 240s
        try:
            raise self.retry(exc=exc, countdown=60 * (2 ** self.request.retries))
        except self.MaxRetriesExceededError:
            # After 3 retries, mark as failed
            Document.objects.filter(id=document_id).update(
                status=Document.STATUS_FAILED,
                error_message=str(exc),
            )


def _load_document(file_path: str, file_type: str) -> str:
    """
    Load a file and return its full text content.

    Supports:
      pdf  → PyPDFLoader (handles multi-page PDFs)
      docx → Docx2txtLoader
      txt  → plain file read
    """
    from langchain_community.document_loaders import (
        PyPDFLoader,
        Docx2txtLoader,
        TextLoader,
    )

    loaders = {
        "pdf": PyPDFLoader,
        "docx": Docx2txtLoader,
        "txt": TextLoader,
    }

    loader_class = loaders.get(file_type)
    if not loader_class:
        raise ValueError(f"Unsupported file type: {file_type}")

    loader = loader_class(file_path)
    documents = loader.load()

    # Combine all pages/sections into one string
    return "\n\n".join(doc.page_content for doc in documents)


def _split_text(text: str):
    """
    Split text into overlapping chunks using LangChain's RecursiveCharacterTextSplitter.

    RecursiveCharacterTextSplitter tries to split on paragraph boundaries,
    then sentences, then words — keeping chunks semantically meaningful.

    chunk_size=1000    → approx 750 tokens (safe for embeddings)
    chunk_overlap=200  → 200-char overlap prevents context from being cut at boundaries
    """
    from langchain.text_splitter import RecursiveCharacterTextSplitter

    splitter = RecursiveCharacterTextSplitter(
        chunk_size=settings.RAG_CHUNK_SIZE,
        chunk_overlap=settings.RAG_CHUNK_OVERLAP,
        separators=["\n\n", "\n", ". ", " ", ""],
    )

    return splitter.create_documents([text])
