"""
IT-VK-09 (P1): Prometheus exporter for Valkey exposes metrics.

Marked skip if the exporter is not yet wired in this environment.
"""
import os

import pytest

requests = pytest.importorskip("requests")

EXPORTER_URL = os.getenv("VALKEY_EXPORTER_URL", "http://localhost:9121/metrics")


@pytest.mark.p1
def test_valkey_exporter_exposes_metrics():
    try:
        resp = requests.get(EXPORTER_URL, timeout=2)
    except requests.RequestException as e:
        pytest.skip(f"Valkey exporter not reachable at {EXPORTER_URL}: {e}")

    if resp.status_code != 200:
        pytest.skip(f"Exporter returned HTTP {resp.status_code}")

    body = resp.text
    # redis_exporter works against Valkey; metric names are prefixed 'redis_'.
    assert "redis_up" in body, "Expected 'redis_up' metric from exporter"
    # Sanity: up metric is 1
    for line in body.splitlines():
        if line.startswith("redis_up ") or line.startswith("redis_up{"):
            assert line.strip().endswith(" 1") or line.strip().endswith(" 1.0"), (
                f"redis_up not 1: {line!r}"
            )
            break
