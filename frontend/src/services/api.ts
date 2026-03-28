/**
 * HTTP API Client
 * ===============
 * Wraps fetch() with:
 *  - Automatic JWT Bearer token injection
 *  - Token refresh on 401 (access token expired)
 *  - Typed response helpers
 *
 * Token storage:
 *  Tokens live in localStorage under TOKEN_KEY so they survive page reloads.
 *  The authStore writes here via setStoredTokens(); the API client reads here.
 */

const API_BASE = "http://localhost:8000/api";
export const WS_BASE = "ws://localhost:8000/ws";

const TOKEN_KEY = "pip_auth_tokens";

// ── Token helpers ────────────────────────────────────────────────────────────

export function getStoredTokens(): { access: string; refresh: string } | null {
  try {
    const raw = localStorage.getItem(TOKEN_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

export function setStoredTokens(tokens: { access: string; refresh: string }) {
  localStorage.setItem(TOKEN_KEY, JSON.stringify(tokens));
}

export function removeStoredTokens() {
  localStorage.removeItem(TOKEN_KEY);
}

// ── Core fetch wrapper ───────────────────────────────────────────────────────

async function apiFetch(
  path: string,
  options: RequestInit = {},
  isRetry = false
): Promise<Response> {
  const tokens = getStoredTokens();

  const headers: Record<string, string> = {
    ...(options.headers as Record<string, string>),
  };

  // Don't set Content-Type for FormData — browser sets it with the boundary
  if (!(options.body instanceof FormData)) {
    headers["Content-Type"] = "application/json";
  }

  if (tokens?.access) {
    headers["Authorization"] = `Bearer ${tokens.access}`;
  }

  const response = await fetch(`${API_BASE}${path}`, { ...options, headers });

  // Access token expired — try refreshing once
  if (response.status === 401 && tokens?.refresh && !isRetry) {
    const refreshRes = await fetch(`${API_BASE}/auth/refresh/`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ refresh: tokens.refresh }),
    });

    if (refreshRes.ok) {
      const data = await refreshRes.json();
      setStoredTokens({ access: data.access, refresh: tokens.refresh });
      // Retry original request with new access token
      return apiFetch(path, options, true);
    } else {
      // Refresh token also expired — force re-login
      removeStoredTokens();
      window.location.reload();
    }
  }

  return response;
}

async function apiJson<T>(path: string, options: RequestInit = {}): Promise<T> {
  const res = await apiFetch(path, options);
  const data = await res.json();
  if (!res.ok) {
    // Surface the first error message from DRF
    const message =
      data?.detail ||
      data?.error ||
      Object.values(data as Record<string, string[]>)?.[0]?.[0] ||
      "Request failed";
    throw new Error(message);
  }
  return data as T;
}

// ── Auth endpoints ───────────────────────────────────────────────────────────

export interface ApiUser {
  id: number;
  username: string;
  email: string;
  company: string;
  avatar_url: string;
  created_at: string;
}

export interface AuthResponse {
  user: ApiUser;
  tokens: { access: string; refresh: string };
}

export const authApi = {
  login: (email: string, password: string) =>
    apiJson<AuthResponse>("/auth/login/", {
      method: "POST",
      body: JSON.stringify({ email, password }),
    }),

  register: (
    username: string,
    email: string,
    password: string,
    password2: string
  ) =>
    apiJson<AuthResponse>("/auth/register/", {
      method: "POST",
      body: JSON.stringify({ username, email, password, password2 }),
    }),

  me: () => apiJson<ApiUser>("/auth/me/"),
};

// ── Chat endpoints ───────────────────────────────────────────────────────────

export interface ApiSource {
  index: number;
  content: string;
  document_id: number | null;
  document_title: string;
  chunk_index: number | null;
  relevance_score: number; // L2 distance: 0 = perfect, higher = worse
}

export interface ApiMessage {
  id: number;
  role: "user" | "assistant";
  content: string;
  sources: ApiSource[];
  created_at: string;
}

export interface ApiConversation {
  id: number;
  title: string;
  last_message: { role: string; content: string } | null;
  created_at: string;
  updated_at: string;
}

export interface ApiConversationDetail extends ApiConversation {
  messages: ApiMessage[];
}

export interface ChatResponse {
  conversation_id: number;
  message: ApiMessage;
}

export const chatApi = {
  sendMessage: (query: string, conversation_id?: number) =>
    apiJson<ChatResponse>("/chat/", {
      method: "POST",
      body: JSON.stringify({ query, conversation_id }),
    }),

  listConversations: () => apiJson<ApiConversation[]>("/chat/conversations/"),

  getConversation: (id: number) =>
    apiJson<ApiConversationDetail>(`/chat/conversations/${id}/`),

  deleteConversation: (id: number) =>
    apiFetch(`/chat/conversations/${id}/`, { method: "DELETE" }),
};

// ── Document endpoints ────────────────────────────────────────────────────────

export interface ApiDocument {
  id: number;
  title: string;
  file_type: string;
  file_size: number;
  status: "pending" | "processing" | "ready" | "failed";
  chunk_count: number;
  created_at: string;
}

export interface UploadResponse {
  document: ApiDocument;
  message: string;
}

export const documentApi = {
  upload: (
    file: File,
    onProgress: (pct: number) => void
  ): Promise<UploadResponse> => {
    return new Promise((resolve, reject) => {
      const tokens = getStoredTokens();
      const formData = new FormData();
      formData.append("file", file);

      const xhr = new XMLHttpRequest();

      xhr.upload.addEventListener("progress", (e) => {
        if (e.lengthComputable) {
          onProgress(Math.round((e.loaded / e.total) * 100));
        }
      });

      xhr.addEventListener("load", () => {
        if (xhr.status >= 200 && xhr.status < 300) {
          try {
            resolve(JSON.parse(xhr.responseText));
          } catch {
            reject(new Error("Invalid response from server"));
          }
        } else {
          try {
            const err = JSON.parse(xhr.responseText);
            reject(new Error(err.detail || err.error || "Upload failed"));
          } catch {
            reject(new Error("Upload failed"));
          }
        }
      });

      xhr.addEventListener("error", () => reject(new Error("Network error")));

      xhr.open("POST", `${API_BASE}/documents/upload/`);
      if (tokens?.access) {
        xhr.setRequestHeader("Authorization", `Bearer ${tokens.access}`);
      }
      xhr.send(formData);
    });
  },

  list: () => apiJson<ApiDocument[]>("/documents/"),
};
