import pytest
import datetime
from fastapi.testclient import TestClient

from app.main import app
from app.analysis.pattern_rules import PatternRules
from app.analysis.pattern_detector import PatternDetector
from app.analysis.pattern_models import (
    MempoolTxItem, MempoolSimulationRequest, EvmTraceEvaluateRequest,
    DeFiParameters
)
from app.analysis.mempool_simulator import MempoolSimulator
from app.analysis.evm_tracer import EvmTraceAnalyzer

client = TestClient(app)

class MockDeFiTx:
    def __init__(
        self,
        tx_hash: str,
        from_addr: str,
        to_addr: str,
        val_eth: float,
        block_number: int = 19000000,
        transaction_index: int = 0,
        calldata: str = "0x",
        timestamp: datetime.datetime = None,
        same_block_profit: float = 0.0,
        internal_tx_count: int = 0,
        token_approval_count: int = 0,
        lp_token_burn_ratio: float = 0.0,
        gas_price_gwei: float = 25.0
    ):
        self.tx_hash = tx_hash
        self.transaction_hash = tx_hash
        self.from_address = from_addr
        self.to_address = to_addr
        self.value_eth = val_eth
        self.amount_native = val_eth
        self.block_number = block_number
        self.transaction_index = transaction_index
        self.block_position = transaction_index
        self.calldata = calldata
        self.input = calldata
        self.block_timestamp = timestamp or datetime.datetime.now(datetime.UTC)
        self.timestamp = self.block_timestamp
        self.same_block_profit = same_block_profit
        self.internal_tx_count = internal_tx_count
        self.token_approval_count = token_approval_count
        self.lp_token_burn_ratio = lp_token_burn_ratio
        self.gas_price_gwei = gas_price_gwei


def test_defi_parameters_extraction():
    """Verify extraction of all 6 DeFi parameters."""
    # 0x095ea7b3 is approve(address,uint256) with unlimited (2^256-1)
    unlimited_approval_calldata = (
        "0x095ea7b3"
        "0000000000000000000000007a250d5630b4cf539739df2c5dacb4c659f2488d"
        "ffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff"
    )
    tx = MockDeFiTx(
        tx_hash="0xdefitx1",
        from_addr="0xattacker",
        to_addr="0xcontract",
        val_eth=2.5,
        block_number=19000000,
        transaction_index=0,  # block_position = 0 (front-run suspect)
        calldata=unlimited_approval_calldata,
        same_block_profit=1.25,
        internal_tx_count=4,
        lp_token_burn_ratio=0.88
    )

    params: DeFiParameters = EvmTraceAnalyzer.evaluate_defi_parameters(tx)
    assert params.block_position == 0
    assert params.same_block_profit == 1.25
    assert params.calldata_signature == "0x095ea7b3"
    assert params.internal_tx_count == 4
    assert params.token_approval_count >= 1
    assert params.lp_token_burn_ratio == 0.88


def test_mev_sandwich_detection():
    """Verify PAT-MEV-SANDWICH: Buy -> Target Tx -> Sell in same block."""
    bot = "0xmevbot111111111111111111111111111111111"
    victim = "0xvictim222222222222222222222222222222222"
    pool = "0xuniv2pool33333333333333333333333333333333"
    blk = 19100500

    # Sandwich sequence
    front_buy = MockDeFiTx(
        "0xfront_buy", bot, pool, val_eth=5.0, block_number=blk,
        transaction_index=10, calldata="0x38ed1739..." # swapExactTokensForTokens
    )
    victim_tx = MockDeFiTx(
        "0xvictim_swap", victim, pool, val_eth=50.0, block_number=blk,
        transaction_index=11, calldata="0x38ed1739..."
    )
    back_sell = MockDeFiTx(
        "0xback_sell", bot, pool, val_eth=5.25, block_number=blk,
        transaction_index=12, calldata="0x18cbafe5...", # swapExactTokensForETH
        same_block_profit=0.25
    )

    txs = [front_buy, victim_tx, back_sell]
    findings = PatternRules.detect_mev_sandwich(bot, txs)

    assert len(findings) == 1
    f = findings[0]
    assert f.pattern_id == "PAT-MEV-SANDWICH"
    assert f.severity == "CRITICAL"
    assert f.defi_parameters is not None
    assert f.defi_parameters.block_position == 10
    assert f.defi_parameters.same_block_profit == 0.25
    assert "0xfront_buy" in f.related_transaction_hashes
    assert "0xvictim_swap" in f.related_transaction_hashes
    assert "0xback_sell" in f.related_transaction_hashes


def test_flash_loan_exploit_detection():
    """Verify PAT-FLASH-LOAN-EXPLOIT: Borrow -> Attack -> Repay in 1 tx."""
    attacker = "0xexploiter4444444444444444444444444444444"
    # Aave flashLoan 4-byte selector: 0xab9c4b5d
    flash_tx = MockDeFiTx(
        tx_hash="0xflash_attack_tx",
        from_addr=attacker,
        to_addr="0xaavepool",
        val_eth=150.0,
        calldata="0xab9c4b5d000000000000000000000000...",
        internal_tx_count=5,
        same_block_profit=15.5
    )

    findings = PatternRules.detect_flash_loan_exploit(attacker, [flash_tx])
    assert len(findings) == 1
    f = findings[0]
    assert f.pattern_id == "PAT-FLASH-LOAN-EXPLOIT"
    assert f.severity == "CRITICAL"
    assert f.defi_parameters.internal_tx_count >= 3
    assert f.defi_parameters.same_block_profit == 15.5


def test_rug_pull_detection():
    """Verify PAT-RUG-PULL: LP token burn -> creator withdrawal."""
    creator = "0xrugcreator5555555555555555555555555555"
    # removeLiquidity selector: 0xbaa2abde
    rug_tx = MockDeFiTx(
        tx_hash="0xrug_pull_tx",
        from_addr=creator,
        to_addr="0xrouter",
        val_eth=85.0,
        calldata="0xbaa2abde00000000000000000000...",
        lp_token_burn_ratio=0.98,
        same_block_profit=85.0
    )

    findings = PatternRules.detect_rug_pull(creator, [rug_tx])
    assert len(findings) == 1
    f = findings[0]
    assert f.pattern_id == "PAT-RUG-PULL"
    assert f.severity == "CRITICAL"
    assert f.defi_parameters.lp_token_burn_ratio == 0.98


def test_pump_dump_detection():
    """Verify PAT-PUMP-DUMP: Synchronized buy cluster -> sell."""
    target = "0xmarketmaker6666666666666666666666666666"
    now = datetime.datetime.now(datetime.UTC)

    # 4 distinct buyers within 5 minutes
    buys = [
        MockDeFiTx(f"0xbuy_{i}", f"0xbuyer_{i}", target, 2.0, timestamp=now + datetime.timedelta(seconds=i*30))
        for i in range(4)
    ]
    # Sell / dump by target wallet shortly after
    dump = MockDeFiTx("0xdump_tx", target, "0xexchange", 7.8, timestamp=now + datetime.timedelta(minutes=10))

    all_txs = buys + [dump]
    findings = PatternRules.detect_pump_and_dump(target, all_txs)
    assert len(findings) == 1
    f = findings[0]
    assert f.pattern_id == "PAT-PUMP-DUMP"
    assert f.severity == "HIGH"
    assert f.evidence["buyer_count"] >= 4
    assert f.evidence["liquidated_eth"] == 7.8


def test_wash_trading_detection():
    """Verify PAT-WASH-TRADING: Cyclic A->B->A NFT trades."""
    wallet_a = "0xwallet_aaa_777777777777777777777777777"
    wallet_b = "0xwallet_bbb_888888888888888888888888888"

    now = datetime.datetime.now(datetime.UTC)
    txs = [
        MockDeFiTx("0xwash_1", wallet_a, wallet_b, 10.0, timestamp=now),
        MockDeFiTx("0xwash_2", wallet_b, wallet_a, 10.0, timestamp=now + datetime.timedelta(minutes=5))
    ]

    findings = PatternRules.detect_wash_trading(wallet_a, txs)
    assert len(findings) == 1
    f = findings[0]
    assert f.pattern_id == "PAT-WASH-TRADING"
    assert f.severity == "HIGH"
    assert f.evidence["counterparty"] == wallet_b.lower()


def test_oracle_manipulation_detection():
    """Verify PAT-ORACLE-MANIPULATION: Oracle read -> flash loan -> drain."""
    attacker = "0xoracle_manipulator_99999999999999999"
    # Chainlink latestRoundData selector: 0xfe9fbb80
    oracle_tx = MockDeFiTx(
        tx_hash="0xoracle_drain_tx",
        from_addr=attacker,
        to_addr="0xlendingpool",
        val_eth=40.0,
        calldata="0xfe9fbb80000000000000000000000000",
        same_block_profit=40.0,
        internal_tx_count=4
    )

    findings = PatternRules.detect_oracle_manipulation(attacker, [oracle_tx])
    assert len(findings) == 1
    f = findings[0]
    assert f.pattern_id == "PAT-ORACLE-MANIPULATION"
    assert f.severity == "CRITICAL"
    assert f.defi_parameters.calldata_signature == "0xfe9fbb80"
    assert f.defi_parameters.same_block_profit == 40.0


def test_front_running_detection():
    """Verify PAT-FRONT-RUNNING: Copycat pending tx with higher gas."""
    frontrunner = "0xfrontrunner00000000000000000000000000"
    tx = MockDeFiTx(
        tx_hash="0xfrontrun_tx",
        from_addr=frontrunner,
        to_addr="0xdexrouter",
        val_eth=2.0,
        transaction_index=0, # block_position = 0
        calldata="0x38ed1739000000000000000000000000",
        gas_price_gwei=120.0
    )

    findings = PatternRules.detect_front_running(frontrunner, [tx])
    assert len(findings) == 1
    f = findings[0]
    assert f.pattern_id == "PAT-FRONT-RUNNING"
    assert f.severity == "HIGH"
    assert f.defi_parameters.block_position == 0


def test_mempool_simulator_engine():
    """Verify MempoolSimulator ordering, priority fees, and sandwich detection."""
    pool_contract = "0x111111125421ca6dc452d289314280a0f8842a65"
    now = datetime.datetime.now(datetime.UTC)

    # 3 transactions: attacker buy (100 gwei), victim (50 gwei), attacker sell (80 gwei)
    pending = [
        MempoolTxItem(
            tx_hash="0xpending_attacker_buy",
            from_address="0xbot_addr",
            to_address=pool_contract,
            value_eth=5.0,
            gas_price_gwei=100.0,
            calldata="0x38ed1739000000000000000000000000",
            timestamp=now
        ),
        MempoolTxItem(
            tx_hash="0xpending_victim",
            from_address="0xvictim_addr",
            to_address=pool_contract,
            value_eth=20.0,
            gas_price_gwei=50.0,
            calldata="0x38ed1739000000000000000000000000",
            timestamp=now + datetime.timedelta(seconds=1)
        ),
        MempoolTxItem(
            tx_hash="0xpending_attacker_sell",
            from_address="0xbot_addr",
            to_address=pool_contract,
            value_eth=5.5,
            gas_price_gwei=80.0,
            calldata="0x18cbafe5000000000000000000000000",
            timestamp=now + datetime.timedelta(seconds=2)
        )
    ]

    res = MempoolSimulator.simulate_mempool(pending, base_fee_gwei=20.0)
    assert res.simulated_block_size == 3
    # Ordered by gas price: 100 gwei (pos 0), 80 gwei (pos 1), 50 gwei (pos 2)
    assert res.ordered_transactions[0].tx_hash == "0xpending_attacker_buy"
    assert res.ordered_transactions[0].block_position == 0
    assert res.ordered_transactions[1].tx_hash == "0xpending_attacker_sell"
    assert res.ordered_transactions[1].block_position == 1
    assert res.ordered_transactions[2].tx_hash == "0xpending_victim"
    assert res.ordered_transactions[2].block_position == 2


def test_api_mempool_and_trace_endpoints():
    """Verify REST API endpoints for mempool simulation and EVM trace analysis."""
    # 1. Mempool simulate endpoint
    mempool_payload = {
        "blockchain": "Ethereum",
        "base_fee_gwei": 15.0,
        "pending_transactions": [
            {
                "tx_hash": "0xsim1",
                "from_address": "0x1111111111111111111111111111111111111111",
                "to_address": "0x2222222222222222222222222222222222222222",
                "value_eth": 1.0,
                "gas_price_gwei": 35.0,
                "calldata": "0x38ed1739"
            }
        ]
    }
    res = client.post("/analysis/mempool/simulate", json=mempool_payload)
    assert res.status_code == 200
    data = res.json()
    assert data["simulated_block_size"] == 1
    assert len(data["ordered_transactions"]) == 1
    assert data["ordered_transactions"][0]["block_position"] == 0

    # 2. Trace evaluate endpoint
    trace_payload = {
        "tx_hash": "0xtracetest",
        "from_address": "0xattacker",
        "to_address": "0xprotocol",
        "value_eth": 10.0,
        "calldata": "0xab9c4b5d000000000000000000000000", # Flash loan selector
        "block_position": 0,
        "same_block_profit": 5.0,
        "internal_calls": [
            {"type": "CALL", "value_eth": 5.0, "to": "0xdrain"}
        ]
    }
    res_trace = client.post("/analysis/trace/evaluate", json=trace_payload)
    assert res_trace.status_code == 200
    trace_data = res_trace.json()
    assert trace_data["defi_parameters"]["calldata_signature"] == "0xab9c4b5d"
    assert trace_data["defi_parameters"]["block_position"] == 0
    assert trace_data["defi_parameters"]["same_block_profit"] == 5.0
    assert trace_data["defi_parameters"]["internal_tx_count"] >= 1
