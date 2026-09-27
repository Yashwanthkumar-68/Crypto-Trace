import re
import logging
import requests
from typing import Dict, Any, Optional, List
from app.blockchain.adapter import BlockchainAdapter

logger = logging.getLogger("blockchain.solana")

class SolanaAdapter(BlockchainAdapter):
    """
    Live Solana Blockchain Adapter connecting directly to Solana Mainnet-Beta JSON-RPC
    with resilient demo fallback.
    """
    def __init__(self, chain_id: int = 101, name: str = "Solana Mainnet", symbol: str = "SOL"):
        super().__init__(chain_id=chain_id, name=name, symbol=symbol, is_evm=False)
        self.rpc_url = "https://api.mainnet-beta.solana.com"
        self.timeout = 6

    def validate_address(self, address: str) -> bool:
        if not address or not isinstance(address, str):
            return False
        # Base58, 32-44 chars
        pattern = r'^[1-9A-HJ-NP-Za-km-z]{32,44}$'
        return bool(re.match(pattern, address.strip()))

    def normalize_address(self, address: str) -> str:
        if not self.validate_address(address):
            raise ValueError(f"Invalid address format for {self.name}: {address}")
        return address.strip()

    def get_balance(self, address: str) -> Dict[str, Any]:
        norm = self.normalize_address(address)
        try:
            payload = {
                "jsonrpc": "2.0",
                "id": 1,
                "method": "getBalance",
                "params": [norm]
            }
            res = requests.post(self.rpc_url, json=payload, headers={"Content-Type": "application/json"}, timeout=self.timeout)
            if res.status_code == 200:
                data = res.json()
                lamports = data.get("result", {}).get("value", 0)
                bal_sol = round(lamports / 1_000_000_000.0, 6)
                return {
                    "address": norm,
                    "chain_id": self.chain_id,
                    "chain_name": self.name,
                    "balance_wei": str(lamports),
                    "balance_native": bal_sol,
                    "symbol": self.symbol,
                    "is_live": True
                }
        except Exception as e:
            logger.warning(f"Solana RPC get_balance error for {norm}: {e}")

        return {
            "address": norm,
            "chain_id": self.chain_id,
            "chain_name": self.name,
            "balance_wei": "150500000000",
            "balance_native": 150.5,
            "symbol": self.symbol,
            "is_live": False
        }

    def get_transaction(self, tx_hash: str) -> Optional[Dict[str, Any]]:
        clean_tx = tx_hash.strip()
        try:
            payload = {
                "jsonrpc": "2.0",
                "id": 1,
                "method": "getTransaction",
                "params": [clean_tx, {"encoding": "jsonParsed", "maxSupportedTransactionVersion": 0}]
            }
            res = requests.post(self.rpc_url, json=payload, timeout=self.timeout)
            if res.status_code == 200:
                data = res.json()
                result = data.get("result")
                if result:
                    slot = result.get("slot", 0)
                    meta = result.get("meta", {})
                    fee_lamports = meta.get("fee", 5000)
                    status = "SUCCESS" if meta.get("err") is None else "FAILED"
                    return {
                        "tx_hash": clean_tx,
                        "chain_id": self.chain_id,
                        "from_address": "SolanaFeePayer",
                        "to_address": "SolanaProgram",
                        "value_native": round(fee_lamports / 1_000_000_000.0, 6),
                        "block_number": slot,
                        "status": status,
                        "is_live": True
                    }
        except Exception as e:
            logger.warning(f"Solana RPC get_tx error: {e}")

        return {
            "tx_hash": clean_tx,
            "chain_id": self.chain_id,
            "from_address": "4Nd1mBQtrCGMB1Z6zNnGBB43uE6xJwGg5L7X4LhZp73E",
            "to_address": "TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA",
            "value_native": 10.0,
            "block_number": 450000000,
            "status": "SUCCESS",
            "is_live": False
        }

    def get_transactions(self, address: str, limit: int = 20) -> List[Dict[str, Any]]:
        norm = self.normalize_address(address)
        try:
            payload = {
                "jsonrpc": "2.0",
                "id": 1,
                "method": "getSignaturesForAddress",
                "params": [norm, {"limit": min(limit, 20)}]
            }
            res = requests.post(self.rpc_url, json=payload, headers={"Content-Type": "application/json"}, timeout=self.timeout)
            if res.status_code == 200:
                data = res.json()
                sigs = data.get("result", [])
                if isinstance(sigs, list) and len(sigs) > 0:
                    return [
                        {
                            "tx_hash": s.get("signature"),
                            "chain_id": self.chain_id,
                            "from_address": norm,
                            "to_address": "SolanaProgramInvocation",
                            "value_native": 0.0,
                            "block_number": s.get("slot"),
                            "status": "SUCCESS" if s.get("err") is None else "FAILED",
                            "timestamp": s.get("blockTime"),
                            "is_live": True
                        }
                        for s in sigs
                    ]
        except Exception as e:
            logger.warning(f"Solana RPC get_signatures error: {e}")

        # Demo fallback
        return [
            {
                "tx_hash": f"sol_mock_tx_{i}",
                "chain_id": self.chain_id,
                "from_address": norm if i % 2 == 0 else "4Nd1mBQtrCGMB1Z6zNnGBB43uE6xJwGg5L7X4LhZp73E",
                "to_address": "4Nd1mBQtrCGMB1Z6zNnGBB43uE6xJwGg5L7X4LhZp73E" if i % 2 == 0 else norm,
                "value_native": 1.5 * (i + 1),
                "block_number": 450000000 - i,
                "status": "SUCCESS",
                "is_live": False
            }
            for i in range(min(limit, 5))
        ]

    def get_latest_block_number(self) -> int:
        try:
            payload = {"jsonrpc": "2.0", "id": 1, "method": "getSlot"}
            res = requests.post(self.rpc_url, json=payload, headers={"Content-Type": "application/json"}, timeout=self.timeout)
            if res.status_code == 200:
                data = res.json()
                slot = data.get("result")
                if slot:
                    return int(slot)
        except Exception:
            pass
        return 450890000
