# Frontend — AI Resume Assistant

Next.js 16 frontend for the Multi-Agent Resume Assistant.

## Stack

- **Next.js 16** (App Router) + TypeScript
- **Tailwind CSS v4** — utility-first styling
- **framer-motion** — message entry animations, typing indicator
- **react-markdown** + **react-syntax-highlighter** — formatted AI responses with code highlighting
- **react-virtuoso** — virtualized message list for performance
- **Lucide React** — icons

## Setup

```bash
npm install
cp .env.example .env.local
npm run dev
# → http://localhost:3000
```

## Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `NEXT_PUBLIC_API_URL` | `http://localhost:8000` | Backend URL (used client-side for direct SSE) |
| `BACKEND_URL` | `http://localhost:8000` | Backend URL (used server-side in `/api/chat` proxy) |

## Scripts

```bash
npm run dev      # Development server (Turbopack)
npm run build    # Production build
npm run start    # Production server
npm run lint     # ESLint
```

## Structure

```
src/
├── app/
│   ├── api/chat/route.ts    # Server-side SSE proxy to backend
│   ├── layout.tsx           # Root layout + fonts + metadata
│   └── page.tsx             # Entry point → ChatContainer
├── components/chat/
│   ├── ChatContainer.tsx    # Root state: messages, conversations, theme
│   ├── Header.tsx           # Sidebar toggle, export, theme, clear
│   ├── MessageList.tsx      # react-virtuoso virtualized list + welcome screen
│   ├── MessageBubble.tsx    # Per-message: markdown, agent badge, copy, animation
│   ├── ChatInput.tsx        # Textarea + file attach + send/stop
│   └── TypingIndicator.tsx  # Animated dots while AI streams
├── lib/
│   ├── api.ts               # SSE streaming client + message factories
│   └── utils.ts             # cn(), formatTime(), AGENT_COLORS, SAMPLE_QUERIES
└── types/index.ts           # Message, Conversation, AgentType, StreamEvent
```

## Key Behaviours

- **Streaming** — connects directly to backend SSE via `NEXT_PUBLIC_API_URL`. The `/api/chat` route is a server-side proxy fallback.
- **File attachments** — `.txt`, `.md`, `.json`, `.csv` files are read client-side and sent as `attachments[]` in the message payload. The backend Resume RAG agent prioritizes uploaded content over indexed resumes.
- **Conversation sidebar** — conversations are stored in React state (in-memory, not persisted). Each conversation auto-titles from the first user message.
- **Export** — downloads the full conversation as a `.txt` file.
- **Agent badges** — Resume RAG Agent (violet), General AI Agent (blue). Chitchat responses show no badge.
