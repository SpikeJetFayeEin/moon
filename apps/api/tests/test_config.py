from app.core.config import Settings


def test_default_cors_origins_cover_localhost_and_loopback_previews():
    settings = Settings()

    assert "http://localhost:5173" in settings.api_cors_origins
    assert "http://127.0.0.1:4173" in settings.api_cors_origins
