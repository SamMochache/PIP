# 🤖 AI Customer Support Agent (RAG-Powered)

An AI-powered customer support system that leverages **Retrieval-Augmented Generation (RAG)** to deliver accurate, context-aware responses based on company documents.

This project is designed to simulate a **real-world intelligent support assistant**, combining modern frontend UX with a scalable AI backend architecture.

---

## 🚀 Project Status

- ✅ Frontend (React + TypeScript) — **Completed**  
- 🚧 Backend (Django + RAG pipeline) — *In Progress*

---

## 🧠 Key Idea

Traditional chatbots guess.

This system:
1. Retrieves relevant company data (documents, FAQs, etc.)
2. Feeds it into an LLM
3. Generates **fact-based answers with sources**

👉 Result: **Accurate, explainable AI support**

---

## 🖥️ Frontend Overview

The frontend provides a **modern ChatGPT-like interface** tailored for customer support interactions.

### ✨ Features

- 💬 **Interactive Chat UI**
  - User & AI message bubbles
  - Smooth scrolling & auto-focus input
  - Typing/streaming indicator

- 📂 **File Upload Interface**
  - Upload documents (PDF, DOCX, TXT)
  - Visual feedback for upload progress

- 🧾 **Source Citations**
  - AI responses include references
  - Expandable/clickable sources (UI ready)

- 🗂️ **Conversation Management**
  - Sidebar with chat history
  - Switch between conversations
  - Start new chats

- 🔐 **Authentication UI**
  - Login & Signup pages (UI only for now)

- 🎨 **User Experience**
  - Responsive design (mobile + desktop)
  - Loading states & error handling
  - Clean, modular component structure

---

## 🏗️ Frontend Tech Stack

- React (TypeScript)
- CSS / Tailwind
- Axios / Fetch API
- Context API (State Management)

---

## 📁 Frontend Structure
frontend/
└── src/
├── components/
│ ├── ChatWindow.tsx
│ ├── MessageBubble.tsx
│ ├── Sidebar.tsx
│ ├── FileUpload.tsx
│
├── pages/
│ ├── ChatPage.tsx
│ ├── LoginPage.tsx
│
├── services/
│ ├── api.ts
│ ├── chatService.ts
│
├── hooks/
│ ├── useChat.ts
│
├── context/
│ ├── AuthContext.tsx


---

## 🔌 API Integration (Planned)

The frontend is structured to integrate with the following backend endpoints:

| Method | Endpoint               | Description                      |
|--------|----------------------|----------------------------------|
| POST   | `/api/chat/`         | Send user message                |
| GET    | `/api/conversations/`| Fetch chat history               |
| POST   | `/api/upload/`       | Upload documents for indexing    |

---

## 🧪 Running the Frontend Locally

```bash
# Navigate to frontend
cd frontend

# Install dependencies
npm install

# Start development server
npm run dev