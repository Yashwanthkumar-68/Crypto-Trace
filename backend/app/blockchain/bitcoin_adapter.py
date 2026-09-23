import re
from typing import Dict, Any, Optional, List
from app.blockchain.adapter import BlockchainAdapter

class BitcoinAdapter(BlockchainAdapter):
    def __init__(self, chain_id: int = 0, name: str = "Bitcoin", symbol: str = "BTC"):
        super().__init__(chain_id=chain_id, name=name, symbol=symbol, is_evm=False)

    def validate_address(self, address: str) -> bool:
        if not address or not isinstance(address, str):
            return False
        # P2PKH starts with 1, P2SH starts with 3, Bech32 starts with bc1
        pattern = r'^(1[a-km-zA-HJ-NP-Z1-9]{25,34}|3[a-km-zA-HJ-NP-Z1-9]{25,34}|bc1[a-zA-HJ-NP-Z0-9]{39,59})$'
        return bool(re.match(pattern, address))

    def normalize_address(self, address: str) -> str:
        if not self.validate_address(address):
            raise ValueError(f"Invalid address format for {self.name}: {address}")
        return address

    def get_balance(self, address: str) -> Dict[str, Any]:
        norm = self.normalize_address(address)
        return {
            "address": norm,
            "chain_id": self.chain_id,
            "chain_name": self.name,
            "balance_wei": "0",  # Following EVM adapter mock structure
            "balance_native": 1.25, # Mock balance
            "symbol": self.symbol
        }

    def get_transaction(self, tx_hash: str) -> Optional[Dict[str, Any]]:
        return {
            "tx_hash": tx_hash,
            "chain_id": self.chain_id,
            "from_address": "1A1zP1eP5QGefi2DMPTfTL5SLmv7DivfNa",
            "to_address": "1CounterpartyAddressExample1234",
            "value_native": 0.5,
            "block_number": 800000,
            "status": "SUCCESS"
        }

    def get_transactions(self, address: str, limit: int = 20) -> List[Dict[str, Any]]:
        # Mock transaction list
        return [
            {
                "tx_hash": f"mock_tx_{i}",
                "chain_id": self.chain_id,
                "from_address": address if i % 2 == 0 else "1A1zP1eP5QGefi2DMPTfTL5SLmv7DivfNa",
                "to_address": "1A1zP1eP5QGefi2DMPTfTL5SLmv7DivfNa" if i % 2 == 0 else address,
                "value_native": 0.1 * i,
                "block_number": 800000 - i,
                "status": "SUCCESS"
            }
            for i in range(min(limit, 5))
        ]

    def get_latest_block_number(self) -> int:
        return 800000
