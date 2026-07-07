from fastapi import APIRouter, Depends
from pydantic import BaseModel
from app.api.deps import get_current_user
from agents.graph import agent_graph
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer

router = APIRouter()
security = HTTPBearer()

class QueryRequest(BaseModel):
    message: str

@router.post("/agent/query")
async def query_agent(
    request: QueryRequest,
    current_user: dict = Depends(get_current_user),
    credentials: HTTPAuthorizationCredentials = Depends(security)
):
    initial_state = {
        "user_id": current_user["id"],
        "user_role": current_user["role"],
        "access_token": credentials.credentials,
        "raw_query": request.message,
        "conversation_history": [],
        "intent": None,
        "agent_response": None,
        "access_denied": False,
        "access_denied_reason": None,
    }
    
    # Invoke the graph synchronously for now (LangGraph supports async but sync is simpler for scaffolding)
    # The return is the final state dictionary
    final_state = agent_graph.invoke(initial_state)
    
    if final_state.get("access_denied"):
        return {"response": "Access Denied: " + (final_state.get("access_denied_reason") or "Unauthorized action.")}
        
    return {"response": final_state.get("agent_response", "No response generated.")}
