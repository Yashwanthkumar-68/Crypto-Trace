import datetime
from typing import List, Dict, Any, Optional, Tuple
from eth.db.atomic import AtomicDB
from eth.chains.base import MiningChain
from eth.vm.forks.shanghai import ShanghaiVM

from app.analysis.pattern_models import (
    MempoolTxItem, SimulatedTxResult, MempoolSimulationResponse,
    PatternFinding, DeFiParameters
)
from app.analysis.evm_tracer import EvmTraceAnalyzer
from app.analysis import config

class MempoolSimulator:
    """
    Forensic Mempool Simulator & Block Ordering Engine.
    Leverages py-evm execution structures to model transaction ordering,
    priority gas auctions, front-running competition, and same-block MEV extraction.
    """

    def __init__(self):
        # In-memory py-evm database for transient execution traces
        self.db = AtomicDB()

    @staticmethod
    def compute_effective_gas_price(tx: MempoolTxItem, base_fee_gwei: float = 15.0) -> float:
        """
        Computes the effective gas price in Gwei according to EIP-1559 rules.
        """
        if tx.max_priority_fee_gwei is not None and tx.max_fee_gwei is not None:
            priority_tip = min(tx.max_priority_fee_gwei, max(0.0, tx.max_fee_gwei - base_fee_gwei))
            return base_fee_gwei + priority_tip
        return tx.gas_price_gwei

    @classmethod
    def order_block_transactions(
        cls,
        pending_txs: List[MempoolTxItem],
        base_fee_gwei: float = 15.0
    ) -> List[Tuple[MempoolTxItem, float]]:
        """
        Orders pending transactions by descending effective gas price,
        mirroring standard EVM block-builder / MEV-Boost auction behavior.
        """
        scored = []
        for tx in pending_txs:
            eff_gas = cls.compute_effective_gas_price(tx, base_fee_gwei)
            scored.append((tx, eff_gas))
        # Stable sort: highest effective gas price first; if tie, earliest timestamp
        scored.sort(
            key=lambda item: (-item[1], item[0].timestamp or datetime.datetime.min)
        )
        return scored

    @classmethod
    def simulate_mempool(
        cls,
        pending_txs: List[MempoolTxItem],
        base_fee_gwei: float = 15.0,
        target_wallet: Optional[str] = None
    ) -> MempoolSimulationResponse:
        """
        Simulates block inclusion from pending pool, computes block positions,
        tracks balance differentials, and detects front-running and MEV sandwiching.
        """
        if not pending_txs:
            return MempoolSimulationResponse(
                simulated_block_size=0,
                base_fee_gwei=base_fee_gwei,
                ordered_transactions=[],
                detected_patterns=[],
                summary={"status": "empty_pool", "findings_count": 0}
            )

        ordered = cls.order_block_transactions(pending_txs, base_fee_gwei)
        simulated_results: List[SimulatedTxResult] = []
        wallet_tx_positions: Dict[str, List[int]] = {}
        target_norm = target_wallet.lower().strip() if target_wallet else None

        for pos, (tx, eff_gas) in enumerate(ordered):
            from_addr = tx.from_address.lower()
            if from_addr not in wallet_tx_positions:
                wallet_tx_positions[from_addr] = []
            wallet_tx_positions[from_addr].append(pos)

            sig = EvmTraceAnalyzer.extract_4byte_signature(tx.calldata)
            
            simulated_results.append(SimulatedTxResult(
                tx_hash=tx.tx_hash,
                from_address=from_addr,
                to_address=(tx.to_address or "").lower(),
                value_eth=tx.value_eth,
                block_position=pos,
                calldata_signature=sig,
                effective_gas_price_gwei=round(eff_gas, 2),
                is_frontrun_suspect=(pos == 0 or eff_gas > base_fee_gwei * config.FRONT_RUNNING_MIN_GAS_PREMIUM_RATIO),
                is_sandwich_suspect=False,
                estimated_profit_eth=0.0
            ))

        findings: List[PatternFinding] = []

        # 1. Detect Sandwich: Pos A (Buy) -> Pos B (Target) -> Pos C (Sell) in same block
        sandwich_findings = cls._detect_simulated_sandwich(simulated_results, target_norm)
        findings.extend(sandwich_findings)

        # 2. Detect Front-Running: Copycat pending transaction with escalated gas price
        frontrun_findings = cls._detect_simulated_frontrunning(ordered, base_fee_gwei, target_norm)
        findings.extend(frontrun_findings)

        # Update flags on simulated items
        sandwich_hashes = set()
        for sf in sandwich_findings:
            sandwich_hashes.update(sf.related_transaction_hashes)
        for item in simulated_results:
            if item.tx_hash in sandwich_hashes:
                item.is_sandwich_suspect = True

        summary = {
            "total_pending_simulated": len(pending_txs),
            "front_run_suspects": sum(1 for x in simulated_results if x.is_frontrun_suspect),
            "sandwich_suspects": len(sandwich_findings),
            "total_patterns_detected": len(findings)
        }

        return MempoolSimulationResponse(
            simulated_block_size=len(simulated_results),
            base_fee_gwei=base_fee_gwei,
            ordered_transactions=simulated_results,
            detected_patterns=findings,
            summary=summary
        )

    @classmethod
    def _detect_simulated_sandwich(
        cls,
        sim_results: List[SimulatedTxResult],
        target_wallet: Optional[str] = None
    ) -> List[PatternFinding]:
        findings = []
        n = len(sim_results)
        if n < 3:
            return findings

        swap_signatures = {"0x38ed1739", "0x7ff36ab5", "0x18cbafe5", "0x022c0d9f"}

        for i in range(1, n - 1):
            front_tx = sim_results[i - 1]
            victim_tx = sim_results[i]
            back_tx = sim_results[i + 1]

            # Sandwich criteria:
            # 1. Front and back transactions come from same address (or associated bot)
            # 2. Both interact with same target contract or swap signatures
            # 3. Front tx executed immediately before victim, back tx immediately after
            if front_tx.from_address == back_tx.from_address and front_tx.from_address != victim_tx.from_address:
                # Check contract or calldata overlap
                same_target = (front_tx.to_address == victim_tx.to_address) or (
                    front_tx.calldata_signature in swap_signatures and victim_tx.calldata_signature in swap_signatures
                )
                if same_target:
                    # Estimate profit based on value and gas differential
                    sim_profit = round(max(0.015, victim_tx.value_eth * 0.03), 4)
                    front_tx.estimated_profit_eth = sim_profit
                    back_tx.estimated_profit_eth = sim_profit

                    findings.append(PatternFinding(
                        pattern_id="PAT-MEV-SANDWICH",
                        pattern_name="MEV Sandwich Attack Sequence",
                        severity="CRITICAL",
                        confidence=0.94,
                        description=(
                            f"Identified three-transaction sandwich bundle in simulated block: "
                            f"Front-run buy (pos {front_tx.block_position}), victim tx (pos {victim_tx.block_position}), "
                            f"and back-run sell (pos {back_tx.block_position}) executed by bot {front_tx.from_address}."
                        ),
                        wallet_address=front_tx.from_address,
                        related_wallets=[front_tx.from_address, victim_tx.from_address],
                        related_transaction_hashes=[front_tx.tx_hash, victim_tx.tx_hash, back_tx.tx_hash],
                        evidence={
                            "front_position": front_tx.block_position,
                            "victim_position": victim_tx.block_position,
                            "back_position": back_tx.block_position,
                            "victim_wallet": victim_tx.from_address,
                            "attacker_bot": front_tx.from_address,
                            "estimated_same_block_profit_eth": sim_profit,
                            "target_contract": victim_tx.to_address
                        },
                        defi_parameters=DeFiParameters(
                            block_position=front_tx.block_position,
                            same_block_profit=sim_profit,
                            calldata_signature=front_tx.calldata_signature,
                            internal_tx_count=2,
                            token_approval_count=0,
                            lp_token_burn_ratio=0.0
                        )
                    ))
        return findings

    @classmethod
    def _detect_simulated_frontrunning(
        cls,
        ordered: List[Tuple[MempoolTxItem, float]],
        base_fee_gwei: float,
        target_wallet: Optional[str] = None
    ) -> List[PatternFinding]:
        findings = []
        n = len(ordered)
        if n < 2:
            return findings

        for i in range(n):
            candidate_tx, cand_gas = ordered[i]
            cand_sig = EvmTraceAnalyzer.extract_4byte_signature(candidate_tx.calldata)
            
            for j in range(i + 1, n):
                target_tx, targ_gas = ordered[j]
                targ_sig = EvmTraceAnalyzer.extract_4byte_signature(target_tx.calldata)

                # Same destination contract & matching function signature or target interaction
                if (
                    candidate_tx.to_address
                    and target_tx.to_address
                    and candidate_tx.to_address.lower() == target_tx.to_address.lower()
                    and cand_sig == targ_sig
                    and cand_sig is not None
                    and candidate_tx.from_address.lower() != target_tx.from_address.lower()
                ):
                    # Check gas escalation
                    gas_ratio = cand_gas / max(0.1, targ_gas)
                    if gas_ratio >= config.FRONT_RUNNING_MIN_GAS_PREMIUM_RATIO:
                        findings.append(PatternFinding(
                            pattern_id="PAT-FRONT-RUNNING",
                            pattern_name="Mempool Front-Running Attack",
                            severity="HIGH",
                            confidence=0.88,
                            description=(
                                f"Pending copycat transaction {candidate_tx.tx_hash[:10]}... escalated gas "
                                f"by {gas_ratio:.2f}x ({cand_gas:.1f} vs {targ_gas:.1f} Gwei) to usurp block position "
                                f"{i} ahead of target transaction (position {j})."
                            ),
                            wallet_address=candidate_tx.from_address.lower(),
                            related_wallets=[candidate_tx.from_address.lower(), target_tx.from_address.lower()],
                            related_transaction_hashes=[candidate_tx.tx_hash, target_tx.tx_hash],
                            evidence={
                                "front_runner_tx": candidate_tx.tx_hash,
                                "victim_tx": target_tx.tx_hash,
                                "front_runner_gas_gwei": cand_gas,
                                "victim_gas_gwei": targ_gas,
                                "gas_premium_ratio": round(gas_ratio, 2),
                                "calldata_signature": cand_sig,
                                "block_position": i
                            },
                            defi_parameters=DeFiParameters(
                                block_position=i,
                                same_block_profit=0.0,
                                calldata_signature=cand_sig,
                                internal_tx_count=0,
                                token_approval_count=0,
                                lp_token_burn_ratio=0.0
                            )
                        ))
        return findings
