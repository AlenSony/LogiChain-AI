from typing import TypedDict, List, Optional
from langchain_core.messages import BaseMessage

class AgentState(TypedDict):
    user_id: str
    user_role: str
    access_token: str
    raw_query: str
    conversation_history: List[BaseMessage]
    intent: Optional[str]
    agent_response: Optional[str]
    access_denied: bool
    access_denied_reason: Optional[str]
