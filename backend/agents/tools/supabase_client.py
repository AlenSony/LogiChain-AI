"""
LogiChain AI — Supabase PostgREST Async Client
================================================
Typed async wrapper around Supabase's auto-generated REST API.

Instead of using the supabase-py SDK (which has inconsistent async support),
we call PostgREST endpoints directly via httpx.AsyncClient. This gives us:
  • Full async/await support for LangGraph node execution
  • Explicit type safety on every response
  • Connection pooling via a module-level client singleton
  • Strict HTTP status validation with structured error returns

Usage:
    from agents.tools.supabase_client import supabase_client
    rows = await supabase_client.query_table("warehouses", select="*")
"""

from __future__ import annotations

import logging
from typing import Any

import httpx

from app.core.config import settings

logger = logging.getLogger("logichain.supabase_client")


# ── Exceptions ──────────────────────────────────────────────────────────────

class SupabaseAPIError(Exception):
    """Raised when a PostgREST request fails with a non-2xx status."""

    def __init__(self, status_code: int, detail: str, table: str) -> None:
        self.status_code = status_code
        self.detail = detail
        self.table = table
        super().__init__(
            f"PostgREST error on '{table}': HTTP {status_code} — {detail}"
        )


# ── Client ──────────────────────────────────────────────────────────────────

class SupabasePostgRESTClient:
    """
    Lightweight async wrapper around the Supabase PostgREST API.

    All queries use the service_role key, which bypasses RLS intentionally.
    The agents need system-wide visibility (e.g., querying *all* warehouses
    for capacity analysis) regardless of the end-user's JWT scope.

    Security is enforced at the *agent layer* (security_node) before any
    downstream agent is allowed to execute.
    """

    def __init__(self) -> None:
        base_url = settings.SUPABASE_URL.rstrip("/")
        self._rest_url = f"{base_url}/rest/v1"
        self._headers = {
            "apikey": settings.SUPABASE_SERVICE_ROLE_KEY,
            "Authorization": f"Bearer {settings.SUPABASE_SERVICE_ROLE_KEY}",
            "Content-Type": "application/json",
            "Prefer": "return=representation",  # Return the mutated row(s)
        }
        # Module-level singleton — connection pool is reused across requests
        self._client = httpx.AsyncClient(
            timeout=httpx.Timeout(30.0, connect=10.0),
        )

    # ── READ ────────────────────────────────────────────────────────────

    async def query_table(
        self,
        table: str,
        *,
        select: str = "*",
        filters: dict[str, Any] | None = None,
        order: str | None = None,
        limit: int | None = None,
    ) -> list[dict[str, Any]]:
        """
        Query a Supabase table via PostgREST GET.

        Args:
            table:   Table name (e.g. "warehouses", "packages").
            select:  PostgREST select expression (default "*").
            filters: Dict of column → value equality filters.
                     For PostgREST operators, use the column name with the
                     operator suffix, e.g. {"status": "eq.in_transit"}.
                     Simple values are auto-wrapped with "eq.".
            order:   PostgREST order expression (e.g. "sequence_no.asc").
            limit:   Maximum number of rows to return.

        Returns:
            List of row dicts.

        Raises:
            SupabaseAPIError: On non-2xx response.
        """
        url = f"{self._rest_url}/{table}"
        params: dict[str, str] = {"select": select}

        if filters:
            for col, val in filters.items():
                str_val = str(val)
                # If the caller already included a PostgREST operator, use as-is
                if any(str_val.startswith(op) for op in (
                    "eq.", "neq.", "gt.", "gte.", "lt.", "lte.",
                    "like.", "ilike.", "in.", "is.", "not.",
                )):
                    params[col] = str_val
                else:
                    params[col] = f"eq.{str_val}"

        if order:
            params["order"] = order
        if limit is not None:
            params["limit"] = str(limit)

        logger.debug("GET %s params=%s", url, params)
        response = await self._client.get(
            url, headers=self._headers, params=params
        )
        self._raise_for_status(response, table)
        return response.json()

    # ── WRITE ───────────────────────────────────────────────────────────

    async def update_table(
        self,
        table: str,
        *,
        match: dict[str, Any],
        data: dict[str, Any],
    ) -> list[dict[str, Any]]:
        """
        Update rows in a Supabase table via PostgREST PATCH.

        Args:
            table: Table name.
            match: Equality filters to identify the row(s) to update.
            data:  Dict of column → new value to set.

        Returns:
            List of updated row dicts (PostgREST returns representation).

        Raises:
            SupabaseAPIError: On non-2xx response.
        """
        url = f"{self._rest_url}/{table}"
        params: dict[str, str] = {}
        for col, val in match.items():
            params[col] = f"eq.{val}"

        logger.debug("PATCH %s params=%s body=%s", url, params, data)
        response = await self._client.patch(
            url, headers=self._headers, params=params, json=data
        )
        self._raise_for_status(response, table)
        return response.json()

    # ── INSERT ──────────────────────────────────────────────────────────

    async def insert_rows(
        self,
        table: str,
        *,
        rows: list[dict[str, Any]],
    ) -> list[dict[str, Any]]:
        """
        Insert one or more rows into a Supabase table via PostgREST POST.

        Args:
            table: Table name.
            rows:  List of dicts, each representing a row to insert.

        Returns:
            List of inserted row dicts.

        Raises:
            SupabaseAPIError: On non-2xx response.
        """
        url = f"{self._rest_url}/{table}"
        body = rows if len(rows) > 1 else rows[0]

        logger.debug("POST %s body=%s", url, body)
        response = await self._client.post(
            url, headers=self._headers, json=body
        )
        self._raise_for_status(response, table)
        return response.json()

    # ── Internal ────────────────────────────────────────────────────────

    def _raise_for_status(
        self, response: httpx.Response, table: str
    ) -> None:
        """Validate the HTTP response and raise a typed error if non-2xx."""
        if response.is_success:
            return

        # PostgREST error responses are JSON with a "message" field
        try:
            error_body = response.json()
            detail = error_body.get("message", response.text)
        except Exception:
            detail = response.text

        logger.error(
            "PostgREST error: table=%s status=%d detail=%s",
            table, response.status_code, detail,
        )
        raise SupabaseAPIError(
            status_code=response.status_code,
            detail=detail,
            table=table,
        )

    async def close(self) -> None:
        """Gracefully close the underlying HTTP connection pool."""
        await self._client.aclose()


# ── Module-level singleton ──────────────────────────────────────────────────
# Imported by agent nodes: `from agents.tools.supabase_client import supabase_client`
supabase_client = SupabasePostgRESTClient()
