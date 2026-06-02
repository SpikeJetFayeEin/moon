from functools import lru_cache
import json
import sys

from pydantic import Field, field_validator
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    app_name: str = "Moon Fund API"
    api_cors_origins: str = Field(
        default=(
            "http://localhost:5173,"
            "http://127.0.0.1:5173,"
            "http://localhost:4173,"
            "http://127.0.0.1:4173"
        )
    )
    supabase_url: str | None = None
    supabase_service_role_key: str | None = None
    supabase_jwt_secret: str | None = None
    akshare_enabled: bool = False

    @field_validator(
        "api_cors_origins",
        "supabase_url",
        "supabase_service_role_key",
        "supabase_jwt_secret",
        "akshare_enabled",
        mode="before",
    )
    @classmethod
    def strip_utf8_bom(cls, value):
        if isinstance(value, str):
            return value.strip().lstrip("\ufeff")
        return value

    model_config = SettingsConfigDict(
        env_file=None if "pytest" in sys.modules or "pytest" in sys.argv[0] else ".env",
        env_prefix="",
        extra="ignore",
    )

    @property
    def cors_origin_list(self) -> list[str]:
        raw_value = self.api_cors_origins.strip().lstrip("\ufeff")
        if not raw_value:
            return []
        if raw_value.startswith("["):
            return [str(origin) for origin in json.loads(raw_value)]
        return [origin.strip() for origin in raw_value.split(",") if origin.strip()]


@lru_cache
def get_settings() -> Settings:
    return Settings()
