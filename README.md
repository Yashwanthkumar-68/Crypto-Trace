<h1 align="center"> 🛡️ CryptoTrace (SIH-2026 / ID: 26183) </h1>
<h3 align="center">Next-Generation Multi-Chain Forensic Intelligence, Cross-Border Evasion Countermeasures & Statutory Law Enforcement Automation Platform</h3>

<div align="center">

[![Python](https://img.shields.io/badge/Python-3.11%20%7C%203.12-3776AB?style=for-the-badge&logo=python&logoColor=white)](https://www.python.org/)
[![FastAPI](https://img.shields.io/badge/FastAPI-0.115+-009688?style=for-the-badge&logo=fastapi&logoColor=white)](https://fastapi.tiangolo.com/)
[![React](https://img.shields.io/badge/React-18%20%2B%20TypeScript-61DAFB?style=for-the-badge&logo=react&logoColor=black)](https://reactjs.org/)
[![Vite](https://img.shields.io/badge/Vite-5.4-646CFF?style=for-the-badge&logo=vite&logoColor=white)](https://vitejs.dev/)
[![TailwindCSS](https://img.shields.io/badge/TailwindCSS-3.4-38B2AC?style=for-the-badge&logo=tailwind-css&logoColor=white)](https://tailwindcss.com/)
[![PostgreSQL](https://img.shields.io/badge/PostgreSQL-Supabase%20Pooler-336791?style=for-the-badge&logo=postgresql&logoColor=white)](https://supabase.com/)
[![Gemini 1.5](https://img.shields.io/badge/AI-Google%20Gemini%201.5%20Pro-8E75C2?style=for-the-badge&logo=google&logoColor=white)](https://deepmind.google/technologies/gemini/)
[![MHA / I4C](https://img.shields.io/badge/Ministry%20of%20Home%20Affairs-I4C%20%2F%20NCRP-138808?style=for-the-badge)](https://i4c.mha.gov.in/)

[🎯 Problem Statement](#-smart-india-hackathon-sih-2026-sih26183) • [💡 Platform Architecture](#-system-architecture) • [✨ Complete Feature Matrix](#-core-features--innovations) • [⚖️ Indian Statutory Law Suite](#-statutory-legal-automation--admissibility) • [🚀 Quickstart](#-quickstart--installation) • [🧪 Testing](#-automated-testing--verification)

</div>

---

## 🎯 Smart India Hackathon (SIH-2026: SIH26183)

- **Problem Statement ID:** `SIH26183`
- **Nodal Ministry / Organization:** Ministry of Home Affairs (MHA) / Indian Cyber Crime Coordination Centre (I4C) / National Cyber Crime Reporting Portal (NCRP / 1930)
- **Theme:** Defensive Cybersecurity • Multi-Chain Forensic Tracing • Anti-Money Laundering (AML) • VASP Attribution

### The Investigative Bottleneck in Crypto Financial Fraud
When cyber syndicates orchestrate investment scams, task scams, phishing heists, or ransomware extortion, they exploit blockchain pseudo-anonymity through automated multi-layer obfuscation:

```
Victim Wallet ──> Suspect Mule ──> Dusting Attacks / Peel Chains ──> Cross-Chain Bridges / Mixers ──> Centralized Exchanges (VASP) ──> P2P Fiat Cashout
```

Traditional manual law enforcement workflows collapse due to **5 systemic failures**:
1. **The "Golden Hour" Delay:** Stolen assets are split and moved through automated scripts into Centralized Exchanges (VASPs) within **15 minutes**. Manual block explorer lookups take days—by which time funds are cashed out into fiat via P2P.
2. **Dusting Attacks & Graph Explosion:** Criminals flood wallets with hundreds of $0.01 micro-transactions to innocent celebrity/exchange wallets, intentionally crashing graph visualizers and blinding investigators with noise.
3. **Cross-Chain Bridge & Mixer Blindspots:** Hopping from Ethereum to Tron or dropping funds into privacy pools (e.g., Tornado Cash) breaks conventional single-chain tracing.
4. **Inter-Agency Silos:** Investigating officers across different states (e.g., Delhi, Maharashtra, Kerala) duplicate investigations on the same scam syndicate without knowing they share common mule wallets.
5. **Judicial Inadmissibility:** Unsubstantiated AI claims or unverified screenshots are rejected by courts. Evidence must strictly satisfy **Section 94 BNSS (2023)**, **Section 91 CrPC**, and **Section 65B of the Indian Evidence Act / Section 63 BSA**.

---

## 💡 Solution Overview: CryptoTrace

**CryptoTrace** is an end-to-end, zero-mock forensic intelligence operating system built for Law Enforcement Agencies (LEAs). It automates the entire investigation pipeline—from victim intake to court-admissible asset freezing notices—in under **60 seconds**.

```
+──────────────────────────────────────────────────────────────────────────────────────────────────────────+
|                                        CRYPTO-TRACE ARCHITECTURE                                         |
+──────────────────────────────────────────────────────────────────────────────────────────────────────────+
|                                                                                                          |
|   [NCRP 1930 / VICTIM INTAKE]  ───>  [DYNAMIC STATE-MACHINE AI COPILOT]                                  |
|   • Webhook / Audio Voice Rec        • Entity Extraction (Victim, Loss, Wallet, TXID, Scam Category)     |
|                                      • Automatic Case Dossier Initialization (SIH-2026-001)              |
|                                                               │                                          |
|                                                               ▼                                          |
|                                      [RECURSIVE MULTI-HOP ON-CHAIN TRACING]                              |
|                                      • 7+ Blockchains: ETH, BTC, TRX, MATIC, BNB, ARB, SOL               |
|                                      • Zero-Mock RPC & Indexer Fetching (Etherscan, TronGrid, Alchemy)   |
|                                                               │                                          |
|                  ┌────────────────────────────────────────────┴───────────────────────────────────────┐  |
|                  ▼                                                                                    ▼  |
|   [RED TEAM EVASION COUNTERMEASURES]                                                 [INTELLIGENCE & GRAPH]
|   • Anti-Dusting Mathematical Pruning                                                • Cytoscape.js Topology Canvas
|   • Mixer Black Hole Temporal Analysis                                               • Cross-Case Syndicate Clusters
|   • Cross-Chain Bridge Correlation Engine                                            • Scam Campaign Event Timeline
|                  │                                                                                    │  |
|                  └────────────────────────────────────────────┬───────────────────────────────────────┘  |
|                                                               ▼                                          |
|   [GEO JURISDICTIONS & LEA CO-INVESTIGATION] ──> [INDIAN STATUTORY LAW SUITE]                            |
|   • Leaflet VASP HQ & Branch Plotter             • 1-Click Sec 94 BNSS / 91 CrPC Freezing Notices        |
|   • Suspect IP Geolocation Resolver              • Section 65B Evidence Act Electronic Certificates      |
|   • Multi-Agency Collaboration Directory         • Tamper-Evident SHA-256 Vault & Formal ReportLab PDF   |
+──────────────────────────────────────────────────────────────────────────────────────────────────────────+
```

---

## ✨ Core Features & Innovations

### 1. 🎙️ Dynamic Context-Aware AI Voice & Chat Copilot
- **Voice-to-Dossier Intake**: Victims and desk officers can speak directly into the microphone. Powered by an adaptive **Dynamic State Machine** (Google Gemini 1.5), it dynamically conducts interviews without robotic rigid scripts.
- **Automated Entity Extraction**: Automatically isolates Victim Name, Phone, Loss in INR/Crypto, Suspect Wallets (EVM `0x...`, Tron `T...`, BTC `1.../3.../bc1...`), and TXIDs.
- **Autonomous Tool-Calling Agent**: The AI Copilot can execute real backend tools: trigger live traces, run anti-dust filters, verify wallet risk, and draft freeze notices.

### 2. ⛓️ Multi-Chain Forensic Tracing (7+ Chains)
- **Full Spectrum Blockchain Support**: Live querying across **Ethereum (ETH/ERC20)**, **Bitcoin (BTC)**, **Tron (TRC20 USDT)**, **Polygon (MATIC)**, **BNB Chain (BEP20)**, **Arbitrum**, and **Solana (SPL)**.
- **Zero Mocking**: Direct RPC and indexer querying via Etherscan, TronGrid, Blockchair, and Alchemy.
- **Recursive Multi-Hop Breadth-First-Search (BFS)**: Traces 1 to 5+ hops downstream, mapping complex layering pathways and peeling chains.

### 3. 🛡️ Advanced Evasion Countermeasures (Red Team vs Blue Team)
- **Anti-Dusting Mathematical Pruner**: Criminals spam hundreds of $0.01 micro-transactions to overwhelm visual graphs. CryptoTrace uses an adaptive volume threshold filter to prune noise edges and preserve the genuine money trail.
- **Mixer "Black Hole" Temporal Analysis**: Identifies deposits into anonymity pools (Tornado Cash, SunPump), computes swallowed capital, and cross-references withdrawal timing, relayer fees, and volume heuristics.
- **Cross-Chain Bridge Hop Correlation**: Detects decentralized bridge contract calls (Stargate, Across, Wormhole), matching slippage-adjusted values and cross-chain execution timestamps to resume the trace on the target network.

### 4. 🕸️ Interactive Visual Threat Graph
- **Cytoscape.js High-Performance Canvas**: Visualizes complex topologies with custom color-coded node taxonomy:
  - 🔴 *Suspect / Target Wallets*
  - 🔵 *Victim Wallets*
  - 🟣 *VASP Deposit Addresses & Exchange Off-Ramps*
  - 🟡 *Mixers, Smart Contracts & High-Risk Protocols*
  - 🟢 *Cold Storage & Liquidity Pools*
- **Edge Volume Inspection**: Click any edge to view the native token volume, USD equivalent, block height, timestamp, and block explorer link.

### 5. 👥 Multi-Agency Investigator Collaboration System
- **Cross-Agency Directory**: Displays available officers from **Cyber Cell Special Cell Delhi**, **Cyber Crime CID Mumbai**, **Kerala Cyberdome**, **Karnataka CID**, and the **Enforcement Directorate (ED)**.
- **Custom Invitations & Legal Presets**: Lead officers can invite colleagues with 1-click presets:
  - *"Requesting forensic chain-of-custody assistance for cross-border tracing"*
  - *"High-risk mixer activity detected; requesting urgent multi-agency review"*
  - *"Jurisdictional transfer request - suspect IP geolocated in your territorial area"*
- **Accepted Co-Investigation Rights**: When accepted, the backend authorizes both officers to co-investigate, view, edit, and trace the case.
- **Shared Team Notes & Immutable Audit Trail**: Real-time collaborative case notes and chronological activity logging.

### 6. 🗺️ Geo Jurisdictions & VASP Intelligence
- **Leaflet Geo Map with CSS/SVG Radar Pulse Markers**:
  - 🔴 **Red Radar Pulse**: Overseas VASP HQs (Binance Dubai HQ, Kraken San Francisco, OKX Seychelles).
  - 🔵 **Blue Radar Pulse**: Domestic Registered Offices (CoinDCX Mumbai, WazirX Mumbai, CoinSwitch Bengaluru).
  - 🟡 **Amber Radar Pulse**: Mixers & Non-Compliant Protocols (Tornado Cash Amsterdam).
  - 🟣 **Purple Radar Pulse**: Geolocated Suspect IP Addresses.
- **Suspect IP Geolocation Resolver**: Resolves suspect IPs captured from phishing server logs to physical coordinates, ISP, and ASN on the map.
- **Statutory Jurisdiction Legal Matrix**: Lists FIU-IND registration status, active bilateral treaties (e.g., India-UAE 1999 Treaty, US-India MLAT), verified subpoena channels, and compliance turnaround SLAs.

### 7. ⏰ Live 15s Monitoring Daemon & Alerting
- **`APScheduler` Background Daemon**: Polls monitored wallets across Ethereum and Tron every 15 seconds.
- **Multi-Channel Alerts**: Plays an audio siren and pushes instant in-app alerts when funds move toward an exchange.
- **SMS Dispatch**: Triggers automated SMS alerts via Twilio/Fast2SMS directly to the assigned investigator's phone.

### 8. 📊 Cross-Case Syndicate Correlation & Timeline
- **Syndicate Master File Generation**: Correlates independent FIRs registered across different states that share identical exchange deposit addresses or money-mule hops.
- **Scam Campaign Timeline**: Aligns on-chain fund spikes with real-world events (mass phishing SMS broadcasts, Telegram group launches, overseas regulatory freezes).

---

## ⚖️ Statutory Legal Automation & Admissibility

CryptoTrace is specifically tailored to the Indian Criminal Justice System:

```
+──────────────────────────────────────────────────────────────────────────────────────────────────────────+
|                                    STATUTORY LEGAL COMPLIANCE MATRIX                                     |
+──────────────────────────────────────────────────────────────────────────────────────────────────────────+
|  Statute & Provision             | Document Produced by CryptoTrace     | Legal Effect                  |
+──────────────────────────────────+──────────────────────────────────────+───────────────────────────────+
|  Section 94 BNSS (2023) /        | Formal Order to Produce & Freeze     | Compels VASP compliance desk  |
|  Section 91 CrPC                 | Target Account / Preserves KYC       | to freeze funds in 24 hours.  |
+──────────────────────────────────+──────────────────────────────────────+───────────────────────────────+
|  Section 65B Indian Evidence Act /| Digital Electronic Record Certificate| Validates hash integrity and  |
|  Section 63 BSA (2023)           | with SHA-256 Checksums & Timestamps  | makes trace court-admissible. |
+──────────────────────────────────+──────────────────────────────────────+───────────────────────────────+
|  Mutual Legal Assistance Treaty  | Diplomatic Letters Rogatory via MHA  | Obtains foreign KYC from      |
|  (MLAT) Framework                | International Judicial Assistance    | non-domestic exchanges.       |
+──────────────────────────────────+──────────────────────────────────────+───────────────────────────────+
|  FATF Recommendation 15/16       | Originator & Beneficiary VASP Dossier| Enforces Travel Rule tracing. |
+──────────────────────────────────+──────────────────────────────────────+───────────────────────────────+
```

### Four-Tier Forensic Truth Taxonomy
- 🟢 **`BLOCKCHAIN FACT`**: Cryptographically immutable on-chain records (TX hash, block height, amounts, gas, addresses).
- 🔵 **`SYSTEM INFERENCE`**: Algorithmic pattern detection (peeling chains, anti-dust pruning, temporal correlations).
- 🟡 **`OSINT INTELLIGENCE`**: Sourced from open-source threat intelligence, scam databases, or user reports.
- 🟣 **`INVESTIGATOR DECISION`**: Human officer actions, supervisor approvals, and sealed evidence locker tags.

---

## 🏛️ System Architecture

```
+──────────────────────────────────────────────────────────────────────────────────────────────────+
|                                   PRESENTATION LAYER (VITE + REACT 18)                           |
|  • Responsive LEA Dashboard     • Cytoscape.js Threat Graph Canvas • Geo Jurisdictions Map      |
|  • Voice Copilot Intake Modal   • Collaboration Directory & Notes  • Evidence Vault & PDF Export |
+───────────────────────────────────┬──────────────────────────────────────────────────────────────+
                                    │ Axios REST / WebSockets / TLS
                                    ▼
+──────────────────────────────────────────────────────────────────────────────────────────────────+
|                               API & AUTHENTICATION GATEWAY (FASTAPI)                             |
|  • JWT Authentication Engine    • Role-Based Access Control (RBAC) • Tamper-Evident Audit Logging|
|  • NCRP 1930 Webhook Gateway    • Real-Time Graph Traversal API    • Statutory Notice Generator  |
+───────────────────────────────────┬──────────────────────────────────────────────────────────────+
                                    │
         ┌──────────────────────────┴──────────────────────────┐
         ▼                                                     ▼
+───────────────────────────────────+ +────────────────────────────────────────────────────────────+
|     FORENSIC ANALYTICS CORE       | |             BLOCKCHAIN & INGESTION ENGINE                  |
|  • NetworkX Graph Builder         | |  • Multi-Chain RPC Client (ETH, BTC, TRX, MATIC, BNB, SOL) |
|  • Anti-Dusting Pruning Engine    | |  • Zero-Mock Live Indexer (Etherscan, TronGrid, Alchemy)   |
|  • Bridge Correlation Engine      | |  • Address Checksum Normalization (EIP-55, Base58Check)    |
|  • APScheduler Daemon (15s Poll)  | |  • Dynamic VASP Attribution & Address Labeling             |
+─────────────────┬─────────────────+ +────────────────────────────┬───────────────────────────────+
                  │                                                │
                  └─────────────────────────┬──────────────────────┘
                                            ▼
+──────────────────────────────────────────────────────────────────────────────────────────────────+
|                                   DATA & PERSISTENCE LAYER                                       |
|  • Supabase PostgreSQL (SSL Transaction Pooler) / SQLite Local Fallback                          |
|  • SQLAlchemy ORM 2.0 (Relational Entities: Cases, Assignments, Evidence, Activity, Notes)       |
+──────────────────────────────────────────────────────────────────────────────────────────────────+
```

---

## 🛠️ Complete Technology Stack

| Layer | Technologies Used | Purpose |
| :--- | :--- | :--- |
| **Backend Core** | `Python 3.11/3.12`, `FastAPI`, `Uvicorn` | Asynchronous, high-throughput REST API backend |
| **Graph Intelligence** | `NetworkX`, `NumPy`, `SciPy` | Directed multigraph construction, multi-hop pathfinding |
| **AI & NLP** | `Google Gemini 1.5 Pro / Flash`, `Google GenAI` | Dynamic state-machine voice assistant & autonomous tool agent |
| **Blockchain Clients** | `Web3.py`, `TronGrid API`, `Etherscan API`, `Blockchair` | Real-time multi-chain RPC verification & transaction retrieval |
| **Frontend Core** | `React 18`, `TypeScript`, `Vite` | High-performance, type-safe forensic investigator dashboard |
| **Graph Canvas** | `Cytoscape.js`, `React Flow` | Interactive fund-flow money trail visualization |
| **Geo Mapping** | `Leaflet`, `React-Leaflet`, `OpenStreetMap` | Physical VASP coordinates, radar markers & IP geolocation |
| **Styling & Icons** | `Tailwind CSS`, `Lucide React` | High-contrast law enforcement dark/light UI design system |
| **Database & ORM** | `PostgreSQL (Supabase)`, `SQLAlchemy 2.0` | Secure relational storage with SSL pooling |
| **Task Daemon** | `APScheduler` | Background daemon polling monitored wallets every 15s |
| **Dossier & Forensics** | `ReportLab`, `Python Hashlib (SHA-256)` | Automated court-ready PDF generation & digital evidence hashing |

---

## 👥 Pre-Configured Test Personas

For instant evaluation, the platform includes pre-seeded demonstration credentials with 1-click login buttons on the login screen:

| Persona | Username | Password | Department / Role |
| :--- | :--- | :--- | :--- |
| 🕵️ **Inspector Vikram Malhotra** | `investigator` | `password123` | Lead Investigator (Cyber Crime Police Station) |
| 🛡️ **SP Sunita Rao** | `supervisor` | `password123` | Supervisory Officer (Superintendent of Police) |
| 🔍 **SI Priya Nair** | `priya_nair` | `password123` | Co-Investigator (Cyber Cell CID Mumbai) |
| ⚙️ **System Administrator** | `admin` | `password123` | Platform Admin (Manages VASP labels & audit logs) |
| 👤 **Rahul Sharma** | `victim` | `password123` | Victim (Lodges complaints via Voice Copilot) |

---

## 🚀 Quickstart & Installation

### Prerequisites
- **Python:** 3.11 or 3.12 installed
- **Node.js:** v18.0+ and `npm` installed
- **Git:** installed and configured

### 1. Clone the Repository
```bash
git clone https://github.com/Yashwanthkumar-68/Crypto-Trace.git
cd Crypto-Trace
```

### 2. Backend Setup
```bash
cd backend

# Create and activate virtual environment
# Windows:
python -m venv venv
.\venv\Scripts\Activate.ps1
# Linux / macOS:
# python3 -m venv venv && source venv/bin/activate

# Install dependencies
pip install -r requirements.txt

# Start FastAPI development server
uvicorn app.main:app --reload --port 8000
```
- **Backend API:** `http://127.0.0.1:8000`
- **Interactive Swagger Documentation:** `http://127.0.0.1:8000/docs`

### 3. Frontend Setup
```bash
# Open a new terminal in the project root
cd frontend

# Install dependencies
npm install

# Start Vite development server
npm run dev
```
- **Web Application:** `http://127.0.0.1:5173`

---

## 🧪 Automated Testing & Verification

CryptoTrace includes automated test suites covering cryptographic parsing, graph traversal, anti-dust pruning, and risk scoring:

```bash
cd backend
pytest -v
```

### Passing Test Suites:
- `test_ethereum_address_validation` - Validates EIP-55 checksums and invalid hex rejection
- `test_transaction_normalization` - Verifies raw RPC data normalization into forensic schemas
- `test_cross_chain_bridge_detection` - Validates Polygon PoS & Across bridge contract matching
- `test_auth_and_login` - Tests JWT access token generation and RBAC authorization
- `test_graph_builder_and_k_hop` - Verifies NetworkX graph construction and multi-hop extraction
- `test_path_tracing_to_vasp` - Validates shortest simple path discovery terminating at VASP hot wallets
- `test_rapid_movement_rule` - Verifies sub-15-minute fund exit detection
- `test_fund_splitting_rule` - Tests 1-to-many peeling chain identification
- `test_risk_explainability_scoring` - Verifies 0–100 score bounds and dynamic factor breakdowns
- `test_sih_hackathon_demo_flow` - Validates end-to-end hackathon demonstration workflow

---

## 📄 License & Team

This project is licensed under the **MIT License** - see the [LICENSE](LICENSE) file for details.

Developed with pride for the **Smart India Hackathon 2026 (SIH26183)** by **Team ByteBuilders** to empower Indian Law Enforcement Agencies in combating cryptocurrency cybercrime.
