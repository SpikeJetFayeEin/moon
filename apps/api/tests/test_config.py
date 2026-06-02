from app.core.config import Settings


def test_default_cors_origins_cover_localhost_and_loopback_previews():
    settings = Settings()

    assert "http://localhost:5173" in settings.cors_origin_list
    assert "http://127.0.0.1:4173" in settings.cors_origin_list


def test_cors_origins_accept_json_with_utf8_bom():
    settings = Settings(
        api_cors_origins='\ufeff["https://moon-sigma-taupe.vercel.app"]',
    )

    assert settings.cors_origin_list == ["https://moon-sigma-taupe.vercel.app"]


def test_boolean_env_values_accept_utf8_bom():
    settings = Settings(akshare_enabled="\ufefffalse")

    assert settings.akshare_enabled is False
