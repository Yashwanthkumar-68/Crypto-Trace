# CryptoTrace Living System Architecture (`ARCHITECTURE.md`)

This document defines the high-level system components, interface boundaries, and data contracts for CryptoTrace. All agents must build in compliance with these specifications.

---

## 1. System Topology

```
+-------------------------------------------------------------------------------+
|                       React + TypeScript Frontend                             |
|   (Investigation Dashboard, GraphExplorer, MoneyTrailTimeline, CopilotDrawer) |
+-------------------------------------------------------------------------------+
                                       │
                                   REST / JSON
                                       ▼
+-------------------------------------------------------------------------------+
|                        FastAPI Forensic Backend                               |
|   +-------------------+  +--------------------+  +------------------------+   |
|   | Auth & RBAC (JWT) |  | Case Management    |  | Evidence Locker        |   |
|   +-------------------+  +--------------------+  +------------------------+   |
|   +-------------------+  +--------------------+  +------------------------+   |
|   | Watchlist & Alert |  | Forensic Reports   |  | Audit Trail Logging    |   |
|   +-------------------+  +--------------------+  +------------------------+   |
+-------------------------------------------------------------------------------+
             │                                    │
             ▼                                    ▼
+-----------------------------+     +-----------------------------+
|    Blockchain Layer         |     |      Database Layer         |
|  - Ethereum Sepolia         |     |  - Supabase PostgreSQL      |
|  - Ethereum Mainnet (R/O)   |     |  - Local SQLite fallback    |
|  - Polygon PoS Engine       |     |  - Evidence SHA-256 hashes  |
|  - BNB Smart Chain Engine   |     |  - User roles & audit trails|
|  - Cross-Chain Bridge Intel |     +-----------------------------+
+-----------------------------+
             │
             ▼
+-------------------------------------------------------------------------------+
|                          Analytics & Intelligence                             |
|  - NetworkX Directed Multigraph (Path Tracing to Destination Exchanges)       |
|  - Heuristic Pattern Evaluation (11 Rules: Rapid Exit, Peeling, Structuring)  |
|  - Random Forest Risk Scoring (0–100 Score with Feature Explainability)       |
|  - Priority Subpoena Engine (Multi-criteria ranking of 500+ Wallets)          |
|  - Investigator Copilot (Context-grounded assistant for case dossiers)        |
+-------------------------------------------------------------------------------+
```

---

## 2. Component Boundaries & Responsibilities

### Frontend (`frontend/src/`)
- **Technologies**: React 18, Vite, TypeScript, Tailwind CSS, Lucide icons.
- **Key Modules**:
  - `components/GraphExplorer.tsx`: Interactive SVG/Canvas multi-hop relationship visualizer.
  - `components/MoneyTrailTimeline.tsx`: Hop-by-hop chronological flow of illicit funds.
  - `components/CopilotDrawer.tsx`: In-context conversational AI investigative assistant.
  - `pages/InvestigatorDashboardPage.tsx` & `CaseDetailPage.tsx`: Primary case management views.

### Backend (`backend/app/`)
- **Technologies**: Python 3.13, FastAPI, SQLAlchemy 2.0, Pydantic v2.
- **Key Modules**:
  - `api/`: REST API endpoints organized by domain (auth, cases, wallets, transactions, graph, priority, reports).
  - `database/models.py`: Relational schema definitions (`User`, `Case`, `Wallet`, `Transaction`, `Evidence`, `RiskAssessment`, `AuditLog`).
  - `services/`: Core business logic (`CaseService`, `TimelineService`, `MonitoringService`).

### Blockchain Forensics (`backend/app/blockchain/`)
- **Technologies**: Web3.py, resilient RPC fallback client, transaction parser.
- **Key Modules**:
  - `ethereum.py`, `polygon.py`, `bnb.py`: Chain-specific providers.
  - `cross_chain.py`: Bridge deposit/withdrawal signature identification.
  - `chain_registry.py`: Supported network metadata and status tracking.

### Machine Learning & Risk Intelligence (`backend/app/risk/` & `ml/`)
- **Technologies**: Scikit-learn, joblib, NetworkX, Pandas, NumPy.
- **Key Modules**:
  - `ml/models/risk_rf_model.joblib`: Pre-trained Random Forest classifier.
  - `app/risk/risk_service.py`: Computes 0–100 risk score combining heuristics and ML predictions.
  - `app/analysis/pattern_rules.py`: Heuristic detectors for peeling chains, fund splitting, and mixing patterns.
  - `app/priority/`: Priority queue engine scoring suspect wallets for legal intervention.

---

## 3. Data & API Contracts

- **Base URL**: `/api` (with backwards-compatible root router aliases).
- **Authentication**: Bearer JWT tokens in `Authorization` header.
- **Standardized Response Envelopes**:
  - All responses return structured JSON with typed attributes matching Pydantic schemas in `backend/app/database/schemas.py`.
- **Truth Categorization**: Every intelligence payload must carry its respective `TruthLevel` field.
