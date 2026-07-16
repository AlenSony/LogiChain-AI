"""
LogiChain AI — LangGraph Workflow Construction
================================================
Wires all agent nodes into a compiled LangGraph StateGraph with
conditional edges based on security validation and intent classification.

Graph Topology:
  ┌─────────────┐
  │   ENTRY     │
  └──────┬──────┘
         ▼
  ┌──────────────┐     ┌──────────────────┐
  │ security_gate│──►──│  ACCESS DENIED   │──► END
  └──────┬───────┘     └──────────────────┘
         │ (passed)
         ▼
  ┌───────────────────┐
  │ intent_classifier  │
  └───────┬───────────┘
          │
    ┌─────┼──────────┬──────────────┐
    ▼     ▼          ▼              ▼
  order  routing  warehouse     general
  agent  agent    agent         fallback
    │     │          │              │
    │     │          ▼              │
    │     │    delivery_agent       │
    │     │          │              │
    ▼     ▼          ▼              ▼
  ┌────────────────────────────────────┐
  │        response_assembler          │
  └────────────────┬───────────────────┘
                   ▼
                  END
"""

from __future__ import annotations

import logging
from typing import Any

from langgraph.graph import END, StateGraph

from agents.nodes.classifier import classifier_node
from agents.nodes.general import general_fallback_node
from agents.nodes.optimization import delivery_agent_node, warehouse_agent_node
from agents.nodes.order import order_agent_node
from agents.nodes.response import response_assembler_node
from agents.nodes.routing import routing_agent_node
from agents.nodes.security import security_node
from agents.state import AgentState

logger = logging.getLogger("logichain.graph")


# ── Conditional Edge Functions ──────────────────────────────────────────────

def check_access(state: AgentState) -> str:
    """
    Conditional edge after security_gate.
    Routes to END if access is denied, or to classifier if passed.
    """
    if state.get("access_denied", False):
        logger.info("Access denied — skipping to END.")
        return "denied"
    return "passed"


def route_by_intent(state: AgentState) -> str:
    """
    Conditional edge after intent_classifier.
    Routes to the appropriate domain agent based on classified intent.
    """
    intent = state.get("intent", "general")
    logger.info("Routing to intent: '%s'", intent)

    # If the classifier already wrote a denial response (RBAC downgrade),
    # and the intent was changed to 'general', check if there's already
    # an agent_response set
    if intent == "general" and state.get("agent_response"):
        return "general"

    valid_intents = {"order", "routing", "warehouse", "general"}
    if intent not in valid_intents:
        logger.warning("Unknown intent '%s', defaulting to 'general'", intent)
        return "general"

    return intent


# ── Graph Builder ───────────────────────────────────────────────────────────

def build_graph() -> Any:
    """
    Construct and compile the full LangGraph multi-agent workflow.

    Returns:
        A compiled LangGraph CompiledStateGraph ready for .invoke()
        or .ainvoke() execution.
    """
    workflow = StateGraph(AgentState)

    # ── Register all nodes ──────────────────────────────────────────────
    workflow.add_node("security_gate", security_node)
    workflow.add_node("intent_classifier", classifier_node)
    workflow.add_node("order_agent", order_agent_node)
    workflow.add_node("routing_agent", routing_agent_node)
    workflow.add_node("warehouse_agent", warehouse_agent_node)
    workflow.add_node("delivery_agent", delivery_agent_node)
    workflow.add_node("general_fallback", general_fallback_node)
    workflow.add_node("response_assembler", response_assembler_node)

    # ── Set entry point ─────────────────────────────────────────────────
    workflow.set_entry_point("security_gate")

    # ── Edge: security_gate → classifier or END ─────────────────────────
    workflow.add_conditional_edges(
        "security_gate",
        check_access,
        {
            "denied": END,          # Access denied → terminate immediately
            "passed": "intent_classifier",  # Passed → classify intent
        },
    )

    # ── Edge: intent_classifier → domain agents ─────────────────────────
    workflow.add_conditional_edges(
        "intent_classifier",
        route_by_intent,
        {
            "order": "order_agent",
            "routing": "routing_agent",
            "warehouse": "warehouse_agent",
            "general": "general_fallback",
        },
    )

    # ── Edge: order_agent → response_assembler ──────────────────────────
    workflow.add_edge("order_agent", "response_assembler")

    # ── Edge: routing_agent → response_assembler ────────────────────────
    workflow.add_edge("routing_agent", "response_assembler")

    # ── Edge: warehouse_agent → delivery_agent (sequential) ─────────────
    # Delivery scheduling always runs after warehouse capacity analysis
    workflow.add_edge("warehouse_agent", "delivery_agent")

    # ── Edge: delivery_agent → response_assembler ───────────────────────
    workflow.add_edge("delivery_agent", "response_assembler")

    # ── Edge: general_fallback → END (no assembly needed) ───────────────
    workflow.add_edge("general_fallback", END)

    # ── Edge: response_assembler → END ──────────────────────────────────
    workflow.add_edge("response_assembler", END)

    # ── Compile ─────────────────────────────────────────────────────────
    compiled = workflow.compile()
    logger.info("LangGraph workflow compiled successfully.")
    return compiled


# ── Global compiled graph instance ──────────────────────────────────────────
# Imported by the chat endpoint: `from agents.graph import agent_graph`
agent_graph = build_graph()
