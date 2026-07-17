# Intelligent Multi-Agent Resume Assistant

A production-grade full-stack AI application featuring a **4-agent LangGraph system** for resume intelligence, AI/ML knowledge queries, and conversational interaction.

**Live Demo:** https://ai-resume-assistant-lyart.vercel.app/  
**GitHub:** https://github.com/CHARITHESHJ27/AI-Resume-Assistant

---

## ⚠️ Disclaimer — LLM Provider & Live Demo

This project supports **4 LLM providers** that are swappable via a single `LLM_PROVIDER` env variable:

| Provider | Requires | Notes |
|----------|----------|-------|
| `ollama` | [Ollama](https://ollama.com) running locally | **Free, no API key needed** — default for local dev |
| `openai` | `OPENAI_API_KEY` | GPT-4o-mini, paid |
| `gemini` | `GEMINI_API_KEY` | Gemini 1.5 Flash, free tier available |
| `grok` | `GROK_API_KEY` | xAI Grok, paid |

**For local development**, I personally run this with **Ollama** (`llama3.2`) — it's completely free and runs on your machine with no API key required. Just [install Ollama](https://ollama.com/download), pull the model (`ollama pull llama3.2`), and set `LLM_PROVIDER=ollama` in your `.env`.

**The live demo** is hosted on Railway with **Grok** (`grok-3-mini`) as the LLM provider since Ollama can't run on cloud servers. If you fork this project and deploy it yourself, swap in whichever provider you have an API key for — all four work identically.

> **Fallback behavior:** If the configured provider's API key is missing or invalid, the backend automatically falls back to Ollama. So even if you set `LLM_PROVIDER=grok` but don't have a key, it won't crash — it'll just use Ollama locally.

---

## Architecture

```
User Message
     │
     ▼
┌──────────────────┐
│ Supervisor Agent │  ← Confidence-scored routing (0.0–1.0)
└────────┬─────────┘
         │
    ┌────┼────────┐
    ▼    ▼        ▼
┌──────┐ ┌───────┐ ┌──────────┐
│Resume│ │General│ │ Chitchat │
│ RAG  │ │  AI   │ │  Agent   │
│Agent │ │ Agent │ │          │
└──────┘ └───────┘ └──────────┘
    │         │          │
    └────┬────┘──────────┘
         ▼
   Response to User
```

### Agent Roles

| Agent | Trigger | Capability |
|-------|---------|------------|
| **Supervisor** | Every message | Confidence-scored routing with context window |
| **Resume RAG Agent** | Resume/career queries | Hybrid semantic+BM25 retrieval, cross-encoder reranking, MMR diversity |
| **General AI Agent** | AI/ML concept queries | Domain-aware expert knowledge with memory trimming |
| **Chitchat Agent** | Greetings/small talk | Zero-LLM instant responses |

---

## Hybrid RAG Pipeline

The Resume RAG Agent uses a 6-stage retrieval pipeline:

```
Query
  │
  ├─► Stage 1: Query Expansion (LLM → 3 variants)
  │
  ├─► Stage 2a: Semantic Search (ChromaDB cosine similarity)  ──┐
  ├─► Stage 2b: BM25 Search (rank-bm25 keyword matching)  ──────┤
  │                                                              ▼
  │                                               Stage 3: Reciprocal Rank Fusion
  │                                                              │
  │                                               Stage 4: Cross-Encoder Reranking
  │                                               (ms-marco-MiniLM-L-6-v2)
  │                                                              │
  │                                               Stage 5: MMR Diversity Filter
  │                                                              │
  └──────────────────────────────────────────────Stage 6: Score Threshold → Top-5
                                                                 │
                                                           LLM Context
```

---

## Tech Stack

**Backend**
- Python 3.11+, FastAPI, LangGraph, LangChain
- OpenAI GPT-4o-mini / Ollama / Gemini (swappable via config)
- ChromaDB for vector storage
- `sentence-transformers` — bi-encoder embeddings + cross-encoder reranking
- `rank-bm25` — BM25Okapi keyword retrieval
- Server-Sent Events (SSE) for real-time streaming
- Rate limiting via `slowapi`

**Frontend**
- Next.js 16 (App Router), TypeScript
- Tailwind CSS v4
- `framer-motion` — message animations, typing indicator
- `react-markdown` + `react-syntax-highlighter` — formatted AI responses
- `react-virtuoso` — virtualized message list
- Lucide React icons

---

## Local Setup

### Quick Start (recommended)

```bash
# Install all dependencies
make install

# Run both backend + frontend
make dev
```

Or run them separately:

```bash
make backend    # http://localhost:8000
make frontend   # http://localhost:3000
```

### Manual Setup

#### Backend

```bash
cd backend
pip install -r requirements.txt

cp .env.example .env
# Set LLM_PROVIDER=ollama for local (free), or add an API key for openai/gemini/grok

uvicorn main:app --reload --port 8000
```

#### Frontend

```bash
cd frontend
npm install
cp .env.example .env.local

npm run dev
# Open http://localhost:3000
```

---

## Environment Variables

### Backend (`.env`)

| Variable | Default | Description |
|----------|---------|-------------|
| `LLM_PROVIDER` | `ollama` | `ollama` \| `openai` \| `gemini` \| `grok` |
| `OLLAMA_BASE_URL` | `http://localhost:11434` | Ollama server URL |
| `OLLAMA_MODEL` | `llama3.2` | Ollama model name |
| `OPENAI_API_KEY` | — | Required if `LLM_PROVIDER=openai` |
| `OPENAI_MODEL` | `gpt-4o-mini` | OpenAI model name |
| `GEMINI_API_KEY` | — | Required if `LLM_PROVIDER=gemini` |
| `GEMINI_MODEL` | `gemini-1.5-flash` | Gemini model name |
| `GROK_API_KEY` | — | Required if `LLM_PROVIDER=grok` |
| `GROK_MODEL` | `grok-3-mini` | xAI Grok model name |
| `CHROMA_PERSIST_DIR` | `./vector_store/chroma_db` | ChromaDB storage path |
| `CORS_ORIGINS` | `http://localhost:3000` | Comma-separated allowed origins |

### Frontend (`.env.local`)

| Variable | Default | Description |
|----------|---------|-------------|
| `NEXT_PUBLIC_API_URL` | `http://localhost:8000` | Backend URL (client-side) |
| `BACKEND_URL` | `http://localhost:8000` | Backend URL (server-side proxy) |

---

## Sample Queries

**Resume RAG Agent** (📄 violet badge):
- "What skills does a machine learning engineer typically have?"
- "Show me experience examples for computer vision roles"
- "What certifications are common in AI engineering?"
- "Check my resume" *(attach a .txt/.md resume file)*

**General AI Agent** (🤖 blue badge):
- "How does the attention mechanism work in transformers?"
- "What is the difference between YOLO and Faster R-CNN?"
- "What are best practices for deploying ML models to production?"
- "Explain the difference between RAG and fine-tuning"

---

## Features

- ✅ 4-agent LangGraph orchestration with confidence-scored supervisor routing
- ✅ Hybrid RAG: semantic + BM25 + RRF + cross-encoder reranking + MMR diversity
- ✅ Resume file upload — attach your own resume for personalized analysis
- ✅ Real-time streaming responses (SSE)
- ✅ Conversation sidebar — browse and switch between past conversations
- ✅ Export chat to `.txt`
- ✅ Dark / light mode toggle
- ✅ Copy message to clipboard
- ✅ Clear conversation
- ✅ Agent badge showing which agent responded
- ✅ Sample query shortcuts
- ✅ Responsive design (mobile + desktop)
- ✅ Stop generation mid-stream
- ✅ Formatted responses (markdown, code blocks with syntax highlighting)
- ✅ Framer Motion message animations
- ✅ Virtualized message list (react-virtuoso)
- ✅ Full ARIA accessibility

---

## Deployment

### Links

- **Live Demo:** https://ai-resume-assistant-lyart.vercel.app/
- **GitHub Repository:** https://github.com/CHARITHESHJ27/AI-Resume-Assistant

### Frontend → Vercel

```bash
# 1. Push repo to GitHub
# 2. Import at vercel.com
# 3. Set environment variable:
NEXT_PUBLIC_API_URL=https://your-backend-url
BACKEND_URL=https://your-backend-url
# 4. Deploy
```

### Backend → Railway / Render

```bash
# 1. Connect GitHub repo, set root to backend/
# 2. Set environment variables from .env.example
# 3. Start command:
uvicorn main:app --host 0.0.0.0 --port 8000
```

---

## Project Structure

```
Multi-Agent/
├── backend/
│   ├── agents/
│   │   ├── __init__.py        # LangGraph graph builder + chitchat node
│   │   ├── state.py           # Shared AgentState (Pydantic)
│   │   ├── supervisor.py      # Confidence-scored routing agent
│   │   ├── resume_rag.py      # Hybrid RAG pipeline (6 stages)
│   │   └── general_ai.py      # AI/ML knowledge agent
│   ├── data/resumes/          # 8 anonymized resume samples (.txt)
│   ├── vector_store/          # ChromaDB persistence
│   ├── tests/                 # pytest test suite
│   ├── main.py                # FastAPI app + SSE streaming
│   ├── config.py              # Pydantic settings
│   ├── llm_factory.py         # LLM provider abstraction
│   ├── security.py            # Input sanitization
│   ├── logger.py              # Logging configuration
│   └── requirements.txt
└── frontend/
    └── src/
        ├── app/
        │   ├── api/chat/route.ts    # Next.js SSE proxy
        │   ├── layout.tsx
        │   └── page.tsx
        ├── components/chat/
        │   ├── ChatContainer.tsx    # Main state + conversation sidebar
        │   ├── Header.tsx           # Nav bar + export + theme toggle
        │   ├── MessageList.tsx      # Virtualized message list
        │   ├── MessageBubble.tsx    # Markdown rendering + animations
        │   ├── ChatInput.tsx        # Input + file attachment
        │   └── TypingIndicator.tsx  # Framer Motion dots
        ├── lib/
        │   ├── api.ts               # SSE streaming client
        │   └── utils.ts             # Helpers + constants
        └── types/index.ts           # TypeScript types
```

---

## API Reference

### `POST /api/chat/stream`
Streaming SSE endpoint.

**Request:**
```json
{
  "messages": [
    {
      "role": "user",
      "content": "What skills does an ML engineer need?",
      "attachments": []
    }
  ]
}
```

**SSE Events:**
```
data: {"type": "agent", "agent": "Resume RAG Agent", "query_type": "resume"}
data: {"type": "token", "content": "Machine learning engineers typically..."}
data: {"type": "done"}
data: {"type": "error", "message": "..."}
```

### `POST /api/chat`
Non-streaming endpoint. Returns full response JSON.

### `GET /api/health`
Health check. Returns `{"status": "ok", "version": "1.0.0"}`.

### `POST /api/vector-store/init`
Manually trigger vector store initialization (rate limited: 5/min).
