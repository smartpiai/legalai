"""
IT-VK-06: enqueue a no-op Celery task against Valkey broker, assert result
is stored in the Valkey result backend.

Runs an in-process solo worker so the test is hermetic and does not depend
on an externally-running celery worker container.
"""
import os
import threading
import time

import pytest

celery = pytest.importorskip("celery")

from app.workers.celery_app import celery_app  # noqa: E402


@celery_app.task(name="tests.phase1.valkey.noop")
def _noop(x: int = 1) -> int:
    return x + 1


def _broker_points_at_valkey(valkey_url: str) -> bool:
    broker = celery_app.conf.broker_url or ""
    # Valkey speaks redis protocol, so broker URL scheme is redis://
    return broker.startswith("redis://") or broker.startswith("valkey://")


@pytest.fixture()
def celery_worker_thread():
    if not _broker_points_at_valkey(os.getenv("REDIS_URL", "")):
        pytest.skip("Celery broker not configured against Valkey/redis")

    from celery.worker import worker as celery_worker_mod  # noqa

    worker = celery_app.Worker(
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
    # Give worker a moment to boot
    time.sleep(1.5)
    yield worker
    try:
        worker.stop()
    except Exception:
        pass


def test_celery_noop_enqueue_and_result(celery_worker_thread):
    async_result = _noop.apply_async(args=(41,))
    value = async_result.get(timeout=10)
    assert value == 42
    assert async_result.successful()
