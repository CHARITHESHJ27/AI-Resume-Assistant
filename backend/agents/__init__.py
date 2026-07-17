import threading
import random
from langchain_core.messages import AIMessage
from langgraph.graph import StateGraph, END
from agents.state import AgentState
from agents.supervisor import supervisor_node, route_after_supervisor
from agents.resume_rag import resume_rag_node
from agents.general_ai import general_ai_node

_GREETINGS = [
    "Hey! Ask me about resumes, AI/ML concepts, or career advice.",
    "Hi there! I can help with resume analysis or any AI/ML questions.",
    "Hello! What would you like to know — resumes or AI/ML topics?",
]

_WELLBEING = [
    "Doing great, thanks for asking! What can I help you with today?",
    "All good! Ready to help with resumes or AI/ML questions.",
    "Running smoothly! Ask me anything about AI/ML or careers.",
]

_THANKS = [
    "You're welcome! Anything else I can help with?",
    "Happy to help! Feel free to ask more.",
    "Glad I could help!",
]

_HELP = """I'm an AI Resume Assistant with two specialist agents:

- **Resume RAG Agent** — searches anonymized resume data to answer career, skills, and job-related questions
- **General AI Agent** — explains AI/ML concepts, frameworks, architectures, and best practices

Try asking:
- "What skills does an ML engineer need?"
- "How does the attention mechanism work?"
- "What certifications are common in AI roles?"
"""


def chitchat_node(state: AgentState) -> dict:
    query = state.messages[-1].content.lower().strip()

    if any(w in query for w in ("thank", "thanks", "thx", "ty")):
        reply = random.choice(_THANKS)
    elif any(w in query for w in ("how are you", "how r you", "you ok", "you good", "what's up", "whats up", "sup")):
        reply = random.choice(_WELLBEING)
    elif any(w in query for w in ("help", "what can you do", "who are you", "capabilities")):
        reply = _HELP
    else:
        reply = random.choice(_GREETINGS)

    return {
        "messages": [AIMessage(
            content=reply,
            additional_kwargs={"agent": "Assistant"},
        )],
        "next_agent": "__end__",
    }


def build_graph() -> StateGraph:
    graph = StateGraph(AgentState)

    graph.add_node("supervisor", supervisor_node)
    graph.add_node("resume_rag", resume_rag_node)
    graph.add_node("general_ai", general_ai_node)
    graph.add_node("chitchat", chitchat_node)

    graph.set_entry_point("supervisor")

    graph.add_conditional_edges(
        "supervisor",
        route_after_supervisor,
        {
            "resume_rag": "resume_rag",
            "general_ai": "general_ai",
            "chitchat": "chitchat",
        },
    )

    graph.add_edge("resume_rag", END)
    graph.add_edge("general_ai", END)
    graph.add_edge("chitchat", END)

    return graph.compile()


_graph_lock = threading.Lock()
_graph = None


def get_graph():
    global _graph
    if _graph is None:
        with _graph_lock:
            if _graph is None:
                _graph = build_graph()
    return _graph
