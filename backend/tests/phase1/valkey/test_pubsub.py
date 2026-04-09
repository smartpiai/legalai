"""
IT-VK-05: pub/sub delivery between two clients within 1 second.
"""
import threading
import time
import uuid

import pytest
import redis as redis_sync


def test_pubsub_message_delivered_within_1s(valkey_url):
    channel = f"it-vk-05:{uuid.uuid4()}"
    payload = "ping"

    sub_client = redis_sync.Redis.from_url(valkey_url, decode_responses=True)
    pub_client = redis_sync.Redis.from_url(valkey_url, decode_responses=True)

    try:
        pubsub = sub_client.pubsub()
        pubsub.subscribe(channel)

        # Drain the 'subscribe' confirmation message.
        deadline = time.monotonic() + 1.0
        while time.monotonic() < deadline:
            msg = pubsub.get_message(timeout=0.1)
            if msg and msg.get("type") == "subscribe":
                break
        else:
            pytest.fail("Did not receive subscribe confirmation within 1s")

        # Publish from a second client.
        def _publish():
            time.sleep(0.05)
            pub_client.publish(channel, payload)

        t = threading.Thread(target=_publish)
        start = time.monotonic()
        t.start()

        received = None
        while time.monotonic() - start < 1.0:
            msg = pubsub.get_message(timeout=0.1)
            if msg and msg.get("type") == "message":
                received = msg
                break
        t.join()

        elapsed = time.monotonic() - start
        assert received is not None, f"No message received within 1s (elapsed={elapsed:.3f}s)"
        assert received["data"] == payload
        assert elapsed < 1.0, f"Delivery too slow: {elapsed:.3f}s"

        pubsub.unsubscribe(channel)
        pubsub.close()
    finally:
        sub_client.close()
        pub_client.close()
