import json
import logging
import asyncio
from fastapi import FastAPI, HTTPException, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse
from pydantic import BaseModel, field_validator
from slowapi import Limiter, _rate_limit_exceeded_handler
from slowapi.util import get_remote_address
from slowapi.errors import RateLimitExceeded
from langchain_core.messages import HumanMessage, AIMessage
from agents import get_graph
from agents.state import AgentState
from config import get_settings
from security import sanitize_input, MAX_INPUT_LENGTH, MAX_MESSAGES
from logger import setup_logging

setup_logging()
logger = logging.getLogger(__name__)

# ── Rate limiter ───────────────────────────────────────────────────────────────
limiter = Limiter(key_func=get_remote_address, default_limits=["60/minute"])

app = FastAPI(title="Multi-Agent Resume Assistant API", version="1.0.0")
app.state.limiter = limiter
app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)


@app.on_event("startup")
async def warmup():
    """Pre-load embeddings + vector store so first request isn't slow."""
    try:
        from agents.resume_rag import _load_vector_store
        await asyncio.to_thread(_load_vector_store)
        logger.info("Vector store warmed up")
    except Exception:
        logger.warning("Warmup failed — will load on first request")

settings = get_settings()

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins_list,
    allow_credentials=True,
    allow_methods=["POST", "GET"],
    allow_headers=["Content-Type"],
)


# ── Pydantic models ────────────────────────────────────────────────────────────

class Attachment(BaseModel):
    name: str
    content: str
    type: str = ""


class Message(BaseModel):
    role: str
    content: str
    attachments: list[Attachment] = []

    @field_validator("role")
    @classmethod
    def role_must_be_valid(cls, v: str) -> str:
        if v not in ("user", "assistant"):
            raise ValueError("role must be 'user' or 'assistant'")
        return v

    @field_validator("content")
    @classmethod
    def content_must_not_be_empty(cls, v: str) -> str:
        v = v.strip()
        if not v:
            raise ValueError("content must not be empty")
        return v[:MAX_INPUT_LENGTH]


class ChatRequest(BaseModel):
    messages: list[Message]

    @field_validator("messages")
    @classmethod
    def messages_not_empty(cls, v: list) -> list:
        if not v:
            raise ValueError("messages list must not be empty")
        return v[-MAX_MESSAGES:]


# ── Helpers ────────────────────────────────────────────────────────────────────

def _build_lc_messages(messages: list[Message]) -> list:
    result = []
    for m in messages:
        if m.role == "user":
            kwargs = {}
            if m.attachments:
                # Truncate each attachment to 8000 chars to avoid token overflow
                kwargs["attachments"] = [
                    {"name": a.name, "content": a.content[:8000], "type": a.type}
                    for a in m.attachments
                ]
            result.append(HumanMessage(content=sanitize_input(m.content), additional_kwargs=kwargs))
        else:
            result.append(AIMessage(content=m.content))
    return result


# ── Endpoints ──────────────────────────────────────────────────────────────────

@app.post("/api/chat")
@limiter.limit("30/minute")
async def chat(request: Request, body: ChatRequest):
    """Non-streaming chat endpoint — 30 req/min per IP."""
    logger.info("POST /api/chat | messages=%d", len(body.messages))
    try:
        graph = get_graph()
        state = AgentState(messages=_build_lc_messages(body.messages))
        result = await asyncio.to_thread(graph.invoke, state)

        last_msg = result["messages"][-1]
        agent_name = last_msg.additional_kwargs.get("agent", "AI Assistant")
        logger.info("Response from agent=%s", agent_name)

        usage = last_msg.response_metadata.get("token_usage", {})
        logger.info(
            "Token usage | prompt=%s completion=%s total=%s",
            usage.get("prompt_tokens", "?"),
            usage.get("completion_tokens", "?"),
            usage.get("total_tokens", "?"),
        )
        return {
            "content": last_msg.content,
            "agent": agent_name,
            "query_type": result.get("query_type", ""),
            "usage": usage,
        }
    except ValueError as e:
        raise HTTPException(status_code=422, detail=str(e))
    except Exception:
        logger.exception("Unhandled error in /api/chat")
        raise HTTPException(status_code=500, detail="Internal server error")


@app.post("/api/chat/stream")
@limiter.limit("30/minute")
async def chat_stream(request: Request, body: ChatRequest):
    """Streaming SSE endpoint — 30 req/min per IP."""
    logger.info("POST /api/chat/stream | messages=%d", len(body.messages))

    async def event_generator():
        try:
            graph = get_graph()
            state = AgentState(messages=_build_lc_messages(body.messages))

            # Run graph and stream tokens as they arrive
            agent_name = "AI Assistant"
            query_type = ""
            full_content = ""

            async for event in graph.astream_events(
                state.model_dump(),
                version="v2",
            ):
                kind = event.get("event")

                # Capture routing metadata from supervisor output
                if kind == "on_chain_end" and event.get("name") == "supervisor":
                    output = event.get("data", {}).get("output", {})
                    query_type = output.get("query_type", "")

                # Stream tokens from LLM nodes
                if kind == "on_chat_model_stream":
                    chunk = event.get("data", {}).get("chunk")
                    if chunk and hasattr(chunk, "content") and chunk.content:
                        token = chunk.content
                        full_content += token
                        yield f"data: {json.dumps({'type': 'token', 'content': token})}\n\n"

                # Capture agent name from node output
                if kind == "on_chain_end" and event.get("name") in ("resume_rag", "general_ai"):
                    output = event.get("data", {}).get("output", {})
                    msgs = output.get("messages", [])
                    if msgs:
                        agent_name = msgs[-1].additional_kwargs.get("agent", "AI Assistant")
                        # Send agent metadata as soon as we know it
                        yield f"data: {json.dumps({'type': 'agent', 'agent': agent_name, 'query_type': query_type})}\n\n"

                # Capture token usage from LLM response metadata
                if kind == "on_chat_model_end":
                    usage = event.get("data", {}).get("output", {}).response_metadata.get("token_usage", {}) if hasattr(event.get("data", {}).get("output", {}), "response_metadata") else {}
                    if usage:
                        logger.info(
                            "Token usage | prompt=%s completion=%s total=%s",
                            usage.get("prompt_tokens", "?"),
                            usage.get("completion_tokens", "?"),
                            usage.get("total_tokens", "?"),
                        )
                        yield f"data: {json.dumps({'type': 'usage', 'usage': usage})}\n\n"

            yield f"data: {json.dumps({'type': 'done'})}\n\n"
            logger.info("Stream complete | agent=%s | chars=%d", agent_name, len(full_content))

        except Exception:
            logger.exception("Error during SSE stream")
            yield f"data: {json.dumps({'type': 'error', 'message': 'An error occurred. Please try again.'})}\n\n"

    return StreamingResponse(
        event_generator(),
        media_type="text/event-stream",
        headers={"Cache-Control": "no-cache", "X-Accel-Buffering": "no"},
    )


@app.get("/api/health")
async def health():
    return {"status": "ok", "version": "1.0.0"}


@app.post("/api/vector-store/init")
@limiter.limit("5/minute")
async def init_vector_store(request: Request):
    """Manually trigger vector store initialization — 5 req/min per IP."""
    logger.info("POST /api/vector-store/init")
    try:
        from agents.resume_rag import _load_vector_store
        await asyncio.to_thread(_load_vector_store)
        return {"status": "initialized"}
    except Exception:
        logger.exception("Vector store init failed")
        raise HTTPException(status_code=500, detail="Vector store initialization failed")
