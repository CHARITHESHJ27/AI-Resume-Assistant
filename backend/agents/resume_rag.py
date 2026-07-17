from __future__ import annotations
"""
Hybrid RAG Pipeline
===================
Stage 1 — Query Expansion     : LLM rewrites vague query into N variants
Stage 2 — Dual Retrieval      : Semantic (ChromaDB cosine) + BM25 in parallel
Stage 3 — Reciprocal Rank Fusion (RRF) : Merges both ranked lists into one score
Stage 4 — Cross-Encoder Reranking      : ms-marco-MiniLM-L-6-v2 rescores top candidates
Stage 5 — MMR Diversity Filter         : Removes near-duplicate chunks
Stage 6 — Score Threshold + Top-K      : Final gate before LLM context
"""

import os
import glob
import logging
import threading
from dataclasses import dataclass

import numpy as np
from rank_bm25 import BM25Okapi
from sentence_transformers import CrossEncoder
from langchain_chroma import Chroma
from langchain_huggingface import HuggingFaceEmbeddings
from langchain_text_splitters import RecursiveCharacterTextSplitter
from langchain_core.messages import AIMessage

from agents.state import AgentState
from config import get_settings
from llm_factory import get_llm
from security import sanitize_input

logger = logging.getLogger(__name__)

# ── Tuneable constants ─────────────────────────────────────────────────────────
_FETCH_K = 20          # candidates per retriever per query variant
_RRF_K = 60            # RRF smoothing constant (standard = 60)
_RERANK_TOP_N = 12     # feed this many to cross-encoder
_FINAL_TOP_K = 5       # chunks sent to LLM
_MMR_LAMBDA = 0.6      # relevance vs diversity trade-off (1.0 = pure relevance)
_SCORE_THRESHOLD = 0.0 # cross-encoder score floor (logit scale, 0 = neutral)
_MAX_QUERY_VARIANTS = 3

# ── Singleton state ────────────────────────────────────────────────────────────
_lock = threading.Lock()
_vector_store: Chroma | None = None
_embeddings: HuggingFaceEmbeddings | None = None
_cross_encoder: CrossEncoder | None = None

# BM25 index is rebuilt whenever the vector store is (re)loaded
@dataclass
class _BM25Index:
    bm25: BM25Okapi
    chunks: list[str]
    metadatas: list[dict]
    embeddings_matrix: np.ndarray  # shape (N, D) — for MMR cosine similarity

_bm25_index: _BM25Index | None = None

# ── Prompts ────────────────────────────────────────────────────────────────────
_RESUME_RAG_SYSTEM = """You are a Resume Intelligence Agent. Answer questions using the retrieved resume context below.

Rules:
- Never reveal personal information (names, emails, phone numbers, addresses)
- If the user uploaded their own resume, prioritize that content over the indexed resumes
- Be concise — 3 to 6 bullet points max unless the user asks for more
- No lengthy intros; get straight to the point
- If context lacks relevant info, say so briefly
- When citing evidence, reference the source label (e.g. "resume_003")

Retrieved Resume Context:
{context}
"""

_QUERY_EXPANSION_PROMPT = """Rewrite the following user query into {n} specific search phrases optimized for retrieving relevant resume content. Output only the phrases, one per line, no numbering, no explanation.

Query: {query}"""


# ── Initialisation helpers ─────────────────────────────────────────────────────

def _get_embeddings() -> HuggingFaceEmbeddings:
    global _embeddings
    if _embeddings is None:
        logger.info("Loading embedding model: sentence-transformers/all-MiniLM-L6-v2")
        _embeddings = HuggingFaceEmbeddings(
            model_name="sentence-transformers/all-MiniLM-L6-v2",
            model_kwargs={"device": "cpu"},
            encode_kwargs={"normalize_embeddings": True},
        )
    return _embeddings


def _get_cross_encoder() -> CrossEncoder:
    global _cross_encoder
    if _cross_encoder is None:
        logger.info("Loading cross-encoder: cross-encoder/ms-marco-MiniLM-L-6-v2")
        _cross_encoder = CrossEncoder(
            "cross-encoder/ms-marco-MiniLM-L-6-v2",
            max_length=512,
        )
    return _cross_encoder


def _tokenize(text: str) -> list[str]:
    """Simple whitespace + lowercase tokenizer for BM25."""
    return text.lower().split()


def _load_vector_store() -> Chroma:
    global _vector_store, _bm25_index
    with _lock:
        if _vector_store is not None:
            return _vector_store

        settings = get_settings()
        embeddings = _get_embeddings()

        splitter = RecursiveCharacterTextSplitter(
            chunk_size=600,
            chunk_overlap=80,
            separators=["\n\n", "\n", ". ", " "],
        )

        # ── Load or build ChromaDB ─────────────────────────────────────────────
        if os.path.exists(settings.chroma_persist_dir) and os.listdir(settings.chroma_persist_dir):
            logger.info("Loading existing ChromaDB from %s", settings.chroma_persist_dir)
            _vector_store = Chroma(
                persist_directory=settings.chroma_persist_dir,
                embedding_function=embeddings,
                collection_name="resumes",
            )
        else:
            logger.info("Building ChromaDB from resume files")
            resume_dir = os.path.join(os.path.dirname(__file__), "../data/resumes")
            resume_files = glob.glob(os.path.join(resume_dir, "*.txt"))
            if not resume_files:
                raise FileNotFoundError(f"No resume files found in {resume_dir}")

            chunks, metadatas = [], []
            for filepath in resume_files:
                with open(filepath, "r", encoding="utf-8") as f:
                    content = f.read()
                source = os.path.basename(filepath).replace(".txt", "")
                for split in splitter.split_text(content):
                    chunks.append(split)
                    metadatas.append({"source": source})

            logger.info("Embedding %d chunks from %d resumes", len(chunks), len(resume_files))
            _vector_store = Chroma.from_texts(
                texts=chunks,
                embedding=embeddings,
                metadatas=metadatas,
                persist_directory=settings.chroma_persist_dir,
                collection_name="resumes",
            )

        # ── Build BM25 index from the same corpus ──────────────────────────────
        _bm25_index = _build_bm25_index(_vector_store, embeddings)
        return _vector_store


def _build_bm25_index(vector_store: Chroma, embeddings: HuggingFaceEmbeddings) -> _BM25Index:
    """Pull all docs from ChromaDB and build an in-memory BM25 index."""
    collection = vector_store._collection
    result = collection.get(include=["documents", "metadatas", "embeddings"])

    docs = result["documents"]
    metas = result["metadatas"]
    vecs = result.get("embeddings")

    if not docs:
        raise RuntimeError("ChromaDB collection is empty — cannot build BM25 index")

    tokenized = [_tokenize(d) for d in docs]
    bm25 = BM25Okapi(tokenized)

    # Pre-compute embedding matrix for MMR (reuse stored vectors if available)
    if vecs is not None and len(vecs) == len(docs):
        emb_matrix = np.array(vecs, dtype=np.float32)
    else:
        logger.info("Re-embedding %d chunks for MMR matrix", len(docs))
        emb_matrix = np.array(embeddings.embed_documents(docs), dtype=np.float32)

    # L2-normalise for cosine similarity via dot product
    norms = np.linalg.norm(emb_matrix, axis=1, keepdims=True)
    norms = np.where(norms == 0, 1, norms)
    emb_matrix = emb_matrix / norms

    logger.info("BM25 index built: %d documents", len(docs))
    return _BM25Index(bm25=bm25, chunks=docs, metadatas=metas, embeddings_matrix=emb_matrix)


# ── Stage 1: Query Expansion ───────────────────────────────────────────────────

def _expand_query(query: str, llm) -> list[str]:
    try:
        prompt = _QUERY_EXPANSION_PROMPT.format(n=_MAX_QUERY_VARIANTS, query=query)
        result = llm.invoke([{"role": "user", "content": prompt}])
        phrases = [p.strip() for p in result.content.strip().split("\n") if p.strip()]
        variants = list(dict.fromkeys([query] + phrases))[:_MAX_QUERY_VARIANTS + 1]
        logger.debug("Query variants: %s", variants)
        return variants
    except Exception:
        logger.warning("Query expansion failed — using original query only")
        return [query]


# ── Stage 2a: Semantic Retrieval ───────────────────────────────────────────────



def _semantic_search(vector_store: Chroma, queries: list[str]) -> dict[str, float]:
    """
    Perform semantic search across multiple query variants.

    Returns:
        Dict[str, float]:
            {
                page_content: normalized_similarity_score (0.0 - 1.0)
            }
    """
    scores: dict[str, float] = {}

    for query in queries:
        try:
            # Returns (Document, distance)
            results = vector_store.similarity_search_with_score(
                query=query,
                k=_FETCH_K,
            )

            for doc, distance in results:
                key = doc.page_content

                # Convert distance -> similarity (0 to 1)
                similarity = 1.0 / (1.0 + float(distance))

                if key not in scores or similarity > scores[key]:
                    scores[key] = similarity

        except Exception as e:
            logger.exception("Semantic search failed for query '%s': %s", query, e)

    return scores


# ── Stage 2b: BM25 Retrieval ───────────────────────────────────────────────────

def _bm25_search(index: _BM25Index, queries: list[str]) -> dict[str, float]:
    """Returns {content_key: best_normalised_BM25_score} across all query variants."""
    scores: dict[str, float] = {}
    for q in queries:
        tokens = _tokenize(q)
        raw_scores = index.bm25.get_scores(tokens)  # shape (N,)
        max_score = float(raw_scores.max()) if raw_scores.max() > 0 else 1.0
        for i, s in enumerate(raw_scores):
            if s <= 0:
                continue
            key = index.chunks[i]
            normalised = float(s) / max_score
            scores[key] = max(scores.get(key, 0.0), normalised)
    return scores


# ── Stage 3: Reciprocal Rank Fusion ───────────────────────────────────────────

def _reciprocal_rank_fusion(
    semantic_scores: dict[str, float],
    bm25_scores: dict[str, float],
    index: _BM25Index,
) -> list[tuple[float, str, str]]:
    """
    RRF formula: score(d) = Σ 1 / (k + rank(d))
    Returns list of (rrf_score, content, source) sorted descending.
    """
    # Build rank lists (lower rank index = better)
    def _rank_list(score_dict: dict[str, float]) -> dict[str, int]:
        sorted_keys = sorted(score_dict, key=score_dict.get, reverse=True)
        return {k: i + 1 for i, k in enumerate(sorted_keys)}

    sem_ranks = _rank_list(semantic_scores)
    bm25_ranks = _rank_list(bm25_scores)

    all_keys = set(semantic_scores) | set(bm25_scores)

    # Build a lookup: content → metadata
    content_to_meta: dict[str, str] = {}
    for i, chunk in enumerate(index.chunks):
        content_to_meta[chunk] = index.metadatas[i].get("source", "unknown")

    fused: list[tuple[float, str, str]] = []
    for key in all_keys:
        sem_r = sem_ranks.get(key, len(sem_ranks) + 1)
        bm25_r = bm25_ranks.get(key, len(bm25_ranks) + 1)
        rrf_score = 1.0 / (_RRF_K + sem_r) + 1.0 / (_RRF_K + bm25_r)
        source = content_to_meta.get(key, "unknown")
        fused.append((rrf_score, key, source))

    fused.sort(key=lambda x: x[0], reverse=True)
    return fused


# ── Stage 4: Cross-Encoder Reranking ──────────────────────────────────────────

def _cross_encoder_rerank(
    query: str,
    candidates: list[tuple[float, str, str]],
) -> list[tuple[float, str, str]]:
    """
    Rescore top-N candidates with a cross-encoder.
    Returns list of (ce_score, content, source) sorted descending.
    """
    top_n = candidates[:_RERANK_TOP_N]
    if not top_n:
        return []

    ce = _get_cross_encoder()
    pairs = [(query, content) for _, content, _ in top_n]
    ce_scores = ce.predict(pairs)  # logit scores, higher = more relevant

    reranked = [
        (float(ce_scores[i]), top_n[i][1], top_n[i][2])
        for i in range(len(top_n))
    ]
    reranked.sort(key=lambda x: x[0], reverse=True)

    logger.info(
        "Cross-encoder scores (top 5): %s",
        [f"{s:.3f}" for s, _, _ in reranked[:5]],
    )
    return reranked


# ── Stage 5: MMR Diversity Filter ─────────────────────────────────────────────

def _mmr_select(
    query_embedding: np.ndarray,
    candidates: list[tuple[float, str, str]],
    index: _BM25Index,
    k: int,
    lambda_: float = _MMR_LAMBDA,
) -> list[tuple[float, str, str]]:
    """
    Maximal Marginal Relevance:
      MMR = argmax [ λ·sim(q, d) - (1-λ)·max_{s∈S} sim(d, s) ]
    Balances relevance with diversity to avoid redundant chunks.
    """
    if not candidates:
        return []

    # Map content → embedding index
    content_to_idx: dict[str, int] = {c: i for i, c in enumerate(index.chunks)}

    # Filter to candidates that exist in the index
    valid = [(s, c, src) for s, c, src in candidates if c in content_to_idx]
    if not valid:
        return candidates[:k]

    # Normalise query embedding
    q_norm = query_embedding / (np.linalg.norm(query_embedding) + 1e-9)

    # Relevance scores: cosine(query, chunk)
    idxs = [content_to_idx[c] for _, c, _ in valid]
    chunk_embs = index.embeddings_matrix[idxs]  # (M, D)
    relevance = chunk_embs @ q_norm              # (M,)

    selected_indices: list[int] = []
    remaining = list(range(len(valid)))

    for _ in range(min(k, len(valid))):
        if not selected_indices:
            # First pick: highest relevance
            best = int(np.argmax(relevance))
        else:
            # MMR pick
            sel_embs = index.embeddings_matrix[[idxs[i] for i in selected_indices]]
            mmr_scores = []
            for r in remaining:
                rel = float(relevance[r])
                sim_to_selected = float((index.embeddings_matrix[idxs[r]] @ sel_embs.T).max())
                mmr_scores.append(lambda_ * rel - (1 - lambda_) * sim_to_selected)
            best = remaining[int(np.argmax(mmr_scores))]

        selected_indices.append(best)
        remaining.remove(best)

    return [valid[i] for i in selected_indices]


# ── Stage 6: Score threshold + context builder ────────────────────────────────

def _build_context(docs: list[tuple[float, str, str]]) -> str:
    filtered = [(s, c, src) for s, c, src in docs if s >= _SCORE_THRESHOLD]
    if not filtered:
        logger.warning("All docs below threshold — using top-%d unfiltered", _FINAL_TOP_K)
        filtered = docs[:_FINAL_TOP_K]

    logger.info(
        "Final context: %d chunks | sources: %s | ce_scores: %s",
        len(filtered),
        [src for _, _, src in filtered],
        [f"{s:.3f}" for s, _, _ in filtered],
    )
    return "\n\n---\n\n".join(
        f"[Source: {src} | Relevance: {score:.3f}]\n{content}"
        for score, content, src in filtered
    )


# ── Uploaded resume extraction ─────────────────────────────────────────────────

def _extract_uploaded_resume(state: AgentState) -> str | None:
    for msg in reversed(state.messages):
        if msg.type != "human":
            continue
        attachments = getattr(msg, "additional_kwargs", {}).get("attachments", [])
        texts = [a.get("content", "") for a in attachments if a.get("content")]
        if texts:
            combined = "\n\n---\n\n".join(texts)
            logger.info("Uploaded resume: %d chars", len(combined))
            return combined
    return None


# ── Main node ──────────────────────────────────────────────────────────────────

def resume_rag_node(state: AgentState) -> dict:
    vector_store = _load_vector_store()
    bm25_idx = _bm25_index
    llm = get_llm(temperature=0.3)
    embeddings = _get_embeddings()

    raw_query = state.messages[-1].content
    query = sanitize_input(raw_query)
    logger.info("Hybrid RAG query: %.100s", query)

    uploaded_resume = _extract_uploaded_resume(state)

    # Stage 1 — Query expansion
    variants = _expand_query(query, llm)

    # Stage 2 — Dual retrieval
    semantic_scores = _semantic_search(vector_store, variants)
    bm25_scores = _bm25_search(bm25_idx, variants)

    logger.info(
        "Retrieval candidates — semantic: %d, bm25: %d",
        len(semantic_scores), len(bm25_scores),
    )

    # Stage 3 — RRF fusion
    fused = _reciprocal_rank_fusion(semantic_scores, bm25_scores, bm25_idx)

    # Stage 4 — Cross-encoder reranking
    reranked = _cross_encoder_rerank(query, fused)

    # Stage 5 — MMR diversity
    query_emb = np.array(embeddings.embed_query(query), dtype=np.float32)
    diverse = _mmr_select(query_emb, reranked, bm25_idx, k=_FINAL_TOP_K)

    # Stage 6 — Build context
    indexed_context = _build_context(diverse)

    if uploaded_resume:
        context = (
            f"=== UPLOADED RESUME (analyze this directly) ===\n{uploaded_resume}\n\n"
            f"=== INDEXED RESUME EXAMPLES (for comparison) ===\n{indexed_context}"
        )
    else:
        context = indexed_context

    system_prompt = _RESUME_RAG_SYSTEM.format(context=context)
    history = [{"role": "system", "content": system_prompt}]
    for msg in state.messages:
        role = "user" if msg.type == "human" else "assistant"
        content = sanitize_input(msg.content) if role == "user" else msg.content
        history.append({"role": role, "content": content})

    response = llm.invoke(history)
    return {
        "messages": [AIMessage(
            content=response.content,
            additional_kwargs={"agent": "Resume RAG Agent"},
        )],
        "next_agent": "__end__",
    }
