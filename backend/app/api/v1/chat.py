"""
LogiChain AI — Chat Endpoint (Agent Query API)
================================================
FastAPI endpoint that accepts natural language queries from authenticated
users and routes them through the LangGraph multi-agent workflow.

The endpoint:
  1. Extracts user identity from the JWT Bearer token
  2. Initializes the LangGraph state with all required fields
  3. Invokes the compiled graph asynchronously
  4. Returns a structured response with the agent's output
"""

from __future__ import annotations

import logging
from typing import Any

from fastapi import APIRouter, Depends, HTTPException
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from pydantic import BaseModel, Field

from agents.graph import agent_graph
from app.api.deps import get_current_user

logger = logging.getLogger("logichain.chat")

router = APIRouter()
security = HTTPBearer()


# ── Request / Response Models ───────────────────────────────────────────────

class QueryRequest(BaseModel):
    """Incoming query from the frontend."""
    message: str = Field(
        ...,
        min_length=1,
        max_length=2000,
        description="The user's natural language query.",
    )


class QueryResponse(BaseModel):
    """Structured response returned to the frontend."""
    response: str = Field(description="Human-readable agent response.")
    intent: str | None = Field(
        default=None,
        description="Classified intent (order/routing/warehouse/general).",
    )
    metadata: dict[str, Any] | None = Field(
        default=None,
        description="Structured data from the agent pipeline.",
    )


# ── Endpoint ────────────────────────────────────────────────────────────────

@router.post("/agent/query", response_model=QueryResponse)
async def query_agent(
    request: QueryRequest,
    current_user: dict = Depends(get_current_user),
    credentials: HTTPAuthorizationCredentials = Depends(security),
) -> QueryResponse:
    """
    Process a natural language query through the AI agent swarm.

    The query flows through:
      Security Gate → Intent Classifier → Domain Agent(s) → Response Assembler

    Returns the final agent response along with the classified intent
    and any structured metadata produced by the domain agents.
    """
    logger.info(
        "Agent query from user=%s role=%s: %.80s...",
        current_user.get("id", "unknown"),
        current_user.get("role", "unknown"),
        request.message,
    )

    # ── Initialize LangGraph state with all required fields ─────────────
    initial_state: dict[str, Any] = {
        # Identity & Input
        "user_id": current_user["id"],
        "user_role": current_user["role"],
        "access_token": credentials.credentials,
        "raw_query": request.message,
        "conversation_history": [],
        # Security Gate (populated by security_node)
        "access_denied": False,
        "access_denied_reason": None,
        # Classifier (populated by classifier_node)
        "intent": None,
        "intent_confidence": None,
        # Domain Agent Outputs (populated by respective nodes)
        "package_context": None,
        "route_result": None,
        "warehouse_result": None,
        "delivery_result": None,
        # Final Output
        "agent_response": None,
        "error": None,
    }

    try:
        # ── Invoke the LangGraph workflow asynchronously ────────────────
        final_state: dict[str, Any] = await agent_graph.ainvoke(initial_state)

        # ── Extract response ────────────────────────────────────────────
        response_text = final_state.get("agent_response")

        if final_state.get("access_denied"):
            response_text = (
                final_state.get("agent_response")
                or f"⛔ Access Denied: "
                   f"{final_state.get('access_denied_reason', 'Unauthorized.')}"
            )

        if not response_text:
            response_text = (
                "I processed your request but wasn't able to generate "
                "a response. Please try rephrasing your query."
            )

        # ── Build metadata from domain agent outputs ────────────────────
        metadata: dict[str, Any] = {}

        if final_state.get("package_context"):
            metadata["package_context"] = final_state["package_context"]
        if final_state.get("route_result"):
            metadata["route_result"] = final_state["route_result"]
        if final_state.get("warehouse_result"):
            metadata["warehouse_result"] = final_state["warehouse_result"]
        if final_state.get("delivery_result"):
            metadata["delivery_result"] = final_state["delivery_result"]

        return QueryResponse(
            response=response_text,
            intent=final_state.get("intent"),
            metadata=metadata if metadata else None,
        )

    except Exception as e:
        logger.error("Agent pipeline failed: %s", e, exc_info=True)
        raise HTTPException(
            status_code=500,
            detail=f"Agent pipeline error: {str(e)}",
        )
