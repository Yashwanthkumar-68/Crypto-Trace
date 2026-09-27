from typing import List, Dict, Any, Optional
from datetime import datetime, timedelta
from dataclasses import dataclass

@dataclass
class CrossChainTransition:
    source_chain: str
    target_chain: str
    source_tx_hash: str
    target_tx_hash: str
    confidence: float
    bridge_name: str
    amount_source: float = 0.0
    amount_target: float = 0.0

class CrossChainAnalyzer:
    """
    Mathematical Heuristic Engine for Tracing Funds Across Decentralized Bridges.
    Because we lack paid enterprise APIs (like Chainalysis), we use deterministic
    Time/Value slippage matching to link cross-chain hops.
    """


    def __init__(self, time_window_minutes: int = 15, max_value_slippage_pct: float = 0.05):
        self.time_window = timedelta(minutes=time_window_minutes)
        self.max_slippage = max_value_slippage_pct

    def detect_bridge_hop(
        self, 
        bridge_deposit_tx: Dict[str, Any], 
        candidate_withdrawals: List[Dict[str, Any]]
    ) -> Optional[Dict[str, Any]]:
        """
        Attempts to match a deposit into a bridge contract on Chain A 
        with a withdrawal from the bridge on Chain B.
        
        Args:
            bridge_deposit_tx: The transaction sending funds TO the bridge (Chain A).
            candidate_withdrawals: A pool of known withdrawal transactions on Chain B.
            
        Returns:
            The matched transaction and confidence score, or None.
        """
        try:
            deposit_time = datetime.fromisoformat(bridge_deposit_tx.get('timestamp', '').replace('Z', '+00:00'))
            deposit_value_usd = float(bridge_deposit_tx.get('value_usd', 0.0))
        except Exception:
            return None

        if deposit_value_usd <= 0:
            return None

        best_match = None
        highest_confidence = 0.0

        for withdrawal in candidate_withdrawals:
            try:
                withdraw_time = datetime.fromisoformat(withdrawal.get('timestamp', '').replace('Z', '+00:00'))
                withdraw_value_usd = float(withdrawal.get('value_usd', 0.0))
            except Exception:
                continue

            # Rule 1: Withdrawal must happen AFTER deposit
            time_diff = withdraw_time - deposit_time
            if time_diff.total_seconds() < 0:
                continue
            
            # Rule 2: Must be within the acceptable bridge processing window
            if time_diff > self.time_window:
                continue

            # Rule 3: Value matching (Accounting for Bridge Fees / Slippage)
            value_diff = abs(deposit_value_usd - withdraw_value_usd)
            slippage = value_diff / deposit_value_usd

            if slippage <= self.max_slippage:
                # Calculate heuristic confidence
                # Closer in time and tighter in value = higher confidence
                time_penalty = (time_diff.total_seconds() / self.time_window.total_seconds()) * 20
                slippage_penalty = (slippage / self.max_slippage) * 30
                
                confidence = 100.0 - time_penalty - slippage_penalty
                
                if confidence > highest_confidence:
                    highest_confidence = confidence
                    best_match = withdrawal

        if best_match and highest_confidence >= 50.0:
            return {
                "matched_transaction": best_match,
                "confidence_score": round(highest_confidence, 2),
                "method": "TIME_VALUE_SLIPPAGE_HEURISTIC",
                "estimated_fee_usd": round(deposit_value_usd - float(best_match.get('value_usd', 0.0)), 2),
                "time_difference_seconds": int(time_diff.total_seconds()) if 'time_diff' in locals() else 0
            }
            
        return None

# Backward compatibility alias
CrossChainDetector = CrossChainAnalyzer


# Known cross-chain bridge and protocol identifier signatures
KNOWN_BRIDGE_CONTRACTS = {
    "0xb8901acb9304702882a15e236bb4252c10a869cd": "Hop Protocol (Ethereum)",
    "0xdf0770df86a8034b3efef0a1bb3c889b8332ff56": "Across Protocol",
    "0x4f4495243837681061c4743b74b3eedf548d56a5": "Stargate Finance Router",
    "0xe4edb277e41dc89ab076a1f049f4a3efa700bce8": "Orbiter Finance",
    "0x98f3c9e6e3face36baad05fe09d375eff1764732": "Wormhole Portal Bridge",
    "0x3ee18b2214aff97000d974cf647e7c347e8fa585": "Multichain / Anyswap Bridge"
}

DEFAULT_FIAT_RATES = {
    "ETH": 2650.0,
    "BTC": 64500.0,
    "SOL": 145.0,
    "TRX": 0.155,
    "USDT": 1.0,
    "USDC": 1.0,
    "POL": 0.42,
    "BNB": 580.0
}

def analyze_cross_chain_hops(
    transactions: List[Dict[str, Any]],
    fiat_rates: Optional[Dict[str, float]] = None,
    time_window_minutes: int = 20,
    max_slippage: float = 0.08
) -> List[Dict[str, Any]]:
    """
    Automated Multi-Chain Bridge Hop Detector.
    Scans a mixed set of transactions (Ethereum, Bitcoin, Solana, Tron),
    identifies bridge exits/entries, calculates normalized fiat values,
    and runs the time/value slippage heuristic to pinpoint asset hops across chains.
    """
    rates = {**DEFAULT_FIAT_RATES, **(fiat_rates or {})}
    analyzer = CrossChainAnalyzer(time_window_minutes=time_window_minutes, max_value_slippage_pct=max_slippage)

    # 1. Normalize and compute USD values for all transactions
    normalized: List[Dict[str, Any]] = []
    for tx in transactions:
        chain = tx.get("blockchain", "Ethereum")
        symbol = tx.get("symbol")
        if not symbol:
            if "eth" in chain.lower():
                symbol = "ETH"
            elif "btc" in chain.lower() or "bitcoin" in chain.lower():
                symbol = "BTC"
            elif "sol" in chain.lower():
                symbol = "SOL"
            elif "tron" in chain.lower() or "trx" in chain.lower():
                symbol = "TRX"
            elif "polygon" in chain.lower():
                symbol = "POL"
            elif "bnb" in chain.lower() or "bsc" in chain.lower():
                symbol = "BNB"
            else:
                symbol = "USDT"

        native_val = float(tx.get("value_eth") or tx.get("value_native") or tx.get("amount") or 0.0)
        rate = rates.get(symbol, 1.0)
        val_usd = float(tx.get("value_usd") or (native_val * rate))

        ts = tx.get("block_timestamp") or tx.get("timestamp") or tx.get("created_at")
        if isinstance(ts, datetime):
            iso_ts = ts.isoformat()
        elif ts:
            iso_ts = str(ts)
        else:
            iso_ts = datetime.utcnow().isoformat()

        to_addr = (tx.get("to_address") or "").lower()
        bridge_name = KNOWN_BRIDGE_CONTRACTS.get(to_addr) or tx.get("bridge_name")

        normalized.append({
            **tx,
            "blockchain": chain,
            "symbol": symbol,
            "value_usd": val_usd,
            "value_native": native_val,
            "timestamp": iso_ts,
            "is_known_bridge": bool(bridge_name),
            "bridge_protocol": bridge_name or "Cross-Chain Liquidity Router"
        })

    # 2. Partition into candidate deposits and candidate withdrawals
    detected_hops: List[Dict[str, Any]] = []

    for i, dep in enumerate(normalized):
        dep_chain = dep.get("blockchain")
        # Check against transactions on a DIFFERENT blockchain
        candidates_other_chain = [
            tx for j, tx in enumerate(normalized) 
            if i != j and tx.get("blockchain") != dep_chain
        ]

        if not candidates_other_chain:
            continue

        match_res = analyzer.detect_bridge_hop(dep, candidates_other_chain)
        if match_res:
            dest_tx = match_res["matched_transaction"]
            detected_hops.append({
                "source_chain": dep_chain,
                "destination_chain": dest_tx.get("blockchain"),
                "source_tx_hash": dep.get("tx_hash"),
                "destination_tx_hash": dest_tx.get("tx_hash"),
                "source_amount": f"{dep.get('value_native')} {dep.get('symbol')}",
                "destination_amount": f"{dest_tx.get('value_native')} {dest_tx.get('symbol')}",
                "source_usd": dep.get("value_usd"),
                "destination_usd": dest_tx.get("value_usd"),
                "confidence_score": match_res["confidence_score"],
                "protocol": dep.get("bridge_protocol", "Cross-Chain Bridge"),
                "estimated_fee_usd": match_res.get("estimated_fee_usd", 0.0),
                "matched_at": dest_tx.get("timestamp")
            })

    return detected_hops

