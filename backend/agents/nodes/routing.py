"""
LogiChain AI — Routing Agent Node (A* Search Pathfinding)
==========================================================
The core computational engine that compiles multi-hub journey sequences
using a custom-weighted A* Search algorithm.

Algorithm:
  Cost(edge) = w1 · Distance + w2 · TrafficDelay + w3 · NodeOccupancy + w4 · VehicleAvailability

  Where:
    • Distance       = Haversine distance between warehouse coordinates (km)
    • TrafficDelay   = Simulated traffic multiplier per edge
    • NodeOccupancy  = current_load / capacity (ratio 0.0–1.0)
    • VehicleAvailability = Inverse of available vehicles at destination node

  Non-linear penalty: When a node's occupancy ratio exceeds 0.9, the cost
  scales exponentially via e^(10 * (ratio - 0.9)) to force the algorithm
  onto alternative subgraphs — preventing routing through near-capacity hubs.

Heuristic:
  Straight-line Haversine distance to the destination (admissible,
  never overestimates actual traversal cost).
"""

from __future__ import annotations

import heapq
import logging
import math
import re
from dataclasses import dataclass, field
from typing import Any

from agents.state import AgentState
from agents.tools.supabase_client import SupabaseAPIError, supabase_client

logger = logging.getLogger("logichain.routing_agent")


# ── Configuration ───────────────────────────────────────────────────────────

@dataclass
class RoutingWeights:
    """
    Configurable weight vector for the A* cost function.

    Weights should sum to ~1.0 for normalized cost interpretation,
    but this is not strictly enforced — the algorithm works with any
    positive weights.
    """
    distance: float = 0.4
    """w1: Physical distance between hubs (Haversine km)."""

    traffic_delay: float = 0.2
    """w2: Simulated traffic delay multiplier."""

    node_occupancy: float = 0.3
    """w3: Destination node's load/capacity ratio."""

    vehicle_availability: float = 0.1
    """w4: Inverse of available vehicle count at destination."""


# ── Constants ───────────────────────────────────────────────────────────────

EARTH_RADIUS_KM = 6371.0
"""Mean Earth radius in kilometers for Haversine calculation."""

CRITICAL_OCCUPANCY_THRESHOLD = 0.9
"""Occupancy ratio above which the non-linear penalty activates."""

AVERAGE_SPEED_KMH = 60.0
"""Assumed average transit speed for ETA calculation."""

# Simulated traffic multipliers per city pair — in production this would
# come from a real-time traffic API. Values > 1.0 indicate congestion.
_TRAFFIC_MATRIX: dict[str, float] = {
    "Mumbai-Delhi": 1.4,
    "Delhi-Mumbai": 1.4,
    "Mumbai-Bangalore": 1.2,
    "Bangalore-Mumbai": 1.2,
    "Mumbai-Chennai": 1.1,
    "Chennai-Mumbai": 1.1,
    "Bangalore-Chennai": 1.0,
    "Chennai-Bangalore": 1.0,
    "Delhi-Bangalore": 1.3,
    "Bangalore-Delhi": 1.3,
    "Delhi-Chennai": 1.2,
    "Chennai-Delhi": 1.2,
}


# ── Graph Node Representation ──────────────────────────────────────────────

@dataclass
class WarehouseNode:
    """Represents a physical warehouse as a graph node."""
    warehouse_id: int
    name: str
    city: str
    state: str
    latitude: float
    longitude: float
    capacity: int
    current_load: int

    @property
    def occupancy_ratio(self) -> float:
        """Current load as a fraction of total capacity."""
        if self.capacity <= 0:
            return 1.0  # Treat zero-capacity as full
        return self.current_load / self.capacity

    @property
    def is_critical(self) -> bool:
        """True if this node's occupancy exceeds the critical threshold."""
        return self.occupancy_ratio > CRITICAL_OCCUPANCY_THRESHOLD


@dataclass(order=True)
class AStarEntry:
    """Priority queue entry for A* search. Ordered by f_score."""
    f_score: float
    node_id: int = field(compare=False)


# ── A* Router ──────────────────────────────────────────────────────────────

class AStarRouter:
    """
    A* Search pathfinder over a warehouse graph with dynamic weights.

    The graph is fully connected (every warehouse can theoretically
    reach every other warehouse). Edge costs are computed dynamically
    based on the weight vector and real-time warehouse states.
    """

    def __init__(
        self,
        nodes: list[WarehouseNode],
        weights: RoutingWeights | None = None,
    ) -> None:
        self.nodes: dict[int, WarehouseNode] = {n.warehouse_id: n for n in nodes}
        self.weights = weights or RoutingWeights()

    def find_optimal_route(
        self, source_id: int, destination_id: int
    ) -> dict[str, Any] | None:
        """
        Execute A* Search from source to destination.

        Args:
            source_id:      warehouse_id of the starting hub.
            destination_id: warehouse_id of the target hub.

        Returns:
            Dict with optimal_path, total_cost, legs, estimated_transit_hours.
            None if no path exists (shouldn't happen in a fully connected graph).
        """
        if source_id not in self.nodes or destination_id not in self.nodes:
            logger.error(
                "Invalid source=%d or destination=%d", source_id, destination_id
            )
            return None

        if source_id == destination_id:
            src = self.nodes[source_id]
            return {
                "optimal_path": [self._node_to_dict(src)],
                "total_cost": 0.0,
                "legs": [],
                "estimated_transit_hours": 0.0,
            }

        destination_node = self.nodes[destination_id]

        # ── A* Data Structures ──────────────────────────────────────────
        # g_score[n] = cost of cheapest path from source to n found so far
        g_score: dict[int, float] = {nid: math.inf for nid in self.nodes}
        g_score[source_id] = 0.0

        # f_score[n] = g_score[n] + heuristic(n, destination)
        f_score: dict[int, float] = {nid: math.inf for nid in self.nodes}
        f_score[source_id] = self._heuristic(
            self.nodes[source_id], destination_node
        )

        # came_from[n] = predecessor node on the optimal path
        came_from: dict[int, int] = {}

        # Open set as a min-heap
        open_set: list[AStarEntry] = [
            AStarEntry(f_score=f_score[source_id], node_id=source_id)
        ]

        # Closed set
        closed: set[int] = set()

        # ── A* Main Loop ────────────────────────────────────────────────
        while open_set:
            current_entry = heapq.heappop(open_set)
            current_id = current_entry.node_id

            if current_id == destination_id:
                # Reconstruct the path
                return self._reconstruct_path(
                    came_from, current_id, g_score[current_id]
                )

            if current_id in closed:
                continue
            closed.add(current_id)

            current_node = self.nodes[current_id]

            # Explore all neighbors (fully connected graph)
            for neighbor_id, neighbor_node in self.nodes.items():
                if neighbor_id == current_id or neighbor_id in closed:
                    continue

                # Compute edge cost with dynamic weights
                edge_cost = self._compute_edge_cost(
                    current_node, neighbor_node
                )

                tentative_g = g_score[current_id] + edge_cost

                if tentative_g < g_score[neighbor_id]:
                    came_from[neighbor_id] = current_id
                    g_score[neighbor_id] = tentative_g
                    f_score[neighbor_id] = tentative_g + self._heuristic(
                        neighbor_node, destination_node
                    )
                    heapq.heappush(
                        open_set,
                        AStarEntry(
                            f_score=f_score[neighbor_id],
                            node_id=neighbor_id,
                        ),
                    )

        # No path found (shouldn't happen in a fully connected graph)
        logger.warning(
            "No path found from %d to %d", source_id, destination_id
        )
        return None

    # ── Cost Functions ──────────────────────────────────────────────────

    def _compute_edge_cost(
        self, from_node: WarehouseNode, to_node: WarehouseNode
    ) -> float:
        """
        Compute the composite weighted cost of traversing from one node
        to another.

        Cost = w1·Distance + w2·TrafficDelay + w3·OccupancyPenalty + w4·VehiclePenalty
        """
        w = self.weights

        # ── w1: Physical distance (Haversine) ───────────────────────────
        distance_km = haversine_distance(
            from_node.latitude, from_node.longitude,
            to_node.latitude, to_node.longitude,
        )
        distance_component = w.distance * distance_km

        # ── w2: Traffic delay ───────────────────────────────────────────
        traffic_key = f"{from_node.city}-{to_node.city}"
        traffic_multiplier = _TRAFFIC_MATRIX.get(traffic_key, 1.0)
        # Scale traffic delay relative to distance
        traffic_component = w.traffic_delay * (distance_km * (traffic_multiplier - 1.0))

        # ── w3: Node occupancy (destination) ────────────────────────────
        occupancy = to_node.occupancy_ratio
        if occupancy > CRITICAL_OCCUPANCY_THRESHOLD:
            # Non-linear exponential penalty for near-full warehouses
            # e^(10 * (ratio - 0.9)) grows rapidly:
            #   ratio=0.91 → e^0.1 ≈ 1.1
            #   ratio=0.95 → e^0.5 ≈ 1.6
            #   ratio=0.97 → e^0.7 ≈ 2.0
            #   ratio=1.00 → e^1.0 ≈ 2.7
            occupancy_penalty = math.exp(
                10.0 * (occupancy - CRITICAL_OCCUPANCY_THRESHOLD)
            )
        else:
            occupancy_penalty = occupancy

        # Scale occupancy relative to distance so it's comparable
        occupancy_component = w.node_occupancy * (distance_km * occupancy_penalty)

        # ── w4: Vehicle availability (simulated) ────────────────────────
        # In production, this would query a real vehicle/fleet table.
        # For now, simulate based on warehouse load — busier hubs have
        # fewer available vehicles.
        vehicle_availability = max(0.1, 1.0 - occupancy)
        vehicle_penalty = 1.0 / vehicle_availability
        vehicle_component = w.vehicle_availability * (distance_km * (vehicle_penalty - 1.0))

        total = (
            distance_component
            + traffic_component
            + occupancy_component
            + vehicle_component
        )

        logger.debug(
            "Edge %s→%s: dist=%.1fkm traffic=%.2f occ=%.2f veh=%.2f total=%.2f",
            from_node.name, to_node.name,
            distance_km, traffic_component, occupancy_component,
            vehicle_component, total,
        )

        return total

    def _heuristic(
        self, node: WarehouseNode, goal: WarehouseNode
    ) -> float:
        """
        Admissible heuristic: straight-line Haversine distance to goal.

        This never overestimates the actual cost (since real cost includes
        distance plus penalties), guaranteeing A* optimality.
        """
        return self.weights.distance * haversine_distance(
            node.latitude, node.longitude,
            goal.latitude, goal.longitude,
        )

    # ── Path Reconstruction ─────────────────────────────────────────────

    def _reconstruct_path(
        self,
        came_from: dict[int, int],
        current_id: int,
        total_cost: float,
    ) -> dict[str, Any]:
        """Reconstruct the optimal path from A* came_from map."""
        path_ids: list[int] = [current_id]
        while current_id in came_from:
            current_id = came_from[current_id]
            path_ids.append(current_id)
        path_ids.reverse()

        # Build detailed leg breakdown
        legs: list[dict[str, Any]] = []
        total_distance = 0.0

        for i in range(len(path_ids) - 1):
            from_node = self.nodes[path_ids[i]]
            to_node = self.nodes[path_ids[i + 1]]
            distance = haversine_distance(
                from_node.latitude, from_node.longitude,
                to_node.latitude, to_node.longitude,
            )
            total_distance += distance
            traffic_key = f"{from_node.city}-{to_node.city}"

            legs.append({
                "from": self._node_to_dict(from_node),
                "to": self._node_to_dict(to_node),
                "distance_km": round(distance, 1),
                "traffic_multiplier": _TRAFFIC_MATRIX.get(traffic_key, 1.0),
                "destination_occupancy": round(to_node.occupancy_ratio, 3),
                "destination_is_critical": to_node.is_critical,
            })

        estimated_hours = total_distance / AVERAGE_SPEED_KMH

        return {
            "optimal_path": [
                self._node_to_dict(self.nodes[nid]) for nid in path_ids
            ],
            "total_cost": round(total_cost, 2),
            "total_distance_km": round(total_distance, 1),
            "legs": legs,
            "estimated_transit_hours": round(estimated_hours, 1),
            "weights_used": {
                "distance": self.weights.distance,
                "traffic_delay": self.weights.traffic_delay,
                "node_occupancy": self.weights.node_occupancy,
                "vehicle_availability": self.weights.vehicle_availability,
            },
        }

    @staticmethod
    def _node_to_dict(node: WarehouseNode) -> dict[str, Any]:
        """Serialize a WarehouseNode to a JSON-safe dict."""
        return {
            "warehouse_id": node.warehouse_id,
            "name": node.name,
            "city": node.city,
            "state": node.state,
            "latitude": float(node.latitude),
            "longitude": float(node.longitude),
            "capacity": node.capacity,
            "current_load": node.current_load,
            "occupancy_ratio": round(node.occupancy_ratio, 3),
            "is_critical": node.is_critical,
        }


# ── Haversine Distance ─────────────────────────────────────────────────────

def haversine_distance(
    lat1: float, lon1: float, lat2: float, lon2: float
) -> float:
    """
    Calculate the great-circle distance between two points on Earth
    using the Haversine formula.

    Args:
        lat1, lon1: Latitude/longitude of point 1 in decimal degrees.
        lat2, lon2: Latitude/longitude of point 2 in decimal degrees.

    Returns:
        Distance in kilometers.
    """
    lat1_r, lat2_r = math.radians(lat1), math.radians(lat2)
    dlat = math.radians(lat2 - lat1)
    dlon = math.radians(lon2 - lon1)

    a = (
        math.sin(dlat / 2) ** 2
        + math.cos(lat1_r) * math.cos(lat2_r) * math.sin(dlon / 2) ** 2
    )
    c = 2 * math.atan2(math.sqrt(a), math.sqrt(1 - a))

    return EARTH_RADIUS_KM * c


# ── LangGraph Node Function ────────────────────────────────────────────────

async def routing_agent_node(state: AgentState) -> dict[str, Any]:
    """
    LangGraph node: Routing Agent.

    Workflow:
      1. Fetch all warehouses from Supabase to build the graph
      2. Identify source and destination from query context or package routes
      3. Run A* Search with dynamic weights
      4. Format the result for human consumption

    Returns:
        Partial state update with `route_result` and `agent_response`.
    """
    query: str = state.get("raw_query", "")

    logger.info("Routing agent processing: %.80s...", query)

    try:
        # ── Step 1: Build the warehouse graph ───────────────────────────
        warehouse_rows = await supabase_client.query_table(
            "warehouses",
            select="warehouse_id,name,city,state,latitude,longitude,"
                   "capacity,current_load",
        )

        if not warehouse_rows:
            return {
                "route_result": None,
                "agent_response": (
                    "⚠️ No warehouses found in the system. "
                    "Cannot compute routes."
                ),
            }

        nodes = [
            WarehouseNode(
                warehouse_id=int(w["warehouse_id"]),
                name=w["name"],
                city=w["city"],
                state=w["state"],
                latitude=float(w["latitude"]),
                longitude=float(w["longitude"]),
                capacity=int(w["capacity"]),
                current_load=int(w["current_load"]),
            )
            for w in warehouse_rows
        ]

        # ── Step 2: Identify source and destination ─────────────────────
        source_id, dest_id = _identify_endpoints(query, nodes, state)

        if source_id is None or dest_id is None:
            # If we can't identify endpoints, show all warehouses + status
            return _format_warehouse_overview(nodes)

        # ── Step 3: Run A* Search ───────────────────────────────────────
        router = AStarRouter(nodes)
        result = router.find_optimal_route(source_id, dest_id)

        if result is None:
            return {
                "route_result": None,
                "agent_response": (
                    "⚠️ Could not find a viable route between the "
                    "specified hubs. All intermediate nodes may be at "
                    "critical capacity."
                ),
            }

        # ── Step 4: Format response ─────────────────────────────────────
        response = _format_route_response(result)

        return {
            "route_result": result,
            "agent_response": response,
        }

    except SupabaseAPIError as e:
        logger.error("Supabase query failed in routing agent: %s", e)
        return {
            "error": f"Database query failed: {e.detail}",
            "agent_response": (
                "⚠️ Failed to fetch warehouse data for route computation. "
                "Please try again."
            ),
        }
    except Exception as e:
        logger.error("Routing agent failed: %s", e, exc_info=True)
        return {
            "error": f"Routing agent error: {str(e)}",
            "agent_response": (
                "⚠️ An unexpected error occurred during route computation. "
                "Please try again."
            ),
        }


# ── Endpoint Identification ────────────────────────────────────────────────

def _identify_endpoints(
    query: str,
    nodes: list[WarehouseNode],
    state: AgentState,
) -> tuple[int | None, int | None]:
    """
    Attempt to identify source and destination warehouses from:
      1. City names mentioned in the query
      2. Package context (if available from a prior order query)
      3. Warehouse names mentioned in the query

    Returns (source_id, destination_id) — either may be None.
    """
    # Build lookup maps
    city_to_id: dict[str, int] = {}
    name_to_id: dict[str, int] = {}
    for node in nodes:
        city_to_id[node.city.lower()] = node.warehouse_id
        name_to_id[node.name.lower()] = node.warehouse_id

    query_lower = query.lower()

    # Strategy 1: Look for city names in the query
    found_cities: list[int] = []
    for city, wid in city_to_id.items():
        if city in query_lower:
            found_cities.append(wid)

    # Strategy 2: Look for warehouse names in the query
    for name, wid in name_to_id.items():
        if name in query_lower and wid not in found_cities:
            found_cities.append(wid)

    if len(found_cities) >= 2:
        return found_cities[0], found_cities[1]

    # Strategy 3: Check for "from X to Y" pattern
    from_to_pattern = re.compile(
        r"from\s+(\w+)\s+to\s+(\w+)", re.IGNORECASE
    )
    match = from_to_pattern.search(query)
    if match:
        src_city = match.group(1).lower()
        dst_city = match.group(2).lower()
        src_id = city_to_id.get(src_city)
        dst_id = city_to_id.get(dst_city)
        if src_id and dst_id:
            return src_id, dst_id

    # Strategy 4: Fall back to package context if available
    pkg_context = state.get("package_context")
    if pkg_context and "route_sequence" in pkg_context:
        route = pkg_context["route_sequence"]
        if len(route) >= 2:
            first = route[0].get("warehouse_id")
            last = route[-1].get("warehouse_id")
            if first and last:
                return int(first), int(last)

    # If only one city found, pair it with the first/last warehouse
    if len(found_cities) == 1:
        # Default: route from the found city to the furthest warehouse
        source = nodes[0]
        dest = nodes[-1]
        if found_cities[0] == source.warehouse_id:
            return source.warehouse_id, dest.warehouse_id
        else:
            return found_cities[0], source.warehouse_id

    return None, None


def _format_warehouse_overview(nodes: list[WarehouseNode]) -> dict[str, Any]:
    """Format a warehouse overview when no specific route is requested."""
    lines = [
        "🗺️ **Warehouse Network Overview**",
        "",
        "| Hub | City | Capacity | Load | Occupancy | Status |",
        "|-----|------|----------|------|-----------|--------|",
    ]
    for n in nodes:
        status = "🔴 CRITICAL" if n.is_critical else (
            "🟡 High" if n.occupancy_ratio > 0.7 else "🟢 Normal"
        )
        lines.append(
            f"| {n.name} | {n.city} | {n.capacity:,} | "
            f"{n.current_load:,} | {n.occupancy_ratio:.0%} | {status} |"
        )

    lines.append("")
    lines.append(
        "💡 *Specify source and destination cities to compute an optimal route.*\n"
        "Example: \"Route from Mumbai to Chennai\""
    )

    return {
        "route_result": None,
        "agent_response": "\n".join(lines),
    }


def _format_route_response(result: dict[str, Any]) -> str:
    """Format an A* route result into a human-readable response."""
    path = result["optimal_path"]
    legs = result["legs"]
    total_dist = result["total_distance_km"]
    total_cost = result["total_cost"]
    eta_hours = result["estimated_transit_hours"]

    lines = [
        "🗺️ **Optimal Route Computed** (A* Search)",
        "",
    ]

    # Path visualization
    path_names = [f"**{n['name']}** ({n['city']})" for n in path]
    lines.append("**Route:** " + " → ".join(path_names))
    lines.append("")

    # Leg details
    lines.append("| Leg | From → To | Distance | Traffic | Dest. Occupancy | Alert |")
    lines.append("|-----|-----------|----------|---------|-----------------|-------|")

    for i, leg in enumerate(legs, 1):
        from_name = leg["from"]["name"]
        to_name = leg["to"]["name"]
        dist = leg["distance_km"]
        traffic = leg["traffic_multiplier"]
        occ = leg["destination_occupancy"]
        alert = "🔴 CRITICAL" if leg["destination_is_critical"] else "✅"
        traffic_str = f"{traffic:.1f}x" if traffic > 1.0 else "Normal"

        lines.append(
            f"| {i} | {from_name} → {to_name} | "
            f"{dist:.0f} km | {traffic_str} | {occ:.0%} | {alert} |"
        )

    lines.append("")
    lines.append(f"📊 **Summary:**")
    lines.append(f"  • Total Distance: **{total_dist:,.0f} km**")
    lines.append(f"  • Weighted Cost: **{total_cost:,.1f}**")
    lines.append(f"  • Estimated Transit: **{eta_hours:.1f} hours**")

    # Flag any critical nodes
    critical = [n for n in path if n.get("is_critical")]
    if critical:
        lines.append("")
        lines.append("⚠️ **Capacity Alerts:**")
        for n in critical:
            lines.append(
                f"  • {n['name']} ({n['city']}) is at "
                f"**{n['occupancy_ratio']:.0%}** capacity — "
                f"consider alternative routing."
            )

    return "\n".join(lines)
