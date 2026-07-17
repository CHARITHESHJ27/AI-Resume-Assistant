from __future__ import annotations
from pydantic_settings import BaseSettings, SettingsConfigDict
from functools import lru_cache
from typing import Literal


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8")

    # --- Provider selection ---
    llm_provider: Literal["ollama", "openai", "gemini", "grok"] = "ollama"

    # --- Ollama (default, free, local) ---
    ollama_base_url: str = "http://localhost:11434"
    ollama_model: str = "llama3.2"

    # --- OpenAI (optional) ---
    openai_api_key: str = ""
    openai_model: str = "gpt-4o-mini"

    # --- Gemini (optional) ---
    gemini_api_key: str = ""
    gemini_model: str = "gemini-1.5-flash"

    # --- Grok / xAI (optional) ---
    grok_api_key: str = ""
    grok_model: str = "grok-3-mini"

    # --- Embeddings (always local/free via HuggingFace) ---
    embedding_model: str = "all-MiniLM-L6-v2"

    # --- Storage ---
    chroma_persist_dir: str = "./vector_store/chroma_db"
    cors_origins: str = "http://localhost:3000"

    @property
    def cors_origins_list(self) -> list[str]:
        return [o.strip() for o in self.cors_origins.split(",")]


@lru_cache
def get_settings() -> Settings:
    return Settings()
