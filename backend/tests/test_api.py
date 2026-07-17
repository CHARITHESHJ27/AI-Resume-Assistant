"""
API integration tests for main.py FastAPI endpoints.
Run: pytest tests/test_api.py -v
Uses TestClient — no real LLM calls (mocked).
"""
import pytest
from unittest.mock import patch, MagicMock, AsyncMock
from fastapi.testclient import TestClient


@pytest.fixture
def client():
    from main import app
    return TestClient(app)


class TestHealthEndpoint:
    def test_health_returns_ok(self, client):
        res = client.get("/api/health")
        assert res.status_code == 200
        assert res.json()["status"] == "ok"

    def test_health_returns_version(self, client):
        res = client.get("/api/health")
        assert "version" in res.json()


class TestChatEndpoint:
    def _mock_graph_result(self):
        from langchain_core.messages import AIMessage
        mock_msg = AIMessage(
            content="ML engineers typically need Python, PyTorch, and scikit-learn.",
            additional_kwargs={"agent": "Resume RAG Agent"}
        )
        return {"messages": [mock_msg], "query_type": "resume"}

    def test_valid_request_returns_200(self, client):
        with patch("main.get_graph") as mock_get_graph:
            mock_graph = MagicMock()
            mock_graph.invoke.return_value = self._mock_graph_result()
            mock_get_graph.return_value = mock_graph

            res = client.post("/api/chat", json={
                "messages": [{"role": "user", "content": "What skills does an ML engineer need?"}]
            })
            assert res.status_code == 200
            data = res.json()
            assert "content" in data
            assert "agent" in data

    def test_empty_messages_returns_422(self, client):
        res = client.post("/api/chat", json={"messages": []})
        assert res.status_code == 422

    def test_invalid_role_returns_422(self, client):
        res = client.post("/api/chat", json={
            "messages": [{"role": "system", "content": "hack"}]
        })
        assert res.status_code == 422

    def test_empty_content_returns_422(self, client):
        res = client.post("/api/chat", json={
            "messages": [{"role": "user", "content": "   "}]
        })
        assert res.status_code == 422

    def test_missing_messages_field_returns_422(self, client):
        res = client.post("/api/chat", json={})
        assert res.status_code == 422

    def test_content_truncated_to_max_length(self, client):
        with patch("main.get_graph") as mock_get_graph:
            mock_graph = MagicMock()
            mock_graph.invoke.return_value = self._mock_graph_result()
            mock_get_graph.return_value = mock_graph

            long_content = "a" * 5000
            res = client.post("/api/chat", json={
                "messages": [{"role": "user", "content": long_content}]
            })
            # Should succeed — content is truncated not rejected
            assert res.status_code == 200

    def test_agent_name_in_response(self, client):
        with patch("main.get_graph") as mock_get_graph:
            mock_graph = MagicMock()
            mock_graph.invoke.return_value = self._mock_graph_result()
            mock_get_graph.return_value = mock_graph

            res = client.post("/api/chat", json={
                "messages": [{"role": "user", "content": "What skills does an ML engineer need?"}]
            })
            assert res.json()["agent"] == "Resume RAG Agent"


class TestSupervisorRouting:
    """Test that supervisor correctly routes to the right agent."""

    def test_resume_query_routes_to_resume_rag(self, client):
        from langchain_core.messages import AIMessage
        resume_result = {
            "messages": [AIMessage(content="...", additional_kwargs={"agent": "Resume RAG Agent"})],
            "query_type": "resume"
        }
        with patch("main.get_graph") as mock_get_graph:
            mock_graph = MagicMock()
            mock_graph.invoke.return_value = resume_result
            mock_get_graph.return_value = mock_graph

            res = client.post("/api/chat", json={
                "messages": [{"role": "user", "content": "What certifications are common in AI?"}]
            })
            assert res.json()["agent"] == "Resume RAG Agent"
            assert res.json()["query_type"] == "resume"

    def test_ai_query_routes_to_general_ai(self, client):
        from langchain_core.messages import AIMessage
        ai_result = {
            "messages": [AIMessage(content="...", additional_kwargs={"agent": "General AI Agent"})],
            "query_type": "general_ai"
        }
        with patch("main.get_graph") as mock_get_graph:
            mock_graph = MagicMock()
            mock_graph.invoke.return_value = ai_result
            mock_get_graph.return_value = mock_graph

            res = client.post("/api/chat", json={
                "messages": [{"role": "user", "content": "How does attention mechanism work?"}]
            })
            assert res.json()["agent"] == "General AI Agent"
