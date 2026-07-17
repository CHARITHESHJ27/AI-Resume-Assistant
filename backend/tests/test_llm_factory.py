"""
Unit tests for llm_factory.py — provider selection logic.
Run: pytest tests/test_llm_factory.py -v
"""
import pytest
from unittest.mock import patch, MagicMock
from config import Settings


class TestLLMFactory:
    def test_ollama_provider_returns_chat_ollama(self):
        mock_settings = Settings(llm_provider="ollama")
        with patch("llm_factory.get_settings", return_value=mock_settings):
            from llm_factory import get_llm
            llm = get_llm()
            assert type(llm).__name__ == "ChatOllama"

    def test_openai_provider_missing_key_raises(self):
        mock_settings = Settings(llm_provider="openai", openai_api_key="")
        with patch("llm_factory.get_settings", return_value=mock_settings):
            from llm_factory import get_llm
            with pytest.raises(ValueError, match="OPENAI_API_KEY"):
                get_llm()

    def test_gemini_provider_missing_key_raises(self):
        mock_settings = Settings(llm_provider="gemini", gemini_api_key="")
        with patch("llm_factory.get_settings", return_value=mock_settings):
            from llm_factory import get_llm
            with pytest.raises(ValueError, match="GEMINI_API_KEY"):
                get_llm()

    def test_temperature_passed_to_ollama(self):
        mock_settings = Settings(llm_provider="ollama")
        with patch("llm_factory.get_settings", return_value=mock_settings):
            from llm_factory import get_llm
            llm = get_llm(temperature=0.7)
            assert llm.temperature == 0.7
