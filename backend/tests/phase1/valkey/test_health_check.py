"""
IT-VK-08: docker inspect health == 'healthy'. Skips if not under compose.
"""
import json
import shutil
import subprocess

import pytest


def test_valkey_container_health(valkey_container):
    if shutil.which("docker") is None:
        pytest.skip("docker CLI not available")

    probe = subprocess.run(
        ["docker", "inspect", "--format", "{{json .State.Health}}", valkey_container],
        capture_output=True,
        text=True,
    )
    if probe.returncode != 0:
        pytest.skip(
            f"Container {valkey_container!r} not found (not running under compose?)"
        )

    raw = probe.stdout.strip()
    if not raw or raw == "null":
        pytest.skip(f"Container {valkey_container!r} has no healthcheck configured")

    state = json.loads(raw)
    assert state.get("Status") == "healthy", f"Unhealthy state: {state}"
