"""IT-VK-01: assert server is Valkey 8.x."""
import pytest


def test_valkey_version_is_8(valkey_client):
    info = valkey_client.info("server")
    # Valkey exposes `valkey_version`; some builds also keep `redis_version`
    # for client compatibility. We require valkey_version present and 8.x.
    version = info.get("valkey_version")
    assert version is not None, (
        f"'valkey_version' not in INFO server — not a Valkey server. Got keys: {list(info)[:20]}"
    )
    assert version.startswith("8."), f"Expected Valkey 8.x, got {version!r}"
