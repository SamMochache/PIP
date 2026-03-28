"""
RAG Pipeline with LangGraph
============================
This is the complete Retrieval-Augmented Generation pipeline.

LangGraph lets us define the pipeline as a STATE MACHINE — a graph of nodes
where each node is a step, and edges decide what happens next (conditionally).

Graph Structure:
  ┌──────────────────────────────────────────────────────────┐
  │                                                          │
  │  [retrieve] → has_results? ──YES──→ [generate]          │
  │                    │                    │                │
  │                    NO                   │                │
  │                    ↓                    │                │
  │            [clarify_or_fallback]        │                │
  │                    │                    │                │
  │                    └────────────────────┘                │
  │                             ↓                            │
  │                          [END]                           │
  └──────────────────────────────────────────────────────────┘

State:
  The pipeline passes a dictionary (the "state") between nodes.
  Each node reads from state and writes back to it.
"""

import logging
from typing import TypedDict, Annotated, List, Optional
from django.conf import settings

logger = logging.getLogger(__name__)


# ── State Definition ─────────────────────────────────────────────────────────

class RAGState(TypedDict):
    """
    The shared state that flows through the LangGraph pipeline.
    Every node reads from and writes to this dict.
    """
    user_id: int
    query: str
    conversation_history: List[dict]   # [{"role": "user", "content": "..."}, ...]
    retrieved_docs: List[dict]         # top-k chunks from FAISS
    answer: str                        # final AI response
    sources: List[dict]                # source citations to return to frontend
    is_ambiguous: bool                 # did the retrieval return low-confidence results?
    error: Optional[str]               # any error message


# ── Node Functions ────────────────────────────────────────────────────────────

def retrieve_node(state: RAGState) -> RAGState:
    """
    Node 1: RETRIEVE
    Convert query → embedding → search FAISS → return top-k chunks.
    """
    from .vectorstore import similarity_search

    logger.info(f"RAG retrieve: '{state['query'][:50]}...'")

    results = similarity_search(
        user_id=state["user_id"],
        query=state["query"],
        k=settings.RAG_TOP_K,
    )

    if not results:
        return {**state, "retrieved_docs": [], "is_ambiguous": False}

    # Unpack (Document, score) tuples
    retrieved_docs = []
    for doc, score in results:
        retrieved_docs.append({
            "content": doc.page_content,
            "metadata": doc.metadata,
            "score": float(score),
        })

    # If ALL similarity scores are very high (far from query), mark as ambiguous
    # FAISS uses L2 distance — lower = more similar. Score > 1.5 = poor match.
    avg_score = sum(d["score"] for d in retrieved_docs) / len(retrieved_docs)
    is_ambiguous = avg_score > 1.5

    return {**state, "retrieved_docs": retrieved_docs, "is_ambiguous": is_ambiguous}


def generate_node(state: RAGState) -> RAGState:
    """
    Node 2: GENERATE
    Combine retrieved context + conversation history → send to LLM → get answer.

    Prompt structure:
      System: "You are a helpful assistant. Use ONLY the provided context."
      Context: <retrieved chunks>
      History: <last N turns>
      User: <current query>
    """
    from langchain_openai import ChatOpenAI
    from langchain.prompts import ChatPromptTemplate

    logger.info("RAG generate: calling LLM")

    # Build context string from retrieved chunks
    context_parts = []
    sources = []
    for i, doc in enumerate(state["retrieved_docs"]):
        context_parts.append(f"[Source {i+1}]\n{doc['content']}")
        sources.append({
            "index": i + 1,
            "content": doc["content"][:300] + "..." if len(doc["content"]) > 300 else doc["content"],
            "document_id": doc["metadata"].get("document_id"),
            "chunk_index": doc["metadata"].get("chunk_index"),
            "relevance_score": round(doc["score"], 4),
        })

    context = "\n\n".join(context_parts)

    # Format conversation history for the prompt
    history_text = ""
    if state["conversation_history"]:
        recent = state["conversation_history"][-6:]  # last 3 turns (user+assistant pairs)
        history_text = "\n".join(
            f"{msg['role'].capitalize()}: {msg['content']}"
            for msg in recent
        )

    # The prompt template — {context}, {history}, {query} are filled in below
    prompt = ChatPromptTemplate.from_messages([
        (
            "system",
            """You are a knowledgeable customer support AI assistant.
Answer the user's question using ONLY the provided context documents.
If the context doesn't contain enough information, say so honestly.
Be concise, accurate, and helpful. Cite sources using [Source N] notation.

Context documents:
{context}

Previous conversation:
{history}""",
        ),
        ("human", "{query}"),
    ])

    llm = ChatOpenAI(
        model=settings.OPENAI_CHAT_MODEL,
        temperature=0.1,    # low temperature = more factual, less creative
        openai_api_key=settings.OPENAI_API_KEY,
    )

    chain = prompt | llm
    response = chain.invoke({
        "context": context,
        "history": history_text or "No previous conversation.",
        "query": state["query"],
    })

    return {
        **state,
        "answer": response.content,
        "sources": sources,
    }


def fallback_node(state: RAGState) -> RAGState:
    """
    Node 3: FALLBACK / CLARIFY
    Triggered when no relevant documents are found.

    Two sub-cases:
      - is_ambiguous=True:  "I found something but I'm not sure it's relevant"
      - no results at all:  "I have no documents to answer this"
    """
    from langchain_openai import ChatOpenAI
    from langchain.prompts import ChatPromptTemplate

    if state["is_ambiguous"] and state["retrieved_docs"]:
        # Some results but low confidence — ask for clarification
        prompt = ChatPromptTemplate.from_messages([
            (
                "system",
                "You are a helpful customer support assistant. "
                "The user's query seems ambiguous or the available documents "
                "may not fully address it. Politely ask for clarification.",
            ),
            ("human", "{query}"),
        ])
    else:
        # No documents at all
        prompt = ChatPromptTemplate.from_messages([
            (
                "system",
                "You are a helpful customer support assistant. "
                "You don't have specific documents to answer this question. "
                "Acknowledge this and suggest the user contact support directly, "
                "or rephrase their question.",
            ),
            ("human", "{query}"),
        ])

    llm = ChatOpenAI(
        model=settings.OPENAI_CHAT_MODEL,
        temperature=0.3,
        openai_api_key=settings.OPENAI_API_KEY,
    )

    chain = prompt | llm
    response = chain.invoke({"query": state["query"]})

    return {
        **state,
        "answer": response.content,
        "sources": [],
    }


# ── Conditional Edge ──────────────────────────────────────────────────────────

def route_after_retrieval(state: RAGState) -> str:
    """
    Decides which node to visit after retrieval.

    Returns "generate"  → we have good results, generate an answer
    Returns "fallback"  → no results or ambiguous query
    """
    has_docs = len(state["retrieved_docs"]) > 0
    is_ambiguous = state.get("is_ambiguous", False)

    if has_docs and not is_ambiguous:
        return "generate"
    else:
        return "fallback"


# ── Build the Graph ───────────────────────────────────────────────────────────

def build_rag_graph():
    """
    Assemble the LangGraph state machine.

    LangGraph concepts:
      - StateGraph: the graph container that tracks state between nodes
      - add_node:   register a function as a node
      - add_edge:   unconditional connection between nodes
      - add_conditional_edges: branch based on a routing function
      - set_entry_point: where execution starts
      - compile:    validate and build the executable graph
    """
    from langgraph.graph import StateGraph, END

    graph = StateGraph(RAGState)

    # Register nodes
    graph.add_node("retrieve", retrieve_node)
    graph.add_node("generate", generate_node)
    graph.add_node("fallback", fallback_node)

    # Entry point
    graph.set_entry_point("retrieve")

    # After retrieval: branch based on results quality
    graph.add_conditional_edges(
        "retrieve",
        route_after_retrieval,
        {
            "generate": "generate",
            "fallback": "fallback",
        },
    )

    # Both generate and fallback lead to END
    graph.add_edge("generate", END)
    graph.add_edge("fallback", END)

    return graph.compile()


# Singleton — build the graph once, reuse for every request
_rag_graph = None


def get_rag_graph():
    global _rag_graph
    if _rag_graph is None:
        _rag_graph = build_rag_graph()
    return _rag_graph


# ── Public API ────────────────────────────────────────────────────────────────

def run_rag_pipeline(
    user_id: int,
    query: str,
    conversation_history: list = None,
) -> dict:
    """
    Run the complete RAG pipeline for a query.

    Returns:
      {
        "answer": "The refund policy is...",
        "sources": [{"index": 1, "content": "...", "document_id": 5}, ...],
        "retrieved_docs": [...],
      }
    """
    graph = get_rag_graph()

    initial_state = RAGState(
        user_id=user_id,
        query=query,
        conversation_history=conversation_history or [],
        retrieved_docs=[],
        answer="",
        sources=[],
        is_ambiguous=False,
        error=None,
    )

    final_state = graph.invoke(initial_state)

    return {
        "answer": final_state["answer"],
        "sources": final_state["sources"],
        "retrieved_docs": final_state["retrieved_docs"],
    }
