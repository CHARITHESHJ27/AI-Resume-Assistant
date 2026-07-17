# Learning Journal

**Project:** Intelligent Multi-Agent Resume Assistant  
**Stack:** Python 3.11 · FastAPI · LangGraph · ChromaDB · Next.js 16 · Tailwind CSS v4

---

## What Was Built

A production-grade 4-agent LangGraph system with a hybrid RAG pipeline and a fully upgraded React frontend.

### Agent System
- **Supervisor** — confidence-scored routing (0.0–1.0) with structured output parsing and 3-turn context window
- **Resume RAG Agent** — 6-stage hybrid retrieval pipeline
- **General AI Agent** — domain-aware AI/ML knowledge with memory trimming and uncertainty detection
- **Chitchat Agent** — zero-LLM instant responses for greetings and small talk

### Hybrid RAG Pipeline (6 Stages)
1. **Query Expansion** — LLM rewrites vague queries into 3 specific search variants
2. **Semantic Search** — ChromaDB cosine similarity (`all-MiniLM-L6-v2`)
3. **BM25 Search** — `rank-bm25` keyword matching (BM25Okapi)
4. **Reciprocal Rank Fusion (RRF)** — merges both ranked lists using `1/(k + rank)` formula
5. **Cross-Encoder Reranking** — `ms-marco-MiniLM-L-6-v2` rescores top-12 candidates
6. **MMR Diversity Filter** — Maximal Marginal Relevance removes near-duplicate chunks

### Frontend Upgrades
- `framer-motion` — message slide-in animations, typing indicator
- `react-markdown` + `react-syntax-highlighter` — proper code blocks with `oneDark`/`oneLight` themes
- `react-virtuoso` — virtualized message list (handles thousands of messages)
- Conversation sidebar with auto-titling and in-memory persistence
- File attachment support (`.txt`, `.md`, `.json`, `.csv`)
- Export chat to `.txt`
- Full ARIA accessibility (roles, labels, live regions)

---

## Key Technical Learnings

### Why Hybrid Retrieval Beats Pure Semantic Search

Semantic search (embeddings) is excellent at finding conceptually similar content but fails on exact keyword matches. BM25 is the opposite — great for specific terms like "PyTorch", "YOLO", "SageMaker" but blind to synonyms. RRF fusion captures both: a chunk ranked highly by both retrievers scores much higher than one ranked highly by only one.

The cross-encoder reranker (`ms-marco-MiniLM-L-6-v2`) reads the full `(query, chunk)` pair together — unlike bi-encoders which embed them separately. This is significantly more accurate but slower, so it only runs on the top-12 RRF candidates.

MMR prevents the LLM from receiving 5 near-identical chunks from the same resume section. The `λ=0.6` parameter means 60% weight on relevance, 40% on diversity.

### Supervisor Routing Design

The original supervisor had a typo (`"g"` instead of `"general_ai"`) that silently broke all AI/ML routing. The fix was structured output parsing:

```
ROUTE: general_ai
CONFIDENCE: 0.94
REASON: Query is about transformer architecture theory
```

This makes routing decisions observable in logs and testable in unit tests. The confidence threshold (0.65) means ambiguous queries default to `resume_rag` rather than flipping a coin.

### LangGraph State Machine Pattern

Every node receives the full `AgentState` and returns a partial update. The `Annotated[list, add_messages]` reducer handles message accumulation automatically — manually appending messages causes state conflicts. The `chitchat` node demonstrates the pattern at its simplest: no LLM call, just a direct `AIMessage` return.

### SSE Streaming Architecture

The frontend connects directly to the backend SSE endpoint via `NEXT_PUBLIC_API_URL`. The Next.js `/api/chat` route is a server-side proxy for environments where the backend isn't publicly accessible. The SSE buffer handles partial line fragmentation by accumulating chunks until a complete `\n\n`-terminated event is received.

### React Performance with Virtuoso

`react-virtuoso` only renders visible messages in the DOM. For long conversations this is critical — without virtualization, 500+ messages would cause significant layout thrashing. The `followOutput="smooth"` prop auto-scrolls to new messages while preserving scroll position when the user scrolls up.

---

## Design Decisions

**Why RRF over weighted score combination?**  
RRF is rank-based, not score-based. This means it's robust to score scale differences between semantic (0–1 cosine) and BM25 (unbounded). No normalization tuning required.

**Why cross-encoder only on top-12?**  
Cross-encoders are O(n) — running on all candidates would be too slow. Fetching 20 candidates per retriever per query variant, fusing with RRF, then reranking the top-12 gives the best accuracy/latency tradeoff.

**Why chitchat as a separate agent vs. handling in General AI?**  
Routing "hi" to General AI wastes an LLM call and produces robotic responses ("I don't have feelings..."). The chitchat node costs zero tokens and responds in <1ms. The supervisor routes with 0.99 confidence on greetings, bypassing the confidence threshold entirely.

**Why memory trimming in General AI?**  
Without trimming, token cost grows linearly with conversation length. Capping at 6 turns (12 messages, 3000 chars each) keeps costs predictable while preserving enough context for coherent multi-turn conversations.

---

## Challenges & Solutions

**Challenge: BM25 index out of sync with ChromaDB**  
The BM25 index is built from ChromaDB's stored documents at load time. If ChromaDB is rebuilt (e.g., after deleting `vector_store/`), the BM25 index rebuilds automatically in `_load_vector_store()`. The singleton pattern ensures this only happens once per process.

**Challenge: MMR candidates not in embedding matrix**  
Uploaded resume chunks aren't in the BM25 index or embedding matrix. The `_mmr_select` function filters to only candidates that exist in `content_to_idx` and falls back to `candidates[:k]` for unindexed content.

**Challenge: TypeScript `AgentType` union missing `"Assistant"`**  
The chitchat node returns `additional_kwargs={"agent": "Assistant"}` but the frontend `AgentType` union didn't include it. This caused a TypeScript overlap error in `MessageBubble`. Fixed by adding `"Assistant"` to the union and hiding the badge for chitchat responses.

**Challenge: Duplicate Chroma import**  
`resume_rag.py` had `from langchain_community.vectorstores import Chroma` imported twice (once from the original file, once added during the hybrid RAG rewrite). Caught by `pyflakes` and removed.

---

## Tools Used

**Amazon Q Developer** (primary IDE assistant):
- Designed the full hybrid RAG pipeline architecture
- Debugged the supervisor routing typo (`"g"` vs `"general_ai"`)
- Implemented the RRF fusion, cross-encoder reranking, and MMR diversity stages
- Upgraded all frontend components with framer-motion, react-markdown, react-virtuoso
- Fixed all lint and TypeScript errors across both codebases

---

## Resources

- [LangGraph Official Docs](https://langchain-ai.github.io/langgraph/)
- [ChromaDB Docs](https://docs.trychroma.com/)
- [rank-bm25 PyPI](https://pypi.org/project/rank-bm25/)
- [sentence-transformers CrossEncoder](https://www.sbert.net/docs/cross_encoder/usage/usage.html)
- [Reciprocal Rank Fusion paper](https://plg.uwaterloo.ca/~gvcormac/cormacksigir09-rrf.pdf)
- [Maximal Marginal Relevance (Carbonell & Goldstein, 1998)](https://dl.acm.org/doi/10.1145/290941.291025)
- [react-virtuoso docs](https://virtuoso.dev/)
- [framer-motion docs](https://www.framer.com/motion/)
