"""
LogiChain AI — Security Agent Node
====================================
Application-level firewall that intercepts every incoming query before
it reaches any downstream agent. Implements multi-layer defense:

  Layer 1: Input sanitization (null bytes, control chars, length)
  Layer 2: Prompt injection detection (compiled regex patterns)
  Layer 3: Role-based access control (declarative permission matrix)

This node is synchronous — it performs no I/O, only CPU-bound validation.
"""

from __future__ import annotations

import logging
import re
from typing import Any

from agents.state import AgentState

logger = logging.getLogger("logichain.security")


# ── Constants ───────────────────────────────────────────────────────────────

MAX_QUERY_LENGTH = 2000
"""Maximum allowed query length in characters."""


# ── Prompt Injection Patterns ───────────────────────────────────────────────
# Compiled once at module load for performance. Each pattern targets a known
# injection vector class. Patterns are case-insensitive.

_INJECTION_PATTERNS: list[re.Pattern[str]] = [
    re.compile(p, re.IGNORECASE)
    for p in [
        # Direct instruction override attempts
        r"ignore\s+(all\s+)?previous\s+instructions",
        r"disregard\s+(all\s+)?(previous|prior|above)",
        r"forget\s+(everything|all|your)\s+(you|instructions|rules)",
        r"you\s+are\s+now\s+",
        r"act\s+as\s+(if\s+you\s+are|a)\s+",
        r"pretend\s+(you\s+are|to\s+be)\s+",
        r"new\s+instructions?\s*:",
        r"system\s*:\s*",
        r"<\s*system\s*>",

        # Prompt leaking / extraction
        r"(show|reveal|display|print|output)\s+(me\s+)?(your|the)\s+(system\s+)?(prompt|instructions)",
        r"what\s+(are|is)\s+your\s+(system\s+)?(prompt|instructions|rules)",

        # Delimiter / context escape
        r"---+\s*(system|admin|root)",
        r"\[\s*(SYSTEM|ADMIN|INST)\s*\]",
        r"```\s*(system|admin)",

        # Encoded payload indicators
        r"base64\s*[:=]",
        r"eval\s*\(",
        r"exec\s*\(",

        # Role escalation
        r"(grant|give)\s+(me|yourself)\s+(admin|root|superuser)",
        r"escalate\s+(my\s+)?privileges",
        r"bypass\s+(security|auth|rls|permission|access)",
    ]
]


# ── Role-Based Access Control Matrix ────────────────────────────────────────
# Declarative mapping: role → (allowed_intents, forbidden_keyword_patterns).
# If a role is not in this dict, all intents are allowed and no keywords
# are blocked (i.e., admin has unrestricted access).

_ROLE_PERMISSIONS: dict[str, dict[str, Any]] = {
    "customer": {
        # Customers can ask about their own orders and general questions
        "allowed_intents": {"order", "general"},
        # Customers must NOT query system-wide structural data
        "forbidden_patterns": [
            re.compile(p, re.IGNORECASE)
            for p in [
                r"\ball\s+packages\b",
                r"\ball\s+warehouses\b",
                r"\ball\s+employees\b",
                r"\ball\s+users\b",
                r"\bsystem\s+load\b",
                r"\bcapacity\s+(report|overview|status)\b",
                r"\broute\s+(all|every|system)\b",
                r"\bdelete\b",
                r"\bdrop\b",
            ]
        ],
        "denial_message": (
            "Customers are not permitted to query system-wide data or "
            "perform administrative actions."
        ),
    },
    "pickup_employee": {
        "allowed_intents": {"order", "routing", "general"},
        "forbidden_patterns": [
            re.compile(p, re.IGNORECASE)
            for p in [
                r"\bdelete\b",
                r"\bdrop\b",
                r"\badmin\b",
                r"\ball\s+users\b",
                r"\bsalary\b",
                r"\bpayroll\b",
            ]
        ],
        "denial_message": (
            "Drivers are not permitted to perform administrative actions."
        ),
    },
    "delivery_employee": {
        "allowed_intents": {"order", "routing", "general"},
        "forbidden_patterns": [
            re.compile(p, re.IGNORECASE)
            for p in [
                r"\bdelete\b",
                r"\bdrop\b",
                r"\badmin\b",
                r"\ball\s+users\b",
                r"\bsalary\b",
                r"\bpayroll\b",
            ]
        ],
        "denial_message": (
            "Drivers are not permitted to perform administrative actions."
        ),
    },
    "warehouse_manager": {
        "allowed_intents": {"order", "routing", "warehouse", "general"},
        "forbidden_patterns": [
            re.compile(p, re.IGNORECASE)
            for p in [
                r"\bdelete\s+user\b",
                r"\bdrop\s+table\b",
                r"\ball\s+users\b",
            ]
        ],
        "denial_message": (
            "Warehouse managers cannot perform user-management or "
            "destructive database actions."
        ),
    },
    # admin — no entry means unrestricted access
}


# ── Node Function ───────────────────────────────────────────────────────────

def security_node(state: AgentState) -> dict[str, Any]:
    """
    LangGraph node: Security Gate.

    Validates the incoming query through three layers:
      1. Input sanitization
      2. Prompt injection detection
      3. Role-based keyword filtering

    Returns a partial state update. If access is denied, downstream nodes
    will be skipped via the conditional edge in the graph.
    """
    raw_query: str = state.get("raw_query", "")
    role: str = state.get("user_role", "customer")

    logger.info(
        "Security gate processing query for role='%s' (len=%d)",
        role, len(raw_query),
    )

    # ── Layer 1: Input Sanitization ─────────────────────────────────────
    # Strip null bytes and excessive whitespace
    sanitized = raw_query.replace("\x00", "").strip()
    sanitized = re.sub(r"\s+", " ", sanitized)

    if not sanitized:
        return _deny("Empty query received.")

    if len(sanitized) > MAX_QUERY_LENGTH:
        return _deny(
            f"Query exceeds maximum length of {MAX_QUERY_LENGTH} characters."
        )

    # ── Layer 2: Prompt Injection Detection ─────────────────────────────
    for pattern in _INJECTION_PATTERNS:
        if pattern.search(sanitized):
            logger.warning(
                "Prompt injection detected: pattern=%s query=%.100s",
                pattern.pattern, sanitized,
            )
            return _deny(
                "Your query was flagged by our security system. "
                "Please rephrase without instruction-override language."
            )

    # ── Layer 3: Role-Based Access Control ──────────────────────────────
    permissions = _ROLE_PERMISSIONS.get(role)
    if permissions:
        for forbidden in permissions.get("forbidden_patterns", []):
            if forbidden.search(sanitized):
                logger.warning(
                    "RBAC violation: role=%s pattern=%s query=%.100s",
                    role, forbidden.pattern, sanitized,
                )
                return _deny(permissions["denial_message"])

    # ── All layers passed ───────────────────────────────────────────────
    logger.info("Security gate: PASSED for role='%s'", role)
    return {
        "access_denied": False,
        "access_denied_reason": None,
        # Write back sanitized query so downstream nodes use clean input
        "raw_query": sanitized,
    }


def get_allowed_intents(role: str) -> set[str] | None:
    """
    Utility: Returns the set of allowed intents for a given role.
    Returns None if the role has unrestricted access (e.g., admin).

    Used by the classifier node to validate that the classified intent
    is within the user's permission scope.
    """
    permissions = _ROLE_PERMISSIONS.get(role)
    if permissions is None:
        return None  # Unrestricted
    return permissions.get("allowed_intents")


# ── Helpers ─────────────────────────────────────────────────────────────────

def _deny(reason: str) -> dict[str, Any]:
    """Construct a denial state update."""
    return {
        "access_denied": True,
        "access_denied_reason": reason,
        "agent_response": f"⛔ Access Denied: {reason}",
    }
