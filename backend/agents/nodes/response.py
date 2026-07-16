"""
LogiChain AI — Response Assembler Node
========================================
Convergence node that collects results from whichever upstream agent
ran and assembles the final human-readable response.

This node runs at the end of every successful pipeline execution
(after order, routing, or warehouse+delivery paths). It ensures
consistent response formatting and graceful error handling.
"""

from __future__ import annotations

import logging
from typing import Any

from agents.state import AgentState

logger = logging.getLogger("logichain.response_assembler")


def response_assembler_node(state: AgentState) -> dict[str, Any]:
    """
    LangGraph node: Response Assembler.

    Collects all upstream results and ensures a coherent final response
    is written to `agent_response`. Handles several scenarios:

    1. If `agent_response` is already set by an upstream node → pass through
    2. If an `error` occurred → format an error response
    3. If multiple results exist (e.g., warehouse + delivery) → merge them
    4. If nothing was produced → return a generic fallback
    """
    intent = state.get("intent", "general")
    error = state.get("error")
    existing_response = state.get("agent_response")

    logger.info(
        "Response assembler: intent=%s, has_error=%s, has_response=%s",
        intent, bool(error), bool(existing_response),
    )

    # ── Scenario 1: Error state ─────────────────────────────────────────
    if error:
        # If there's already a response, keep it (it was set by the agent
        # that encountered the error)
        if existing_response:
            return {"agent_response": existing_response}

        return {
            "agent_response": (
                f"⚠️ An error occurred while processing your request: "
                f"{error}\n\nPlease try again or rephrase your query."
            ),
        }

    # ── Scenario 2: Warehouse → Delivery pipeline ──────────────────────
    # When both warehouse and delivery agents ran, merge their responses
    if intent == "warehouse":
        warehouse_result = state.get("warehouse_result")
        delivery_result = state.get("delivery_result")

        parts: list[str] = []

        if existing_response:
            # The last agent to run (delivery_agent) set the response.
            # But we want to show the warehouse report first.
            warehouse_response = _get_warehouse_response(state)
            delivery_response = existing_response

            if warehouse_response and warehouse_response != delivery_response:
                parts.append(warehouse_response)
                parts.append("")
                parts.append("---")
                parts.append("")
                parts.append(delivery_response)
            else:
                parts.append(existing_response)
        elif warehouse_result:
            parts.append("Warehouse analysis completed successfully.")
        else:
            parts.append("No warehouse data available.")

        if parts:
            return {"agent_response": "\n".join(parts)}

    # ── Scenario 3: Single-agent response already exists ────────────────
    if existing_response:
        return {"agent_response": existing_response}

    # ── Scenario 4: No response was generated ───────────────────────────
    logger.warning("No agent response generated for intent='%s'", intent)
    return {
        "agent_response": (
            "I processed your request but wasn't able to generate a "
            "detailed response. Please try rephrasing your query or "
            "provide more specific details."
        ),
    }


def _get_warehouse_response(state: AgentState) -> str | None:
    """
    Attempt to reconstruct the warehouse response from the stored result.
    Used when we need to merge warehouse + delivery responses.
    """
    wh_result = state.get("warehouse_result")
    if not wh_result:
        return None

    warehouses = wh_result.get("warehouses", [])
    if not warehouses:
        return None

    total_cap = wh_result.get("total_system_capacity", 0)
    total_load = wh_result.get("total_system_load", 0)
    ratio = total_load / total_cap if total_cap > 0 else 0

    lines = [
        "🏭 **Warehouse Capacity Report**",
        "",
        f"**System-wide Utilization:** {ratio:.0%} "
        f"({total_load:,} / {total_cap:,} units)",
        "",
        "| Hub | City | Utilization | Status |",
        "|-----|------|-------------|--------|",
    ]

    for wh in sorted(warehouses, key=lambda w: -w["occupancy_ratio"]):
        if wh.get("is_critical"):
            status = "🔴 CRITICAL"
        elif wh["occupancy_ratio"] > 0.7:
            status = "🟡 Elevated"
        else:
            status = "🟢 Normal"

        lines.append(
            f"| {wh['name']} | {wh['city']} | "
            f"{wh['occupancy_ratio']:.0%} | {status} |"
        )

    alerts = wh_result.get("alerts", [])
    if alerts:
        lines.append("")
        lines.append("🚨 **Alerts:**")
        for alert in alerts:
            lines.append(f"  • {alert}")

    suggestions = wh_result.get("suggestions", [])
    if suggestions:
        lines.append("")
        lines.append("💡 **Suggestions:**")
        for s in suggestions:
            lines.append(f"  • {s}")

    return "\n".join(lines)
