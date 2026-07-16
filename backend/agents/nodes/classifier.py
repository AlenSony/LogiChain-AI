"""
LogiChain AI — Intent Classifier Agent Node
=============================================
Async LangGraph node that classifies user queries into one of four
intent categories using GPT-4o-mini with structured output.

Intent Categories:
  • 'order'     — Package tracking, cancellation, status queries
  • 'routing'   — Route computation, distance, path optimization
  • 'warehouse' — Capacity monitoring, load analysis, rebalancing
  • 'general'   — Greetings, off-topic, help requests

The classifier also validates the result against the user's RBAC
permissions: if a customer's query is classified as 'warehouse',
it is downgraded to 'general' with an explanatory response.
"""

from __future__ import annotations

import logging
from typing import Any

from langchain_core.prompts import ChatPromptTemplate
from langchain_openai import ChatOpenAI
from pydantic import BaseModel, Field
from tenacity import (
    retry,
    retry_if_exception_type,
    stop_after_attempt,
    wait_exponential,
)

from agents.nodes.security import get_allowed_intents
from agents.state import AgentState
from app.core.config import settings

logger = logging.getLogger("logichain.classifier")


# ── Structured Output Schema ───────────────────────────────────────────────

class IntentClassification(BaseModel):
    """Pydantic model for structured LLM output."""

    intent: str = Field(
        description=(
            "The classified intent. Must be exactly one of: "
            "'order', 'routing', 'warehouse', 'general'."
        )
    )
    confidence: float = Field(
        description=(
            "Confidence score between 0.0 and 1.0 indicating how certain "
            "the classification is."
        ),
        ge=0.0,
        le=1.0,
    )


# ── System Prompt ───────────────────────────────────────────────────────────

_CLASSIFIER_PROMPT = ChatPromptTemplate.from_messages([
    ("system", """You are an intent classifier for LogiChain AI, an enterprise logistics management platform.

Your task is to classify the user's query into EXACTLY ONE of the following categories:

• 'order' — Queries about a specific package: tracking, status, cancellation, modification, delivery updates, package details, or any mention of a tracking number (e.g., TRK-XXXXXXXX).
• 'routing' — Queries about how packages are routed between hubs, optimal paths, distances between warehouses, route changes, transit times, or pathfinding.
• 'warehouse' — Queries about warehouse capacity, current load, storage availability, hub status, node occupancy, or warehouse operations.
• 'general' — Any query that does not clearly fit the above categories: greetings, help requests, platform capabilities, or off-topic questions.

Classification Rules:
1. If the query mentions a tracking number or asks about "my package/order", classify as 'order'.
2. If the query asks about "route", "path", "distance", "transit", or "how to get from X to Y", classify as 'routing'.
3. If the query asks about "capacity", "load", "warehouse status", or "storage", classify as 'warehouse'.
4. When in doubt, classify as 'general'.
5. Return your confidence as a float between 0.0 and 1.0.

Output only the structured JSON."""),
    ("human", "{query}"),
])


# ── Node Function ───────────────────────────────────────────────────────────

@retry(
    stop=stop_after_attempt(3),
    wait=wait_exponential(multiplier=1, min=1, max=10),
    retry=retry_if_exception_type((Exception,)),
    reraise=True,
)
async def _classify_with_llm(query: str) -> IntentClassification:
    """Call the LLM with retry logic for transient failures."""
    llm = ChatOpenAI(
        model=settings.OPENAI_MODEL,
        temperature=0,
        api_key=settings.OPENAI_API_KEY,
    )
    structured_llm = llm.with_structured_output(IntentClassification)
    chain = _CLASSIFIER_PROMPT | structured_llm
    result = await chain.ainvoke({"query": query})
    return result


async def classifier_node(state: AgentState) -> dict[str, Any]:
    """
    LangGraph node: Intent Classifier.

    1. Sends the sanitized query to GPT-4o-mini for classification
    2. Validates the classified intent against the user's RBAC permissions
    3. If the intent is out-of-scope for the role, downgrades to 'general'

    Returns:
        Partial state update with `intent` and `intent_confidence`.
    """
    query: str = state.get("raw_query", "")
    role: str = state.get("user_role", "customer")

    logger.info("Classifying intent for query: %.80s...", query)

    try:
        result: IntentClassification = await _classify_with_llm(query)
        classified_intent = result.intent
        confidence = result.confidence

        logger.info(
            "Classified intent='%s' confidence=%.2f",
            classified_intent, confidence,
        )

        # ── RBAC Validation ─────────────────────────────────────────────
        # Check if the classified intent is within the user's allowed scope
        allowed = get_allowed_intents(role)
        if allowed is not None and classified_intent not in allowed:
            logger.warning(
                "Intent '%s' not allowed for role '%s'. "
                "Downgrading to 'general'.",
                classified_intent, role,
            )
            return {
                "intent": "general",
                "intent_confidence": confidence,
                "agent_response": (
                    f"I understood your question relates to "
                    f"'{classified_intent}', but your current role "
                    f"('{role}') does not have access to that feature. "
                    f"Please contact your administrator for elevated access."
                ),
            }

        return {
            "intent": classified_intent,
            "intent_confidence": confidence,
        }

    except Exception as e:
        logger.error("Intent classification failed: %s", e, exc_info=True)
        # On failure, route to 'general' with an error — don't crash
        return {
            "intent": "general",
            "intent_confidence": 0.0,
            "error": f"Intent classification failed: {str(e)}",
        }
