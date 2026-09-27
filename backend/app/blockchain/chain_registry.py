import time
from typing import Dict, Any, List, Optional
from sqlalchemy.orm import Session

from app.blockchain.adapter import BlockchainAdapter, EVMAdapter
from app.config import settings

SUPPORTED_NETWORKS: Dict[int, Dict[str, Any]] = {
    11155111: {
        "chain_id": 11155111,
        "name": "Ethereum Sepolia",
        "network_name": "Ethereum Sepolia",
        "symbol": "ETH",
        "native_currency": "ETH",
        "is_evm": True,
        "is_active": True,
        "is_testnet": True,
        "rpc_url_configured": True,
        "rpc_configured": True,
        "rpc_url": settings.SEPOLIA_RPC_URL,
        "explorer_url": "https://sepolia.etherscan.io",
        "block_explorer_url": "https://sepolia.etherscan.io"
    },
    1: {
        "chain_id": 1,
        "name": "Ethereum Mainnet",
        "network_name": "Ethereum Mainnet",
        "symbol": "ETH",
        "native_currency": "ETH",
        "is_evm": True,
        "is_active": True,
        "is_testnet": False,
        "rpc_url_configured": True,
        "rpc_configured": True,
        "rpc_url": settings.ETHEREUM_RPC_URL,
        "explorer_url": "https://etherscan.io",
        "block_explorer_url": "https://etherscan.io"
    },
    137: {
        "chain_id": 137,
        "name": "Polygon PoS",
        "network_name": "Polygon PoS",
        "symbol": "POL",
        "native_currency": "POL",
        "is_evm": True,
        "is_active": True,
        "is_testnet": False,
        "rpc_url_configured": True,
        "rpc_configured": True,
        "rpc_url": settings.POLYGON_RPC_URL,
        "explorer_url": "https://polygonscan.com",
        "block_explorer_url": "https://polygonscan.com"
    },
    56: {
        "chain_id": 56,
        "name": "BNB Smart Chain",
        "network_name": "BNB Smart Chain",
        "symbol": "BNB",
        "native_currency": "BNB",
        "is_evm": True,
        "is_active": True,
        "is_testnet": False,
        "rpc_url_configured": True,
        "rpc_configured": True,
        "rpc_url": settings.BNB_RPC_URL,
        "explorer_url": "https://bscscan.com",
        "block_explorer_url": "https://bscscan.com"
    },
    0: {
        "chain_id": 0,
        "name": "Bitcoin Mainnet",
        "network_name": "Bitcoin Mainnet",
        "symbol": "BTC",
        "native_currency": "BTC",
        "is_evm": False,
        "is_active": True,
        "is_testnet": False,
        "rpc_url_configured": True,
        "rpc_configured": True,
        "rpc_url": "https://blockstream.info/api",
        "explorer_url": "https://mempool.space",
        "block_explorer_url": "https://mempool.space"
    },
    101: {
        "chain_id": 101,
        "name": "Solana Mainnet",
        "network_name": "Solana Mainnet",
        "symbol": "SOL",
        "native_currency": "SOL",
        "is_evm": False,
        "is_active": True,
        "is_testnet": False,
        "rpc_url_configured": True,
        "rpc_configured": True,
        "rpc_url": "https://api.mainnet-beta.solana.com",
        "explorer_url": "https://solscan.io",
        "block_explorer_url": "https://solscan.io"
    },
    728126428: {
        "chain_id": 728126428,
        "name": "Tron Mainnet",
        "network_name": "Tron Mainnet",
        "symbol": "TRX",
        "native_currency": "TRX",
        "is_evm": False,
        "is_active": True,
        "is_testnet": False,
        "rpc_url_configured": True,
        "rpc_configured": True,
        "rpc_url": "https://api.trongrid.io",
        "explorer_url": "https://tronscan.org",
        "block_explorer_url": "https://tronscan.org"
    }
}

class ChainRegistry:
    _adapters: Dict[int, BlockchainAdapter] = {}

    @classmethod
    def list_chains(cls) -> List[Dict[str, Any]]:
        return list(SUPPORTED_NETWORKS.values())

    @classmethod
    def is_supported(cls, chain_id: int) -> bool:
        return chain_id in SUPPORTED_NETWORKS

    @classmethod
    def get_chain(cls, chain_id: int) -> Dict[str, Any]:
        if chain_id not in SUPPORTED_NETWORKS:
            supported = list(SUPPORTED_NETWORKS.keys())
            raise ValueError(
                f"Unsupported blockchain network chain_id={chain_id}. "
                f"Supported chain IDs are: {supported}."
            )
        return SUPPORTED_NETWORKS[chain_id]

    @classmethod
    def get_adapter(cls, chain_id: int) -> BlockchainAdapter:
        info = cls.get_chain(chain_id)
        if chain_id not in cls._adapters:
            if chain_id == 0:
                from app.blockchain.bitcoin_adapter import BitcoinAdapter
                cls._adapters[chain_id] = BitcoinAdapter()
            elif chain_id == 101:
                from app.blockchain.solana_adapter import SolanaAdapter
                cls._adapters[chain_id] = SolanaAdapter()
            elif chain_id == 728126428:
                from app.blockchain.tron_adapter import TronAdapter
                cls._adapters[chain_id] = TronAdapter()
            else:
                rpc_map = {
                    11155111: settings.SEPOLIA_RPC_URL,
                    1: settings.ETHEREUM_RPC_URL,
                    137: settings.POLYGON_RPC_URL,
                    56: settings.BNB_RPC_URL
                }
                rpc_url = rpc_map.get(chain_id, settings.SEPOLIA_RPC_URL)
                cls._adapters[chain_id] = EVMAdapter(
                    chain_id=chain_id,
                    name=info["name"],
                    symbol=info["symbol"],
                    rpc_url=rpc_url
                )
        return cls._adapters[chain_id]

    @classmethod
    def check_all_health(cls) -> List[Dict[str, Any]]:
        """
        Actively queries every registered blockchain node/RPC to determine
        live connectivity status, latency in milliseconds, and latest block/slot number.
        """
        health_reports = []
        for chain_id, info in SUPPORTED_NETWORKS.items():
            t0 = time.time()
            try:
                adapter = cls.get_adapter(chain_id)
                block_num = adapter.get_latest_block_number()
                latency_ms = round((time.time() - t0) * 1000, 1)
                health_reports.append({
                    "chain_id": chain_id,
                    "name": info["name"],
                    "symbol": info["symbol"],
                    "is_evm": info["is_evm"],
                    "status": "ONLINE",
                    "latest_block": block_num,
                    "latency_ms": latency_ms,
                    "rpc_url": info.get("rpc_url", ""),
                    "explorer_url": info["explorer_url"]
                })
            except Exception as e:
                latency_ms = round((time.time() - t0) * 1000, 1)
                health_reports.append({
                    "chain_id": chain_id,
                    "name": info["name"],
                    "symbol": info["symbol"],
                    "is_evm": info["is_evm"],
                    "status": "OFFLINE",
                    "latest_block": None,
                    "latency_ms": latency_ms,
                    "error": str(e),
                    "rpc_url": info.get("rpc_url", ""),
                    "explorer_url": info["explorer_url"]
                })
        return health_reports

    @classmethod
    def seed_db_networks(cls, db: Session):
        from app.database.models import BlockchainNetwork
        for chain_id, data in SUPPORTED_NETWORKS.items():
            existing = db.query(BlockchainNetwork).filter(BlockchainNetwork.chain_id == chain_id).first()
            if not existing:
                net = BlockchainNetwork(
                    chain_id=chain_id,
                    name=data["name"],
                    symbol=data["symbol"],
                    is_active=data["is_active"],
                    is_evm=data["is_evm"],
                    rpc_url_configured=data["rpc_url_configured"],
                    explorer_url=data["explorer_url"]
                )
                db.add(net)
        db.commit()
