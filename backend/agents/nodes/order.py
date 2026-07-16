"""
LogiChain AI — Order Management Agent Node
============================================
Async LangGraph node that handles all package/order-related queries:
  • Package lookup by tracking number or package ID
  • Status queries ("Where is my package?")
  • Cancellation requests (with business rule enforcement)
  • Full package context assembly (package + route + tracking history)

Business Rules:
  • Cannot cancel if status is 'in_transit', 'out_for_delivery', or 'delivered'
  • Cannot modify if 'delivered' or 'cancelled'
  • Customers can only see their own packages
  • Admin/warehouse_manager can see all packages
"""

from __future__ import annotations

import logging
import re
from typing import Any

from agents.state import AgentState
from agents.tools.supabase_client import SupabaseAPIError, supabase_client

logger = logging.getLogger("logichain.order_agent")


# ── Tracking Number Extraction ──────────────────────────────────────────────
# Matches patterns like TRK-98213456, trk98213456, #98213456
_TRACKING_PATTERNS = [
    re.compile(r"TRK-?\d{6,10}", re.IGNORECASE),
    re.compile(r"#(\d{6,10})"),
    re.compile(r"tracking\s*(?:number|#|no\.?)?\s*:?\s*(\d{6,10})", re.IGNORECASE),
    re.compile(r"package\s*(?:id|#|no\.?)?\s*:?\s*(\d{1,5})", re.IGNORECASE),
]

# Statuses that prevent cancellation
_NON_CANCELLABLE = {"in_transit", "out_for_delivery", "delivered"}

# Statuses that prevent any modification
_IMMUTABLE = {"delivered", "cancelled"}


# ── Node Function ───────────────────────────────────────────────────────────

async def order_agent_node(state: AgentState) -> dict[str, Any]:
    """
    LangGraph node: Order Management Agent.

    Workflow:
      1. Extract tracking number or package ID from the raw query
      2. Query Supabase for the package (scoped by user role)
      3. Fetch associated route sequence and tracking events
      4. Check for cancellation/modification intent and enforce rules
      5. Assemble structured package_context and human-readable response

    Returns:
        Partial state update with `package_context` and `agent_response`.
    """
    query: str = state.get("raw_query", "")
    user_id: str = state.get("user_id", "")
    role: str = state.get("user_role", "customer")

    logger.info("Order agent processing query: %.80s...", query)

    try:
        # ── Step 1: Extract identifier ──────────────────────────────────
        tracking_number, package_id = _extract_identifiers(query)

        if not tracking_number and package_id is None:
            # No specific package referenced — provide general guidance
            return await _handle_general_order_query(query, user_id, role)

        # ── Step 2: Fetch the package ───────────────────────────────────
        package = await _fetch_package(
            tracking_number=tracking_number,
            package_id=package_id,
            user_id=user_id,
            role=role,
        )

        if not package:
            return {
                "package_context": None,
                "agent_response": (
                    "📦 I couldn't find a package matching that identifier. "
                    "Please double-check the tracking number and try again."
                ),
            }

        pkg_id = package["package_id"]

        # ── Step 3: Fetch route + tracking events ───────────────────────
        route_sequence = await _fetch_route_sequence(pkg_id)
        tracking_events = await _fetch_tracking_events(pkg_id)

        # ── Step 4: Build full context ──────────────────────────────────
        package_context: dict[str, Any] = {
            "package": package,
            "route_sequence": route_sequence,
            "tracking_events": tracking_events,
        }

        # ── Step 5: Handle cancellation intent ──────────────────────────
        if _is_cancellation_request(query):
            return _handle_cancellation(package, package_context)

        # ── Step 6: Assemble response ───────────────────────────────────
        response = _format_package_response(
            package, route_sequence, tracking_events
        )

        return {
            "package_context": package_context,
            "agent_response": response,
        }

    except SupabaseAPIError as e:
        logger.error("Supabase query failed in order agent: %s", e)
        return {
            "error": f"Database query failed: {e.detail}",
            "agent_response": (
                "⚠️ I encountered an error while looking up your package. "
                "Please try again in a moment."
            ),
        }
    except Exception as e:
        logger.error("Order agent failed: %s", e, exc_info=True)
        return {
            "error": f"Order agent error: {str(e)}",
            "agent_response": (
                "⚠️ An unexpected error occurred while processing your "
                "order query. Please try again."
            ),
        }


# ── Helper Functions ────────────────────────────────────────────────────────

def _extract_identifiers(query: str) -> tuple[str | None, int | None]:
    """
    Extract a tracking number and/or package ID from the query string.

    Returns:
        (tracking_number, package_id) — one or both may be None.
    """
    tracking_number: str | None = None
    package_id: int | None = None

    for pattern in _TRACKING_PATTERNS:
        match = pattern.search(query)
        if match:
            full_match = match.group(0)
            # If it looks like a tracking number (has TRK prefix)
            if full_match.upper().startswith("TRK"):
                tracking_number = full_match.upper()
                # Normalize: ensure dash is present
                if "-" not in tracking_number:
                    tracking_number = f"TRK-{tracking_number[3:]}"
                break
            else:
                # It's a numeric ID
                digits = match.group(1) if match.lastindex else full_match
                digits = re.sub(r"\D", "", str(digits))
                if digits:
                    num = int(digits)
                    # Distinguish: short numbers are package IDs,
                    # long numbers could be partial tracking numbers
                    if num < 100000:
                        package_id = num
                    else:
                        tracking_number = f"TRK-{digits}"
                    break

    return tracking_number, package_id


async def _fetch_package(
    *,
    tracking_number: str | None,
    package_id: int | None,
    user_id: str,
    role: str,
) -> dict[str, Any] | None:
    """
    Fetch a single package from Supabase.
    Customers are scoped to their own packages. Admins see all.
    """
    filters: dict[str, Any] = {}

    if tracking_number:
        filters["tracking_number"] = tracking_number
    elif package_id is not None:
        filters["package_id"] = str(package_id)
    else:
        return None

    # Scope to user's own packages if they're a customer
    if role == "customer":
        filters["user_id"] = user_id

    rows = await supabase_client.query_table(
        "packages",
        select="*",
        filters=filters,
        limit=1,
    )
    return rows[0] if rows else None


async def _fetch_route_sequence(package_id: int) -> list[dict[str, Any]]:
    """Fetch the multi-hub route for a package, joined with warehouse names."""
    routes = await supabase_client.query_table(
        "package_routes",
        select="sequence_no,warehouse_id,arrival_time,departure_time,"
               "warehouses(name,city,state)",
        filters={"package_id": str(package_id)},
        order="sequence_no.asc",
    )
    return routes


async def _fetch_tracking_events(package_id: int) -> list[dict[str, Any]]:
    """Fetch the tracking event audit trail for a package."""
    events = await supabase_client.query_table(
        "tracking_events",
        select="event_id,status,remarks,timestamp,"
               "warehouses(name),employees(employee_id)",
        filters={"package_id": str(package_id)},
        order="timestamp.asc",
    )
    return events


async def _handle_general_order_query(
    query: str, user_id: str, role: str
) -> dict[str, Any]:
    """
    Handle order queries that don't reference a specific package.
    Lists the user's recent packages as context.
    """
    filters: dict[str, Any] = {}
    if role == "customer":
        filters["user_id"] = user_id

    packages = await supabase_client.query_table(
        "packages",
        select="package_id,tracking_number,status,source_address,"
               "destination_address,created_at",
        filters=filters,
        order="created_at.desc",
        limit=5,
    )

    if not packages:
        return {
            "package_context": None,
            "agent_response": (
                "📦 You don't have any packages in the system yet. "
                "Create a new shipment to get started!"
            ),
        }

    # Format a summary of recent packages
    lines = ["📦 **Your Recent Packages:**\n"]
    for pkg in packages:
        status_emoji = _status_emoji(pkg["status"])
        lines.append(
            f"  • **{pkg['tracking_number']}** — "
            f"{status_emoji} {pkg['status'].replace('_', ' ').title()}\n"
            f"    {pkg['source_address']} → {pkg['destination_address']}"
        )

    lines.append(
        "\n💡 *Mention a specific tracking number to get detailed info.*"
    )

    return {
        "package_context": {"recent_packages": packages},
        "agent_response": "\n".join(lines),
    }


def _is_cancellation_request(query: str) -> bool:
    """Detect if the user wants to cancel or modify a package."""
    cancel_patterns = [
        r"\bcancel\b", r"\bcancell?ation\b",
        r"\brefund\b", r"\breturn\b",
        r"\bstop\s+(the\s+)?(shipment|delivery|order)\b",
    ]
    return any(re.search(p, query, re.IGNORECASE) for p in cancel_patterns)


def _handle_cancellation(
    package: dict[str, Any],
    package_context: dict[str, Any],
) -> dict[str, Any]:
    """Enforce cancellation business rules."""
    status = package.get("status", "")
    tracking = package.get("tracking_number", "Unknown")

    if status in _IMMUTABLE:
        return {
            "package_context": package_context,
            "agent_response": (
                f"❌ Package **{tracking}** cannot be cancelled — "
                f"it is already marked as **{status.replace('_', ' ')}**."
            ),
        }

    if status in _NON_CANCELLABLE:
        return {
            "package_context": package_context,
            "agent_response": (
                f"⚠️ Package **{tracking}** is currently "
                f"**{status.replace('_', ' ')}** and cannot be cancelled "
                f"at this stage. Please contact support for assistance."
            ),
        }

    # Package CAN be cancelled (pending, pickup_scheduled, picked_up,
    # in_warehouse)
    return {
        "package_context": package_context,
        "agent_response": (
            f"✅ Package **{tracking}** (status: "
            f"**{status.replace('_', ' ')}**) is eligible for cancellation. "
            f"Would you like me to proceed with the cancellation? "
            f"Please confirm by saying 'Yes, cancel it.'"
        ),
    }


def _format_package_response(
    package: dict[str, Any],
    route_sequence: list[dict[str, Any]],
    tracking_events: list[dict[str, Any]],
) -> str:
    """Assemble a human-readable package detail response."""
    tracking = package.get("tracking_number", "Unknown")
    status = package.get("status", "unknown")
    weight = package.get("weight", "N/A")
    category = package.get("category", "N/A")
    fragile = "⚠️ Yes" if package.get("fragile") else "No"
    hazardous = "☣️ Yes" if package.get("hazardous") else "No"
    source = package.get("source_address", "Unknown")
    dest = package.get("destination_address", "Unknown")

    lines = [
        f"📦 **Package {tracking}**",
        f"",
        f"| Field | Value |",
        f"|-------|-------|",
        f"| Status | {_status_emoji(status)} {status.replace('_', ' ').title()} |",
        f"| Weight | {weight} kg |",
        f"| Category | {category.title() if isinstance(category, str) else category} |",
        f"| Fragile | {fragile} |",
        f"| Hazardous | {hazardous} |",
        f"| From | {source} |",
        f"| To | {dest} |",
    ]

    # Route sequence
    if route_sequence:
        lines.append("")
        lines.append("🗺️ **Route Sequence:**")
        for hop in route_sequence:
            seq = hop.get("sequence_no", "?")
            wh = hop.get("warehouses", {})
            wh_name = wh.get("name", "Unknown Hub") if isinstance(wh, dict) else "Unknown Hub"
            wh_city = wh.get("city", "") if isinstance(wh, dict) else ""
            lines.append(f"  {seq}. {wh_name} ({wh_city})")

    # Recent tracking events (last 5)
    if tracking_events:
        lines.append("")
        lines.append("📋 **Tracking History** (latest first):")
        for event in reversed(tracking_events[-5:]):
            evt_status = event.get("status", "unknown")
            remarks = event.get("remarks", "No details")
            timestamp = event.get("timestamp", "")
            # Truncate timestamp to readable format
            if timestamp and len(str(timestamp)) > 19:
                timestamp = str(timestamp)[:19]
            lines.append(
                f"  • [{timestamp}] "
                f"{_status_emoji(evt_status)} {evt_status.replace('_', ' ').title()} "
                f"— {remarks}"
            )

    return "\n".join(lines)


def _status_emoji(status: str) -> str:
    """Map package status to a visual emoji indicator."""
    return {
        "pending": "🟡",
        "pickup_scheduled": "📅",
        "picked_up": "🚚",
        "in_warehouse": "🏭",
        "in_transit": "✈️",
        "out_for_delivery": "🛵",
        "delivered": "✅",
        "cancelled": "❌",
    }.get(status, "⬜")
