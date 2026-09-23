# CryptoTrace Multi-Agent Task Registry (`TASKS.md`)

This file tracks all engineering tasks across specialized AI agents. Every task must be assigned to an agent, linked to an isolated worktree/branch, and anchored to a verified rollback commit SHA.

---

## Status Legend
- `[TODO]` — Planned, dependencies identified, ready for pickup
- `[IN_PROGRESS]` — Currently being implemented in agent worktree
- `[UNDER_REVIEW]` — Implementation done; awaiting peer/security/orchestrator review
- `[TESTING]` — In verification by QA / Testing agent
- `[DONE]` — Verified, regression tested, merged to `multi-agent/main`
- `[BLOCKED]` — Waiting on upstream dependency or decision
- `[ROLLED_BACK]` — Reverted due to failures; post-mortem documented

---

## Active Task Backlog: 8-Phase Platform Enhancement

| Task ID | Phase | Title | Assigned Agent | Target Branch / Worktree | Priority | Dependencies | Status | Rollback SHA |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| **TSK-P1-01** | Phase 1 | Real-Time Alerts Backend & WebSocket API | Backend Agent | `agent/codex` | Critical | None | `2e0ef29` | `[TODO]` |
| **TSK-P1-02** | Phase 1 | Toast Notifications & WebSocket Hook UI | Frontend Agent | `agent/gemini` | Critical | TSK-P1-01 | `2e0ef29` | `[TODO]` |
| **TSK-P1-03** | Phase 1 | Real-Time Alert QA & Integration Tests | QA Agent | `agent/claude` | High | TSK-P1-02 | `2e0ef29` | `[TODO]` |
| **TSK-P2-01** | Phase 2 | Bitcoin & Solana Adapters & Validation | Blockchain Agent| `agent/claude` | High | Phase 1 | `2e0ef29` | `[TODO]` |
| **TSK-P2-02** | Phase 2 | Multi-Chain Explorer UI & Case Intake | Frontend Agent | `agent/gemini` | High | TSK-P2-01 | `2e0ef29` | `[TODO]` |
| **TSK-P3-01** | Phase 3 | Advanced Analytics Service & Aggregation | Backend / ML | `agent/codex` | Medium | Phase 2 | `2e0ef29` | `[TODO]` |
| **TSK-P3-02** | Phase 3 | Analytics Dashboard & Recharts UI | Frontend Agent | `agent/gemini` | Medium | TSK-P3-01 | `2e0ef29` | `[TODO]` |
| **TSK-P4-01** | Phase 4 | Team Collaboration & Mentions Models/API| Backend Agent | `agent/codex` | Medium | Phase 3 | `2e0ef29` | `[TODO]` |
| **TSK-P4-02** | Phase 4 | Collaboration Panel & Activity Feed UI | Frontend Agent | `agent/gemini` | Medium | TSK-P4-01 | `2e0ef29` | `[TODO]` |
| **TSK-P5-01** | Phase 5 | Mobile-Responsive Layout & Touch Targets| Frontend Agent | `agent/gemini` | Medium | Phase 4 | `2e0ef29` | `[TODO]` |
| **TSK-P5-02** | Phase 5 | PWA Manifest & Service Worker Offline | Frontend / DevOps| `multi-agent/main`| Medium | TSK-P5-01 | `2e0ef29` | `[TODO]` |
| **TSK-P6-01** | Phase 6 | CSV Batch Processing & Validation Engine| Backend Agent | `agent/codex` | Medium | Phase 5 | `2e0ef29` | `[TODO]` |
| **TSK-P6-02** | Phase 6 | Batch Analysis Page & Results Exporter | Frontend Agent | `agent/gemini` | Medium | TSK-P6-01 | `2e0ef29` | `[TODO]` |
| **TSK-P7-01** | Phase 7 | Geolocation Intel Service & VASP Registry| Backend Agent | `agent/codex` | Medium | Phase 6 | `2e0ef29` | `[TODO]` |
| **TSK-P7-02** | Phase 7 | Leaflet Interactive World GeoMap UI | Frontend Agent | `agent/gemini` | Medium | TSK-P7-01 | `2e0ef29` | `[TODO]` |
| **TSK-P8-01** | Phase 8 | Asyncio Scheduled Monitoring Engine | Backend / DevOps| `agent/codex` | Medium | Phase 7 | `2e0ef29` | `[TODO]` |
| **TSK-P8-02** | Phase 8 | Scheduler Dashboard & Diff View UI | Frontend Agent | `agent/gemini` | Medium | TSK-P8-01 | `2e0ef29` | `[TODO]` |

---

## Completed Tasks Archive
- **TSK-001**: Multi-Agent Coordination Infrastructure Setup (`[DONE]`, 2026-09-20)
