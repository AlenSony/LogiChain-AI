"""
LogiChain AI — Agent Tools Package
====================================
Re-exports the Supabase PostgREST client.
"""

from agents.tools.supabase_client import SupabaseAPIError, supabase_client

__all__ = [
    "supabase_client",
    "SupabaseAPIError",
]
