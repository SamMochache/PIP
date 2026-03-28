# AI Customer Support System — Full Stack RAG Application

A production-ready AI-powered customer support platform built with **React + TypeScript** on the frontend and **Django + Python** on the backend. The system uses **Retrieval-Augmented Generation (RAG)** to answer user questions based on company documents they upload, grounding every AI response in real source material.

---

## Table of Contents

1. [What This System Does](#1-what-this-system-does)
2. [Architecture Overview](#2-architecture-overview)
3. [Complete File Structure](#3-complete-file-structure)
4. [Frontend — Deep Dive](#4-frontend--deep-dive)
   - [Entry Point](#41-entry-point)
   - [Authentication](#42-authentication)
   - [State Management (Stores)](#43-state-management-stores)
   - [API Service Layer](#44-api-service-layer)
   - [Chat Components](#45-chat-components)
   - [Layout & Sidebar](#46-layout--sidebar)
   - [Utilities](#47-utilities)
5. [Backend — Deep Dive](#5-backend--deep-dive)
   - [Django Project Core](#51-django-project-core)
   - [Authentication App](#52-authentication-app)
   - [Documents App](#53-documents-app)
   - [RAG App](#54-rag-app)
   - [Chat App](#55-chat-app)
6. [The RAG Pipeline — Step by Step](#6-the-rag-pipeline--step-by-step)
7. [WebSocket Streaming](#7-websocket-streaming)
8. [JWT Authentication Flow](#8-jwt-authentication-flow)
9. [Document Ingestion Pipeline](#9-document-ingestion-pipeline)
10. [Database Schema](#10-database-schema)
11. [API Reference](#11-api-reference)
12. [Environment Variables](#12-environment-variables)
13. [Running Locally — Step by Step](#13-running-locally--step-by-step)
14. [Technology Choices Explained](#14-technology-choices-explained)

---

## 1. What This System Does

Traditional chatbots are trained on static data and hallucinate answers. This system is different:

```
User asks: "What is our refund policy?"
                    ↓
System embeds the question → searches your uploaded documents
                    ↓
Finds: "Refunds are processed within 14 days..." (from Policy_2024.pdf, page 3)
                    ↓
Sends that document chunk + the question to the AI
                    ↓
AI answers using ONLY the retrieved text → cites the source
```

**Result:** Every answer is grounded in your actual documents. The AI cannot fabricate facts it was not given.

### Key Features

| Feature | Description |
|---|---|
| Document Upload | Upload PDF, DOCX, or TXT files. They are automatically chunked, embedded, and indexed. |
| RAG Chat | Ask questions in plain English. The system retrieves relevant passages and generates an answer. |
| Source Citations | Every AI response shows which document it used, with the exact snippet. |
| Conversation History | All conversations are saved per user. Switch between them at any time. |
| Streaming Responses | AI responses appear word-by-word for a natural typing feel. |
| JWT Authentication | Secure login/signup. Every user's documents are private and isolated. |
| Dark Mode | Full dark/light theme toggle. |

---

## 2. Architecture Overview

```
┌─────────────────────────────────────────────────────────────────────┐
│                        React Frontend                               │
│   LoginPage → AppLayout → Sidebar + ChatArea + ChatInput            │
│              authStore (JWT)   chatStore (messages)                 │
│              services/api.ts (fetch wrapper)                        │
└──────────────────────┬──────────────────────────────────────────────┘
                       │ HTTP (REST) + WebSocket
┌──────────────────────▼──────────────────────────────────────────────┐
│                     Django Backend (Daphne / ASGI)                  │
│                                                                     │
│  /api/auth/      → authentication app  (JWT login, register)        │
│  /api/chat/      → chat app            (conversations, messages)    │
│  /api/documents/ → documents app       (upload, ingestion)          │
│  /api/rag/       → rag app             (direct query endpoint)      │
│  /ws/chat/<id>/  → WebSocket consumer  (streaming)                  │
│                                                                     │
│  ┌──────────────────────────────────────────────────────────────┐   │
│  │                    RAG Pipeline (LangGraph)                   │   │
│  │                                                              │   │
│  │  [retrieve] → FAISS search → [route] → [generate] or        │   │
│  │                                        [fallback]            │   │
│  └──────────────────────────────────────────────────────────────┘   │
│                                                                     │
│  ┌─────────────┐  ┌──────────────┐  ┌──────────────────────────┐   │
│  │ PostgreSQL  │  │    Redis     │  │  FAISS (per-user index)   │   │
│  │ users       │  │ cache        │  │  faiss_indexes/<user_id>/ │   │
│  │ convos      │  │ channels     │  │  index.faiss              │   │
│  │ messages    │  │ celery queue │  │                           │   │
│  │ documents   │  └──────────────┘  └──────────────────────────┘   │
│  │ chunks      │                                                     │
│  └─────────────┘                                                     │
│                                                                     │
│  Celery Worker (background tasks)                                   │
│  → document ingestion: parse → chunk → embed → store in FAISS       │
└─────────────────────────────────────────────────────────────────────┘
```

---

## 3. Complete File Structure

```
PIP/
├── README.md                          ← this file
│
├── frontend/                          ← React + TypeScript SPA
│   ├── package.json
│   ├── tsconfig.json
│   └── src/
│       ├── index.tsx                  ← React entry point
│       ├── index.css                  ← global styles (Tailwind base)
│       ├── App.tsx                    ← root component (auth gate)
│       │
│       ├── services/
│       │   ├── api.ts                 ← HTTP client (fetch + JWT)
│       │   └── mockApi.ts             ← Citation type + file upload
│       │
│       ├── store/
│       │   ├── authStore.ts           ← Zustand: user session + JWT
│       │   ├── chatStore.ts           ← Zustand: conversations + messages
│       │   └── themeStore.ts          ← Zustand: dark/light mode
│       │
│       ├── components/
│       │   ├── auth/
│       │   │   ├── LoginPage.tsx      ← email + password login form
│       │   │   └── SignupPage.tsx     ← name + email + password form
│       │   │
│       │   ├── layout/
│       │   │   └── AppLayout.tsx      ← root layout (sidebar + chat)
│       │   │
│       │   ├── sidebar/
│       │   │   ├── Sidebar.tsx        ← conversation list + user profile
│       │   │   └── ConversationItem.tsx ← single conversation row
│       │   │
│       │   ├── chat/
│       │   │   ├── ChatArea.tsx       ← chat header + message list + input
│       │   │   ├── ChatInput.tsx      ← textarea + file attach + send
│       │   │   ├── MessageList.tsx    ← scrollable message container
│       │   │   ├── MessageBubble.tsx  ← single message (user or AI)
│       │   │   ├── CitationCard.tsx   ← expandable source document card
│       │   │   ├── FileUploadPreview.tsx ← upload progress pill
│       │   │   └── TypingIndicator.tsx   ← animated 3-dot loader
│       │   │
│       │   └── common/
│       │       ├── ThemeToggle.tsx    ← dark/light switch button
│       │       └── CopyButton.tsx     ← copy AI message to clipboard
│       │
│       └── utils/
│           └── formatTime.ts          ← relative time + conversation grouping
│
└── backend/                           ← Django REST API
    ├── manage.py                      ← Django CLI entry point
    ├── requirements.txt               ← Python dependencies
    ├── docker-compose.yml             ← PostgreSQL + Redis containers
    ├── Makefile                       ← convenience commands
    ├── .env.example                   ← environment variable template
    │
    ├── core/                          ← Django project configuration
    │   ├── settings.py                ← all settings (DB, Redis, JWT, RAG)
    │   ├── urls.py                    ← root URL router
    │   ├── asgi.py                    ← ASGI config (HTTP + WebSocket)
    │   └── celery.py                  ← Celery app configuration
    │
    └── apps/
        ├── authentication/            ← user accounts + JWT
        │   ├── models.py              ← custom User model
        │   ├── serializers.py         ← register + user serializers
        │   ├── views.py               ← register, login, me endpoints
        │   ├── urls.py                ← auth URL patterns
        │   └── admin.py               ← Django admin registration
        │
        ├── documents/                 ← file upload + ingestion
        │   ├── models.py              ← Document + DocumentChunk models
        │   ├── serializers.py         ← upload validation + response shape
        │   ├── views.py               ← upload, list, delete endpoints
        │   ├── tasks.py               ← Celery ingestion task
        │   ├── urls.py                ← document URL patterns
        │   └── admin.py               ← Django admin registration
        │
        ├── rag/                       ← vector store + RAG pipeline
        │   ├── vectorstore.py         ← FAISS index management (per user)
        │   ├── pipeline.py            ← LangGraph RAG state machine
        │   ├── views.py               ← direct query endpoint
        │   └── urls.py                ← RAG URL patterns
        │
        └── chat/                      ← conversations + streaming
            ├── models.py              ← Conversation + Message models
            ├── serializers.py         ← conversation/message shapes
            ├── views.py               ← chat, list, detail endpoints
            ├── consumers.py           ← WebSocket streaming consumer
            ├── routing.py             ← WebSocket URL patterns
            ├── urls.py                ← HTTP URL patterns
            └── admin.py               ← Django admin registration
```

---

## 4. Frontend — Deep Dive

### 4.1 Entry Point

#### `src/index.tsx`
The root of the React application. Calls `ReactDOM.createRoot()` to mount the `<App />` component into `index.html`. This is the standard React 18 entry point.

#### `src/App.tsx`
The **authentication gate** — the very first thing rendered.

```
App renders:
  ├── if NOT authenticated → LoginPage or SignupPage (based on authView state)
  └── if authenticated     → AppLayout (the full chat interface)
```

It also runs a `useEffect` on startup to apply the saved theme (dark/light) to the `<html>` element.

**Why handle auth here?**
The whole application is behind a login wall. Checking `isAuthenticated` at the root means no protected component ever needs to check "am I logged in?" individually.

---

### 4.2 Authentication

#### `src/components/auth/LoginPage.tsx`

A centered card with email + password fields. On submit it calls the async `login()` action from `authStore`.

Key behaviours:
- **`async handleSubmit`** — awaits the login API call. If it throws, the store sets `error` and the component renders a red error banner.
- **Disabled button during loading** — `disabled={isLoading}` prevents double-submits.
- **`clearError()`** — clears any previous error message before the next attempt.

#### `src/components/auth/SignupPage.tsx`

Same pattern as LoginPage but calls `register(name, email, password)`. The `name` field is displayed in the UI and stored as `username` in the backend (spaces replaced with underscores).

Password is sent twice internally (the backend requires `password2` for confirmation) but we handle that in `authStore.register()` — the UI only asks once.

---

### 4.3 State Management (Stores)

The frontend uses **Zustand** for state management. Zustand is a tiny, hook-based state library. Each store is a single function that returns the state and actions. There are three stores:

#### `src/store/authStore.ts`

Manages the authenticated user session.

**State:**
| Field | Type | Purpose |
|---|---|---|
| `isAuthenticated` | boolean | Whether a user is logged in |
| `user` | `User \| null` | User profile (id, name, email, avatar) |
| `isLoading` | boolean | True while an API call is in flight |
| `error` | `string \| null` | Last error message from the backend |

**Actions:**
| Action | What it does |
|---|---|
| `login(email, password)` | Calls `POST /api/auth/login/`. On success: stores JWT tokens in localStorage, saves user to Zustand state. On failure: sets `error`. |
| `register(name, email, password)` | Calls `POST /api/auth/register/`. Same success/failure handling as login. |
| `logout()` | Removes tokens from localStorage, resets state to unauthenticated. |
| `clearError()` | Sets `error: null` so the UI error banner disappears. |

**Persistence:**
The store uses Zustand's `persist` middleware to save `isAuthenticated` and `user` to `localStorage` under the key `auth-storage`. This means if you reload the page, you stay logged in.

JWT tokens are NOT stored in the Zustand persist — they live in their own `localStorage` key (`pip_auth_tokens`) managed by `api.ts`. This separation means the auth store doesn't need to know anything about HTTP headers.

**Rehydration guard:**
On page load, if the persisted state says `isAuthenticated: true` but the tokens are gone (expired and cleared by the API layer), the store resets to unauthenticated. This prevents a stuck logged-in state.

---

#### `src/store/chatStore.ts`

The largest and most important store — manages all conversations and messages.

**State:**
| Field | Type | Purpose |
|---|---|---|
| `conversations` | `Conversation[]` | List of all conversations (sidebar) |
| `activeConversationId` | `string \| null` | Which conversation is currently open |
| `messages` | `Record<string, Message[]>` | Messages per conversation, keyed by ID |
| `isStreaming` | boolean | True while the AI response is being revealed |
| `globalError` | `string \| null` | Error banner at the top of chat |

**The `Message` type:**
```typescript
{
  id: string
  role: 'user' | 'ai'     // 'ai' is the frontend name; backend uses 'assistant'
  content: string
  timestamp: number
  citations?: Citation[]   // source documents (shown below the message)
  status?: 'sending' | 'sent' | 'error'
  attachments?: { name: string; url: string }[]
}
```

**Actions:**

`loadConversations()` — Called once on app startup. Fetches `GET /api/chat/conversations/` and populates the sidebar. Converts backend integer IDs to strings.

`createConversation()` — Does NOT call the backend. Sets `activeConversationId: null` to signal that the next message should create a new backend conversation.

`switchConversation(id)` — Sets the active conversation, then checks if messages for that conversation are already in the local cache. If not, fetches them from `GET /api/chat/conversations/<id>/`. This is lazy loading — we only fetch a conversation's messages when you actually open it.

`sendMessage(content, attachments)` — The most complex action:
1. Immediately adds the user's message to the local state (optimistic update)
2. Adds an empty AI message placeholder with `status: 'sending'`
3. Calls `POST /api/chat/` with the query and (optionally) a `conversation_id`
4. If the conversation is new (no `conversation_id`), the backend creates it and returns the new `conversation_id`
5. Migrates local messages from the temp key to the real backend ID
6. Takes the full AI response text and reveals it word-by-word using `simulateStream()` at 40ms per word, creating the "typing" effect
7. On error: marks the user's message with `status: 'error'`, shows the error banner

`deleteConversation(id)` — Optimistically removes from local state immediately (fast UX), then calls `DELETE /api/chat/conversations/<id>/` in the background.

**ID handling:**
The backend uses integer primary keys (1, 2, 3...). The frontend converts all IDs to strings at the API boundary (`String(res.id)`). This way, all internal frontend logic uses strings consistently and no TypeScript type errors occur from number/string mismatches.

**Citation mapping:**
Backend sources come in this shape:
```json
{ "index": 1, "content": "...", "document_id": 5, "document_title": "Policy.pdf",
  "chunk_index": 2, "relevance_score": 0.42 }
```
The `relevance_score` is a **FAISS L2 distance** (0 = perfect match, higher = worse match). The frontend expects a 0–1 score where higher is better. The conversion is:
```
frontendScore = max(0, min(1, 1 - l2Distance / 2))
```
So a distance of 0 → score 1.0, distance of 1 → score 0.5, distance of 2+ → score 0.0.

---

#### `src/store/themeStore.ts`

Manages dark/light mode. Persists the preference in `localStorage`. On change, adds or removes the `dark` class from `<html>` — Tailwind reads this class to apply dark variants.

---

### 4.4 API Service Layer

#### `src/services/api.ts`

The single file that handles all HTTP communication with the Django backend.

**Token management:**
```typescript
// Tokens stored in localStorage under 'pip_auth_tokens'
getStoredTokens()   // → { access: string, refresh: string } | null
setStoredTokens()   // called by authStore after login
removeStoredTokens() // called by authStore on logout
```

**`apiFetch(path, options, isRetry?)`:**
The core wrapper around `fetch()`.
1. Reads the access token from localStorage
2. Adds `Authorization: Bearer <token>` to every request
3. If the response is **401 Unauthorized**:
   - Calls `POST /api/auth/refresh/` with the refresh token
   - If refresh succeeds: saves the new access token, retries the original request
   - If refresh fails: clears tokens, reloads the page (forces re-login)
4. Returns the raw `Response` object

**`apiJson<T>(path, options)`:**
Wraps `apiFetch` and parses the JSON body. If the response is not OK (4xx, 5xx), it extracts the first error message from the Django REST Framework error format and throws it as an `Error`. This means all API errors become normal JavaScript exceptions that the stores can catch.

**File uploads use XHR not fetch:**
```typescript
documentApi.upload(file, onProgress)
```
Native `fetch` does not support upload progress events. `XMLHttpRequest` does (`xhr.upload.addEventListener('progress', ...)`). So file uploads use XHR to provide real-time progress percentages to the `FileUploadPreview` component.

**Typed endpoint groups:**
- `authApi` — `login()`, `register()`, `me()`
- `chatApi` — `sendMessage()`, `listConversations()`, `getConversation()`, `deleteConversation()`
- `documentApi` — `upload()`, `list()`

---

#### `src/services/mockApi.ts`

Contains two things:

1. **`Citation` interface** — the shape that `CitationCard` displays. This type is kept here because multiple components import it from this path.

```typescript
interface Citation {
  id: string          // e.g. "5-2" (document_id - chunk_index)
  documentName: string // e.g. "Employee_Handbook.pdf"
  pageNumber?: number  // chunk_index + 1 (approximate page)
  relevanceScore: number // 0–1, higher = more relevant
  snippet: string      // the actual text excerpt
}
```

2. **`mockApi.uploadFile()`** — calls `documentApi.upload()` from `api.ts`. The component `ChatInput` calls this function, so keeping the same export name means no changes were needed in the component.

---

### 4.5 Chat Components

#### `src/components/chat/ChatArea.tsx`

The main content area on the right side of the screen. Contains:
- **Header bar** — conversation title + theme toggle + mobile menu button
- **Global error banner** — animated red strip that appears when `globalError` is set. Has an X button to dismiss.
- **`<MessageList />`** — the scrollable message history
- **`<ChatInput />`** — the message input at the bottom

#### `src/components/chat/MessageList.tsx`

Renders the array of messages for the active conversation. Uses a `useRef` on a dummy `<div>` at the bottom to auto-scroll when new messages arrive via `scrollIntoView({ behavior: 'smooth' })`.

Shows an empty state ("How can I help you today?") when there are no messages yet.

#### `src/components/chat/MessageBubble.tsx`

Renders a single message. Handles three cases:

**User messages** (`role === 'user'`):
- Right-aligned indigo bubble
- Shows the user's avatar and name
- Displays file attachments if any
- Shows error state with retry button if `status === 'error'`

**AI messages — streaming** (`role === 'ai'`, `status === 'sending'`, empty content):
- Shows `<TypingIndicator />` (three animated dots)

**AI messages — complete** (`role === 'ai'`, `status === 'sent'`):
- Left-aligned white/dark bubble
- Shows the full response text
- Shows `<CitationCard />` for each source below the message
- Shows a copy-to-clipboard button on hover

#### `src/components/chat/CitationCard.tsx`

An expandable card shown below AI messages that lists the source documents.

- **Collapsed:** shows document name, approximate page number, and relevance percentage
- **Expanded:** shows the exact text snippet retrieved from the document

The relevance score is displayed as a percentage (`Math.round(relevanceScore * 100)%`) inside a green pill badge.

#### `src/components/chat/ChatInput.tsx`

The input area at the bottom. Features:
- **Auto-resizing textarea** — grows up to 120px tall as you type, then scrolls
- **Send on Enter** — `Shift+Enter` for newline, plain `Enter` to send
- **File attachment** — clicking the paperclip opens a hidden `<input type="file">` for PDF, DOCX, TXT
- **Upload progress** — shows `<FileUploadPreview>` pills while files are uploading to the backend
- **Disabled states** — send button is disabled while streaming or while files are still uploading

#### `src/components/chat/FileUploadPreview.tsx`

A small pill showing an uploading file's name and a progress bar. Shows a spinning loader icon while uploading, a file icon when done. Has an X button to remove the attachment before sending.

#### `src/components/chat/TypingIndicator.tsx`

Three dots that animate up and down sequentially using Framer Motion, with staggered delays. Displayed while the AI response is being streamed.

---

### 4.6 Layout & Sidebar

#### `src/components/layout/AppLayout.tsx`

The root layout of the authenticated application. On mount, calls `loadConversations()` to populate the sidebar from the backend. Renders:
- `<Sidebar />` on the left (fixed width 288px)
- `<ChatArea />` taking up the remaining space

On mobile, the sidebar is hidden by default and toggled by a hamburger button in the chat header.

#### `src/components/sidebar/Sidebar.tsx`

The left navigation panel. Contains:
- **"New Chat" button** — calls `createConversation()` which resets the active state
- **Conversation list** — grouped by Today, Yesterday, Previous 7 Days, Older
- **User profile section** — avatar, name, email, and logout button at the bottom

On mobile screens (< 768px), the sidebar renders as an overlay with a dark backdrop. Switching to a conversation or starting a new chat automatically closes it.

#### `src/components/sidebar/ConversationItem.tsx`

A single row in the conversation list. Highlighted when active. Shows a trash icon on hover that calls `deleteConversation()` when clicked.

---

### 4.7 Utilities

#### `src/utils/formatTime.ts`

Two exported functions:

**`formatRelativeTime(date)`** — Returns a human-readable relative time string:
- "just now" (< 60 seconds)
- "5m ago" (< 1 hour)
- "3h ago" (< 1 day)
- "yesterday"
- "4d ago" (< 1 week)
- "Mar 15" (older)

**`groupConversationsByDate(conversations)`** — Buckets an array of conversations into four groups: Today, Yesterday, Previous 7 Days, Older. Used by the Sidebar to render the date group headings.

---

## 5. Backend — Deep Dive

### 5.1 Django Project Core

#### `backend/core/settings.py`

The master configuration file. Key sections:

**Database:**
```python
DATABASES = { "default": { "ENGINE": "django.db.backends.postgresql", ... } }
```
PostgreSQL stores users, conversations, messages, and document metadata.

**Redis (dual purpose):**
```python
CACHES = { "default": { "BACKEND": "django_redis.cache.RedisCache", ... } }
CHANNEL_LAYERS = { "default": { "BACKEND": "channels_redis.core.RedisChannelLayer", ... } }
```
Redis serves as both the Django cache layer AND the WebSocket channel routing bus.

**JWT settings:**
```python
SIMPLE_JWT = {
    "ACCESS_TOKEN_LIFETIME": timedelta(hours=1),   # short-lived
    "REFRESH_TOKEN_LIFETIME": timedelta(days=7),   # long-lived
    "ROTATE_REFRESH_TOKENS": True,                 # new refresh token on each use
}
```

**RAG settings:**
```python
RAG_CHUNK_SIZE = 1000     # characters per chunk
RAG_CHUNK_OVERLAP = 200   # overlap between chunks
RAG_TOP_K = 4             # how many chunks to retrieve
OPENAI_EMBEDDING_MODEL = "text-embedding-3-small"
OPENAI_CHAT_MODEL = "gpt-4o-mini"
FAISS_INDEX_PATH = BASE_DIR / "faiss_indexes"
```

**CORS:**
```python
CORS_ALLOWED_ORIGINS = ["http://localhost:3000", "http://127.0.0.1:3000"]
CORS_ALLOW_CREDENTIALS = True
```
Without this, browsers would block the React app's requests to Django (different ports = different origins).

---

#### `backend/core/urls.py`

The root URL router. Mounts each app's URL patterns:
```
/api/auth/      → apps.authentication.urls
/api/chat/      → apps.chat.urls
/api/documents/ → apps.documents.urls
/api/rag/       → apps.rag.urls
```

---

#### `backend/core/asgi.py`

ASGI (Async Server Gateway Interface) replaces the traditional WSGI for this project because WebSockets require a persistent async connection.

```python
application = ProtocolTypeRouter({
    "http":      get_asgi_application(),         # normal HTTP → Django views
    "websocket": AuthMiddlewareStack(            # WebSocket → Channels consumers
                    URLRouter(websocket_urlpatterns)
                 ),
})
```

The `AuthMiddlewareStack` reads the session/JWT token from the WebSocket handshake so consumers can identify which user is connected.

---

#### `backend/core/celery.py`

Celery is a distributed task queue. It runs slow operations (like document ingestion) in background worker processes so HTTP requests can return immediately.

```python
app = Celery("pip_support")
app.config_from_object("django.conf:settings", namespace="CELERY")
app.autodiscover_tasks()
```

The worker reads tasks from Redis (the broker), executes them, and stores results back in Redis.

---

### 5.2 Authentication App

#### `apps/authentication/models.py`

Extends Django's built-in `AbstractUser` with:
- `email` as the login field (unique, required)
- `company` field (for multi-tenant future use)
- `avatar_url` field
- `created_at` / `updated_at` timestamps

`USERNAME_FIELD = "email"` means Django's `authenticate()` function accepts email instead of username.

#### `apps/authentication/serializers.py`

**`RegisterSerializer`:**
- Validates `password` and `password2` match
- Runs Django's built-in password validators (min length, not too common, etc.)
- Creates the user via `create_user()` which hashes the password — never stored as plain text

**`UserSerializer`:**
- Read-only serializer for returning user profiles
- Excludes sensitive fields like password hash

#### `apps/authentication/views.py`

**`RegisterView` (POST `/api/auth/register/`):**
1. Validates input via `RegisterSerializer`
2. Creates the user
3. Generates JWT token pair
4. Returns `{ user, tokens }`

**`LoginView` (POST `/api/auth/login/`):**
1. Calls Django's `authenticate(username=email, password=password)` — checks the hashed password
2. Returns 401 if wrong credentials
3. Returns `{ user, tokens }` on success

**`MeView` (GET/PATCH `/api/auth/me/`):**
- `request.user` is automatically set by `JWTAuthentication` middleware
- Returns or updates the current user's profile

**`get_tokens_for_user(user)`:**
Uses `rest_framework_simplejwt`'s `RefreshToken.for_user()` to generate a signed token pair. The access token payload contains the user ID and is verified on each request WITHOUT hitting the database (stateless).

---

### 5.3 Documents App

#### `apps/documents/models.py`

**`Document` model:**
| Field | Purpose |
|---|---|
| `user` | ForeignKey — which user owns this document |
| `title` | Original filename |
| `file` | FileField — actual file stored at `media/documents/<user_id>/<filename>` |
| `file_type` | pdf, docx, or txt |
| `file_size` | in bytes |
| `status` | pending → processing → ready (or failed) |
| `error_message` | failure reason if ingestion fails |
| `chunk_count` | how many chunks were extracted |

The `upload_to` function separates files by user ID: `documents/<user_id>/<filename>`. This ensures users cannot guess other users' file paths.

**`DocumentChunk` model:**
| Field | Purpose |
|---|---|
| `document` | ForeignKey to Document |
| `content` | The actual text of this chunk |
| `chunk_index` | Order within the document |
| `faiss_vector_id` | The ID assigned by FAISS (for tracing) |

Why store chunks in SQL if FAISS handles retrieval? Because FAISS only stores vectors — not text. When returning citations to the frontend, we need the actual text snippets. PostgreSQL is the source of truth for text; FAISS is the source of truth for similarity.

#### `apps/documents/serializers.py`

**`DocumentUploadSerializer`:**
- Validates `content_type` against allowed types (PDF, DOCX, TXT)
- Validates file size ≤ 50 MB
- Returns a clean `file` object

#### `apps/documents/views.py`

**`DocumentUploadView` (POST `/api/documents/upload/`):**
1. Validates the uploaded file
2. Creates a `Document` record with `status='pending'`
3. Saves the file to disk
4. Calls `ingest_document_task.delay(document.id)` — the `.delay()` is Celery's way of saying "run this in the background, return immediately"
5. Returns HTTP 202 Accepted (meaning: received, but not finished yet)

**`DocumentListView` (GET `/api/documents/`):**
Returns all documents for the authenticated user. The `filter(user=request.user)` is critical — without it, a user could see other users' documents.

**`DocumentDetailView` (DELETE `/api/documents/<id>/`):**
Deletes the database record and removes the physical file from disk with `os.remove()`.

#### `apps/documents/tasks.py`

The Celery task `ingest_document_task` is the backbone of document processing:

```
Document saved to disk
        ↓
_load_document()
  PDF  → PyPDFLoader  (extracts text from each page)
  DOCX → Docx2txtLoader
  TXT  → TextLoader
        ↓
_split_text()
  RecursiveCharacterTextSplitter
  chunk_size=1000, chunk_overlap=200
  Tries to split on: paragraphs → sentences → words → characters
        ↓
get_or_create_vectorstore(user_id)
  Opens the user's FAISS index (or creates one)
        ↓
vectorstore.add_texts(chunks, metadatas)
  Sends each chunk to OpenAI → gets 1536-dim vector
  Stores in FAISS
        ↓
DocumentChunk.objects.bulk_create(chunks)
  Saves text content to PostgreSQL for later retrieval
        ↓
Document.status = 'ready'
```

**Error handling:** The task has `max_retries=3` and uses exponential backoff (60s, 120s, 240s between retries). After 3 failures it marks the document as `failed` with the error message.

---

### 5.4 RAG App

This is the intelligence layer. It transforms a user query into a grounded AI answer.

#### `apps/rag/vectorstore.py`

Manages per-user FAISS indexes.

**Why per-user indexes?**
Each user's documents are private. Storing all users in one index would require filtering by user ID after every search, which is slow and error-prone. Separate index files on disk make isolation both fast and secure.

**`get_or_create_vectorstore(user_id)`:**
- Checks if `faiss_indexes/<user_id>/index.faiss` exists
- If yes: loads it with `FAISS.load_local()`
- If no: creates a new FAISS index seeded with a dummy document (FAISS requires at least one vector to initialize)
- Returns a LangChain `FAISS` object that handles embedding automatically

**`similarity_search(user_id, query, k)`:**
1. Loads the user's FAISS index
2. Embeds the query using OpenAI (`text-embedding-3-small`)
3. Runs L2 nearest-neighbor search for top-k results
4. Filters out the dummy init document
5. Returns `[(Document, score), ...]` where score is L2 distance

#### `apps/rag/pipeline.py`

Implements the RAG logic as a **LangGraph state machine**.

**What is LangGraph?**
LangGraph is a library for building AI workflows as directed graphs. Instead of one long function, you define:
- **Nodes** — individual processing steps (Python functions)
- **Edges** — connections between steps
- **Conditional edges** — branches based on runtime state

**The `RAGState` TypedDict:**
```python
class RAGState(TypedDict):
    user_id: int
    query: str
    conversation_history: List[dict]
    retrieved_docs: List[dict]     # filled by retrieve_node
    answer: str                    # filled by generate_node or fallback_node
    sources: List[dict]            # filled by generate_node
    is_ambiguous: bool             # set by retrieve_node
    error: Optional[str]
```
This dictionary flows through the entire graph. Each node reads from it and returns an updated copy.

**Node 1: `retrieve_node`**
Calls `similarity_search()`. If the average L2 distance across results exceeds 1.5 (meaning the query is a poor match for all stored documents), sets `is_ambiguous = True`.

**Node 2: `generate_node`**
Constructs the LLM prompt:
```
System: You are a helpful AI. Use ONLY the provided context. Cite as [Source N].
Context:
  [Source 1]
  {chunk text}
  [Source 2]
  {chunk text}
  ...
Previous conversation:
  User: ...
  Assistant: ...
Human: {current query}
```
Sends to `gpt-4o-mini` via LangChain's `ChatOpenAI`. `temperature=0.1` keeps answers factual (low randomness).

**Node 3: `fallback_node`**
Two sub-behaviours:
- If `is_ambiguous=True`: asks the user to clarify their question
- If no documents at all: informs the user no relevant documents were found

**The routing function `route_after_retrieval`:**
```python
def route_after_retrieval(state):
    if state["retrieved_docs"] and not state["is_ambiguous"]:
        return "generate"
    return "fallback"
```
This is the conditional edge — LangGraph calls this after `retrieve_node` and uses the return value to decide which node runs next.

**Graph structure:**
```
[START]
   ↓
[retrieve]
   ↓
[route_after_retrieval] ──"generate"──→ [generate] ──→ [END]
                        ──"fallback"──→ [fallback] ──→ [END]
```

---

### 5.5 Chat App

#### `apps/chat/models.py`

**`Conversation` model:**
- Belongs to one user
- Has a title (auto-generated from the first message)
- `updated_at` is used to sort conversations newest-first in the sidebar

**`Message` model:**
- Belongs to one conversation
- `role` is either `'user'` or `'assistant'`
- `sources` is a `JSONField` storing the list of source citations
- Why JSON? Source citations are read-only display data. A separate `Source` table would add joins and complexity for no benefit.

**`conversation.get_history(limit=10)`:**
Returns the last 10 messages in LLM-ready format:
```python
[{"role": "user", "content": "..."}, {"role": "assistant", "content": "..."}]
```
This is passed into the RAG pipeline so the LLM has conversational context.

#### `apps/chat/views.py`

**`ChatView` (POST `/api/chat/`):**
The main chat endpoint. Full flow:
1. Validates input with `ChatRequestSerializer`
2. Gets existing conversation (by ID) or creates a new one
3. Saves the user's message to the DB
4. Retrieves conversation history
5. Calls `run_rag_pipeline(user_id, query, history)`
6. **Enriches sources with document titles** — the RAG pipeline only has `document_id`, so we look up titles with a single bulk query:
   ```python
   title_map = {d.id: d.title for d in Doc.objects.filter(id__in=doc_ids)}
   for s in sources:
       s["document_title"] = title_map.get(s["document_id"], "Unknown")
   ```
7. Saves the AI's response with sources to the DB
8. Returns `{ conversation_id, message }`

**`ConversationListView` (GET `/api/chat/conversations/`):**
Returns all conversations for the user with the last message preview. Used to populate the sidebar.

**`ConversationDetailView` (GET/DELETE `/api/chat/conversations/<id>/`):**
GET: Returns the full conversation with all messages and their sources.
DELETE: Removes the conversation and all its messages (cascade).

#### `apps/chat/consumers.py`

The **WebSocket consumer** for real-time streaming. Extends `AsyncWebsocketConsumer`.

**Connection lifecycle:**
```
Client connects to ws://localhost:8000/ws/chat/<conversation_id>/
    ↓ connect() called
    - Check user is authenticated (from AuthMiddlewareStack)
    - Accept connection
    - Join channel group
    ↓ receive() called when client sends a message
    - Parse JSON: { "query": "..." }
    - Call stream_rag_response()
    ↓ disconnect() called when connection closes
    - Leave channel group
```

**`stream_rag_response(query)`:**
1. Saves user message to DB
2. Gets conversation history
3. Runs FAISS similarity search
4. Looks up document titles for source attribution
5. Calls `stream_from_llm()` which uses `AsyncOpenAI` with `stream=True`

**`stream_from_llm()`:**
```python
async with client.chat.completions.create(..., stream=True) as stream:
    async for chunk in stream:
        token = chunk.choices[0].delta.content
        await self.send(text_data=json.dumps({
            "type": "token",
            "content": token
        }))
```
Each token is sent to the frontend as soon as OpenAI generates it. The frontend appends each token to the message bubble in real-time.

**Why use `database_sync_to_async`?**
Django's ORM is synchronous. WebSocket consumers run in an async event loop. Calling sync code from async context would block the event loop (freezing all WebSocket connections on the server). `database_sync_to_async` runs the DB call in a thread pool, returning control to the event loop while waiting.

---

## 6. The RAG Pipeline — Step by Step

Here is the complete journey of a single user query through the system:

```
User types: "What is the return policy for electronics?"
                            │
                            ▼
              POST /api/chat/
              { query: "What is the return...", conversation_id: 42 }
                            │
                            ▼
              ChatView receives request
              → fetches conversation #42 from PostgreSQL
              → fetches last 10 messages for context
                            │
                            ▼
              run_rag_pipeline(user_id=7, query="...", history=[...])
                            │
                            ▼
              ┌─────────── retrieve_node ────────────────┐
              │                                          │
              │  1. Call OpenAI text-embedding-3-small   │
              │     "What is the return policy for..."   │
              │     → [0.023, -0.41, 0.87, ...]         │
              │        (1536 numbers)                    │
              │                                          │
              │  2. FAISS L2 search in user #7's index  │
              │     Finds 4 nearest vectors              │
              │     → chunk from Returns_Policy.pdf      │
              │     → chunk from FAQ.pdf                 │
              │     → chunk from Terms.pdf               │
              │     → chunk from Returns_Policy.pdf      │
              │                                          │
              │  3. avg_score = 0.4 → not ambiguous     │
              └──────────────────────────────────────────┘
                            │
                  route_after_retrieval: "generate"
                            │
                            ▼
              ┌─────────── generate_node ────────────────┐
              │                                          │
              │  Build prompt:                           │
              │  ┌────────────────────────────────────┐  │
              │  │ System: You are a helpful AI.      │  │
              │  │ Use ONLY the context. Cite [N].    │  │
              │  │                                    │  │
              │  │ [Source 1]                         │  │
              │  │ Electronics may be returned within │  │
              │  │ 30 days with original receipt...   │  │
              │  │                                    │  │
              │  │ [Source 2]                         │  │
              │  │ Items must be in original packaging│  │
              │  │                                    │  │
              │  │ Previous: User asked about...      │  │
              │  │                                    │  │
              │  │ Human: What is the return policy..│  │
              │  └────────────────────────────────────┘  │
              │                                          │
              │  Send to gpt-4o-mini (temperature=0.1)  │
              │  → "Electronics can be returned within  │
              │     30 days [Source 1]. Items must be   │
              │     in original packaging [Source 2]."   │
              └──────────────────────────────────────────┘
                            │
                            ▼
              Enrich sources with document titles
              (bulk DB query: document_id → title)
                            │
                            ▼
              Save AI message to PostgreSQL
              (content + sources JSON)
                            │
                            ▼
              Return to frontend:
              {
                "conversation_id": 42,
                "message": {
                  "id": 891,
                  "role": "assistant",
                  "content": "Electronics can be returned...",
                  "sources": [
                    { "document_title": "Returns_Policy.pdf",
                      "content": "Electronics may be returned...",
                      "relevance_score": 0.12 }
                  ]
                }
              }
                            │
                            ▼
              chatStore.sendMessage() receives response
              Simulates streaming: reveals response word-by-word at 40ms/word
              Converts sources → Citations (L2 distance → 0-1 score)
              Renders CitationCard below the message
```

---

## 7. WebSocket Streaming

For true token-by-token streaming (instead of the simulated word-reveal), the backend has a WebSocket consumer at `ws://localhost:8000/ws/chat/<conversation_id>/`.

**Connection (from frontend JavaScript):**
```javascript
const ws = new WebSocket("ws://localhost:8000/ws/chat/42/");

ws.onmessage = (event) => {
    const data = JSON.parse(event.data);

    if (data.type === "token") {
        // Append token to message bubble
        appendToken(data.content);
    }
    if (data.type === "done") {
        // Show source citations
        showSources(data.sources);
    }
    if (data.type === "error") {
        showError(data.message);
    }
};

ws.send(JSON.stringify({ query: "What is the refund policy?" }));
```

**Message protocol:**
| Direction | Type | Payload |
|---|---|---|
| Client → Server | (any) | `{ "query": "..." }` |
| Server → Client | token | `{ "type": "token", "content": "The " }` |
| Server → Client | done | `{ "type": "done", "sources": [...] }` |
| Server → Client | error | `{ "type": "error", "message": "..." }` |

The HTTP endpoint (`POST /api/chat/`) is used by the React app by default. The WebSocket endpoint is available for integrations that want true server-sent token streaming.

---

## 8. JWT Authentication Flow

```
1. User submits login form
        ↓
2. POST /api/auth/login/  { email, password }
        ↓
3. Django: authenticate(username=email, password=password)
   - Looks up user by email
   - Verifies bcrypt hash of password
        ↓
4. Generate JWT pair:
   - Access token  (expires in 1 hour)
     Payload: { user_id: 7, exp: <timestamp>, ... }
     Signed with SECRET_KEY using HS256
   - Refresh token (expires in 7 days)
        ↓
5. Return { user: {...}, tokens: { access, refresh } }
        ↓
6. Frontend: store tokens in localStorage
        ↓
7. Every subsequent API request:
   Header: Authorization: Bearer eyJhbGciOiJIUzI1NiJ9...
        ↓
8. Django JWTAuthentication:
   - Decodes the token (verifies signature)
   - Checks expiry
   - Sets request.user = User.objects.get(id=7)
   No database hit needed — all info is in the token!
        ↓
9. When access token expires (1 hour):
   POST /api/auth/refresh/  { refresh: "eyJ..." }
   → New access token returned
   → Frontend retries original request
        ↓
10. When refresh token expires (7 days):
    Frontend clears tokens → user sees login page
```

---

## 9. Document Ingestion Pipeline

```
User uploads Policy.pdf (2 MB)
        ↓
POST /api/documents/upload/
- Validates file type and size
- Saves to: media/documents/7/Policy.pdf
- Creates Document(status='pending')
- Returns HTTP 202 immediately
        ↓
Celery picks up ingest_document_task(document_id=15)
(runs in a separate worker process)
        ↓
PyPDFLoader("media/documents/7/Policy.pdf")
→ Extracts text from all pages
→ "RETURN POLICY\n\nElectronics may be returned..."
        ↓
RecursiveCharacterTextSplitter(chunk_size=1000, chunk_overlap=200)
→ Chunk 0 (chars 0-1000):    "RETURN POLICY\n\nElectronics..."
→ Chunk 1 (chars 800-1800):  "...original packaging. Refunds..."
→ Chunk 2 (chars 1600-2600): "...processed within 14 days..."
...
(overlap of 200 chars ensures context is not lost at boundaries)
        ↓
For each chunk:
  OpenAI text-embedding-3-small → 1536-dimensional vector
  Cost: ~$0.00002 per chunk (very cheap)
        ↓
FAISS.add_texts(chunks, metadatas)
→ Stores vectors in: faiss_indexes/7/index.faiss
→ Saves index to disk
        ↓
DocumentChunk.objects.bulk_create(chunks)
→ Stores chunk text in PostgreSQL for citation display
        ↓
Document.status = 'ready'
Document.chunk_count = 47
        ↓
User can now ask questions about Policy.pdf
```

---

## 10. Database Schema

```sql
-- Users
users (
    id           BIGSERIAL PRIMARY KEY,
    username     VARCHAR(150) UNIQUE,
    email        VARCHAR(254) UNIQUE,   ← login field
    password     VARCHAR(128),           ← bcrypt hash
    company      VARCHAR(200),
    avatar_url   VARCHAR(200),
    created_at   TIMESTAMPTZ,
    updated_at   TIMESTAMPTZ
)

-- Conversations
conversations (
    id           BIGSERIAL PRIMARY KEY,
    user_id      BIGINT REFERENCES users(id) ON DELETE CASCADE,
    title        VARCHAR(255),
    created_at   TIMESTAMPTZ,
    updated_at   TIMESTAMPTZ          ← used for sidebar ordering
)

-- Messages
messages (
    id              BIGSERIAL PRIMARY KEY,
    conversation_id BIGINT REFERENCES conversations(id) ON DELETE CASCADE,
    role            VARCHAR(20),      ← 'user' or 'assistant'
    content         TEXT,
    sources         JSONB,            ← array of source citation objects
    created_at      TIMESTAMPTZ
)

-- Documents
documents (
    id            BIGSERIAL PRIMARY KEY,
    user_id       BIGINT REFERENCES users(id) ON DELETE CASCADE,
    title         VARCHAR(255),
    file          VARCHAR(255),       ← relative path on disk
    file_type     VARCHAR(10),        ← pdf, docx, txt
    file_size     INTEGER,
    status        VARCHAR(20),        ← pending/processing/ready/failed
    error_message TEXT,
    chunk_count   INTEGER,
    created_at    TIMESTAMPTZ,
    updated_at    TIMESTAMPTZ
)

-- Document Chunks (text content only — vectors are in FAISS)
document_chunks (
    id              BIGSERIAL PRIMARY KEY,
    document_id     BIGINT REFERENCES documents(id) ON DELETE CASCADE,
    content         TEXT,
    chunk_index     INTEGER,
    faiss_vector_id INTEGER,          ← FAISS internal ID for tracing
    created_at      TIMESTAMPTZ
)
```

---

## 11. API Reference

### Authentication

| Method | Endpoint | Auth | Body | Response |
|---|---|---|---|---|
| POST | `/api/auth/register/` | None | `{username, email, password, password2, company?}` | `{user, tokens}` |
| POST | `/api/auth/login/` | None | `{email, password}` | `{user, tokens}` |
| POST | `/api/auth/refresh/` | None | `{refresh}` | `{access}` |
| GET | `/api/auth/me/` | JWT | — | `{id, username, email, ...}` |
| PATCH | `/api/auth/me/` | JWT | `{company?, avatar_url?}` | `{id, username, ...}` |

### Chat

| Method | Endpoint | Auth | Body | Response |
|---|---|---|---|---|
| POST | `/api/chat/` | JWT | `{query, conversation_id?}` | `{conversation_id, message}` |
| GET | `/api/chat/conversations/` | JWT | — | `[{id, title, last_message, updated_at}]` |
| GET | `/api/chat/conversations/<id>/` | JWT | — | `{id, title, messages: [...]}` |
| DELETE | `/api/chat/conversations/<id>/` | JWT | — | `{message: "deleted"}` |

### Documents

| Method | Endpoint | Auth | Body | Response |
|---|---|---|---|---|
| POST | `/api/documents/upload/` | JWT | `multipart: {file}` | `{document, message}` |
| GET | `/api/documents/` | JWT | — | `[{id, title, status, chunk_count, ...}]` |
| GET | `/api/documents/<id>/` | JWT | — | `{id, title, status, ...}` |
| DELETE | `/api/documents/<id>/` | JWT | — | `{message: "deleted"}` |

### RAG (Direct Query)

| Method | Endpoint | Auth | Body | Response |
|---|---|---|---|---|
| POST | `/api/rag/query/` | JWT | `{query}` | `{answer, sources, retrieved_docs}` |

### WebSocket

| URL | Protocol | Description |
|---|---|---|
| `ws://localhost:8000/ws/chat/<conversation_id>/` | JSON messages | Streaming chat responses |

**Send:** `{ "query": "your question" }`
**Receive:** `{ "type": "token", "content": "word " }` (repeated) then `{ "type": "done", "sources": [...] }`

---

## 12. Environment Variables

Create `backend/.env` by copying `backend/.env.example`:

```bash
cp backend/.env.example backend/.env
```

| Variable | Description | Example |
|---|---|---|
| `SECRET_KEY` | Django secret key (any long random string) | `django-insecure-abc123...` |
| `DEBUG` | Enable debug mode (False in production) | `True` |
| `ALLOWED_HOSTS` | Comma-separated allowed hostnames | `localhost,127.0.0.1` |
| `DB_NAME` | PostgreSQL database name | `pip_support` |
| `DB_USER` | PostgreSQL username | `postgres` |
| `DB_PASSWORD` | PostgreSQL password | `postgres` |
| `DB_HOST` | PostgreSQL host | `localhost` |
| `DB_PORT` | PostgreSQL port | `5432` |
| `REDIS_URL` | Redis connection URL | `redis://localhost:6379` |
| `OPENAI_API_KEY` | Your OpenAI API key | `sk-proj-...` |
| `CORS_ALLOWED_ORIGINS` | Frontend origins allowed to call the API | `http://localhost:3000` |

**Get an OpenAI API key:**
1. Go to platform.openai.com
2. Create an account
3. Go to API Keys → Create new secret key
4. Paste it as `OPENAI_API_KEY` in your `.env`

**Cost estimate:** For a typical development session (100 questions, 50 document pages):
- Embeddings: ~$0.01
- Chat completions: ~$0.10
- Total: < $0.20

---

## 13. Running Locally — Step by Step

### Prerequisites

- Python 3.11+
- Node.js 18+
- Docker Desktop (for PostgreSQL and Redis)
- An OpenAI API key

### Step 1: Clone and configure

```bash
# Navigate into the project
cd /path/to/PIP

# Copy and edit the environment file
cp backend/.env.example backend/.env
# Open backend/.env and set your OPENAI_API_KEY
```

### Step 2: Start infrastructure

```bash
cd backend
docker-compose up -d
# This starts PostgreSQL on port 5432 and Redis on port 6379
```

Verify they're running:
```bash
docker-compose ps
# Should show both containers as "Up"
```

### Step 3: Set up the Django backend

```bash
# Create a Python virtual environment
python -m venv venv
source venv/bin/activate        # on Windows: venv\Scripts\activate

# Install dependencies
pip install -r requirements.txt

# Create database tables
python manage.py makemigrations
python manage.py migrate

# Create the FAISS index directory
mkdir -p faiss_indexes

# Create an admin user (optional — for /admin panel)
python manage.py createsuperuser

# Start the server (Daphne supports both HTTP and WebSocket)
daphne -b 0.0.0.0 -p 8000 core.asgi:application
```

The backend is now running at: `http://localhost:8000`

### Step 4: Start the Celery worker (in a new terminal)

```bash
cd backend
source venv/bin/activate
celery -A core.celery worker --loglevel=info
```

The Celery worker is needed to process uploaded documents in the background.

### Step 5: Start the React frontend (in a new terminal)

```bash
cd frontend
npm install
npm run dev
```

The frontend is now running at: `http://localhost:3000`

### Step 6: Test the full flow

1. Open `http://localhost:3000`
2. Click **Sign up** and create an account
3. Click the **paperclip** icon in the chat input
4. Upload a PDF or TXT file (your company policy, FAQ, manual, etc.)
5. Wait ~10–30 seconds for ingestion (watch Celery worker logs)
6. Ask a question about the document content
7. The AI responds with an answer and cites the specific passage

---

## 14. Technology Choices Explained

| Technology | Why chosen | Alternative |
|---|---|---|
| **React + TypeScript** | Component model matches the chat UI structure; TypeScript catches bugs at build time | Vue, Svelte |
| **Zustand** | Simpler than Redux; no boilerplate; built-in persistence middleware | Redux Toolkit, Jotai |
| **Tailwind CSS** | Utility classes mean no separate CSS files; dark mode via `dark:` prefix | CSS Modules, styled-components |
| **Framer Motion** | Declarative animation API for React; handles enter/exit animations cleanly | CSS transitions |
| **Django** | Batteries-included: ORM, admin, auth, migrations all built in | FastAPI, Flask |
| **Django REST Framework** | Serializers enforce API shape; ViewSets reduce boilerplate | Manual Django views |
| **SimpleJWT** | Stateless auth (no session table); refresh token rotation built in | django-allauth, session auth |
| **Django Channels** | Extends Django to support WebSockets using the same project structure | FastAPI WebSockets |
| **PostgreSQL** | ACID compliance, JSONB for sources, reliable at scale | SQLite (dev only), MySQL |
| **Redis** | Serves as both Django cache AND Channels layer AND Celery broker — one service, three uses | Memcached (cache only) |
| **FAISS** | Free, runs locally, extremely fast similarity search, no external dependencies | Pinecone (managed, costs money), Weaviate |
| **Celery** | Proven Python task queue; handles retries, scheduling, monitoring | RQ (simpler but less features) |
| **LangChain** | Provides document loaders, text splitters, and FAISS wrapper with consistent API | Raw OpenAI SDK + custom splitting |
| **LangGraph** | Makes conditional logic in AI pipelines explicit and testable | If/else chains in a single function |
| **OpenAI** | Best-in-class embeddings and chat; `text-embedding-3-small` is cheap; `gpt-4o-mini` is affordable | Llama 3 (local), Mistral |
| **Daphne** | The reference ASGI server for Django Channels; handles HTTP + WebSocket | Uvicorn + Starlette |

---

*Built with Django 4.2, React 18, LangChain 0.1, LangGraph, FAISS, and OpenAI.*
