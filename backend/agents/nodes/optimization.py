"""
LogiChain AI — Warehouse Optimization & Delivery Scheduling Agents
===================================================================
Two async LangGraph nodes in one module:

  1. warehouse_agent_node — Monitors system-wide storage constraints,
     flags critical-capacity nodes (≥90%), and suggests bypass routes.

  2. delivery_agent_node — Matches available pickup/delivery employees
     to optimal time windows based on warehouse assignments, vehicle
     availability, and employee type.
"""

from __future__ import annotations

import logging
from datetime import datetime, timedelta, timezone
from typing import Any

from agents.state import AgentState
from agents.tools.supabase_client import SupabaseAPIError, supabase_client

logger = logging.getLogger("logichain.optimization")


# ── Constants ───────────────────────────────────────────────────────────────

CRITICAL_CAPACITY_THRESHOLD = 0.9
"""Warehouses at or above 90% capacity are flagged as critical."""

PICKUP_WINDOW_HOURS = 2
"""Default pickup time window in hours from assignment."""

DELIVERY_WINDOW_HOURS = 4
"""Default delivery time window in hours from dispatch."""


# ═══════════════════════════════════════════════════════════════════════════
# ██  WAREHOUSE OPTIMIZATION AGENT
# ═══════════════════════════════════════════════════════════════════════════

async def warehouse_agent_node(state: AgentState) -> dict[str, Any]:
    """
    LangGraph node: Warehouse Optimization Agent.

    Responsibilities:
      1. Query all warehouses from Supabase
      2. Compute occupancy ratios for each hub
      3. Flag nodes at critical capacity (≥ 90%)
      4. Generate alerts and rebalancing suggestions
      5. If route context exists, check if any route hubs are critical

    Returns:
        Partial state update with `warehouse_result` and `agent_response`.
    """
    query: str = state.get("raw_query", "")

    logger.info("Warehouse agent processing: %.80s...", query)

    try:
        # ── Step 1: Fetch all warehouse data ────────────────────────────
        warehouse_rows = await supabase_client.query_table(
            "warehouses",
            select="warehouse_id,name,city,state,capacity,current_load,"
                   "latitude,longitude",
        )

        if not warehouse_rows:
            return {
                "warehouse_result": None,
                "agent_response": (
                    "⚠️ No warehouse data available in the system."
                ),
            }

        # ── Step 2: Analyze each warehouse ──────────────────────────────
        warehouses_analysis: list[dict[str, Any]] = []
        critical_nodes: list[dict[str, Any]] = []
        alerts: list[str] = []

        for wh in warehouse_rows:
            capacity = int(wh["capacity"])
            current_load = int(wh["current_load"])
            ratio = current_load / capacity if capacity > 0 else 1.0
            name = wh["name"]
            city = wh["city"]

            analysis = {
                "warehouse_id": wh["warehouse_id"],
                "name": name,
                "city": city,
                "state": wh["state"],
                "capacity": capacity,
                "current_load": current_load,
                "occupancy_ratio": round(ratio, 3),
                "is_critical": ratio >= CRITICAL_CAPACITY_THRESHOLD,
                "available_capacity": capacity - current_load,
            }
            warehouses_analysis.append(analysis)

            if ratio >= CRITICAL_CAPACITY_THRESHOLD:
                critical_nodes.append(analysis)
                severity = "🔴 CRITICAL" if ratio >= 0.95 else "🟠 WARNING"
                alerts.append(
                    f"{severity}: {name} ({city}) is at "
                    f"{ratio:.0%} capacity — only "
                    f"{capacity - current_load:,} units remaining."
                )

        # ── Step 3: Generate rebalancing suggestions ────────────────────
        suggestions: list[str] = []
        if critical_nodes:
            # Find the least loaded warehouse as a bypass candidate
            sorted_by_load = sorted(
                warehouses_analysis, key=lambda w: w["occupancy_ratio"]
            )
            least_loaded = sorted_by_load[0]

            for critical in critical_nodes:
                if least_loaded["occupancy_ratio"] < 0.7:
                    suggestions.append(
                        f"Consider rerouting packages from "
                        f"{critical['name']} ({critical['city']}) to "
                        f"{least_loaded['name']} ({least_loaded['city']}) — "
                        f"currently at {least_loaded['occupancy_ratio']:.0%} "
                        f"with {least_loaded['available_capacity']:,} units "
                        f"available."
                    )

        # ── Step 4: Check route context for critical hubs ───────────────
        route_result = state.get("route_result")
        route_warnings: list[str] = []
        if route_result and "optimal_path" in route_result:
            for hop in route_result["optimal_path"]:
                wid = hop.get("warehouse_id")
                matching = [
                    w for w in critical_nodes
                    if w["warehouse_id"] == wid
                ]
                if matching:
                    route_warnings.append(
                        f"⚠️ Route passes through {matching[0]['name']} "
                        f"which is at {matching[0]['occupancy_ratio']:.0%} "
                        f"capacity. Consider alternative routing."
                    )

        # ── Step 5: Assemble result ─────────────────────────────────────
        warehouse_result = {
            "warehouses": warehouses_analysis,
            "critical_nodes": critical_nodes,
            "alerts": alerts,
            "suggestions": suggestions,
            "route_warnings": route_warnings,
            "total_system_capacity": sum(
                w["capacity"] for w in warehouses_analysis
            ),
            "total_system_load": sum(
                w["current_load"] for w in warehouses_analysis
            ),
        }

        # Format human-readable response
        response = _format_warehouse_response(
            warehouses_analysis, critical_nodes, alerts,
            suggestions, route_warnings,
        )

        return {
            "warehouse_result": warehouse_result,
            "agent_response": response,
        }

    except SupabaseAPIError as e:
        logger.error("Supabase query failed in warehouse agent: %s", e)
        return {
            "error": f"Database query failed: {e.detail}",
            "agent_response": (
                "⚠️ Failed to fetch warehouse capacity data. "
                "Please try again."
            ),
        }
    except Exception as e:
        logger.error("Warehouse agent failed: %s", e, exc_info=True)
        return {
            "error": f"Warehouse agent error: {str(e)}",
            "agent_response": (
                "⚠️ An error occurred during warehouse capacity analysis."
            ),
        }


def _format_warehouse_response(
    warehouses: list[dict[str, Any]],
    critical: list[dict[str, Any]],
    alerts: list[str],
    suggestions: list[str],
    route_warnings: list[str],
) -> str:
    """Format warehouse analysis into a human-readable report."""
    total_cap = sum(w["capacity"] for w in warehouses)
    total_load = sum(w["current_load"] for w in warehouses)
    system_ratio = total_load / total_cap if total_cap > 0 else 0

    lines = [
        "🏭 **Warehouse Capacity Report**",
        "",
        f"**System-wide Utilization:** {system_ratio:.0%} "
        f"({total_load:,} / {total_cap:,} units)",
        "",
        "| Hub | City | Capacity | Load | Utilization | Status |",
        "|-----|------|----------|------|-------------|--------|",
    ]

    for wh in sorted(warehouses, key=lambda w: -w["occupancy_ratio"]):
        if wh["is_critical"]:
            status = "🔴 CRITICAL" if wh["occupancy_ratio"] >= 0.95 else "🟠 WARNING"
        elif wh["occupancy_ratio"] > 0.7:
            status = "🟡 Elevated"
        else:
            status = "🟢 Normal"

        lines.append(
            f"| {wh['name']} | {wh['city']} | "
            f"{wh['capacity']:,} | {wh['current_load']:,} | "
            f"{wh['occupancy_ratio']:.0%} | {status} |"
        )

    if alerts:
        lines.append("")
        lines.append("🚨 **Capacity Alerts:**")
        for alert in alerts:
            lines.append(f"  • {alert}")

    if route_warnings:
        lines.append("")
        lines.append("⚠️ **Route Conflict Warnings:**")
        for warning in route_warnings:
            lines.append(f"  • {warning}")

    if suggestions:
        lines.append("")
        lines.append("💡 **Rebalancing Suggestions:**")
        for suggestion in suggestions:
            lines.append(f"  • {suggestion}")

    return "\n".join(lines)


# ═══════════════════════════════════════════════════════════════════════════
# ██  DELIVERY SCHEDULING AGENT
# ═══════════════════════════════════════════════════════════════════════════

async def delivery_agent_node(state: AgentState) -> dict[str, Any]:
    """
    LangGraph node: Delivery Scheduling Agent.

    Responsibilities:
      1. Determine relevant warehouse(s) from route or warehouse context
      2. Query available employees from those warehouses
      3. Separate into pickup_agent and delivery_agent pools
      4. Match employees to optimal time windows based on:
         - Employee type (pickup vs delivery)
         - Vehicle availability (non-null vehicle_id)
         - Active status
      5. Assemble assignment recommendations

    Returns:
        Partial state update with `delivery_result` and `agent_response`.
    """
    logger.info("Delivery agent processing assignment optimization...")

    try:
        # ── Step 1: Determine relevant warehouses ───────────────────────
        warehouse_ids = _get_relevant_warehouse_ids(state)

        if not warehouse_ids:
            # Fall back to all warehouses
            all_wh = await supabase_client.query_table(
                "warehouses", select="warehouse_id"
            )
            warehouse_ids = [int(w["warehouse_id"]) for w in all_wh]

        # ── Step 2: Fetch available employees ───────────────────────────
        employees = await supabase_client.query_table(
            "employees",
            select="employee_id,user_id,emp_type,warehouse_id,"
                   "vehicle_id,status",
            filters={"status": "active"},
        )

        if not employees:
            return {
                "delivery_result": {"available_pool": 0},
                "agent_response": (
                    "⚠️ No active employees found in the system. "
                    "Delivery scheduling unavailable."
                ),
            }

        # ── Step 3: Categorize and filter ───────────────────────────────
        pickup_agents: list[dict[str, Any]] = []
        delivery_agents: list[dict[str, Any]] = []
        warehouse_operators: list[dict[str, Any]] = []

        for emp in employees:
            emp_wh = emp.get("warehouse_id")
            emp_type = emp.get("emp_type", "")

            # Prioritize employees from relevant warehouses
            is_relevant = emp_wh in warehouse_ids if emp_wh else False

            annotated = {
                **emp,
                "is_relevant_warehouse": is_relevant,
                "has_vehicle": emp.get("vehicle_id") is not None,
            }

            if emp_type == "pickup_agent":
                pickup_agents.append(annotated)
            elif emp_type == "delivery_agent":
                delivery_agents.append(annotated)
            elif emp_type == "warehouse_operator":
                warehouse_operators.append(annotated)

        # Sort: relevant warehouse first, then vehicle availability
        pickup_agents.sort(
            key=lambda e: (-e["is_relevant_warehouse"], -e["has_vehicle"])
        )
        delivery_agents.sort(
            key=lambda e: (-e["is_relevant_warehouse"], -e["has_vehicle"])
        )

        # ── Step 4: Compute optimal time windows ────────────────────────
        now = datetime.now(timezone.utc)

        assigned_pickup = None
        pickup_window = None
        if pickup_agents:
            best = pickup_agents[0]
            assigned_pickup = {
                "employee_id": best["employee_id"],
                "emp_type": best["emp_type"],
                "warehouse_id": best["warehouse_id"],
                "vehicle_id": best.get("vehicle_id"),
                "is_relevant_warehouse": best["is_relevant_warehouse"],
            }
            pickup_window = {
                "start": (now + timedelta(minutes=30)).isoformat(),
                "end": (now + timedelta(hours=PICKUP_WINDOW_HOURS)).isoformat(),
                "duration_hours": PICKUP_WINDOW_HOURS,
            }

        assigned_delivery = None
        delivery_window = None
        if delivery_agents:
            best = delivery_agents[0]
            assigned_delivery = {
                "employee_id": best["employee_id"],
                "emp_type": best["emp_type"],
                "warehouse_id": best["warehouse_id"],
                "vehicle_id": best.get("vehicle_id"),
                "is_relevant_warehouse": best["is_relevant_warehouse"],
            }
            delivery_window = {
                "start": (now + timedelta(hours=PICKUP_WINDOW_HOURS)).isoformat(),
                "end": (
                    now + timedelta(
                        hours=PICKUP_WINDOW_HOURS + DELIVERY_WINDOW_HOURS
                    )
                ).isoformat(),
                "duration_hours": DELIVERY_WINDOW_HOURS,
            }

        # ── Step 5: Assemble result ─────────────────────────────────────
        delivery_result = {
            "assigned_pickup": assigned_pickup,
            "assigned_delivery": assigned_delivery,
            "pickup_window": pickup_window,
            "delivery_window": delivery_window,
            "available_pool": {
                "pickup_agents": len(pickup_agents),
                "delivery_agents": len(delivery_agents),
                "warehouse_operators": len(warehouse_operators),
                "total": len(employees),
            },
            "relevant_warehouses": warehouse_ids,
        }

        response = _format_delivery_response(delivery_result)

        return {
            "delivery_result": delivery_result,
            "agent_response": response,
        }

    except SupabaseAPIError as e:
        logger.error("Supabase query failed in delivery agent: %s", e)
        return {
            "error": f"Database query failed: {e.detail}",
            "agent_response": (
                "⚠️ Failed to fetch employee data for delivery scheduling."
            ),
        }
    except Exception as e:
        logger.error("Delivery agent failed: %s", e, exc_info=True)
        return {
            "error": f"Delivery agent error: {str(e)}",
            "agent_response": (
                "⚠️ An error occurred during delivery scheduling."
            ),
        }


def _get_relevant_warehouse_ids(state: AgentState) -> list[int]:
    """
    Extract warehouse IDs relevant to the current context from:
      1. Route result (optimal_path warehouses)
      2. Warehouse result (critical nodes)
      3. Package context (route sequence)
    """
    ids: list[int] = []

    # From route result
    route_result = state.get("route_result")
    if route_result and "optimal_path" in route_result:
        for node in route_result["optimal_path"]:
            wid = node.get("warehouse_id")
            if wid and int(wid) not in ids:
                ids.append(int(wid))

    # From warehouse result (critical nodes)
    wh_result = state.get("warehouse_result")
    if wh_result and "critical_nodes" in wh_result:
        for node in wh_result["critical_nodes"]:
            wid = node.get("warehouse_id")
            if wid and int(wid) not in ids:
                ids.append(int(wid))

    # From package context (route sequence)
    pkg_context = state.get("package_context")
    if pkg_context and "route_sequence" in pkg_context:
        for hop in pkg_context["route_sequence"]:
            wid = hop.get("warehouse_id")
            if wid and int(wid) not in ids:
                ids.append(int(wid))

    return ids


def _format_delivery_response(result: dict[str, Any]) -> str:
    """Format delivery scheduling result into a human-readable response."""
    lines = [
        "🚚 **Delivery Scheduling Report**",
        "",
    ]

    pool = result.get("available_pool", {})
    lines.append(
        f"**Available Fleet:** {pool.get('total', 0)} active employees "
        f"({pool.get('pickup_agents', 0)} pickup, "
        f"{pool.get('delivery_agents', 0)} delivery, "
        f"{pool.get('warehouse_operators', 0)} operators)"
    )
    lines.append("")

    # Pickup assignment
    pickup = result.get("assigned_pickup")
    if pickup:
        window = result.get("pickup_window", {})
        vehicle = pickup.get("vehicle_id") or "No vehicle assigned"
        lines.append("📥 **Pickup Assignment:**")
        lines.append(f"  • Employee ID: **{pickup['employee_id']}**")
        lines.append(f"  • Vehicle: **{vehicle}**")
        lines.append(f"  • Warehouse: #{pickup['warehouse_id']}")
        lines.append(
            f"  • Window: {window.get('start', 'TBD')[:16]} → "
            f"{window.get('end', 'TBD')[:16]}"
        )
    else:
        lines.append("📥 **Pickup:** ⚠️ No pickup agents available")

    lines.append("")

    # Delivery assignment
    delivery = result.get("assigned_delivery")
    if delivery:
        window = result.get("delivery_window", {})
        vehicle = delivery.get("vehicle_id") or "No vehicle assigned"
        lines.append("📦 **Delivery Assignment:**")
        lines.append(f"  • Employee ID: **{delivery['employee_id']}**")
        lines.append(f"  • Vehicle: **{vehicle}**")
        lines.append(f"  • Warehouse: #{delivery['warehouse_id']}")
        lines.append(
            f"  • Window: {window.get('start', 'TBD')[:16]} → "
            f"{window.get('end', 'TBD')[:16]}"
        )
    else:
        lines.append("📦 **Delivery:** ⚠️ No delivery agents available")

    return "\n".join(lines)
