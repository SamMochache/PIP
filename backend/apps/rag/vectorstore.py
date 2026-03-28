"""
FAISS Vector Store Manager
===========================
FAISS (Facebook AI Similarity Search) is an extremely fast library for
finding the nearest vectors in a large dataset.

How embeddings + FAISS work together:
  1. At ingestion: text chunk → OpenAI API → 1536-dimensional vector → store in FAISS
  2. At query time: query text → OpenAI API → 1536-dimensional vector → FAISS searches
     for the most similar stored vectors using cosine similarity

Per-user indexes:
  Each user gets their own FAISS index file on disk.
  This means users can ONLY retrieve from their own documents.
  Path: FAISS_INDEX_PATH/<user_id>/index.faiss

Why FAISS and not Pinecone?
  FAISS: free, runs locally, great for development and smaller datasets
  Pinecone: managed cloud service, scales to billions of vectors, costs money
  You can swap either in by changing this file — the RAG pipeline above doesn't change.
"""

import os
import logging
from pathlib import Path
from django.conf import settings

logger = logging.getLogger(__name__)


def _get_embeddings():
    """
    Returns the OpenAI embeddings object.
    text-embedding-3-small: 1536 dimensions, very cheap (~$0.02 / million tokens).
    """
    from langchain_openai import OpenAIEmbeddings
    return OpenAIEmbeddings(
        model=settings.OPENAI_EMBEDDING_MODEL,
        openai_api_key=settings.OPENAI_API_KEY,
    )


def _get_index_path(user_id: int) -> Path:
    """Returns the directory path for a user's FAISS index."""
    path = Path(settings.FAISS_INDEX_PATH) / str(user_id)
    path.mkdir(parents=True, exist_ok=True)
    return path


def get_or_create_vectorstore(user_id: int):
    """
    Load the user's FAISS index from disk, or create a new empty one.

    LangChain's FAISS wrapper handles:
      - Saving/loading from disk
      - Converting text → embedding automatically before add/search
      - Returning LangChain Document objects with metadata

    Returns a LangChain FAISS vectorstore instance.
    """
    from langchain_community.vectorstores import FAISS

    embeddings = _get_embeddings()
    index_path = _get_index_path(user_id)
    index_file = index_path / "index.faiss"

    if index_file.exists():
        # Load existing index from disk
        logger.info(f"Loading FAISS index for user {user_id}")
        vectorstore = FAISS.load_local(
            str(index_path),
            embeddings,
            allow_dangerous_deserialization=True,
        )
    else:
        # Create a new empty FAISS index
        # We seed it with a dummy document so the index initializes correctly
        logger.info(f"Creating new FAISS index for user {user_id}")
        vectorstore = FAISS.from_texts(
            texts=["__init__"],
            embedding=embeddings,
            metadatas=[{"init": True}],
        )
        vectorstore.save_local(str(index_path))

    return vectorstore


def save_vectorstore(vectorstore, user_id: int):
    """Persist the vectorstore to disk after adding new documents."""
    index_path = _get_index_path(user_id)
    vectorstore.save_local(str(index_path))
    logger.info(f"FAISS index saved for user {user_id}")


def similarity_search(user_id: int, query: str, k: int = None):
    """
    Search the user's vector store for the top-k most relevant chunks.

    Returns a list of LangChain Document objects:
      doc.page_content → the text of the chunk
      doc.metadata     → {"document_id": ..., "chunk_index": ...}
    """
    from langchain_community.vectorstores import FAISS

    k = k or settings.RAG_TOP_K
    embeddings = _get_embeddings()
    index_path = _get_index_path(user_id)
    index_file = index_path / "index.faiss"

    if not index_file.exists():
        return []  # user has no documents yet

    vectorstore = FAISS.load_local(
        str(index_path),
        embeddings,
        allow_dangerous_deserialization=True,
    )

    # similarity_search_with_score returns [(Document, score), ...]
    # Lower score = more similar (L2 distance)
    results = vectorstore.similarity_search_with_score(query, k=k)

    # Filter out the dummy init document
    return [
        (doc, score)
        for doc, score in results
        if not doc.metadata.get("init")
    ]
