import { create } from 'zustand';
import { Citation, mockApi } from '../services/mockApi';

export interface Message {
  id: string;
  role: 'user' | 'ai';
  content: string;
  timestamp: number;
  citations?: Citation[];
  status?: 'sending' | 'sent' | 'error';
  attachments?: {name: string;url: string;}[];
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

  createConversation: () => string;
  switchConversation: (id: string) => void;
  sendMessage: (
  content: string,
  attachments?: {name: string;url: string;}[])
  => void;
  retryMessage: (messageId: string) => void;
  clearGlobalError: () => void;
  deleteConversation: (id: string) => void;
}

const generateId = () => Math.random().toString(36).substring(2, 15);

export const useChatStore = create<ChatState>((set, get) => ({
  conversations: [
  { id: '1', title: 'Welcome to Support AI', updatedAt: Date.now() - 100000 }],

  activeConversationId: '1',
  messages: {
    '1': [
    {
      id: 'm1',
      role: 'ai',
      content:
      'Hello! I am your AI support assistant. How can I help you today?',
      timestamp: Date.now() - 100000,
      status: 'sent'
    }]

  },
  isStreaming: false,
  globalError: null,

  createConversation: () => {
    const id = generateId();
    const newConv: Conversation = {
      id,
      title: 'New Conversation',
      updatedAt: Date.now()
    };
    set((state) => ({
      conversations: [newConv, ...state.conversations],
      activeConversationId: id,
      messages: { ...state.messages, [id]: [] }
    }));
    return id;
  },

  switchConversation: (id: string) => {
    set({ activeConversationId: id, globalError: null });
  },

  deleteConversation: (id: string) => {
    set((state) => {
      const newConversations = state.conversations.filter((c) => c.id !== id);
      const newMessages = { ...state.messages };
      delete newMessages[id];

      return {
        conversations: newConversations,
        messages: newMessages,
        activeConversationId:
        state.activeConversationId === id ?
        newConversations[0]?.id || null :
        state.activeConversationId
      };
    });
  },

  clearGlobalError: () => set({ globalError: null }),

  retryMessage: (messageId: string) => {
    const state = get();
    const convId = state.activeConversationId;
    if (!convId) return;

    const convMessages = state.messages[convId] || [];
    const msgIndex = convMessages.findIndex((m) => m.id === messageId);
    if (msgIndex === -1) return;

    const msg = convMessages[msgIndex];

    // Remove the error message and any subsequent messages (like failed AI responses)
    const newMessages = convMessages.slice(0, msgIndex);

    set((s) => ({
      messages: { ...s.messages, [convId]: newMessages }
    }));

    // Resend
    get().sendMessage(msg.content, msg.attachments);
  },

  sendMessage: (content: string, attachments = []) => {
    const state = get();
    let convId = state.activeConversationId;

    if (!convId) {
      convId = get().createConversation();
    }

    const userMsgId = generateId();
    const aiMsgId = generateId();
    const now = Date.now();

    // Update conversation title if it's the first message
    const isFirstMessage =
    !state.messages[convId] || state.messages[convId].length === 0;

    const userMessage: Message = {
      id: userMsgId,
      role: 'user',
      content,
      timestamp: now,
      status: 'sent',
      attachments
    };

    set((s) => {
      const updatedConvs = s.conversations.
      map((c) => {
        if (c.id === convId) {
          return {
            ...c,
            title: isFirstMessage ?
            content.slice(0, 30) + (content.length > 30 ? '...' : '') :
            c.title,
            updatedAt: now
          };
        }
        return c;
      }).
      sort((a, b) => b.updatedAt - a.updatedAt);

      return {
        conversations: updatedConvs,
        messages: {
          ...s.messages,
          [convId!]: [...(s.messages[convId!] || []), userMessage]
        },
        isStreaming: true,
        globalError: null
      };
    });

    // Add empty AI message placeholder
    set((s) => ({
      messages: {
        ...s.messages,
        [convId!]: [
        ...(s.messages[convId!] || []),
        {
          id: aiMsgId,
          role: 'ai',
          content: '',
          timestamp: Date.now(),
          status: 'sending'
        }]

      }
    }));

    mockApi.streamResponse(
      content,
      (chunk) => {
        set((s) => {
          const msgs = s.messages[convId!] || [];
          return {
            messages: {
              ...s.messages,
              [convId!]: msgs.map((m) =>
              m.id === aiMsgId ? { ...m, content: chunk } : m
              )
            }
          };
        });
      },
      (citations) => {
        set((s) => {
          const msgs = s.messages[convId!] || [];
          return {
            isStreaming: false,
            messages: {
              ...s.messages,
              [convId!]: msgs.map((m) =>
              m.id === aiMsgId ? { ...m, status: 'sent', citations } : m
              )
            }
          };
        });
      },
      (error) => {
        set((s) => {
          const msgs = s.messages[convId!] || [];
          return {
            isStreaming: false,
            globalError: error.message,
            messages: {
              ...s.messages,
              // Mark user message as error, remove AI placeholder
              [convId!]: msgs.
              filter((m) => m.id !== aiMsgId).
              map((m) =>
              m.id === userMsgId ? { ...m, status: 'error' } : m
              )
            }
          };
        });
      }
    );
  }
}));