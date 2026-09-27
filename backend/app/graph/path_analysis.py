import networkx as nx
from typing import List, Dict, Any, Optional, Set

class PathAnalyzer:
    def __init__(self, graph: nx.MultiDiGraph):
        self.g = graph

    def _find_node(self, addr: str) -> Optional[str]:
        if not addr:
            return None
        if self.g.has_node(addr):
            return addr
        clean = addr.strip().lower()
        if self.g.has_node(clean):
            return clean
        for n in self.g.nodes():
            if str(n).lower() == clean:
                return n
        return None

    def get_k_hop_subgraph(
        self,
        source: str,
        max_hops: int = 2,
        suspicious_only: bool = False,
        suspicious_tx_hashes: Optional[Set[str]] = None,
        anti_dust: bool = True,
        dust_threshold: float = 0.02
    ) -> Dict[str, Any]:
        """
        Extracts k-hop neighborhood from source address formatted for frontend graph rendering.
        Applies mathematical Anti-Dusting pruning to eliminate adversarial noise micro-transactions.
        """
        matched = self._find_node(source)
        if not matched:
            return {
                "nodes": [],
                "edges": [],
                "max_hops": max_hops,
                "source": source,
                "node_count": 0,
                "edge_count": 0,
                "dust_metrics": {
                    "anti_dust_active": anti_dust,
                    "dust_threshold_pct": round(dust_threshold * 100, 1),
                    "pruned_tx_count": 0,
                    "pruned_volume_native": 0.0,
                    "trunk_edges_retained": 0,
                    "primary_trunk_volume": 0.0,
                    "noise_suppression_ratio": 0.0
                }
            }
        source = matched

        # Calculate distances from source using BFS
        visited_nodes: Set[str] = {source}
        queue = [(source, 0)]
        node_hops: Dict[str, int] = {source: 0}

        while queue:
            curr, depth = queue.pop(0)
            if depth >= max_hops:
                continue

            # Forward outgoing edges
            for nbr in self.g.successors(curr):
                if nbr not in node_hops or node_hops[nbr] > depth + 1:
                    node_hops[nbr] = depth + 1
                    visited_nodes.add(nbr)
                    queue.append((nbr, depth + 1))

            # Backward incoming edges (1 hop context)
            if depth == 0:
                for pred in self.g.predecessors(curr):
                    if pred not in node_hops:
                        node_hops[pred] = 1
                        visited_nodes.add(pred)

        # Precalculate parent node outflows for relative thresholding
        node_outflows: Dict[str, float] = {}
        for n in visited_nodes:
            out_edges = self.g.out_edges(n, data=True)
            node_outflows[n] = sum(d.get("amount", 0.0) for _, _, d in out_edges)

        # Extract edges between visited nodes with Anti-Dust Pruning
        edges_data = []
        pruned_dust_count = 0
        pruned_dust_volume = 0.0

        for u, v, key, data in self.g.edges(keys=True, data=True):
            if u in visited_nodes and v in visited_nodes:
                tx_hash = data.get("transaction_hash", key)
                is_suspicious = (
                    suspicious_tx_hashes and tx_hash in suspicious_tx_hashes
                ) or data.get("is_suspicious", False)

                if suspicious_only and not is_suspicious:
                    continue

                edge_val = data.get("amount", 0.0)
                parent_outflow = node_outflows.get(u, 0.0)

                # EVASION COUNTERMEASURE: Anti-Dusting Pruning Engine
                # If transaction branch carries < 2% of node outflow, classify as noise/dusting attack
                if anti_dust and dust_threshold > 0 and parent_outflow > 0:
                    if (edge_val / parent_outflow) < dust_threshold:
                        pruned_dust_count += 1
                        pruned_dust_volume += edge_val
                        continue  # Prune dust transaction from graph

                edges_data.append({
                    "id": f"{u}->{v}:{tx_hash}",
                    "source": u,
                    "target": v,
                    "transaction_hash": tx_hash,
                    "amount": round(edge_val, 4),
                    "amount_usd": data.get("amount_usd"),
                    "timestamp": data.get("timestamp"),
                    "block_number": data.get("block_number"),
                    "blockchain": data.get("blockchain", "Ethereum"),
                    "is_suspicious": is_suspicious
                })

        # Keep only nodes that have remaining valid edges or are the primary source
        active_node_ids = {source}
        for e in edges_data:
            active_node_ids.add(e["source"])
            active_node_ids.add(e["target"])

        # Extract nodes
        nodes_data = []
        for node in visited_nodes:
            if anti_dust and node not in active_node_ids:
                # Discard orphan nodes created by dust pruning
                continue

            meta = self.g.nodes[node]
            nodes_data.append({
                "id": node,
                "address": node,
                "label": meta.get("label", "Unknown Address"),
                "entity_type": meta.get("entity_type", "UNKNOWN"),
                "risk_score": meta.get("risk_score", 0.0),
                "total_incoming": round(meta.get("total_incoming", 0.0), 4),
                "total_outgoing": round(meta.get("total_outgoing", 0.0), 4),
                "tx_count": meta.get("tx_count", 0),
                "hops_from_source": node_hops.get(node, 999),
                "is_source": (node.lower() == source.lower())
            })

        primary_trunk_volume = sum(e["amount"] for e in edges_data)
        total_txs = pruned_dust_count + len(edges_data)
        noise_suppression_ratio = (pruned_dust_count / max(1, total_txs)) * 100.0

        return {
            "nodes": nodes_data,
            "edges": edges_data,
            "max_hops": max_hops,
            "source": source,
            "node_count": len(nodes_data),
            "edge_count": len(edges_data),
            "dust_metrics": {
                "anti_dust_active": anti_dust,
                "dust_threshold_pct": round(dust_threshold * 100, 1),
                "pruned_tx_count": pruned_dust_count,
                "pruned_volume_native": round(pruned_dust_volume, 6),
                "trunk_edges_retained": len(edges_data),
                "primary_trunk_volume": round(primary_trunk_volume, 4),
                "noise_suppression_ratio": round(noise_suppression_ratio, 1)
            }
        }


    def trace_paths_to_vasp(self, source: str, max_hops: int = 5) -> List[Dict[str, Any]]:
        """
        Discovers verified paths from suspect wallet to any node labeled as VASP or EXCHANGE.
        """
        matched = self._find_node(source)
        if not matched:
            return []
        source = matched

        # Find candidate target nodes
        vasp_targets = [
            node for node, meta in self.g.nodes(data=True)
            if meta.get("entity_type") in ("VASP", "EXCHANGE") and str(node).lower() != str(source).lower()
        ]

        simple_g = nx.DiGraph(self.g)

        # Fallback to terminal destination sinks if no known VASP nodes are present in the graph
        if not vasp_targets:
            sinks = [
                node for node in self.g.nodes()
                if str(node).lower() != str(source).lower()
                and self.g.out_degree(node) == 0
                and nx.has_path(simple_g, source, node)
            ]
            if sinks:
                vasp_targets = sinks
            else:
                # If all nodes have outgoing edges (e.g. cycles), use any nodes reachable downstream from source
                vasp_targets = [
                    node for node in self.g.nodes()
                    if str(node).lower() != str(source).lower()
                    and nx.has_path(simple_g, source, node)
                ]

        if not vasp_targets:
            return []

        discovered_paths = []

        for target in vasp_targets:
            try:
                for path in nx.all_simple_paths(simple_g, source=source, target=target, cutoff=max_hops):
                    # Reconstruct step by step path details
                    path_steps = []
                    total_flow = 0.0
                    total_hops = len(path) - 1
                    prev_step_ts = None

                    for i in range(len(path) - 1):
                        u, v = path[i], path[i+1]
                        # Find edge with largest amount between u and v
                        edge_data_dict = self.g.get_edge_data(u, v) or {}
                        edge_candidates = list(edge_data_dict.values())
                        if not edge_candidates:
                            continue
                        best_edge = max(edge_candidates, key=lambda e: (e.get("amount") or e.get("value_eth") or 0.0))
                        edge_amount = best_edge.get("amount") if best_edge.get("amount") is not None else (best_edge.get("value_eth") or 0.0)
                        total_flow = edge_amount

                        # Block number
                        block_num = best_edge.get("block_number")

                        # Timestamp handling
                        raw_ts = best_edge.get("timestamp") or best_edge.get("block_timestamp")
                        ts_str = raw_ts.isoformat() if hasattr(raw_ts, "isoformat") else (str(raw_ts) if raw_ts else None)

                        # Check destination node and VASP attribution
                        v_meta = self.g.nodes[v]
                        v_label = v_meta.get("label") or "Destination Node"
                        v_type = (v_meta.get("entity_type") or "UNKNOWN").upper()
                        is_dest_vasp = (
                            v_type in ("VASP", "EXCHANGE")
                            or any(kw in (v_label or "").upper() for kw in ("BINANCE", "WAZIRX", "COINDCX", "EXCHANGE", "KRAKEN", "OKX", "COINBASE", "VASP"))
                        )

                        # Suspicious indicator determination
                        suspicious_flags = []
                        if best_edge.get("is_suspicious"):
                            suspicious_flags.append("Flagged Suspicious Transaction")
                        if i == 0:
                            suspicious_flags.append("Suspect Dispersal Origin")
                        if is_dest_vasp:
                            suspicious_flags.append("Terminal VASP Liquidation")
                        if self.g.nodes[u].get("outgoing_count", 0) > 1 or self.g.out_degree(u) > 1:
                            suspicious_flags.append("Peeling Chain Structuring")

                        # Rapid fund movement between consecutive hops
                        if prev_step_ts and ts_str:
                            try:
                                import datetime
                                t1 = datetime.datetime.fromisoformat(prev_step_ts.replace("Z", "+00:00"))
                                t2 = datetime.datetime.fromisoformat(ts_str.replace("Z", "+00:00"))
                                diff_secs = abs((t2 - t1).total_seconds())
                                if diff_secs <= 900:
                                    suspicious_flags.append(f"Rapid Transfer ({int(diff_secs)}s)")
                            except Exception:
                                pass
                        prev_step_ts = ts_str

                        if edge_amount >= 1.0:
                            suspicious_flags.append("High-Value Transfer")

                        suspicious_indicator = ", ".join(suspicious_flags) if suspicious_flags else None

                        path_steps.append({
                            "from_address": u,
                            "from_label": self.g.nodes[u].get("label") or "Intermediate Node",
                            "to_address": v,
                            "to_label": v_label,
                            "to_entity_type": v_type,
                            "transaction_hash": best_edge.get("transaction_hash") or best_edge.get("tx_hash") or "",
                            "amount": edge_amount,
                            "timestamp": ts_str,
                            "block_number": block_num,
                            "hop_number": i + 1,
                            "total_hops": total_hops,
                            "is_destination_vasp": is_dest_vasp,
                            "suspicious_indicator": suspicious_indicator
                        })

                    target_meta = self.g.nodes[target]
                    label_str = target_meta.get("label")
                    is_target_vasp = (
                        target_meta.get("entity_type") in ("VASP", "EXCHANGE")
                        or any(kw in (label_str or "").upper() for kw in ("BINANCE", "WAZIRX", "COINDCX", "EXCHANGE", "KRAKEN", "OKX", "COINBASE", "VASP"))
                    )
                    if not label_str or label_str in ("Unknown Address", "Unknown Wallet"):
                        if is_target_vasp:
                            dest_vasp_name = "Centralized VASP Exit"
                        else:
                            dest_vasp_name = f"Terminal Liquidation Sink ({target[:6]}...{target[-4:]})"
                    else:
                        dest_vasp_name = label_str

                    discovered_paths.append({
                        "hops": total_hops,
                        "destination_vasp": dest_vasp_name,
                        "destination_address": target,
                        "is_known_vasp": is_target_vasp,
                        "steps": path_steps,
                        "flow_amount": total_flow
                    })
            except Exception:
                continue

        # Sort paths by hop count (shortest first)
        discovered_paths.sort(key=lambda p: p["hops"])
        return discovered_paths

    def find_cycles(self, source: str) -> List[List[str]]:
        """Detects circular fund movement loops"""
        matched = self._find_node(source)
        if not matched:
            return []
        source = matched
        try:
            simple_g = nx.DiGraph(self.g)
            cycles = list(nx.simple_cycles(simple_g))
            # Filter cycles involving source or reachable from source
            relevant = [c for c in cycles if source in c or len(c) <= 4]
            return relevant[:5]
        except Exception:
            return []

    def discover_money_flow_paths(
        self,
        root_wallet: str,
        max_hops: int = 3,
        direction: str = "both",
        min_value: Optional[float] = None,
        max_paths: int = 100
    ) -> List[List[str]]:
        """
        Discovers money-flow paths bounded by max_hops (cutoff) from/to root_wallet.
        Returns a list of address paths: e.g. [['0xA', '0xB'], ['0xA', '0xB', '0xC']]
        """
        matched = self._find_node(root_wallet)
        if not matched:
            return []
        norm_root = matched

        # Create simplified directed graph filtered by min_value if specified
        simple_g = nx.DiGraph()
        for u, v, data in self.g.edges(data=True):
            val = data.get("value_eth", data.get("amount", 0.0))
            if min_value is not None and val < min_value:
                continue
            simple_g.add_edge(u, v)

        if not simple_g.has_node(norm_root):
            return []

        discovered: List[List[str]] = []
        seen_tuples: Set[tuple] = set()

        # 1. Outgoing paths: root_wallet -> ... -> target
        if direction in ("outgoing", "both"):
            for target in simple_g.nodes():
                if target == norm_root:
                    continue
                try:
                    for path in nx.all_simple_paths(simple_g, source=norm_root, target=target, cutoff=max_hops):
                        p_tup = tuple(path)
                        if p_tup not in seen_tuples:
                            seen_tuples.add(p_tup)
                            discovered.append(path)
                            if len(discovered) >= max_paths:
                                break
                except Exception:
                    continue
                if len(discovered) >= max_paths:
                    break

        # 2. Incoming paths: source -> ... -> root_wallet
        if direction in ("incoming", "both") and len(discovered) < max_paths:
            for src in simple_g.nodes():
                if src == norm_root:
                    continue
                try:
                    for path in nx.all_simple_paths(simple_g, source=src, target=norm_root, cutoff=max_hops):
                        p_tup = tuple(path)
                        if p_tup not in seen_tuples:
                            seen_tuples.add(p_tup)
                            discovered.append(path)
                            if len(discovered) >= max_paths:
                                break
                except Exception:
                    continue
                if len(discovered) >= max_paths:
                    break

        # Sort paths by hop count (shorter paths first)
        discovered.sort(key=len)
        return discovered[:max_paths]

    def get_reachable_wallets(
        self,
        root_wallet: str,
        max_hops: int = 3,
        direction: str = "both"
    ) -> Dict[int, List[str]]:
        """
        Returns a mapping of {hop_level: [wallet_addresses]} reachable from/to root_wallet.
        """
        matched = self._find_node(root_wallet)
        if not matched:
            return {0: [root_wallet]}
        norm_root = matched

        hop_map: Dict[int, List[str]] = {0: [norm_root]}
        visited: Set[str] = {norm_root}
        queue = [(norm_root, 0)]

        while queue:
            curr, depth = queue.pop(0)
            if depth >= max_hops:
                continue

            neighbors = set()
            if direction in ("outgoing", "both"):
                neighbors.update(self.g.successors(curr))
            if direction in ("incoming", "both"):
                neighbors.update(self.g.predecessors(curr))

            for nbr in neighbors:
                if nbr not in visited:
                    visited.add(nbr)
                    next_depth = depth + 1
                    if next_depth not in hop_map:
                        hop_map[next_depth] = []
                    hop_map[next_depth].append(nbr)
                    queue.append((nbr, next_depth))

        return hop_map
