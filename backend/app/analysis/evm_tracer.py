import re
import datetime
from typing import List, Dict, Any, Optional, Tuple
from eth_abi import decode
from eth_utils import to_hex, function_signature_to_4byte_selector
from app.analysis.pattern_models import DeFiParameters
from app.analysis import config

# Well-known DeFi 4-byte selectors
KNOWN_SELECTORS: Dict[str, Dict[str, Any]] = {
    # ERC-20
    "0xa9059cbb": {"name": "transfer", "types": ["address", "uint256"], "category": "token"},
    "0x23b872dd": {"name": "transferFrom", "types": ["address", "address", "uint256"], "category": "token"},
    "0x095ea7b3": {"name": "approve", "types": ["address", "uint256"], "category": "approval"},
    "0x42966c68": {"name": "burn", "types": ["uint256"], "category": "burn"},
    
    # Uniswap / DEX Swaps & Liquidity
    "0x38ed1739": {"name": "swapExactTokensForTokens", "types": ["uint256", "uint256", "address[]", "address", "uint256"], "category": "swap"},
    "0x7ff36ab5": {"name": "swapExactETHForTokens", "types": ["uint256", "address[]", "address", "uint256"], "category": "swap"},
    "0x18cbafe5": {"name": "swapExactTokensForETH", "types": ["uint256", "uint256", "address[]", "address", "uint256"], "category": "swap"},
    "0x022c0d9f": {"name": "swap", "types": ["uint256", "uint256", "address", "bytes"], "category": "swap"},
    "0xbaa2abde": {"name": "removeLiquidity", "types": ["address", "address", "uint256", "uint256", "uint256", "address", "uint256"], "category": "liquidity_remove"},
    "0x02751fac": {"name": "removeLiquidityETH", "types": ["address", "uint256", "uint256", "uint256", "address", "uint256"], "category": "liquidity_remove"},
    "0x89c31561": {"name": "burn", "types": ["address"], "category": "lp_burn"},
    
    # Flash Loans
    "0xab9c4b5d": {"name": "flashLoan", "types": ["address", "address[]", "uint256[]", "uint256[]", "address", "bytes", "uint16"], "category": "flash_loan"},
    "0x5cffe9de": {"name": "flashLoan", "types": ["address", "address", "uint256", "bytes"], "category": "flash_loan"}, # Balancer / WETH
    "0xe0e238f2": {"name": "flashLoanSimple", "types": ["address", "address", "uint256", "bytes", "uint16"], "category": "flash_loan"},
    "0x10d1e85c": {"name": "uniswapV2Call", "types": ["address", "uint256", "uint256", "bytes"], "category": "flash_loan"},
    "0xfa461e33": {"name": "uniswapV3FlashCallback", "types": ["uint256", "uint256", "bytes"], "category": "flash_loan"},

    # Oracles (Chainlink & Uniswap TWAP)
    "0xfe9fbb80": {"name": "latestRoundData", "types": [], "category": "oracle"},
    "0x50d25bcd": {"name": "latestAnswer", "types": [], "category": "oracle"},
    "0x88344e24": {"name": "observe", "types": ["uint32[]"], "category": "oracle"},
    "0x3850c7bd": {"name": "slot0", "types": [], "category": "oracle"}
}

class EvmTraceAnalyzer:
    """
    Forensic EVM Internal Trace & Calldata Analyzer.
    Decodes calldata selectors, analyzes internal transaction call trees,
    and extracts forensic DeFi parameters.
    """

    @staticmethod
    def extract_4byte_signature(calldata: Optional[str]) -> Optional[str]:
        if not calldata or not isinstance(calldata, str):
            return None
        clean = calldata.strip().lower()
        if clean.startswith("0x"):
            clean = clean[2:]
        if len(clean) >= 8:
            return "0x" + clean[:8]
        return None

    @classmethod
    def decode_calldata(cls, calldata: Optional[str]) -> Dict[str, Any]:
        result: Dict[str, Any] = {
            "signature": None,
            "function_name": None,
            "category": "unknown",
            "decoded_params": {},
            "raw_calldata_length": len(calldata) if calldata else 0
        }
        if not calldata or not isinstance(calldata, str):
            return result

        clean = calldata.strip().lower()
        if clean.startswith("0x"):
            clean = clean[2:]
        
        if len(clean) < 8:
            return result

        selector = "0x" + clean[:8]
        result["signature"] = selector

        if selector in KNOWN_SELECTORS:
            meta = KNOWN_SELECTORS[selector]
            result["function_name"] = meta["name"]
            result["category"] = meta["category"]

            payload_bytes = bytes.fromhex(clean[8:])
            types = meta["types"]
            if types and len(payload_bytes) >= 32:
                try:
                    decoded = decode(types, payload_bytes)
                    param_dict = {}
                    for i, (arg, t) in enumerate(zip(decoded, types)):
                        if isinstance(arg, bytes):
                            arg_val = "0x" + arg.hex()
                        elif isinstance(arg, (list, tuple)):
                            arg_val = [to_hex(x) if isinstance(x, bytes) else str(x) for x in arg]
                        else:
                            arg_val = str(arg)
                        param_dict[f"arg_{i}_{t}"] = arg_val
                    result["decoded_params"] = param_dict
                except Exception:
                    # Partial or custom payload
                    pass
        return result

    @classmethod
    def evaluate_defi_parameters(
        cls,
        tx: Any,
        block_position: Optional[int] = None,
        same_block_profit: float = 0.0,
        internal_calls: Optional[List[Dict[str, Any]]] = None,
        logs: Optional[List[Dict[str, Any]]] = None
    ) -> DeFiParameters:
        """
        Extracts all 6 core DeFi parameters for a transaction:
        - block_position
        - same_block_profit
        - calldata_signature
        - internal_tx_count
        - token_approval_count
        - lp_token_burn_ratio
        """
        # 1. Calldata signature
        calldata = getattr(tx, 'calldata', None) or getattr(tx, 'input', None) or getattr(tx, 'input_data', None)
        sig = cls.extract_4byte_signature(calldata)

        # 2. Block position
        pos = block_position
        if pos is None and hasattr(tx, 'transaction_index'):
            pos = getattr(tx, 'transaction_index')
        if pos is None and hasattr(tx, 'block_position'):
            pos = getattr(tx, 'block_position')

        # 3. Internal tx count
        internal_txs = 0
        approval_count = 0
        burn_ratio = 0.0

        # Check direct calldata for approval
        if sig == "0x095ea7b3": # approve(address,uint256)
            decoded = cls.decode_calldata(calldata)
            for k, val in decoded.get("decoded_params", {}).items():
                if "uint256" in k:
                    try:
                        amount = int(val)
                        if amount >= config.UNLIMITED_APPROVAL_THRESHOLD_WEI or amount == 2**256 - 1:
                            approval_count += 1
                    except Exception:
                        pass

        # Check direct calldata for LP burn / removal
        if sig in ("0xbaa2abde", "0x02751fac", "0x89c31561", "0x42966c68"):
            burn_ratio = getattr(tx, 'lp_token_burn_ratio', 0.85)

        # Inspect internal call tree if provided
        if internal_calls:
            for call in internal_calls:
                call_type = str(call.get("type", "")).upper()
                value = float(call.get("value", 0.0) or call.get("value_eth", 0.0))
                if call_type in ("CALL", "CREATE", "CREATE2") and value > 0:
                    internal_txs += 1
                
                # Check child calls for approvals & burns
                sub_calldata = call.get("input") or call.get("calldata")
                sub_sig = cls.extract_4byte_signature(sub_calldata)
                if sub_sig == "0x095ea7b3":
                    sub_decoded = cls.decode_calldata(sub_calldata)
                    for k, val in sub_decoded.get("decoded_params", {}).items():
                        if "uint256" in k:
                            try:
                                amount = int(val)
                                if amount >= config.UNLIMITED_APPROVAL_THRESHOLD_WEI or amount == 2**256 - 1:
                                    approval_count += 1
                            except Exception:
                                pass
                if sub_sig in ("0xbaa2abde", "0x02751fac", "0x89c31561"):
                    if burn_ratio == 0.0:
                        burn_ratio = float(call.get("burn_ratio", 0.90))

        # Check logs for approvals or LP burns
        if logs:
            for log in logs:
                topics = log.get("topics", [])
                if topics:
                    # Approval(address,address,uint256) topic0 = 0x8c5be1e5ebec7d5bd14f71427d1e84f3dd0314c0f7b2291e5b200ac8c7c3b925
                    if str(topics[0]).lower().startswith("0x8c5be1e5"):
                        data_hex = log.get("data", "0x")
                        if len(data_hex) >= 66:
                            try:
                                amt = int(data_hex, 16)
                                if amt >= config.UNLIMITED_APPROVAL_THRESHOLD_WEI:
                                    approval_count += 1
                            except Exception:
                                pass
                    # Sync / Burn topic0 = 0xdccd414f40f44131d0a77bb6cb33d6b2d2bca700f11773adc6110ee477761b35 (Uniswap V2 Burn)
                    if str(topics[0]).lower().startswith("0xdccd414f"):
                        if burn_ratio == 0.0:
                            burn_ratio = float(log.get("burn_ratio", 0.95))

        # Attribute-level fallbacks if passed directly on transaction model
        if hasattr(tx, 'internal_tx_count') and tx.internal_tx_count is not None:
            internal_txs = max(internal_txs, int(tx.internal_tx_count))
        if hasattr(tx, 'token_approval_count') and tx.token_approval_count is not None:
            approval_count = max(approval_count, int(tx.token_approval_count))
        if hasattr(tx, 'lp_token_burn_ratio') and tx.lp_token_burn_ratio is not None:
            burn_ratio = max(burn_ratio, float(tx.lp_token_burn_ratio))
        if hasattr(tx, 'same_block_profit') and tx.same_block_profit is not None:
            same_block_profit = float(tx.same_block_profit)

        return DeFiParameters(
            block_position=pos,
            same_block_profit=round(same_block_profit, 6),
            calldata_signature=sig,
            internal_tx_count=internal_txs,
            token_approval_count=approval_count,
            lp_token_burn_ratio=round(burn_ratio, 4)
        )
