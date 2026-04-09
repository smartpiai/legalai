"""
FI-02 / RT-03: Fault injection — kill Valkey container mid-Celery-workload,
assert workers retry and resume on restart.

Marked @pytest.mark.fault_injection — runs in the nightly P2 tier, not on PR.

This test requires:
  * docker CLI available
  * Valkey running as a compose container we can stop/start
  * A live celery worker (external or in-process) consuming from Valkey

We run an in-process solo worker with broker/result retry enabled so the
worker survives broker restarts.
"""
import os
import shutil
import subprocess
import threading
import time

import pytest

celery = pytest.importorskip("celery")
from app.workers.celery_app import celery_app  # noqa: E402


pytestmark = [pytest.mark.fault_injection, pytest.mark.p2]


@celery_app.task(name="tests.phase1.valkey.fi02_echo", bind=True, max_retries=10,
                 default_retry_delay=1, acks_late=True)
def _fi02_echo(self, value: int) -> int:
    return value * 2


def _docker_available() -> bool:
    return shutil.which("docker") is not None


def _container_exists(name: str) -> bool:
    r = subprocess.run(
        ["docker", "inspect", name], capture_output=True, text=True
    )
    return r.returncode == 0


@pytest.fixture()
def resilient_celery_app():
    # Enable broker connection retry on startup and during runtime.
    celery_app.conf.broker_connection_retry = True
    celery_app.conf.broker_connection_retry_on_startup = True
    celery_app.conf.broker_connection_max_retries = None  # infinite
    celery_app.conf.result_backend_always_retry = True
    celery_app.conf.result_backend_max_retries = 20
    celery_app.conf.task_acks_late = True
    celery_app.conf.task_reject_on_worker_lost = True
    return celery_app


@pytest.fixture()
def celery_worker_thread(resilient_celery_app):
    worker = resilient_celery_app.Worker(
        pool="solo",
        concurrency=1,
        loglevel="WARNING",
        without_heartbeat=True,
        without_mingle=True,
        without_gossip=True,
        queues=["celery"],
    )
    t = threading.Thread(target=worker.start, daemon=True)
    t.start()
    time.sleep(1.5)
    yield worker
    try:
        worker.stop()
    except Exception:
        pass


def test_fi02_kill_valkey_midworkload(valkey_container, celery_worker_thread):
    if not _docker_available():
        pytest.skip("docker CLI not available")
    if not _container_exists(valkey_container):
        pytest.skip(f"Container {valkey_container!r} not running")

    # Phase 1: enqueue a batch of tasks; collect AsyncResults.
    results = [_fi02_echo.apply_async(args=(i,)) for i in range(10)]

    # Phase 2: mid-workload, restart Valkey.
    time.sleep(0.5)
    subprocess.run(["docker", "restart", valkey_container], check=True,
                   capture_output=True, text=True, timeout=30)

    # Give Valkey a moment to become reachable again.
    deadline = time.monotonic() + 20
    while time.monotonic() < deadline:
        probe = subprocess.run(
            ["docker", "exec", valkey_container, "valkey-cli", "ping"],
            capture_output=True, text=True,
        )
        if probe.returncode == 0 and "PONG" in probe.stdout:
            break
        time.sleep(0.5)
    else:
        pytest.fail("Valkey did not come back up within 20s")

    # Phase 3: enqueue more work after restart and assert the worker resumes.
    post_restart = [_fi02_echo.apply_async(args=(100 + i,)) for i in range(5)]

    # Collect all results with generous timeouts; worker should reconnect.
    collected = []
    for r in results + post_restart:
        try:
            collected.append(r.get(timeout=30))
        except Exception as e:
            pytest.fail(f"Task {r.id} did not complete after Valkey restart: {e}")

    # At minimum, post-restart tasks MUST have succeeded (proves resume).
    for i, v in enumerate(collected[-5:]):
        assert v == (100 + i) * 2, f"Post-restart task {i} got {v!r}"
