from __future__ import annotations
"""
Supervisor Agent
================
Responsibilities:
- Classify every incoming query with a confidence score
- Use recent conversation context (last 3 turns) for ambiguous queries
- Route to the correct specialist agent
- Log routing decisions with reasoning for observability

Routing table:
  resume_rag   — resumes, CVs, careers, job skills, hiring, certifications
  general_ai   — AI/ML concepts, frameworks, architectures, research, deployment
"""

import logging
from langchain_core.messages import SystemMessage
from agents.state import AgentState
from llm_factory import get_llm
from security import sanitize_input

logger = logging.getLogger(__name__)

# ── Constants ──────────────────────────────────────────────────────────────────
_CONFIDENCE_THRESHOLD = 0.65   # below this → fallback to resume_rag
_CONTEXT_TURNS = 3             # how many prior turns to include for context

_SUPERVISOR_SYSTEM = """You are a query routing supervisor for an AI Resume Assistant.

Your job: classify the user's query and output a structured decision.

## Output format (strict — no other text)
ROUTE: <resume_rag|general_ai|chitchat>
CONFIDENCE: <0.0-1.0>
REASON: <one sentence>

## Routing rules

Route to **chitchat** when the query is:
- Greetings: "hi", "hello", "hey", "good morning", "howdy"
- Small talk: "how are you", "what's up", "you ok", "thanks", "thank you", "bye", "ok", "cool"
- Meta questions: "what can you do", "who are you", "help"
- Single words or very short phrases with no technical content

Route to **resume_rag** when the query is about:
- Resumes, CVs, cover letters, portfolios
- Job skills, qualifications, requirements for specific roles
- Career advice, job search, interviews, hiring process
- Work experience examples, project descriptions
- Certifications, education for AI/ML careers
- Salary, compensation, job titles
- "What does an X engineer need?" type questions

Route to **general_ai** when the query is about:
- AI/ML concepts, theory, mathematics
- Model architectures (transformers, CNNs, RNNs, diffusion models)
- Frameworks and tools (PyTorch, TensorFlow, HuggingFace, LangChain)
- Training, fine-tuning, evaluation, benchmarks
- MLOps, deployment, serving, monitoring
- Research papers, trends, comparisons between models
- Data science, statistics, feature engineering

## Ambiguous query rules
- If a query mixes both (e.g. "what PyTorch skills should I put on my resume?") → resume_rag
- If confidence < 0.65 → resume_rag (safer default)
- Use conversation context to resolve ambiguity

## Examples
Query: "hi" → chitchat, 0.99
Query: "hello there" → chitchat, 0.99
Query: "how are you" → chitchat, 0.99
Query: "how are you doing" → chitchat, 0.99
Query: "what's up" → chitchat, 0.99
Query: "thanks" → chitchat, 0.98
Query: "what can you do?" → chitchat, 0.95
Query: "What skills does an ML engineer need?" → resume_rag, 0.95
Query: "How does attention mechanism work?" → general_ai, 0.97
Query: "What certifications help for AI jobs?" → resume_rag, 0.92
Query: "Explain the difference between YOLO and Faster R-CNN" → general_ai, 0.96
Query: "Should I list PyTorch on my resume?" → resume_rag, 0.88
Query: "What is RAG vs fine-tuning?" → general_ai, 0.94
Query: "Check my resume" → resume_rag, 0.99
"""


def _build_context_window(state: AgentState) -> str:
    """Extract last N turns as context string for ambiguous query resolution."""
    turns = []
    for msg in state.messages[-(_CONTEXT_TURNS * 2):]:
        role = "User" if msg.type == "human" else "Assistant"
        turns.append(f"{role}: {msg.content[:200]}")
    return "\n".join(turns)


def _parse_supervisor_response(text: str) -> tuple[str, float, str]:
    """
    Parse structured output:
      ROUTE: resume_rag
      CONFIDENCE: 0.92
      REASON: Query asks about job skills for ML roles
    Returns (route, confidence, reason).
    """
    route = "resume_rag"
    confidence = 0.5
    reason = "default"

    for line in text.strip().splitlines():
        line = line.strip()
        if line.upper().startswith("ROUTE:"):
            val = line.split(":", 1)[1].strip().lower()
            if "general" in val:
                route = "general_ai"
            elif "chitchat" in val or "chit" in val:
                route = "chitchat"
            else:
                route = "resume_rag"
        elif line.upper().startswith("CONFIDENCE:"):
            try:
                confidence = float(line.split(":", 1)[1].strip())
                confidence = max(0.0, min(1.0, confidence))
            except ValueError:
                pass
        elif line.upper().startswith("REASON:"):
            reason = line.split(":", 1)[1].strip()

    return route, confidence, reason


def supervisor_node(state: AgentState) -> dict:
    llm = get_llm(temperature=0)

    raw = state.messages[-1].content
    safe_message = sanitize_input(raw)

    # Build context-aware user prompt
    context_window = _build_context_window(state)
    user_prompt = f"Conversation context:\n{context_window}\n\nCurrent query to classify: {safe_message}"

    response = llm.invoke([
        SystemMessage(content=_SUPERVISOR_SYSTEM),
        {"role": "user", "content": user_prompt},
    ])

    route, confidence, reason = _parse_supervisor_response(response.content)

    # Apply confidence threshold — low confidence defaults to resume_rag
    if route != "chitchat" and confidence < _CONFIDENCE_THRESHOLD:
        logger.info(
            "Supervisor low confidence (%.2f) for route=%s — defaulting to resume_rag | reason: %s",
            confidence, route, reason,
        )
        route = "resume_rag"
    else:
        logger.info(
            "Supervisor → %s (confidence=%.2f) | reason: %s",
            route, confidence, reason,
        )

    query_type = "resume" if route == "resume_rag" else ("chitchat" if route == "chitchat" else "general_ai")
    return {"next_agent": route, "query_type": query_type}


def route_after_supervisor(state: AgentState) -> str:
    return state.next_agent
