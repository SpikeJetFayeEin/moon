from functools import lru_cache
import sys

from pydantic import Field
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    app_name: str = "Moon Fund API"
    api_cors_origins: list[str] = Field(
        default_factory=lambda: [
            "http://localhost:5173",
            "http://127.0.0.1:5173",
            "http://localhost:4173",
            "http://127.0.0.1:4173",
        ]
    )
    supabase_url: str | None = None
    supabase_service_role_key: str | None = None
    supabase_jwt_secret: str | None = None
    akshare_enabled: bool = False

    model_config = SettingsConfigDict(
        env_file=None if "pytest" in sys.modules or "pytest" in sys.argv[0] else ".env",
        env_prefix="",
        extra="ignore",
    )


@lru_cache
def get_settings() -> Settings:
    return Settings()
