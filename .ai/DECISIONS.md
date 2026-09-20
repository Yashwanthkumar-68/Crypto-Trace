# CryptoTrace Architecture Decision Records (`DECISIONS.md`)

All architectural, schema, and procedural decisions that agents must adhere to are documented here.

---

## ADR Index
- **ADR-001**: Multi-Agent Worktree Isolation and File-Based Handoff Protocol
- **ADR-002**: 4-Tier Truth Taxonomy for Forensic Output
- **ADR-003**: Safe Database Interaction & Test Isolation Standards

---

## ADR-001: Multi-Agent Worktree Isolation and File-Based Handoff Protocol
- **Date**: 2026-09-20
- **Status**: ACCEPTED
- **Context**: 
  CryptoTrace is developed by multiple specialized AI agents (Claude Code, Antigravity, Gemini CLI, OpenAI Codex). These agents operate across distinct processes without a shared memory bus.
- **Decision**:
  1. Each agent operates exclusively within its designated Git worktree (`Crypto-Trace-Claude/`, `Crypto-Trace-Codex/`, `Crypto-Trace-Gemini/`) on its dedicated branch (`agent/claude`, `agent/codex`, `agent/gemini`).
  2. Direct communication occurs asynchronously through `.ai/HANDOFFS/` using a standardized markdown format.
  3. No agent may merge directly into `multi-agent/main` or `main`. The Lead Orchestrator reviews the handoff, verifies test evidence, and manages integration.
  4. Before executing any code changes, the starting commit SHA must be recorded in `TASKS.md` as the rollback anchor.
- **Consequences**:
  Prevents file collisions, protects production stability, ensures transparent accountability, and enables clean rollbacks if regressions occur.

---

## ADR-002: 4-Tier Truth Taxonomy for Forensic Output
- **Date**: 2026-09-20
- **Status**: ACCEPTED
- **Context**: 
  Law enforcement and judicial admissibility require strict segregation between immutable on-chain facts and predictive ML inferences.
- **Decision**:
  All platform outputs, UI elements, API responses, and generated PDF reports must strictly classify information into one of four tiers:
  1. `BLOCKCHAIN FACT` (Emerald / Cyan): Cryptographic on-chain ground truth (block number, transaction hash, timestamp, native amounts).
  2. `SYSTEM INFERENCE` (Amber / Yellow): Algorithmic heuristics and rule evaluations (rapid exit, peel structuring, fan-out bursts).
  3. `AI ASSESSMENT` (Purple / Violet): Machine learning probability scores, clustering inferences, and subpoena candidate rankings.
  4. `INVESTIGATOR DECISION` (Blue / Indigo): Human officer annotations, manual tags, supervisor approvals, and legal notices.
- **Consequences**:
  Agents must never present model inferences or heuristic flags as confirmed blockchain facts.

---

## ADR-003: Safe Database Interaction & Test Isolation Standards
- **Date**: 2026-09-20
- **Status**: ACCEPTED
- **Context**: 
  The backend connects to Supabase PostgreSQL in production/remote and SQLite in local environments. Tests running against relational databases must maintain referential integrity.
- **Decision**:
  1. Foreign keys must be honored. Any deletion of parent records (`cases`, `wallets`) must explicitly delete or cascade child dependencies (`evidence`, `risk_assessments`, `notes`, `case_transactions`).
  2. Tests must use isolated transaction rollbacks or unique test case IDs with clean teardown to prevent test suite cross-contamination.
  3. Secrets and `.env` files must never be committed to Git.
- **Consequences**:
  Ensures zero foreign key violations during automated test suites and prevents credential leakage.
