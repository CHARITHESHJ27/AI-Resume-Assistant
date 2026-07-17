from __future__ import annotations
"""
General AI Agent
================
Handles all AI/ML knowledge queries with:
- Domain-aware system prompt (theory / frameworks / deployment / trends)
- Conversation memory trimming — last 6 turns only (prevents token bloat)
- Uncertainty detection — hedges when query is outside confident knowledge
- Structured response format: concept → explanation → concrete example
- Temperature 0.2 for technical accuracy
"""

import logging
from langchain_core.messages import AIMessage, SystemMessage
from agents.state import AgentState
from llm_factory import get_llm
from security import sanitize_input

logger = logging.getLogger(__name__)

# ── Constants ──────────────────────────────────────────────────────────────────
_MAX_HISTORY_TURNS = 6      # trim conversation to last N turns before sending
_MAX_CONTENT_CHARS = 3000   # per-message content cap to control token usage

_GENERAL_AI_SYSTEM = """You are an expert AI/ML Knowledge Agent with deep expertise across:

**Domains you cover:**
- ML Theory: supervised/unsupervised/RL, loss functions, optimisation, regularisation, evaluation metrics
- Deep Learning: CNNs, RNNs, LSTMs, Transformers, attention, diffusion models, GANs, VAEs
- NLP: tokenisation, embeddings, BERT, GPT, T5, RAG, fine-tuning, prompt engineering
- Computer Vision: object detection (YOLO, Faster R-CNN, DETR), segmentation, classification, OCR
- MLOps: model serving, Docker, Kubernetes, CI/CD for ML, monitoring, drift detection, A/B testing
- Frameworks: PyTorch, TensorFlow, HuggingFace, LangChain, LangGraph, scikit-learn, JAX
- Data: feature engineering, data pipelines, imbalanced datasets, augmentation
- Research trends: foundation models, multimodal AI, efficient inference, RLHF, LoRA, quantisation

**Response rules:**
1. Structure: concept definition → how it works → concrete example (code snippet if helpful)
2. Be technically precise — use correct terminology
3. Be concise — 4 to 8 sentences or a tight bullet list unless asked for depth
4. If comparing two things, use a clear side-by-side structure
5. If you are uncertain about something, say so explicitly — do not hallucinate
6. For code examples, use Python and keep them minimal (< 15 lines)
7. Never pad with intros like "Great question!" or summaries like "In conclusion..."

**Uncertainty handling:**
- If a query is about very recent events (post your training cutoff), say: "My knowledge may be outdated on this — verify with recent sources."
- If a query is a greeting, small talk, or completely unrelated to AI/ML, respond with: "I'm best suited for AI/ML and resume questions. Try asking me about machine learning concepts or career advice!"
- Never respond with robotic disclaimers like "I don't have feelings" — just redirect naturally.
"""

_UNCERTAINTY_KEYWORDS = {
    "latest", "newest", "recent", "2024", "2025", "just released",
    "new paper", "state of the art", "sota", "current best",
}


def _trim_history(state: AgentState) -> list:
    """
    Keep only the last N turns to prevent unbounded token growth.
    Always keeps the system message + last _MAX_HISTORY_TURNS human/assistant pairs.
    """
    messages = state.messages
    
    trimmed = messages[-(_MAX_HISTORY_TURNS * 2):]

    history = []
    for msg in trimmed:
        role = "user" if msg.type == "human" else "assistant"
        content = msg.content[:_MAX_CONTENT_CHARS]
        if role == "user":
            content = sanitize_input(content)
        history.append({"role": role, "content": content})

    return history


def _has_uncertainty_signal(query: str) -> bool:
    """Detect if query is likely about very recent/cutting-edge topics."""
    q_lower = query.lower()
    return any(kw in q_lower for kw in _UNCERTAINTY_KEYWORDS)


def _build_system_prompt(query: str) -> str:
    """Augment system prompt with uncertainty notice if needed."""
    base = _GENERAL_AI_SYSTEM
    if _has_uncertainty_signal(query):
        base += "\n\n**Note:** This query may involve very recent developments. Acknowledge your knowledge cutoff if relevant."
    return base


def general_ai_node(state: AgentState) -> dict:
    llm = get_llm(temperature=0.2)
    logger.debug("General AI node invoked")

    raw_query = state.messages[-1].content
    query = sanitize_input(raw_query)

    system_prompt = _build_system_prompt(query)
    history = _trim_history(state)

    trimmed_count = len(state.messages) - len(history)
    if trimmed_count > 0:
        logger.info("General AI: trimmed %d old messages from history", trimmed_count)

    full_history = [SystemMessage(content=system_prompt)] + history

    logger.info(
        "General AI invoking LLM | turns=%d | uncertainty_signal=%s",
        len(history) // 2,
        _has_uncertainty_signal(query),
    )

    response = llm.invoke(full_history)

    return {
        "messages": [AIMessage(
            content=response.content,
            additional_kwargs={"agent": "General AI Agent"},
        )],
        "next_agent": "__end__",
    }
