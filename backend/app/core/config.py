"""
LogiChain AI — Application Configuration
=========================================
Loads environment variables via Pydantic Settings.
All secrets are sourced from the `.env` file in the backend root.
"""

from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    # ── Database (SQLAlchemy async) ─────────────────────────────────────
    DATABASE_URL: str = "postgresql://postgres:postgres@127.0.0.1:54322/postgres"

    # ── Supabase Auth ───────────────────────────────────────────────────
    SUPABASE_JWT_SECRET: str = "super-secret-jwt-token-with-at-least-32-characters-long"
    SUPABASE_SERVICE_ROLE_KEY: str = ""

    # ── Supabase PostgREST (used by agent tools for direct DB queries) ─
    SUPABASE_URL: str = "http://127.0.0.1:54321"

    # ── OpenAI (used by Intent Classifier agent) ────────────────────────
    OPENAI_API_KEY: str = ""
    OPENAI_MODEL: str = "gpt-4o-mini"

    class Config:
        env_file = ".env"
        extra = "ignore"


settings = Settings()