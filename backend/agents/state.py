"""
LogiChain AI — LangGraph Agent State Definition
=================================================
Defines the typed state dictionary that flows through the entire LangGraph
multi-agent workflow. Every node reads from and writes to this state.

Design decisions:
  • Uses TypedDict (not Pydantic BaseModel) because LangGraph's StateGraph
    requires a TypedDict-compatible schema for its channel-based state
    management. Each key is an independent "channel" that nodes can update.
  • Optional fields default to None — nodes only populate the slots
    relevant to their function.
  • The `Annotated[..., operator.add]` pattern on `conversation_history`
    means multiple nodes can *append* messages without overwriting.
"""

from __future__ import annotations

import operator
from typing import Annotated, Any, Literal, TypedDict

from langchain_core.messages import BaseMessage


# ── Intent Literal Type ─────────────────────────────────────────────────────
# Exactly the four categories the Intent Classifier can emit.
IntentType = Literal["order", "routing", "warehouse", "general"]


class AgentState(TypedDict, total=False):
    """
    Complete state schema for the LogiChain AI agent swarm.

    Fields are grouped by the pipeline stage that produces them.
    All fields except the "Identity & Input" group are optional
    (total=False) — they are populated progressively as the query
    flows through the graph.
    """

    # ── Identity & Input (set by the API endpoint) ──────────────────────
    user_id: str
    """UUID of the authenticated Supabase user."""

    user_role: str
    """Role from JWT metadata: 'customer', 'admin', 'warehouse_manager',
    'pickup_employee', 'delivery_employee'."""

    access_token: str
    """Raw JWT Bearer token forwarded from the frontend."""

    raw_query: str
    """The user's original natural-language query string."""

    conversation_history: Annotated[list[BaseMessage], operator.add]
    """Append-only message history. Nodes can push messages and they
    accumulate via the `operator.add` reducer."""

    # ── Security Gate (written by security_node) ────────────────────────
    access_denied: bool
    """True if the security agent blocked the query."""

    access_denied_reason: str | None
    """Human-readable explanation when access is denied."""

    # ── Intent Classifier (written by classifier_node) ──────────────────
    intent: IntentType | None
    """Classified intent: 'order', 'routing', 'warehouse', or 'general'."""

    intent_confidence: float | None
    """Classifier's confidence score (0.0–1.0) for the chosen intent."""

    # ── Order Agent (written by order_agent_node) ───────────────────────
    package_context: dict[str, Any] | None
    """Structured package data fetched from Supabase.
    Contains: tracking_number, status, weight, dimensions, route sequence,
    tracking events, source/destination addresses, etc."""

    # ── Routing Agent (written by routing_agent_node) ───────────────────
    route_result: dict[str, Any] | None
    """A* Search output. Contains:
      - optimal_path: list of warehouse dicts in transit order
      - total_cost: weighted composite cost
      - legs: per-hop breakdown (distance, occupancy, delay)
      - estimated_transit_hours: total ETA"""

    # ── Warehouse Agent (written by warehouse_agent_node) ───────────────
    warehouse_result: dict[str, Any] | None
    """Warehouse capacity analysis. Contains:
      - warehouses: list of all nodes with occupancy ratios
      - critical_nodes: warehouses at ≥90% capacity
      - alerts: human-readable capacity warnings
      - suggestions: bypass/rebalancing recommendations"""

    # ── Delivery Agent (written by delivery_agent_node) ─────────────────
    delivery_result: dict[str, Any] | None
    """Delivery scheduling output. Contains:
      - assigned_pickup: employee + vehicle for pickup leg
      - assigned_delivery: employee + vehicle for delivery leg
      - time_window: scheduled pickup/delivery datetime range
      - available_pool: count of unassigned assets"""

    # ── Final Output (written by response_assembler_node) ───────────────
    agent_response: str | None
    """The final human-readable response string returned to the user."""

    # ── Pipeline Error (written by any node on failure) ─────────────────
    error: str | None
    """Pipeline-level error message. If set, response_assembler will
    return an error message instead of normal output."""
