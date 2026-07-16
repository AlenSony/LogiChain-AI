"""
LogiChain AI — General Fallback Agent Node
============================================
Handles queries classified as 'general' — greetings, help requests,
off-topic questions, and capability inquiries.

This node does NOT call any LLM or external API. It returns a canned
response listing the platform's available capabilities, keeping costs
at zero for non-logistics queries.
"""

from __future__ import annotations

import logging
from typing import Any

from agents.state import AgentState

logger = logging.getLogger("logichain.general")


# ── Capability Descriptions ─────────────────────────────────────────────────

_CAPABILITIES_RESPONSE = """👋 **Welcome to LogiChain AI!**

I'm your autonomous logistics assistant. Here's what I can help you with:

📦 **Order Management**
  • Track a package by its tracking number (e.g., "Where is TRK-98213456?")
  • Check package status, route, and delivery history
  • Request cancellation (subject to business rules)

🗺️ **Route Optimization**
  • Compute optimal multi-hub routes between cities
  • View distance, traffic, and capacity analysis
  • Example: "What's the best route from Mumbai to Chennai?"

🏭 **Warehouse Monitoring** *(Admin/Manager)*
  • View real-time capacity across all hubs
  • Get alerts for warehouses nearing critical capacity
  • Receive rebalancing suggestions

🚚 **Delivery Scheduling** *(Admin/Manager)*
  • Auto-assign pickup and delivery employees
  • Optimize time windows based on fleet availability

💡 **Tips:**
  • Mention a tracking number for instant package lookup
  • Name two cities to get route optimization
  • Ask about "warehouse capacity" for the capacity report

*How can I help you today?*"""


# ── Node Function ───────────────────────────────────────────────────────────

def general_fallback_node(state: AgentState) -> dict[str, Any]:
    """
    LangGraph node: General Fallback Handler.

    For 'general' intent queries, returns a helpful overview of
    platform capabilities. Zero-cost — no LLM or DB calls.
    """
    query = state.get("raw_query", "")
    logger.info("General fallback handling query: %.80s...", query)

    # Check if it's a greeting vs. a help request
    query_lower = query.lower().strip()
    greeting_words = {"hi", "hello", "hey", "howdy", "greetings", "sup", "yo"}

    if any(query_lower.startswith(w) for w in greeting_words):
        return {
            "agent_response": _CAPABILITIES_RESPONSE,
        }

    # Check for explicit help requests
    if any(word in query_lower for word in ["help", "what can you do", "capabilities"]):
        return {
            "agent_response": _CAPABILITIES_RESPONSE,
        }

    # For everything else, give a gentle redirect
    return {
        "agent_response": (
            "🤔 I'm not sure I understand that request. "
            "I'm specialized in logistics operations — "
            "package tracking, route optimization, and warehouse management.\n\n"
            "Here are some things you can try:\n"
            "  • \"Track TRK-98213456\"\n"
            "  • \"Route from Mumbai to Delhi\"\n"
            "  • \"Show warehouse capacity\"\n\n"
            "*Type 'help' for a full list of capabilities.*"
        ),
    }
