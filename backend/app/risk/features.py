import math
import datetime
import statistics
import networkx as nx
from typing import List, Dict, Any, Set, Optional
from app.database.models import Transaction, AddressLabel, EntityType

def _get_tx_timestamp(tx: Any) -> Optional[datetime.datetime]:
    ts = getattr(tx, 'block_timestamp', None)
    if ts is None or not isinstance(ts, (datetime.datetime, int, float, str)):
        ts = getattr(tx, 'timestamp', None)
    if isinstance(ts, datetime.datetime):
        return ts
    if isinstance(ts, (int, float)):
        try:
            return datetime.datetime.fromtimestamp(ts, tz=datetime.timezone.utc).replace(tzinfo=None)
        except Exception:
            pass
    if isinstance(ts, str):
        try:
            return datetime.datetime.fromisoformat(ts.replace('Z', '+00:00')).replace(tzinfo=None)
        except Exception:
            pass
    return None

def _get_tx_value(tx: Any) -> float:
    if hasattr(tx, 'value_eth') and tx.value_eth is not None:
        return float(tx.value_eth)
    if hasattr(tx, 'amount_native') and tx.amount_native is not None:
        return float(tx.amount_native)
    return 0.0

def _get_tx_from(tx: Any) -> str:
    return getattr(tx, 'from_address', '').lower()

def _get_tx_to(tx: Any) -> str:
    return (getattr(tx, 'to_address', '') or '').lower()

def _get_tx_type(tx: Any) -> str:
    return str(getattr(tx, 'transaction_type', '') or getattr(tx, 'tx_type', '')).lower()


class FeatureExtractor:
    @staticmethod
    def extract_wallet_features(
        wallet_address: str,
        transactions: List[Any],
        labels_map: Optional[Dict[str, Any]] = None,
        hop_count: int = 1,
        patterns_list: Optional[List[Any]] = None,
        cycles_count: int = 0
    ) -> Dict[str, float]:
        """
        Extracts multi-dimensional explainable numerical features for a wallet:
        - Structural Graph Features (betweenness, PageRank, clustering, k-core, eigenvector, degree ratios)
        - Temporal Behavioral Features (tx_hour_entropy, inter_tx_intervals, day_of_week, velocity_delta_7d, dormancy)
        - DeFi-Specific Features (protocol diversity, flash loans, LP interactions, NFT ratio, gas percentile)
        - Cross-Chain Features (bridge outflow ratio, multi-chain presence score, chain hop frequency)
        - Risk-Cluster Features / GNN Output (mixer, exchange, scam cluster proximities)
        - Backward-compatible Phase 1 and Phase 6 feature sets
        """
        labels = labels_map or {}
        norm_wallet = wallet_address.lower()

        incoming = [tx for tx in transactions if _get_tx_to(tx) == norm_wallet]
        outgoing = [tx for tx in transactions if _get_tx_from(tx) == norm_wallet]

        incoming_vals = [_get_tx_value(tx) for tx in incoming]
        outgoing_vals = [_get_tx_value(tx) for tx in outgoing]
        all_vals = incoming_vals + outgoing_vals

        incoming_val = sum(incoming_vals)
        outgoing_val = sum(outgoing_vals)
        tx_count = len(incoming) + len(outgoing)

        counterparties: Set[str] = set()
        incoming_cps: Set[str] = set()
        outgoing_cps: Set[str] = set()

        for tx in incoming:
            frm = _get_tx_from(tx)
            if frm:
                counterparties.add(frm)
                incoming_cps.add(frm)
        for tx in outgoing:
            to_addr = _get_tx_to(tx)
            if to_addr:
                counterparties.add(to_addr)
                outgoing_cps.add(to_addr)

        unique_counterparties = len(counterparties)

        # Statistical metrics
        avg_val = statistics.mean(all_vals) if all_vals else 0.0
        med_val = statistics.median(all_vals) if all_vals else 0.0
        max_val = max(all_vals) if all_vals else 0.0

        # Duration & Frequency
        timestamps = [_get_tx_timestamp(tx) for tx in (incoming + outgoing) if _get_tx_timestamp(tx)]
        duration_hours = 0.0
        duration_days = 0.0
        tx_freq = 0.0
        burst_score = 0.0

        if timestamps:
            timestamps.sort()
            duration_secs = max(1.0, (timestamps[-1] - timestamps[0]).total_seconds())
            duration_hours = max(0.1, duration_secs / 3600.0)
            duration_days = max(0.01, duration_secs / 86400.0)
            tx_freq = tx_count / duration_hours
            if duration_secs < 1800 and tx_count >= 5:
                burst_score = 1.0
            elif tx_freq > 10.0:
                burst_score = 0.8

        # Rapid movement count
        rapid_count = 0
        if incoming and outgoing:
            for in_tx in incoming:
                in_t = _get_tx_timestamp(in_tx)
                if not in_t:
                    continue
                for out_tx in outgoing:
                    out_t = _get_tx_timestamp(out_tx)
                    if out_t and 0 <= (out_t - in_t).total_seconds() <= 900:
                        rapid_count += 1
                        break

        # Patterns counts
        p_list = patterns_list or []
        pattern_ids = [getattr(p, 'pattern_id', '') or getattr(p, 'finding_type', '') for p in p_list]
        rapid_transfer_count = float(rapid_count or pattern_ids.count("PAT-RAPID-TRANSFER") or pattern_ids.count("RAPID_MOVEMENT"))
        fund_split_count = float(pattern_ids.count("PAT-FUND-SPLITTING") or pattern_ids.count("FUND_SPLITTING"))
        consolidation_count = float(pattern_ids.count("PAT-FUND-CONSOLIDATION") or pattern_ids.count("FUND_CONSOLIDATION"))
        multi_hop_count = float(pattern_ids.count("PAT-MULTI-HOP") or pattern_ids.count("MULTI_HOP_DEPTH") or (1 if hop_count >= 3 else 0))
        cycle_count = float(cycles_count or pattern_ids.count("PAT-CIRCULAR-FLOW") or pattern_ids.count("CIRCULAR_MOVEMENT"))
        unusual_large_transfer_count = float(pattern_ids.count("PAT-SUDDEN-LARGE-TRANSFER") or pattern_ids.count("SUDDEN_LARGE_TRANSFER"))

        # Entity interactions
        known_entity_interaction = 0.0
        exchange_interaction = 0.0
        bridge_interaction = 0.0
        dex_interaction = 0.0
        high_risk_connections = 0.0
        bridge_outgoing_val = 0.0
        defi_protocols: Set[str] = set()
        scam_connections = 0.0

        for cp in counterparties:
            lbl = labels.get(cp)
            if lbl:
                etype = getattr(lbl, 'entity_type', None)
                etype_str = etype.value if hasattr(etype, 'value') else str(etype)
                ename = getattr(lbl, 'entity_name', cp)
                if etype_str not in ("UNKNOWN", "PERSONAL_WALLET"):
                    known_entity_interaction = 1.0
                if etype_str in ("EXCHANGE", "VASP"):
                    exchange_interaction += 1.0
                elif etype_str == "BRIDGE":
                    bridge_interaction += 1.0
                elif etype_str in ("DEX", "DEFI", "LENDING", "YIELD"):
                    dex_interaction += 1.0
                    if ename:
                        defi_protocols.add(ename)
                elif etype_str in ("MIXER", "SCAM", "SCAM_ASSOCIATED"):
                    high_risk_connections += 1.0
                    if etype_str == "SCAM":
                        scam_connections += 1.0

        for tx in outgoing:
            to_addr = _get_tx_to(tx)
            lbl = labels.get(to_addr)
            if lbl:
                etype = getattr(lbl, 'entity_type', None)
                etype_str = etype.value if hasattr(etype, 'value') else str(etype)
                if etype_str == "BRIDGE":
                    bridge_outgoing_val += _get_tx_value(tx)

        # ----------------------------------------------------
        # 1. STRUCTURAL GRAPH FEATURES
        # ----------------------------------------------------
        in_degree_ratio = float(len(incoming) / tx_count) if tx_count > 0 else 0.0
        out_degree_ratio = float(len(outgoing) / tx_count) if tx_count > 0 else 0.0

        G = nx.MultiDiGraph()
        G.add_node(norm_wallet)
        for tx in (incoming + outgoing):
            u = _get_tx_from(tx)
            v = _get_tx_to(tx)
            if u and v:
                G.add_edge(u, v)

        betweenness_centrality = 0.0
        pagerank_score = 0.0
        clustering_coefficient = 0.0
        k_core_number = 0.0
        eigenvector_centrality = 0.0

        try:
            bc_dict = nx.betweenness_centrality(G)
            betweenness_centrality = float(bc_dict.get(norm_wallet, 0.0))
        except Exception:
            betweenness_centrality = 0.0

        try:
            pr_dict = nx.pagerank(G)
            pagerank_score = float(pr_dict.get(norm_wallet, 0.0))
        except Exception:
            pagerank_score = 0.0

        G_undir = nx.Graph(G)
        try:
            clustering_coefficient = float(nx.clustering(G_undir, norm_wallet)) if norm_wallet in G_undir else 0.0
        except Exception:
            clustering_coefficient = 0.0

        try:
            core_dict = nx.core_number(G_undir)
            k_core_number = float(core_dict.get(norm_wallet, 0))
        except Exception:
            k_core_number = 0.0

        try:
            ev_dict = nx.eigenvector_centrality(G_undir, max_iter=500)
            eigenvector_centrality = float(ev_dict.get(norm_wallet, 0.0))
        except Exception:
            eigenvector_centrality = 0.0

        # ----------------------------------------------------
        # 2. TEMPORAL BEHAVIORAL FEATURES
        # ----------------------------------------------------
        tx_hour_entropy = 0.0
        inter_tx_interval_mean = 0.0
        inter_tx_interval_std = 0.0
        day_of_week_concentration = 0.0
        velocity_delta_7d = 0.0
        dormancy_score = 0.0

        if timestamps:
            # Hour Shannon Entropy
            hour_counts = [0] * 24
            weekend_txs = 0
            for t in timestamps:
                hour_counts[t.hour] += 1
                if t.weekday() in (5, 6):
                    weekend_txs += 1

            n_ts = len(timestamps)
            for cnt in hour_counts:
                if cnt > 0:
                    p = cnt / n_ts
                    tx_hour_entropy -= p * math.log2(p)

            day_of_week_concentration = float(weekend_txs / n_ts)

            # Inter-tx intervals
            if n_ts >= 2:
                intervals = [(timestamps[i] - timestamps[i-1]).total_seconds() for i in range(1, n_ts)]
                inter_tx_interval_mean = float(statistics.mean(intervals))
                if len(intervals) >= 2:
                    inter_tx_interval_std = float(statistics.stdev(intervals))
                dormancy_score = float(max(intervals) / 3600.0)  # Max inactivity in hours

            # Velocity Delta (7-day activity acceleration)
            latest_t = timestamps[-1]
            tx_7d = [t for t in timestamps if (latest_t - t).total_seconds() <= 7 * 86400]
            count_7d = len(tx_7d)
            avg_weekly_count = n_ts / max(1.0, duration_days / 7.0)
            velocity_delta_7d = float(count_7d / max(1.0, avg_weekly_count))

        # ----------------------------------------------------
        # 3. DEFI-SPECIFIC FEATURES
        # ----------------------------------------------------
        flash_loan_count = 0.0
        liquidity_pool_interaction = 0.0
        nft_tx_count = 0.0
        gas_prices = []

        for tx in (incoming + outgoing):
            txtype = _get_tx_type(tx)
            if any(k in txtype for k in ("flash_loan", "flashloan")):
                flash_loan_count += 1.0
            if any(k in txtype for k in ("liquidity", "lp_", "pool", "swap")):
                liquidity_pool_interaction += 1.0
                defi_protocols.add("liquidity_pool")
            if any(k in txtype for k in ("nft", "erc721", "erc1155")):
                nft_tx_count += 1.0

            # Collect gas price if present
            gas_p = getattr(tx, 'gas_price', None) or getattr(tx, 'effective_gas_price', None)
            if gas_p is not None:
                try:
                    gas_prices.append(float(gas_p))
                except Exception:
                    pass

        defi_protocol_diversity = float(len(defi_protocols) + (1 if dex_interaction > 0 else 0))
        nft_transaction_ratio = float(nft_tx_count / tx_count) if tx_count > 0 else 0.0

        # Gas price percentile relative to 30 Gwei standard baseline (30e9 wei)
        gas_price_percentile = 0.5
        if gas_prices:
            avg_gas = statistics.mean(gas_prices)
            # Map average gas price to 0-1 percentile scale
            gas_price_percentile = float(min(1.0, max(0.0, avg_gas / 100e9)))

        # ----------------------------------------------------
        # 4. CROSS-CHAIN FEATURES
        # ----------------------------------------------------
        bridge_outflow_ratio = float(bridge_outgoing_val / outgoing_val) if outgoing_val > 0 else 0.0

        # Multi-chain presence score (count of distinct chains observed)
        chains_seen: Set[str] = set()
        for tx in (incoming + outgoing):
            ch = getattr(tx, 'chain_id', None) or getattr(tx, 'blockchain', 'Ethereum')
            if ch:
                chains_seen.add(str(ch))
        multi_chain_presence_score = float(max(1, len(chains_seen)))

        chain_hop_frequency = float(bridge_interaction / max(0.1, duration_days))

        # ----------------------------------------------------
        # 5. RISK-CLUSTER FEATURES (GNN OUTPUT SIMULATION / EMBEDDINGS)
        # ----------------------------------------------------
        # Cosine proximity scores range from 0.0 to 1.0
        mixer_cluster_proximity = 0.0
        if high_risk_connections > 0 or "PAT-CIRCULAR-FLOW" in pattern_ids or "CIRCULAR_MOVEMENT" in pattern_ids:
            mixer_cluster_proximity = min(1.0, 0.7 + (high_risk_connections * 0.15))
        elif burst_score > 0.5 and multi_hop_count > 0:
            mixer_cluster_proximity = 0.45

        exchange_cluster_proximity = float(min(1.0, exchange_interaction / max(1.0, unique_counterparties)))
        scam_cluster_proximity = 0.0
        if scam_connections > 0 or "PAT-HIGH-RISK" in pattern_ids:
            scam_cluster_proximity = min(1.0, 0.8 + (scam_connections * 0.1))

        # Phase 1 compatibility scores
        fund_splitting_score = min(1.0, len(outgoing) / 5.0) if len(incoming) >= 1 and len(outgoing) >= 3 else 0.0
        fund_concentration_score = min(1.0, len(incoming) / 5.0) if len(incoming) >= 3 and len(outgoing) <= 2 else 0.0
        rapid_movement_indicator = 1.0 if rapid_count > 0 else 0.0
        cross_chain_indicator = 1.0 if bridge_interaction > 0 else 0.0

        return {
            # Structural Graph Features
            "betweenness_centrality": float(round(betweenness_centrality, 6)),
            "pagerank_score": float(round(pagerank_score, 6)),
            "clustering_coefficient": float(round(clustering_coefficient, 6)),
            "k_core_number": float(k_core_number),
            "eigenvector_centrality": float(round(eigenvector_centrality, 6)),
            "in_degree_ratio": float(round(in_degree_ratio, 4)),
            "out_degree_ratio": float(round(out_degree_ratio, 4)),

            # Temporal Behavioral Features
            "tx_hour_entropy": float(round(tx_hour_entropy, 4)),
            "inter_tx_interval_mean": float(round(inter_tx_interval_mean, 2)),
            "inter_tx_interval_std": float(round(inter_tx_interval_std, 2)),
            "day_of_week_concentration": float(round(day_of_week_concentration, 4)),
            "velocity_delta_7d": float(round(velocity_delta_7d, 4)),
            "dormancy_score": float(round(dormancy_score, 2)),

            # DeFi-Specific Features
            "defi_protocol_diversity": float(defi_protocol_diversity),
            "flash_loan_count": float(flash_loan_count),
            "liquidity_pool_interaction": float(liquidity_pool_interaction),
            "nft_transaction_ratio": float(round(nft_transaction_ratio, 4)),
            "gas_price_percentile": float(round(gas_price_percentile, 4)),

            # Cross-Chain Features
            "bridge_outflow_ratio": float(round(bridge_outflow_ratio, 4)),
            "multi_chain_presence_score": float(multi_chain_presence_score),
            "chain_hop_frequency": float(round(chain_hop_frequency, 4)),

            # Risk-Cluster Features (GNN Output)
            "mixer_cluster_proximity": float(round(mixer_cluster_proximity, 4)),
            "exchange_cluster_proximity": float(round(exchange_cluster_proximity, 4)),
            "scam_cluster_proximity": float(round(scam_cluster_proximity, 4)),

            # Core Phase 6 23 baseline features
            "transaction_count": float(tx_count),
            "incoming_transaction_count": float(len(incoming)),
            "outgoing_transaction_count": float(len(outgoing)),
            "unique_counterparties": float(unique_counterparties),
            "total_incoming_value": float(incoming_val),
            "total_outgoing_value": float(outgoing_val),
            "average_transaction_value": float(round(avg_val, 4)),
            "median_transaction_value": float(round(med_val, 4)),
            "maximum_transaction_value": float(round(max_val, 4)),
            "transaction_frequency": float(round(tx_freq, 4)),
            "burst_activity_score": float(burst_score),
            "rapid_transfer_count": rapid_transfer_count,
            "fund_split_count": fund_split_count,
            "consolidation_count": consolidation_count,
            "multi_hop_count": multi_hop_count,
            "cycle_count": cycle_count,
            "unusual_large_transfer_count": unusual_large_transfer_count,
            "known_entity_interaction": known_entity_interaction,
            "exchange_interaction": float(exchange_interaction),
            "bridge_interaction": float(bridge_interaction),
            "DEX_interaction": float(dex_interaction),
            "suspicious_pattern_count": float(len(p_list)),
            "path_depth": float(hop_count),

            # Backward-compatible Phase 1 aliases
            "incoming_value": float(incoming_val),
            "outgoing_value": float(outgoing_val),
            "wallet_activity_duration": float(duration_hours),
            "hop_count": float(hop_count),
            "fund_splitting_score": float(fund_splitting_score),
            "fund_concentration_score": float(fund_concentration_score),
            "high_risk_connections": float(high_risk_connections),
            "cross_chain_indicator": float(cross_chain_indicator),
            "rapid_movement_indicator": float(rapid_movement_indicator)
        }
