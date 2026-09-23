import pytest
from fastapi.testclient import TestClient
from app.main import app

client = TestClient(app)

def test_websocket_connection_and_heartbeat():
    user_id = 999
    with client.websocket_connect(f"/ws/alerts/{user_id}") as websocket:
        # Initial greeting
        data = websocket.receive_json()
        assert data["type"] == "CONNECTION_ESTABLISHED"
        assert data["user_id"] == user_id

        # Ping-pong heartbeat
        websocket.send_json({"type": "PING", "timestamp": 123456789})
        response = websocket.receive_json()
        assert response["type"] == "PONG"
        assert response["timestamp"] == 123456789

def test_test_alert_endpoint():
    response = client.post(
        "/ws/test-alert",
        params={
            "title": "Suspicious Movement Detected",
            "message": "0x123... sent 10 ETH to Mixer",
            "severity": "CRITICAL"
        }
    )
    assert response.status_code == 200
    data = response.json()
    assert data["status"] == "broadcast_sent"
    assert data["payload"]["severity"] == "CRITICAL"
    assert data["payload"]["title"] == "Suspicious Movement Detected"
