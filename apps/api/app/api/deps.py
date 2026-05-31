from fastapi import Header, HTTPException, status
from jose import JWTError, jwt

from app.core.config import get_settings
from app.repositories.funds import FundRepository, SupabaseFundRepository, seed_fund_repository
from app.repositories.users import InMemoryUserRepository, SupabaseUserRepository, UserRepository


_memory_user_repository = InMemoryUserRepository()
_supabase_user_repository: UserRepository | None = None
_supabase_fund_repository: FundRepository | None = None


def require_user_id(authorization: str | None = Header(default=None)) -> str:
    if not authorization or not authorization.startswith("Bearer "):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Authentication required.",
        )
    token = authorization.removeprefix("Bearer ").strip()
    if not token:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Authentication required.",
        )
    try:
        return extract_user_id_from_token(token, get_settings().supabase_jwt_secret)
    except ValueError as exc:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid authentication token.",
        ) from exc


def extract_user_id_from_token(token: str, jwt_secret: str | None) -> str:
    if not jwt_secret:
        return token
    try:
        payload = jwt.decode(
            token,
            jwt_secret,
            algorithms=["HS256"],
            audience="authenticated",
        )
    except JWTError as exc:
        raise ValueError("Invalid JWT.") from exc
    subject = payload.get("sub")
    if not subject:
        raise ValueError("JWT subject is missing.")
    return str(subject)


def get_user_repository() -> UserRepository:
    settings = get_settings()
    if not settings.supabase_url or not settings.supabase_service_role_key:
        return _memory_user_repository

    global _supabase_user_repository
    if _supabase_user_repository is None:
        from supabase import create_client

        _supabase_user_repository = SupabaseUserRepository(
            create_client(settings.supabase_url, settings.supabase_service_role_key)
        )
    return _supabase_user_repository


def get_fund_repository() -> FundRepository:
    settings = get_settings()
    if not settings.supabase_url or not settings.supabase_service_role_key:
        return seed_fund_repository

    global _supabase_fund_repository
    if _supabase_fund_repository is None:
        from supabase import create_client

        _supabase_fund_repository = SupabaseFundRepository(
            create_client(settings.supabase_url, settings.supabase_service_role_key)
        )
    return _supabase_fund_repository
