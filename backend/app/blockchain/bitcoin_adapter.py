import re
import logging
import requests
from typing import Dict, Any, Optional, List
from app.blockchain.adapter import BlockchainAdapter
from app.config import settings

logger = logging.getLogger("blockchain.bitcoin")

class BitcoinAdapter(BlockchainAdapter):
    """
    Live Bitcoin Blockchain Adapter querying the Blockstream public UTXO explorer API
    with resilient demo fallback.
    """
    def __init__(self, chain_id: int = 0, name: str = "Bitcoin Mainnet", symbol: str = "BTC"):
        super().__init__(chain_id=chain_id, name=name, symbol=symbol, is_evm=False)
        self.api_base = "https://blockstream.info/api"
        self.timeout = 6

    def validate_address(self, address: str) -> bool:
        if not address or not isinstance(address, str):
            return False
        # P2PKH starts with 1, P2SH starts with 3, Bech32 starts with bc1
        pattern = r'^(1[a-km-zA-HJ-NP-Z1-9]{25,34}|3[a-km-zA-HJ-NP-Z1-9]{25,34}|bc1[a-zA-HJ-NP-Z0-9]{39,59})$'
        return bool(re.match(pattern, address.strip()))

    def normalize_address(self, address: str) -> str:
        if not self.validate_address(address):
            raise ValueError(f"Invalid address format for {self.name}: {address}")
        return address.strip()

    def get_balance(self, address: str) -> Dict[str, Any]:
        norm = self.normalize_address(address)
        try:
            res = requests.get(f"{self.api_base}/address/{norm}", timeout=self.timeout)
            if res.status_code == 200:
                data = res.json()
                funded = data.get("chain_stats", {}).get("funded_txo_sum", 0)
                spent = data.get("chain_stats", {}).get("spent_txo_sum", 0)
                balance_sat = funded - spent
                balance_btc = round(balance_sat / 100_000_000.0, 8)
                tx_count = data.get("chain_stats", {}).get("tx_count", 0)
                return {
                    "address": norm,
                    "chain_id": self.chain_id,
                    "chain_name": self.name,
                    "balance_wei": str(balance_sat),
                    "balance_native": balance_btc,
                    "symbol": self.symbol,
                    "tx_count": tx_count,
                    "is_live": True
                }
        except Exception as e:
            logger.warning(f"Blockstream API get_balance error for {norm}: {e}")

        # Graceful fallback
        return {
            "address": norm,
            "chain_id": self.chain_id,
            "chain_name": self.name,
            "balance_wei": "125000000",
            "balance_native": 1.25,
            "symbol": self.symbol,
            "is_live": False
        }

    def get_transaction(self, tx_hash: str) -> Optional[Dict[str, Any]]:
        clean_tx = tx_hash.strip()
        try:
            res = requests.get(f"{self.api_base}/tx/{clean_tx}", timeout=self.timeout)
            if res.status_code == 200:
                data = res.json()
                status = data.get("status", {})
                block_height = status.get("block_height", 800000)
                vin = data.get("vin", [])
                vout = data.get("vout", [])
                sender = vin[0].get("prevout", {}).get("scriptpubkey_address", "Unknown") if vin else "Coinbase"
                recipient = vout[0].get("scriptpubkey_address", "Multiple") if vout else "Unknown"
                val_sat = sum(v.get("value", 0) for v in vout)
                return {
                    "tx_hash": clean_tx,
                    "chain_id": self.chain_id,
                    "from_address": sender,
                    "to_address": recipient,
                    "value_native": round(val_sat / 100_000_000.0, 8),
                    "block_number": block_height,
                    "status": "SUCCESS" if status.get("confirmed") else "PENDING",
                    "is_live": True
                }
        except Exception as e:
            logger.warning(f"Blockstream API get_tx error: {e}")

        return {
            "tx_hash": clean_tx,
            "chain_id": self.chain_id,
            "from_address": "1A1zP1eP5QGefi2DMPTfTL5SLmv7DivfNa",
            "to_address": "1CounterpartyAddressExample1234",
            "value_native": 0.5,
            "block_number": 800000,
            "status": "SUCCESS",
            "is_live": False
        }

    def get_transactions(self, address: str, limit: int = 20) -> List[Dict[str, Any]]:
        norm = self.normalize_address(address)
        try:
            res = requests.get(f"{self.api_base}/address/{norm}/txs", timeout=self.timeout)
            if res.status_code == 200:
                tx_list = res.json()
                parsed = []
                for tx in tx_list[:limit]:
                    status = tx.get("status", {})
                    vout = tx.get("vout", [])
                    vin = tx.get("vin", [])
                    sender = vin[0].get("prevout", {}).get("scriptpubkey_address", "Unknown") if vin else "Coinbase"
                    recipient = vout[0].get("scriptpubkey_address", "Multiple") if vout else "Unknown"
                    val_sat = sum(v.get("value", 0) for v in vout)
                    parsed.append({
                        "tx_hash": tx.get("txid"),
                        "chain_id": self.chain_id,
                        "from_address": sender,
                        "to_address": recipient,
                        "value_native": round(val_sat / 100_000_000.0, 8),
                        "block_number": status.get("block_height", 0),
                        "status": "SUCCESS" if status.get("confirmed") else "PENDING",
                        "is_live": True
                    })
                if parsed:
                    return parsed
        except Exception as e:
            logger.warning(f"Blockstream API get_transactions error: {e}")

        # Demo fallback
        return [
            {
                "tx_hash": f"btc_mock_tx_{i}",
                "chain_id": self.chain_id,
                "from_address": norm if i % 2 == 0 else "1A1zP1eP5QGefi2DMPTfTL5SLmv7DivfNa",
                "to_address": "1A1zP1eP5QGefi2DMPTfTL5SLmv7DivfNa" if i % 2 == 0 else norm,
                "value_native": 0.1 * (i + 1),
                "block_number": 800000 - i,
                "status": "SUCCESS",
                "is_live": False
            }
            for i in range(min(limit, 5))
        ]

    def get_latest_block_number(self) -> int:
        try:
            res = requests.get(f"{self.api_base}/blocks/tip/height", timeout=self.timeout)
            if res.status_code == 200:
                return int(res.text.strip())
        except Exception:
            pass
        return 968780
