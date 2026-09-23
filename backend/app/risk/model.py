import os
import joblib
import numpy as np
from pathlib import Path
from typing import Dict, Any, List, Optional
try:
    from sklearn.ensemble import RandomForestClassifier
    SKLEARN_AVAILABLE = True
except Exception:
    RandomForestClassifier = None
    SKLEARN_AVAILABLE = False

MODEL_PATH = Path(__file__).resolve().parent.parent.parent.parent / "ml" / "models" / "risk_rf_model.joblib"

class MLRiskClassifier:
    """
    Modular Machine Learning risk prediction layer using scikit-learn.
    Does NOT replace transparent rule-based scoring.
    Trained on synthetic demonstration topologies without unverified real-world accuracy claims.
    """
    FEATURE_NAMES = [
        # Baseline features
        "transaction_count",
        "unique_counterparties",
        "incoming_value",
        "outgoing_value",
        "transaction_frequency",
        "wallet_activity_duration",
        "hop_count",
        "fund_splitting_score",
        "fund_concentration_score",
        "high_risk_connections",
        "cross_chain_indicator",
        "rapid_movement_indicator",

        # Structural Graph Features
        "betweenness_centrality",
        "pagerank_score",
        "clustering_coefficient",
        "k_core_number",
        "eigenvector_centrality",
        "in_degree_ratio",
        "out_degree_ratio",

        # Temporal Behavioral Features
        "tx_hour_entropy",
        "inter_tx_interval_mean",
        "inter_tx_interval_std",
        "day_of_week_concentration",
        "velocity_delta_7d",
        "dormancy_score",

        # DeFi-Specific Features
        "defi_protocol_diversity",
        "flash_loan_count",
        "liquidity_pool_interaction",
        "nft_transaction_ratio",
        "gas_price_percentile",

        # Cross-Chain Features
        "bridge_outflow_ratio",
        "multi_chain_presence_score",
        "chain_hop_frequency",

        # Risk-Cluster Features (GNN Output)
        "mixer_cluster_proximity",
        "exchange_cluster_proximity",
        "scam_cluster_proximity"
    ]

    MODEL_NAME = "RandomForestClassifier"
    MODEL_VERSION = "2.0.0-multidimensional"

    def __init__(self, auto_init: bool = True):
        self.model: Optional[RandomForestClassifier] = None
        if auto_init:
            self._load_or_train_baseline()

    def _load_or_train_baseline(self):
        if not SKLEARN_AVAILABLE:
            self.model = None
            return
        MODEL_PATH.parent.mkdir(parents=True, exist_ok=True)
        if MODEL_PATH.exists():
            try:
                loaded = joblib.load(MODEL_PATH)
                if hasattr(loaded, "n_features_in_") and loaded.n_features_in_ == len(self.FEATURE_NAMES):
                    self.model = loaded
                    return
            except Exception:
                pass

        try:
            # Train transparent synthetic demonstration baseline model
            np.random.seed(42)
            n_samples = 400
            n_features = len(self.FEATURE_NAMES)

            # Baseline mean vectors for normal vs suspicious profiles
            normal_locs = [
                10, 8, 1.0, 0.8, 0.1, 100.0, 1.0, 0.1, 0.1, 0.0, 0.0, 0.0,  # Baseline 12
                0.01, 0.05, 0.1, 1.0, 0.05, 0.4, 0.4,                      # Structural
                3.5, 3600.0, 500.0, 0.25, 1.0, 10.0,                       # Temporal
                1.0, 0.0, 0.0, 0.05, 0.3,                                  # DeFi
                0.0, 1.0, 0.0,                                             # Cross-chain
                0.0, 0.2, 0.0                                              # GNN clusters
            ]
            normal_scales = [0.1 * l + 0.01 for l in normal_locs]

            suspicious_locs = [
                40, 25, 15.0, 14.8, 2.5, 5.0, 3.5, 0.8, 0.2, 1.5, 0.5, 0.9, # Baseline 12
                0.25, 0.35, 0.65, 4.0, 0.45, 0.7, 0.8,                     # Structural
                1.2, 120.0, 30.0, 0.65, 4.5, 120.0,                        # Temporal
                4.0, 2.0, 5.0, 0.4, 0.85,                                  # DeFi
                0.75, 3.0, 2.5,                                            # Cross-chain
                0.85, 0.6, 0.75                                            # GNN clusters
            ]
            suspicious_scales = [0.15 * l + 0.02 for l in suspicious_locs]

            normal_feats = np.random.normal(
                loc=normal_locs,
                scale=normal_scales,
                size=(n_samples // 2, n_features)
            )
            normal_feats = np.clip(normal_feats, 0, None)
            normal_labels = np.zeros(n_samples // 2)

            suspicious_feats = np.random.normal(
                loc=suspicious_locs,
                scale=suspicious_scales,
                size=(n_samples // 2, n_features)
            )
            suspicious_feats = np.clip(suspicious_feats, 0, None)
            suspicious_labels = np.ones(n_samples // 2)

            X = np.vstack([normal_feats, suspicious_feats])
            y = np.concatenate([normal_labels, suspicious_labels])

            rf = RandomForestClassifier(n_estimators=50, max_depth=6, random_state=42)
            rf.fit(X, y)
            self.model = rf
            joblib.dump(rf, MODEL_PATH)
        except Exception:
            self.model = None

    def is_available(self) -> bool:
        return self.model is not None

    def predict_risk(self, feature_dict: Dict[str, float]) -> Dict[str, Any]:
        """
        Runs RF inference and extracts top contributing features.
        Gracefully handles missing model without throwing exceptions.
        """
        if not self.model:
            return {
                "model_available": False,
                "model_name": self.MODEL_NAME,
                "model_version": self.MODEL_VERSION,
                "reason": "No validated model is configured.",
                "rule_based_risk_available": True
            }

        try:
            vector = [float(feature_dict.get(feat, 0.0)) for feat in self.FEATURE_NAMES]
            probs = self.model.predict_proba([vector])[0]
            suspicious_prob = float(probs[1]) if len(probs) > 1 else float(probs[0])

            importances = self.model.feature_importances_
            feature_contributions = []
            for name, val, imp in zip(self.FEATURE_NAMES, vector, importances):
                feature_contributions.append({
                    "feature": name,
                    "value": round(float(val), 4),
                    "model_importance": round(float(imp), 4)
                })

            feature_contributions.sort(key=lambda x: x["model_importance"], reverse=True)

            prediction_label = "ELEVATED_ANALYTIC_RISK" if suspicious_prob >= 0.5 else "BASELINE_PROFILE"

            explanations = [
                f"Top contributing feature: {f['feature']} (value: {f['value']}, weight: {f['model_importance']})"
                for f in feature_contributions[:3]
            ]

            return {
                "model_available": True,
                "model_name": self.MODEL_NAME,
                "model_version": self.MODEL_VERSION,
                "prediction": prediction_label,
                "ml_risk_probability": round(suspicious_prob, 4),
                "suggested_score_contribution": round(suspicious_prob * 25.0, 1),
                "feature_importance": feature_contributions[:5],
                "explanation": explanations,
                "rule_based_risk_available": True
            }
        except Exception as e:
            return {
                "model_available": False,
                "model_name": self.MODEL_NAME,
                "model_version": self.MODEL_VERSION,
                "reason": f"Inference error: {str(e)}",
                "rule_based_risk_available": True
            }
