"""
Unit tests for config.py — settings loading and validation.
Run: pytest tests/test_config.py -v
"""
import pytest
from unittest.mock import patch
from config import Settings


class TestSettings:
    def test_default_provider_is_ollama(self):
        s = Settings()
        assert s.llm_provider == "ollama"

    def test_default_ollama_model(self):
        s = Settings()
        assert s.ollama_model == "llama3.2"

    def test_default_embedding_model(self):
        s = Settings()
        assert s.embedding_model == "all-MiniLM-L6-v2"

    def test_cors_origins_list_single(self):
        s = Settings(cors_origins="http://localhost:3000")
        assert s.cors_origins_list == ["http://localhost:3000"]

    def test_cors_origins_list_multiple(self):
        s = Settings(cors_origins="http://localhost:3000,https://app.vercel.app")
        assert len(s.cors_origins_list) == 2
        assert "https://app.vercel.app" in s.cors_origins_list

    def test_cors_origins_strips_whitespace(self):
        s = Settings(cors_origins="http://localhost:3000 , https://app.vercel.app")
        assert all(" " not in o for o in s.cors_origins_list)

    def test_invalid_provider_raises(self):
        with pytest.raises(Exception):
            Settings(llm_provider="invalid_provider")  # type: ignore

    def test_openai_key_defaults_empty(self):
        s = Settings()
        assert s.openai_api_key == ""

    def test_gemini_key_defaults_empty(self):
        s = Settings()
        assert s.gemini_api_key == ""
