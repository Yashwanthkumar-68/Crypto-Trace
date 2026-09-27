import logging
import json
from typing import Dict, List, Set, Optional
from fastapi import APIRouter, WebSocket, WebSocketDisconnect, Query, status
from jose import jwt, JWTError
from app.config import settings

logger = logging.getLogger("sih26183.websocket")

router = APIRouter(prefix="/ws", tags=["Real-Time Alerts WebSocket"])


class ConnectionManager:
    def __init__(self):
        # Map user_id to active WebSocket instances
        self.user_connections: Dict[int, List[WebSocket]] = {}
        # All connected clients for broadcast
        self.all_connections: Set[WebSocket] = set()

    async def connect(self, websocket: WebSocket, user_id: int):
        await websocket.accept()
        if user_id not in self.user_connections:
            self.user_connections[user_id] = []
        self.user_connections[user_id].append(websocket)
        self.all_connections.add(websocket)
        logger.info(f"WebSocket client connected: user_id={user_id}. Total active: {len(self.all_connections)}")

    def disconnect(self, websocket: WebSocket, user_id: int):
        if user_id in self.user_connections:
            if websocket in self.user_connections[user_id]:
                self.user_connections[user_id].remove(websocket)
            if not self.user_connections[user_id]:
                del self.user_connections[user_id]
        self.all_connections.discard(websocket)
        logger.info(f"WebSocket client disconnected: user_id={user_id}. Total active: {len(self.all_connections)}")

    async def send_personal_alert(self, user_id: int, message: dict):
        if user_id in self.user_connections:
            for connection in list(self.user_connections[user_id]):
                try:
                    await connection.send_json(message)
                except Exception as e:
                    logger.warning(f"Failed to send personal alert to user_id {user_id}: {e}")
                    self.disconnect(connection, user_id)

    async def broadcast_alert(self, message: dict):
        for connection in list(self.all_connections):
            try:
                await connection.send_json(message)
            except Exception as e:
                logger.warning(f"Failed to broadcast alert: {e}")
                self.all_connections.discard(connection)

    async def broadcast(self, message: dict):
        await self.broadcast_alert(message)


manager = ConnectionManager()


def verify_ws_token(token: Optional[str]) -> Optional[str]:
    """Validate JWT token passed in query parameters."""
    if not token:
        return None
    try:
        payload = jwt.decode(token, settings.SECRET_KEY, algorithms=[settings.ALGORITHM])
        return payload.get("sub")
    except JWTError:
        return None


@router.websocket("/alerts/{user_id}")
async def websocket_alerts_endpoint(
    websocket: WebSocket,
    user_id: int,
    token: Optional[str] = Query(None)
):
    # Optional token verification if token is provided
    if token:
        sub = verify_ws_token(token)
        if not sub:
            logger.warning(f"Rejecting WS connection for user_id {user_id}: Invalid token")
            await websocket.close(code=status.WS_1008_POLICY_VIOLATION)
            return

    await manager.connect(websocket, user_id)
    try:
        # Send initial connection confirmation
        await websocket.send_json({
            "type": "CONNECTION_ESTABLISHED",
            "message": "Connected to CryptoTrace Real-Time Alert Stream",
            "user_id": user_id
        })

        while True:
            data_text = await websocket.receive_text()
            try:
                msg = json.loads(data_text)
                if msg.get("type") == "PING":
                    await websocket.send_json({"type": "PONG", "timestamp": msg.get("timestamp")})
            except json.JSONDecodeError:
                if data_text.strip().upper() == "PING":
                    await websocket.send_json({"type": "PONG"})
    except WebSocketDisconnect:
        manager.disconnect(websocket, user_id)
    except Exception as e:
        logger.error(f"WebSocket unexpected error for user_id {user_id}: {e}")
        manager.disconnect(websocket, user_id)


@router.post("/test-alert")
async def trigger_test_alert(
    title: str = "High-Risk Transaction Detected",
    message: str = "Suspect wallet 0x71C... transferred 4.8 ETH to Binance Hot Wallet",
    severity: str = "CRITICAL",
    case_id: Optional[str] = None,
    user_id: Optional[int] = None
):
    """Trigger a simulated alert for testing toast and notification push."""
    alert_payload = {
        "type": "NEW_ALERT",
        "title": title,
        "message": message,
        "severity": severity,
        "case_id": case_id or "CASE-2026-DEMO",
        "timestamp": json.dumps(None),
        "data": {
            "wallet": "0x71C7656EC7ab88b098defB751B7401B5f6d8976F",
            "risk_score": 88
        }
    }
    if user_id:
        await manager.send_personal_alert(user_id, alert_payload)
    else:
        await manager.broadcast_alert(alert_payload)
    return {"status": "broadcast_sent", "payload": alert_payload}
