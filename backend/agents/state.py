from typing import Annotated, Literal
from pydantic import BaseModel, ConfigDict
from langgraph.graph.message import add_messages


class AgentState(BaseModel):
    model_config = ConfigDict(arbitrary_types_allowed=True)

    messages: Annotated[list, add_messages]
    next_agent: Literal["resume_rag", "general_ai", "chitchat", "supervisor", "__end__"] = "supervisor"
    query_type: str = ""
