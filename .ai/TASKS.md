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

## Active Task Backlog

| Task ID | Title | Assigned Agent | Target Branch / Worktree | Priority | Dependencies | Status | Rollback SHA |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| **TSK-001** | Multi-Agent Coordination Infrastructure Setup | Lead Orchestrator | `multi-agent/main` | High | None | `[DONE]` | `983b3b0` |
| **TSK-002** | Cascade foreign key cleanup fix in `test_phase11_monitoring_reports.py` | Backend Agent / QA Agent | `agent/codex` | Medium | TSK-001 | `[TODO]` | `983b3b0` |
| **TSK-003** | RPC client mock/cache layer for resilient local offline testing | Blockchain Agent | `agent/claude` | Medium | TSK-001 | `[TODO]` | `983b3b0` |
| **TSK-004** | Pydantic V2 migration for deprecation warnings (`ConfigDict`) | Backend Agent | `agent/codex` | Low | TSK-001 | `[TODO]` | `983b3b0` |
| **TSK-005** | Datetime UTC modernization (`datetime.now(datetime.UTC)`) | Backend Agent | `agent/codex` | Low | TSK-001 | `[TODO]` | `983b3b0` |

---

## Completed Tasks Archive

### TSK-001: Multi-Agent Coordination Infrastructure Setup
- **Agent**: Lead Orchestrator
- **Completed**: 2026-09-20
- **Summary**: Established `.ai/` directory containing `TASKS.md`, `PROGRESS.md`, `DECISIONS.md`, `ARCHITECTURE.md`, and `HANDOFFS/`. Added multi-agent worktrees to `.gitignore`. Verified frontend build and backend test baseline.
