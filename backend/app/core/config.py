from pydantic_settings import BaseSettings

class Settings(BaseSettings):
    DATABASE_URL: str = "postgresql://postgres:postgres@127.0.0.1:54322/postgres"
    SUPABASE_JWT_SECRET: str = "super-secret-jwt-token-with-at-least-32-characters-long"
    SUPABASE_SERVICE_ROLE_KEY: str = ""


    class Config:
        env_file = ".env"
        extra = "ignore"

settings = Settings()