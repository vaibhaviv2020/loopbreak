# LoopBreak Work Plan

## Objective

Build a reliable MVP and demo before adding optional features.

## Priority Order

```text
1. AWS setup
2. DynamoDB
3. Lambda API
4. Deterministic loop detection
5. Bedrock reasoning
6. Memory storage
7. Memory recall
8. React Debug Session
9. React Debug Memory
10. End-to-end integration
11. Demo polish
12. Optional semantic matching
```

# Team Split

## Person 1 — AWS + Backend

Own:

- AWS project setup
- IAM role
- Lambda
- DynamoDB
- environment configuration
- backend API
- deterministic fingerprinting
- loop detection
- memory storage
- memory recall
- deployment
- backend integration foundation

Deliverable:

```text
Frontend can call Lambda to:

• detect repeated investigation
• trigger Bedrock analysis
• store completed debugging memory
• recall prior debugging memory
```

Do not build frontend features.

## Person 2 — Bedrock + Reasoning

Own:

- Bedrock model access
- prompt design
- structured output
- evidence-driven analysis
- ruled-out hypotheses
- next investigation
- root-cause/fix output
- `/analyze` implementation

Deliverable:

```text
POST /analyze
        ↓
Amazon Bedrock
        ↓
structured debugging JSON
```

The model must not invent evidence.

## Person 3 — Frontend

### Screen 1 — Debug Session

Show:

- project/component
- error
- attempt timeline
- failed hypotheses
- loop detected
- evidence
- Bedrock reasoning
- next investigation
- fix
- verification

### Screen 2 — Debug Memory

Show:

- prior debugging session
- failed hypotheses
- evidence
- root cause
- fix
- verification
- why this memory is relevant

Deliverable:

A polished UI that makes Agent A → Agent B immediately understandable.

## Person 4 — Integration + Demo

Own:

- connect frontend to backend
- Agent A → Agent B flow
- deterministic demo data
- end-to-end testing
- architecture presentation
- demo script
- submission checklist

Test every claim shown in the UI.

Never fabricate percentages, token savings, benchmark results, or eliminated attempts.

# Integration Contract

The backend exposes:

```text
POST /attempt
POST /analyze
POST /memory
GET  /recall
```

## Attempt

`POST /attempt` performs stateless deterministic loop detection.

It does not write attempts to DynamoDB.

The React frontend owns the current session's fingerprint list and sends it as `prior_fingerprints`.

Request:

```json
{
  "session_id": "session-a",
  "repo_id": "checkout-demo",
  "component": "checkoutService",
  "error": "Checkout request failed",
  "hypothesis": "Database connection timeout",
  "hypothesis_category": "database",
  "change": "Increase DB timeout",
  "result": "failed",
  "evidence": "Database query succeeds",
  "prior_fingerprints": []
}
```

Response:

```json
{
  "success": true,
  "fingerprint": "string",
  "loop_detected": false,
  "updated_fingerprints": [
    "string"
  ]
}
```

## Analysis

`POST /analyze` receives the complete current-session attempt list.

```json
{
  "session_id": "session-a",
  "repo_id": "checkout-demo",
  "component": "checkoutService",
  "attempts": []
}
```

Expected structured reasoning:

```json
{
  "ruled_out": [
    {
      "hypothesis": "Database connection timeout",
      "reason": "Database operations succeeded"
    }
  ],
  "evidence": [
    "Database query succeeds",
    "Payment service response takes 3.8 seconds"
  ],
  "next_investigation": "Payment client timeout",
  "root_cause": "Client timeout is shorter than payment response time",
  "fix": "Increase timeout from 2s to 5s"
}
```

## Memory

`POST /memory` stores completed debugging knowledge.

```json
{
  "session_id": "session-a",
  "repo_id": "checkout-demo",
  "component": "checkoutService",
  "error": "Checkout request failed",
  "hypothesis_category": "payment_api",
  "failed_hypotheses": [],
  "evidence": [],
  "root_cause": "...",
  "fix": "...",
  "verification": "Tests passed"
}
```

The backend stores this as:

```text
memory_type = resolved_debugging_memory
PK = repo_id#component
SK = timestamp
```

## Recall

`GET /recall` retrieves prior debugging memories.

Example:

```text
GET /recall?repo_id=checkout-demo&component=checkoutService
```

Optional query parameters:

```text
hypothesis_category
session_id
```

When `session_id` is supplied, the caller's own session memories are excluded.

# Demo Sequence

## 0:00–0:20 — Problem

> AI agents can debug, but debugging knowledge often dies with the session.

## 0:20–1:10 — Agent A

```text
Attempt 1 → DB hypothesis → FAIL
Attempt 2 → DB hypothesis → FAIL
Attempt 3 → repeated DB investigation
```

Then:

```text
LOOP DETECTED
```

## 1:10–1:40 — Bedrock

Trigger the real Bedrock call.

Show:

```text
Database hypothesis ruled out
↓
Evidence
↓
Payment timeout investigation
```

Apply the fix and show verification.

## 1:40–2:20 — Store

Save the completed debugging memory to DynamoDB and show it through the LoopBreak UI.

## 2:20–2:50 — Agent B

Start a fresh session.

Trigger the real DynamoDB recall.

Show:

```text
🧠 Previous debugging memory found

Failed hypothesis:
Database connection

Evidence:
Database operations succeeded

Previous root cause:
Payment client timeout

Previous fix:
2s → 5s
```

## 2:50–3:00 — Close

> LoopBreak doesn't replace your coding agent. It makes the debugging knowledge from one session available to the next.

# Definition of Done

- [x] Lambda is deployed
- [x] DynamoDB table exists
- [x] deterministic fingerprint works
- [x] repeated fingerprint is detected
- [x] `/attempt` performs stateless loop detection
- [x] `/memory` stores completed debugging memory
- [x] `/recall` retrieves cross-session memory
- [ ] React app starts
- [ ] Bedrock call works
- [ ] Bedrock returns structured reasoning
- [ ] Debug Session screen works
- [ ] Debug Memory screen works
- [ ] complete demo works end-to-end
- [ ] AWS usage is visible and explainable
- [ ] no fabricated metrics are shown

# Optional Feature Cutoff

Do not begin semantic embeddings until:

```text
Backend ✓
Bedrock ✓
DynamoDB ✓
Recall ✓
Frontend ✓
End-to-end demo ✓
```

If any are broken, semantic matching is not the priority.

# Final Rule

A smaller working LoopBreak beats a larger LoopBreak with half-built features.

The winning demo is not:

> "Look how many AWS services we used."

It is:

> "Agent A failed here, LoopBreak remembered why, and Agent B avoided the same dead end."
