import re
from typing import Dict, Any, Optional, List
from app.blockchain.adapter import BlockchainAdapter

class SolanaAdapter(BlockchainAdapter):
    def __init__(self, chain_id: int = 101, name: str = "Solana", symbol: str = "SOL"):
        super().__init__(chain_id=chain_id, name=name, symbol=symbol, is_evm=False)

    def validate_address(self, address: str) -> bool:
        if not address or not isinstance(address, str):
            return False
        # Base58, 32-44 chars
        pattern = r'^[1-9A-HJ-NP-Za-km-z]{32,44}$'
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
            "balance_wei": "0",  # Following EVM format for consistency
            "balance_native": 150.5, # Mock balance
            "symbol": self.symbol
        }

    def get_transaction(self, tx_hash: str) -> Optional[Dict[str, Any]]:
        return {
            "tx_hash": tx_hash,
            "chain_id": self.chain_id,
            "from_address": "4Nd1mBQtrCGMB1Z6zNnGBB43uE6xJwGg5L7X4LhZp73E",
            "to_address": "TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA",
            "value_native": 10.0,
            "block_number": 200000000,
            "status": "SUCCESS"
        }

    def get_transactions(self, address: str, limit: int = 20) -> List[Dict[str, Any]]:
        # Mock transaction list
        return [
            {
                "tx_hash": f"mock_tx_{i}",
                "chain_id": self.chain_id,
                "from_address": address if i % 2 == 0 else "4Nd1mBQtrCGMB1Z6zNnGBB43uE6xJwGg5L7X4LhZp73E",
                "to_address": "4Nd1mBQtrCGMB1Z6zNnGBB43uE6xJwGg5L7X4LhZp73E" if i % 2 == 0 else address,
                "value_native": 1.5 * i,
                "block_number": 200000000 - i,
                "status": "SUCCESS"
            }
            for i in range(min(limit, 5))
        ]

    def get_latest_block_number(self) -> int:
        return 200000000
