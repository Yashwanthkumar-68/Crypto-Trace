import logging
import asyncio
import datetime
from typing import List, Dict, Any, Optional, Set
import httpx
from sqlalchemy.orm import Session

from app.config import settings
from app.database.models import Transaction, Wallet
from app.blockchain.transaction_parser import TransactionNormalizer

logger = logging.getLogger("blockchain.live_indexer")

PUBLIC_SEPOLIA_RPCS = [
    "https://ethereum-sepolia-rpc.publicnode.com",
    "https://1rpc.io/sepolia",
    "https://rpc.ankr.com/eth_sepolia",
    "https://endpoints.omniatech.io/v1/eth/sepolia/public"
]

PUBLIC_MAINNET_RPCS = [
    "https://eth.llamarpc.com",
    "https://1rpc.io/eth",
    "https://rpc.ankr.com/eth",
    "https://cloudflare-eth.com"
]

class AsyncEVMIndexer:
    """
    Enterprise-grade Live On-Chain EVM Indexer.
    Communicates directly with live public JSON-RPC nodes and explorer endpoints,
    crawling transaction graphs in real-time via Breadth-First Search (BFS).
    """

    def __init__(self, chain_id: int = 11155111, rpc_urls: Optional[List[str]] = None):
        self.chain_id = chain_id
        if rpc_urls:
            self.rpc_urls = rpc_urls
        elif chain_id == 1:
            self.rpc_urls = PUBLIC_MAINNET_RPCS
        else:
            configured_rpc = getattr(settings, "SEPOLIA_RPC_URL", None)
            endpoints = [configured_rpc] if configured_rpc else []
            endpoints.extend(PUBLIC_SEPOLIA_RPCS)
            self.rpc_urls = [u for u in endpoints if u]

        self._active_rpc_idx = 0
        self.timeout = 8.0

    @property
    def current_rpc(self) -> str:
        return self.rpc_urls[self._active_rpc_idx % len(self.rpc_urls)]

    def _rotate_rpc(self):
        self._active_rpc_idx = (self._active_rpc_idx + 1) % len(self.rpc_urls)
        logger.warning(f"Switched live RPC endpoint to: {self.current_rpc}")

    async def rpc_call(self, method: str, params: List[Any]) -> Any:
        """
        Executes a JSON-RPC 2.0 call with automatic node failover.
        """
        payload = {
            "jsonrpc": "2.0",
            "id": 1,
            "method": method,
            "params": params
        }

        attempts = len(self.rpc_urls)
        for _ in range(attempts):
            rpc_url = self.current_rpc
            try:
                async with httpx.AsyncClient(timeout=self.timeout) as client:
                    resp = await client.post(rpc_url, json=payload)
                    if resp.status_code == 200:
                        data = resp.json()
                        if "error" in data:
                            logger.debug(f"RPC {rpc_url} returned error: {data['error']}")
                            self._rotate_rpc()
                            continue
                        return data.get("result")
                    else:
                        self._rotate_rpc()
            except Exception as e:
                logger.debug(f"RPC error on {rpc_url}: {e}")
                self._rotate_rpc()

        raise RuntimeError(f"All EVM RPC endpoints exhausted for method {method}")

    async def get_latest_block_number(self) -> int:
        res = await self.rpc_call("eth_blockNumber", [])
        return int(res, 16) if res else 0

    async def get_balance_wei(self, address: str) -> int:
        norm = TransactionNormalizer.normalize_address(address) or address
        res = await self.rpc_call("eth_getBalance", [norm, "latest"])
        return int(res, 16) if res else 0

    async def get_balance_eth(self, address: str) -> float:
        wei = await self.get_balance_wei(address)
        return float(wei) / 1e18

    async def get_transaction(self, tx_hash: str) -> Optional[Dict[str, Any]]:
        return await self.rpc_call("eth_getTransactionByHash", [tx_hash])

    async def get_transaction_receipt(self, tx_hash: str) -> Optional[Dict[str, Any]]:
        return await self.rpc_call("eth_getTransactionReceipt", [tx_hash])

    async def is_contract(self, address: str) -> bool:
        norm = TransactionNormalizer.normalize_address(address) or address
        code = await self.rpc_call("eth_getCode", [norm, "latest"])
        return code not in (None, "0x", "0x0")

    async def fetch_explorer_transactions(
        self,
        address: str,
        page: int = 1,
        page_size: int = 50
    ) -> List[Dict[str, Any]]:
        """
        Fetches live transaction records from Blockscout or Etherscan Sepolia.
        """
        norm_address = TransactionNormalizer.normalize_address(address) or address.lower()
        endpoints = [
            ("https://eth-sepolia.blockscout.com/api", ""),
            ("https://api-sepolia.etherscan.io/api", getattr(settings, "ETHERSCAN_API_KEY", "") or "")
        ]

        for url, apikey in endpoints:
            params = {
                "module": "account",
                "action": "txlist",
                "address": norm_address,
                "startblock": 0,
                "endblock": 99999999,
                "page": page,
                "offset": page_size,
                "sort": "desc"
            }
            if apikey:
                params["apikey"] = apikey

            try:
                async with httpx.AsyncClient(timeout=8.0) as client:
                    resp = await client.get(url, params=params)
                    if resp.status_code == 200:
                        data = resp.json()
                        result = data.get("result")
                        if isinstance(result, list):
                            logger.info(f"Retrieved {len(result)} live transactions for {norm_address} from {url}")
                            return result
            except Exception as e:
                logger.debug(f"Failed fetching explorer txs from {url}: {e}")

        return []

    async def crawl_wallet_bfs(
        self,
        seed_address: str,
        max_depth: int = 2,
        max_txs_per_wallet: int = 15
    ) -> Dict[str, Any]:
        """
        Breadth-First Search (BFS) Live Crawler.
        Recursively crawls transactions originating from or terminating at `seed_address`
        up to `max_depth` hops.
        """
        norm_seed = (TransactionNormalizer.normalize_address(seed_address) or seed_address).lower()
        visited_wallets: Set[str] = set()
        queue: List[tuple[str, int]] = [(norm_seed, 0)]
        
        discovered_txs: List[Dict[str, Any]] = []
        seen_tx_hashes: Set[str] = set()

        while queue:
            current_wallet, depth = queue.pop(0)
            if current_wallet in visited_wallets:
                continue
            visited_wallets.add(current_wallet)

            logger.info(f"[BFS Crawler] Exploring wallet {current_wallet} at hop depth {depth}/{max_depth}")

            # Fetch transactions for current_wallet
            tx_items = await self.fetch_explorer_transactions(
                current_wallet, page=1, page_size=max_txs_per_wallet
            )

            for tx_item in tx_items:
                h = tx_item.get("hash") or tx_item.get("tx_hash")
                if not h or h.lower() in seen_tx_hashes:
                    continue
                seen_tx_hashes.add(h.lower())

                # Standardize transaction representation
                from_addr = (tx_item.get("from") or "").lower()
                to_addr = (tx_item.get("to") or "").lower()
                val_wei = str(tx_item.get("value", 0))
                val_eth = float(val_wei) / 1e18 if val_wei.isdigit() else 0.0

                ts = tx_item.get("timeStamp") or tx_item.get("timestamp")
                dt = datetime.datetime.fromtimestamp(int(ts), tz=datetime.timezone.utc) if ts and str(ts).isdigit() else datetime.datetime.utcnow()

                tx_dict = {
                    "tx_hash": h,
                    "blockchain": "Ethereum",
                    "chain_id": self.chain_id,
                    "block_number": int(tx_item.get("blockNumber", 0)) if str(tx_item.get("blockNumber", "")).isdigit() else None,
                    "from_address": from_addr,
                    "to_address": to_addr,
                    "value_wei": val_wei,
                    "value_eth": val_eth,
                    "gas_used": int(tx_item.get("gasUsed", 21000)) if str(tx_item.get("gasUsed", "")).isdigit() else 21000,
                    "receipt_status": "SUCCESS" if str(tx_item.get("isError", "0")) == "0" else "FAILED",
                    "block_timestamp": dt,
                    "hop_depth": depth
                }
                discovered_txs.append(tx_dict)

                # Queue next hop wallets if below depth limit
                if depth + 1 < max_depth:
                    counterparty = to_addr if from_addr == current_wallet else from_addr
                    if counterparty and counterparty not in visited_wallets and counterparty.startswith("0x"):
                        queue.append((counterparty, depth + 1))

        return {
            "seed_address": norm_seed,
            "max_depth": max_depth,
            "total_transactions": len(discovered_txs),
            "total_wallets_explored": len(visited_wallets),
            "transactions": discovered_txs,
            "wallets": list(visited_wallets)
        }

    def sync_wallet_live_to_db(
        self,
        db: Session,
        address: str,
        case_id: Optional[str] = None,
        max_depth: int = 1
    ) -> Dict[str, Any]:
        """
        Synchronous wrapper that executes the BFS live crawler and persists
        the discovered transactions and wallets into PostgreSQL with zero mocking.
        """
        # Run async crawler in event loop
        try:
            loop = asyncio.get_event_loop()
            if loop.is_running():
                # In an active event loop, run via new thread or executor
                import concurrent.futures
                with concurrent.futures.ThreadPoolExecutor() as pool:
                    crawl_result = pool.submit(
                        asyncio.run,
                        self.crawl_wallet_bfs(address, max_depth=max_depth)
                    ).result()
            else:
                crawl_result = loop.run_until_complete(
                    self.crawl_wallet_bfs(address, max_depth=max_depth)
                )
        except RuntimeError:
            crawl_result = asyncio.run(self.crawl_wallet_bfs(address, max_depth=max_depth))

        txs = crawl_result.get("transactions", [])
        inserted_count = 0
        updated_count = 0
        seen_wallets_in_batch: Set[str] = set()

        for t in txs:
            try:
                tx_hash = t["tx_hash"]
                existing = db.query(Transaction).filter(
                    Transaction.tx_hash.ilike(tx_hash),
                    Transaction.chain_id == t["chain_id"]
                ).first()

                if not existing:
                    new_tx = Transaction(
                        tx_hash=tx_hash,
                        blockchain=t["blockchain"],
                        chain_id=t["chain_id"],
                        block_number=t["block_number"],
                        from_address=t["from_address"],
                        to_address=t["to_address"],
                        value_wei=t["value_wei"],
                        value_eth=t["value_eth"],
                        gas_used=t["gas_used"],
                        receipt_status=t["receipt_status"],
                        block_timestamp=t["block_timestamp"],
                        case_id=case_id
                    )
                    db.add(new_tx)
                    inserted_count += 1
                else:
                    if case_id and not existing.case_id:
                        existing.case_id = case_id
                        updated_count += 1

                # Ensure Wallets are recorded without duplicate insertions
                for raw_addr in [t["from_address"], t["to_address"]]:
                    if raw_addr and raw_addr.startswith("0x"):
                        addr_norm = raw_addr.lower()
                        if addr_norm in seen_wallets_in_batch:
                            continue
                        seen_wallets_in_batch.add(addr_norm)
                        w = db.query(Wallet).filter(
                            Wallet.address.ilike(addr_norm),
                            Wallet.blockchain == "Ethereum"
                        ).first()
                        if not w:
                            w = Wallet(
                                address=addr_norm,
                                blockchain="Ethereum",
                                created_at=datetime.datetime.utcnow()
                            )
                            db.add(w)

            except Exception as e:
                logger.warning(f"Error persisting live tx {t.get('tx_hash')}: {e}")
                db.rollback()
                continue

        try:
            db.commit()
        except Exception as e:
            logger.error(f"Commit error during live sync: {e}")
            db.rollback()

        return {
            "status": "LIVE_INDEXED",
            "seed_address": address,
            "case_id": case_id,
            "depth": max_depth,
            "transactions_crawled": len(txs),
            "transactions_inserted": inserted_count,
            "transactions_updated": updated_count,
            "wallets_explored": crawl_result.get("total_wallets_explored", 0)
        }
