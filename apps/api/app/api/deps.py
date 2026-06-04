from fastapi import Header, HTTPException, status
from jose import JWTError, jwt

from app.core.config import get_settings
from app.repositories.funds import (
    FundRepository,
    SupabaseFundRepository,
    load_akshare_fund_performance_rows,
    load_akshare_fund_profile_rows,
    load_akshare_nav_rows,
    seed_fund_repository,
)
from app.repositories.indices import IndexRepository, SupabaseIndexRepository, index_repository
from app.repositories.users import InMemoryUserRepository, SupabaseUserRepository, UserRepository


_memory_user_repository = InMemoryUserRepository()
_supabase_user_repository: UserRepository | None = None
_supabase_fund_repository: FundRepository | None = None
_supabase_index_repository: IndexRepository | None = None


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
    settings = get_settings()
    try:
        return extract_user_id_from_token(token, settings.supabase_jwt_secret)
    except ValueError as exc:
        if settings.supabase_url and settings.supabase_service_role_key:
            try:
                return fetch_user_id_from_supabase(
                    token,
                    settings.supabase_url,
                    settings.supabase_service_role_key,
                )
            except ValueError:
                pass
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


def fetch_user_id_from_supabase(
    token: str,
    supabase_url: str,
    supabase_service_role_key: str,
    client_factory=None,
) -> str:
    if client_factory is None:
        from supabase import create_client

        client_factory = create_client
    try:
        response = client_factory(supabase_url, supabase_service_role_key).auth.get_user(
            token
        )
    except Exception as exc:
        raise ValueError("Invalid Supabase auth token.") from exc
    user = getattr(response, "user", None)
    user_id = getattr(user, "id", None)
    if not user_id:
        raise ValueError("Supabase auth user is missing.")
    return str(user_id)


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
            create_client(settings.supabase_url, settings.supabase_service_role_key),
            nav_rows_provider=load_akshare_nav_rows if settings.akshare_enabled else None,
            profile_rows_provider=(
                load_akshare_fund_profile_rows if settings.akshare_enabled else None
            ),
            performance_rows_provider=(
                load_akshare_fund_performance_rows if settings.akshare_enabled else None
            ),
        )
    return _supabase_fund_repository


def get_index_repository() -> IndexRepository:
    settings = get_settings()
    if not settings.supabase_url or not settings.supabase_service_role_key:
        return index_repository

    global _supabase_index_repository
    if _supabase_index_repository is None:
        from supabase import create_client

        _supabase_index_repository = SupabaseIndexRepository(
            create_client(settings.supabase_url, settings.supabase_service_role_key)
        )
    return _supabase_index_repository
