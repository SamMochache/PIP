import { create } from "zustand";
import { chatApi, ApiSource } from "../services/api";
import { Citation } from "../services/mockApi";

export interface Message {
  id: string;
  role: "user" | "ai";
  content: string;
  timestamp: number;
  citations?: Citation[];
  status?: "sending" | "sent" | "error";
  attachments?: { name: string; url: string }[];
}

export interface Conversation {
  id: string;
  title: string;
  updatedAt: number;
}

interface ChatState {
  conversations: Conversation[];
  activeConversationId: string | null;
  messages: Record<string, Message[]>;
  isStreaming: boolean;
  globalError: string | null;

  loadConversations: () => Promise<void>;
  createConversation: () => string;
  switchConversation: (id: string) => Promise<void>;
  sendMessage: (
    content: string,
    attachments?: { name: string; url: string }[]
  ) => void;
  retryMessage: (messageId: string) => void;
  clearGlobalError: () => void;
  deleteConversation: (id: string) => void;
}

const tmpId = () => `tmp_${Math.random().toString(36).substring(2, 15)}`;

// Convert FAISS L2 distance (0=best, 2+=worst) to a 0–1 relevance score
function toRelevanceScore(l2Distance: number): number {
  return Math.max(0, Math.min(1, 1 - l2Distance / 2));
}

// Map backend ApiSource → frontend Citation (shape CitationCard expects)
function mapSources(sources: ApiSource[]): Citation[] {
  return sources.map((s) => ({
    id: `${s.document_id ?? "x"}-${s.chunk_index ?? s.index}`,
    documentName: s.document_title || `Document #${s.document_id}`,
    pageNumber: s.chunk_index != null ? s.chunk_index + 1 : undefined,
    relevanceScore: toRelevanceScore(s.relevance_score),
    snippet: s.content,
  }));
}

// Reveal `fullText` word-by-word by repeatedly calling onChunk,
// then call onComplete when done.
function simulateStream(
  fullText: string,
  msgId: string,
  convId: string,
  set: (fn: (s: ChatState) => Partial<ChatState>) => void,
  onComplete: () => void
) {
  const words = fullText.split(" ");
  let i = 0;

  const interval = setInterval(() => {
    i++;
    const partial = words.slice(0, i).join(" ");

    set((s) => {
      const msgs = s.messages[convId] || [];
      return {
        messages: {
          ...s.messages,
          [convId]: msgs.map((m) =>
            m.id === msgId ? { ...m, content: partial } : m
          ),
        },
      };
    });

    if (i >= words.length) {
      clearInterval(interval);
      onComplete();
    }
  }, 40); // ~40 ms per word → natural reading speed
}

export const useChatStore = create<ChatState>((set, get) => ({
  conversations: [],
  activeConversationId: null,
  messages: {},
  isStreaming: false,
  globalError: null,

  // ── Load conversations from backend on app init ──────────────────────────
  loadConversations: async () => {
    try {
      const apiConvs = await chatApi.listConversations();
      const conversations: Conversation[] = apiConvs.map((c) => ({
        id: String(c.id),
        title: c.title,
        updatedAt: new Date(c.updated_at).getTime(),
      }));
      set((s) => ({
        conversations,
        // Keep active selection if it still exists, else pick first
        activeConversationId:
          s.activeConversationId &&
          conversations.some((c) => c.id === s.activeConversationId)
            ? s.activeConversationId
            : conversations[0]?.id ?? null,
      }));
    } catch {
      // Not fatal — user just sees empty list
    }
  },

  // ── Create new conversation (local placeholder only) ─────────────────────
  createConversation: () => {
    // We don't hit the API yet — the backend creates the conversation
    // automatically when the first message is sent with no conversation_id.
    // We set activeConversationId to null so sendMessage knows it's new.
    set({ activeConversationId: null, globalError: null });
    return "";
  },

  // ── Switch to an existing conversation, fetching messages if needed ───────
  switchConversation: async (id: string) => {
    set({ activeConversationId: id, globalError: null });

    // If we already have messages for this conversation, don't re-fetch
    if (get().messages[id]) return;

    try {
      const detail = await chatApi.getConversation(Number(id));
      const messages: Message[] = detail.messages.map((m) => ({
        id: String(m.id),
        role: m.role === "assistant" ? "ai" : "user",
        content: m.content,
        timestamp: new Date(m.created_at).getTime(),
        status: "sent",
        citations: m.sources.length ? mapSources(m.sources) : undefined,
      }));
      set((s) => ({
        messages: { ...s.messages, [id]: messages },
      }));
    } catch {
      // Non-fatal
    }
  },

  // ── Delete conversation ───────────────────────────────────────────────────
  deleteConversation: (id: string) => {
    // Optimistic update
    set((state) => {
      const newConversations = state.conversations.filter((c) => c.id !== id);
      const newMessages = { ...state.messages };
      delete newMessages[id];
      return {
        conversations: newConversations,
        messages: newMessages,
        activeConversationId:
          state.activeConversationId === id
            ? newConversations[0]?.id ?? null
            : state.activeConversationId,
      };
    });

    // Best-effort delete on backend (integer id)
    if (!id.startsWith("tmp_")) {
      chatApi.deleteConversation(Number(id)).catch(() => {});
    }
  },

  clearGlobalError: () => set({ globalError: null }),

  // ── Retry a failed user message ───────────────────────────────────────────
  retryMessage: (messageId: string) => {
    const state = get();
    const convId = state.activeConversationId;
    if (!convId) return;

    const convMessages = state.messages[convId] || [];
    const msgIndex = convMessages.findIndex((m) => m.id === messageId);
    if (msgIndex === -1) return;

    const msg = convMessages[msgIndex];
    const trimmed = convMessages.slice(0, msgIndex);

    set((s) => ({ messages: { ...s.messages, [convId]: trimmed } }));
    get().sendMessage(msg.content, msg.attachments);
  },

  // ── Send a message — calls backend, then streams response ────────────────
  sendMessage: (content: string, attachments = []) => {
    const state = get();
    const backendConvId = state.activeConversationId?.startsWith("tmp_")
      ? null
      : state.activeConversationId;

    const userMsgId = tmpId();
    const aiMsgId = tmpId();
    const now = Date.now();

    // Determine convId for local state key
    // If null (new conversation), use a temp key until we get the real id back
    const localKey = backendConvId ?? userMsgId; // stable temp key

    const isFirstMessage =
      !state.messages[localKey] || state.messages[localKey].length === 0;

    const userMessage: Message = {
      id: userMsgId,
      role: "user",
      content,
      timestamp: now,
      status: "sent",
      attachments,
    };

    // Optimistically add user message + AI placeholder
    set((s) => {
      const updatedConvs = backendConvId
        ? s.conversations
            .map((c) =>
              c.id === backendConvId
                ? { ...c, updatedAt: now }
                : c
            )
            .sort((a, b) => b.updatedAt - a.updatedAt)
        : s.conversations;

      return {
        conversations: updatedConvs,
        activeConversationId: backendConvId ?? localKey,
        messages: {
          ...s.messages,
          [backendConvId ?? localKey]: [
            ...(s.messages[backendConvId ?? localKey] || []),
            userMessage,
            {
              id: aiMsgId,
              role: "ai" as const,
              content: "",
              timestamp: now,
              status: "sending" as const,
            },
          ],
        },
        isStreaming: true,
        globalError: null,
      };
    });

    // Call the backend
    chatApi
      .sendMessage(content, backendConvId ? Number(backendConvId) : undefined)
      .then((res) => {
        const realConvId = String(res.conversation_id);
        const { answer, sources, localKey: _lk } = {
          answer: res.message.content,
          sources: res.message.sources,
          localKey,
        };
        const citations = sources.length ? mapSources(sources) : undefined;

        // If this was a new conversation, migrate temp key → real id
        set((s) => {
          let msgs = s.messages[localKey] || [];

          // Remove AI placeholder (we'll stream the real response in)
          msgs = msgs.filter((m) => m.id !== aiMsgId);

          // Add new AI placeholder for streaming
          const streamPlaceholder: Message = {
            id: aiMsgId,
            role: "ai",
            content: "",
            timestamp: Date.now(),
            status: "sending",
          };
          msgs = [...msgs, streamPlaceholder];

          // If new conversation, register it in the sidebar
          const alreadyExists = s.conversations.some(
            (c) => c.id === realConvId
          );
          const newConversations = alreadyExists
            ? s.conversations
            : [
                {
                  id: realConvId,
                  title: isFirstMessage
                    ? content.slice(0, 40) + (content.length > 40 ? "…" : "")
                    : "New Conversation",
                  updatedAt: Date.now(),
                },
                ...s.conversations.filter((c) => c.id !== localKey),
              ];

          // Migrate messages from temp key to real id
          const newMessages = { ...s.messages };
          if (localKey !== realConvId) {
            newMessages[realConvId] = msgs;
            delete newMessages[localKey];
          } else {
            newMessages[realConvId] = msgs;
          }

          return {
            conversations: newConversations,
            activeConversationId: realConvId,
            messages: newMessages,
          };
        });

        // Stream the response word-by-word
        simulateStream(answer, aiMsgId, realConvId, set, () => {
          set((s) => {
            const msgs = s.messages[realConvId] || [];
            return {
              isStreaming: false,
              messages: {
                ...s.messages,
                [realConvId]: msgs.map((m) =>
                  m.id === aiMsgId
                    ? { ...m, status: "sent", citations }
                    : m
                ),
              },
            };
          });
        });
      })
      .catch((err: Error) => {
        set((s) => {
          const key = backendConvId ?? localKey;
          const msgs = s.messages[key] || [];
          return {
            isStreaming: false,
            globalError: err.message || "Failed to get a response.",
            messages: {
              ...s.messages,
              [key]: msgs
                .filter((m) => m.id !== aiMsgId)
                .map((m) =>
                  m.id === userMsgId ? { ...m, status: "error" } : m
                ),
            },
          };
        });
      });
  },
}));

