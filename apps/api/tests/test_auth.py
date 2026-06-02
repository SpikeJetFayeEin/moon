from jose import jwt

from app.api.deps import extract_user_id_from_token, fetch_user_id_from_supabase


def test_extract_user_id_uses_raw_token_when_jwt_secret_is_not_configured():
    assert extract_user_id_from_token("local-dev-user", None) == "local-dev-user"


def test_extract_user_id_validates_supabase_jwt_when_secret_is_configured():
    token = jwt.encode(
        {"sub": "user-uuid", "aud": "authenticated"},
        "test-secret",
        algorithm="HS256",
    )

    assert extract_user_id_from_token(token, "test-secret") == "user-uuid"


def test_fetch_user_id_from_supabase_uses_auth_api_response():
    class FakeUser:
        id = "remote-user-uuid"

    class FakeResponse:
        user = FakeUser()

    class FakeAuth:
        def get_user(self, token: str):
            assert token == "access-token"
            return FakeResponse()

    class FakeClient:
        auth = FakeAuth()

    def fake_client_factory(url: str, key: str):
        assert url == "https://example.supabase.co"
        assert key == "secret-key"
        return FakeClient()

    assert (
        fetch_user_id_from_supabase(
            "access-token",
            "https://example.supabase.co",
            "secret-key",
            client_factory=fake_client_factory,
        )
        == "remote-user-uuid"
    )
