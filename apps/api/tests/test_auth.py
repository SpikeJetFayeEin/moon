from jose import jwt

from app.api.deps import extract_user_id_from_token


def test_extract_user_id_uses_raw_token_when_jwt_secret_is_not_configured():
    assert extract_user_id_from_token("local-dev-user", None) == "local-dev-user"


def test_extract_user_id_validates_supabase_jwt_when_secret_is_configured():
    token = jwt.encode(
        {"sub": "user-uuid", "aud": "authenticated"},
        "test-secret",
        algorithm="HS256",
    )

    assert extract_user_id_from_token(token, "test-secret") == "user-uuid"
