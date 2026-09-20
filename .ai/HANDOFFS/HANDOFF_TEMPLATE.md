# Agent Handoff: [TASK-ID] — [Task Title]

**Date**: YYYY-MM-DD  
**From Agent**: [Sender Agent Role, e.g., Backend Agent]  
**To Agent**: [Recipient Agent Role, e.g., Frontend Agent / QA Agent]  
**Branch / Worktree**: `agent/[branch-name]` (`Crypto-Trace-[Agent]`)  
**Commit SHA**: `[commit-hash]`  
**Baseline Rollback SHA**: `[rollback-hash]`  

---

## 1. Task Objective
[Brief explanation of what was built, fixed, or modified.]

---

## 2. Components & Files Modified
- `path/to/file1.py`: [Brief summary of change]
- `path/to/file2.tsx`: [Brief summary of change]

---

## 3. Data & API Contracts
[Describe any new endpoints, modified request/response schemas, database columns, or payload structures.]

```json
{
  "example_field": "string",
  "data": {}
}
```

---

## 4. Dependencies & Prerequisites
- [Upstream dependencies, environment variables, or package updates required.]

---

## 5. Tests Performed & Evidence
- **Automated Tests**: [e.g., pytest backend/tests/test_foo.py]
- **Result**: [PASS / FAIL (Attach output snippet)]
- **Manual Verification**: [Steps taken to test manually]

---

## 6. Known Limitations & Edge Cases
- [Any known edge cases, temporary stubs, or performance considerations.]

---

## 7. Recommended Next Actions for Receiving Agent
- [Step 1: Receive this handoff and pull branch or inspect diff]
- [Step 2: Implement dependent UI/API/Test]
- [Step 3: Run regression suite]
