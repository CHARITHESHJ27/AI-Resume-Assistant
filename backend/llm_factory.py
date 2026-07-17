"""
LLM Factory — returns the correct LangChain chat model based on LLM_PROVIDER in .env.

Default: ollama (free, local)
Optional: openai | gemini (requires API key in .env)

All LLM calls are wrapped with tenacity retry logic:
- 3 attempts max
- Exponential backoff: 1s, 2s, 4s
- Retries on transient connection/timeout errors only
"""
import logging
from langchain_core.language_models import BaseChatModel
from langchain_core.messages import BaseMessage
from tenacity import (
    retry,
    stop_after_attempt,
    wait_exponential,
    retry_if_exception_type,
    before_sleep_log,
)
from config import get_settings

logger = logging.getLogger(__name__)

# Retry on transient errors + OpenAI rate limits
try:
    from openai import RateLimitError as _OpenAIRateLimit
    _RETRYABLE = (ConnectionError, TimeoutError, OSError, _OpenAIRateLimit)
except ImportError:
    _RETRYABLE = (ConnectionError, TimeoutError, OSError)

_retry_policy = retry(
    stop=stop_after_attempt(3),
    wait=wait_exponential(multiplier=2, min=5, max=30),
    retry=retry_if_exception_type(_RETRYABLE),
    before_sleep=before_sleep_log(logger, logging.WARNING),
    reraise=True,
)


class _RetryingLLM:
    """
    Thin wrapper that adds tenacity retry around any BaseChatModel.
    Preserves the .invoke() and .astream_events() interface.
    """

    def __init__(self, llm: BaseChatModel) -> None:
        self._llm = llm

    @_retry_policy
    def invoke(self, messages: list) -> BaseMessage:
        return self._llm.invoke(messages)

    # Delegate everything else (astream_events, bind, etc.) to the inner LLM
    def __getattr__(self, name: str):
        return getattr(self._llm, name)


def get_llm(temperature: float = 0.3) -> _RetryingLLM:
    settings = get_settings()
    provider = settings.llm_provider

    if provider == "openai":
        from langchain_openai import ChatOpenAI
        if not settings.openai_api_key:
            raise ValueError("LLM_PROVIDER=openai but OPENAI_API_KEY is not set in .env")
        llm = ChatOpenAI(
            model=settings.openai_model,
            temperature=temperature,
            api_key=settings.openai_api_key,
        )

    elif provider == "gemini":
        from langchain_google_genai import ChatGoogleGenerativeAI
        if not settings.gemini_api_key:
            raise ValueError("LLM_PROVIDER=gemini but GEMINI_API_KEY is not set in .env")
        llm = ChatGoogleGenerativeAI(
            model=settings.gemini_model,
            temperature=temperature,
            google_api_key=settings.gemini_api_key,
        )

    elif provider == "grok":
        from langchain_openai import ChatOpenAI
        if not settings.grok_api_key:
            raise ValueError("LLM_PROVIDER=grok but GROK_API_KEY is not set in .env")
        llm = ChatOpenAI(
            model=settings.grok_model,
            temperature=temperature,
            api_key=settings.grok_api_key,
            base_url="https://api.x.ai/v1",
        )

    else:
        from langchain_ollama import ChatOllama
        llm = ChatOllama(
            model=settings.ollama_model,
            base_url=settings.ollama_base_url,
            temperature=temperature,
        )

    return _RetryingLLM(llm)
