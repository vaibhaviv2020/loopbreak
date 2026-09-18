# LoopBreak Architecture

## 1. Goal

Build the smallest real AWS-backed system that demonstrates persistent debugging knowledge across sessions.

Priorities:

- real AWS usage
- persistent memory
- real Bedrock reasoning
- deterministic behavior
- low implementation risk
- strong 3-minute demo

## 2. High-Level Architecture

```text
┌──────────────────────────┐
│    React Frontend        │
│                          │
│ Debug Session            │
│ Debug Memory             │
└────────────┬─────────────┘
             │
             ▼
┌──────────────────────────┐
│     AWS Lambda           │
│     LoopBreakBackend     │
│                          │
│ /attempt                 │
│ /analyze                 │
│ /memory                  │
│ /recall                  │
└──────────┬───────┬───────┘
           │       │
           ▼       ▼
┌──────────────┐  ┌────────────────┐
│  DynamoDB    │  │ Amazon Bedrock │
│              │  │                │
│ Debugging   │  │ AI reasoning   │
│ Memory      │  │                │
└──────────────┘  └────────────────┘
```

## 3. Responsibilities

### React

Responsible for:

- Debug Session screen
- attempt timeline
- current session fingerprint list
- loop-detected state
- evidence display
- Bedrock recommendation
- Debug Memory screen
- Agent B recall experience

React must not contain AWS credentials or Bedrock credentials.

React owns the current debugging session state.

### Lambda

Responsible for:

- request validation
- deterministic fingerprint generation
- stateless loop detection
- DynamoDB memory writes
- DynamoDB memory queries
- Bedrock orchestration
- structured API responses

The four backend routes have separate responsibilities:

```text
POST /attempt  → loop detection
POST /analyze  → Bedrock reasoning
POST /memory   → DynamoDB write
GET  /recall   → DynamoDB read
```

Lambda does not rely on in-memory server state for session history.

### DynamoDB

Table:

```text
LoopBreakMemory
```

Primary key:

```text
PK = repo_id#component
SK = timestamp
```

Example:

```text
PK = demo-checkout#checkoutService
SK = 2026-09-18T21:16:30.923Z
```

Resolved memories contain:

```text
session_id
repo_id
component
error
hypothesis_category
failed_hypotheses
evidence
root_cause
fix
verification
timestamp
memory_type
```

Resolved memories use:

```text
memory_type = resolved_debugging_memory
```

Normal retrieval uses a DynamoDB Query on:

```text
PK = repo_id#component
```

Do not use a Scan for normal memory retrieval.

### Amazon Bedrock

Bedrock is responsible for evidence-driven reasoning.

It receives the accumulated debugging attempts from the current session.

The model must reason only from supplied evidence and must not invent evidence.

## 4. Deterministic Loop Detection

Loop detection does not depend on an LLM.

The deterministic fingerprint is generated from:

```text
repo_id + component + hypothesis_category
```

The values are normalized by:

- converting to lowercase
- trimming whitespace
- normalizing repeated whitespace

They are combined using:

```text
repo_id|component|hypothesis_category
```

and hashed using SHA-256.

The free-form hypothesis text is deliberately not part of the fingerprint.

The frontend maintains the fingerprints already seen during the current session.

The frontend sends those fingerprints to `/attempt` using:

```json
{
  "prior_fingerprints": []
}
```

Lambda checks whether the newly generated fingerprint already exists in that list.

If it exists:

```text
LOOP DETECTED
```

Lambda returns the updated fingerprint list.

## 5. Bedrock Reasoning

### POST /analyze

The current React session owns the accumulated attempt list.

The request contains:

```json
{
  "session_id": "session-agent-a-001",
  "repo_id": "demo-checkout",
  "component": "checkoutService",
  "attempts": []
}
```

The accumulated attempts can contain:

```text
hypothesis
hypothesis_category
change
result
evidence
```

Expected reasoning should identify:

```text
ruled-out hypotheses
supporting evidence
next investigation
root cause
fix
```

The model must clearly distinguish supplied evidence from uncertainty.

## 6. Memory Storage

### POST /memory

`/memory` stores a completed and verified debugging memory.

It does not store every raw debugging attempt.

Example:

```json
{
  "session_id": "session-agent-a-001",
  "repo_id": "demo-checkout",
  "component": "checkoutService",
  "error": "Checkout request failed with timeout",
  "hypothesis_category": "payment_api",
  "failed_hypotheses": [
    {
      "hypothesis": "The database connection is timing out",
      "reason": "Database query completes successfully"
    }
  ],
  "evidence": [
    "Database query completes successfully",
    "Payment API responds after approximately 3.8 seconds",
    "Client timeout is 2 seconds"
  ],
  "root_cause": "Payment API response exceeds the client timeout",
  "fix": "Increase payment request timeout from 2 seconds to 5 seconds",
  "verification": "Checkout test passed"
}
```

Lambda adds:

```text
PK
SK
timestamp
memory_type
```

## 7. Memory Recall

### GET /recall

Agent B requests prior debugging memories using query parameters.

Example:

```text
GET /recall?repo_id=demo-checkout&component=checkoutService&hypothesis_category=database&session_id=session-agent-b-001
```

Required parameters:

```text
repo_id
component
```

Optional parameters:

```text
hypothesis_category
session_id
```

Lambda performs:

```text
Query:
PK = repo_id#component
```

Then filters to:

```text
memory_type = resolved_debugging_memory
```

If `hypothesis_category` is provided, memories are filtered by that category.

If `session_id` is provided, memories from that same session are excluded.

Response:

```json
{
  "success": true,
  "prior_memory_found": true,
  "memories": []
}
```

No numeric similarity score should be shown unless actual embeddings and cosine similarity are implemented.

## 8. Optional Semantic Layer

Only after the core system works:

```text
Bedrock embedding
      ↓
Vector representation
      ↓
Cosine similarity
      ↓
Relevant prior memories
```

This is optional and must not block the core demo.

## 9. API Contract

### POST /attempt

Stateless deterministic loop detection.

Request:

```json
{
  "session_id": "session-agent-a-001",
  "repo_id": "demo-checkout",
  "component": "checkoutService",
  "error": "Checkout request failed with timeout",
  "hypothesis": "The database connection is timing out",
  "hypothesis_category": "database",
  "change": "Increased database timeout from 2s to 5s",
  "result": "Failed — checkout still times out",
  "evidence": "Database query completes successfully",
  "prior_fingerprints": []
}
```

Response:

```json
{
  "success": true,
  "fingerprint": "string",
  "loop_detected": false,
  "updated_fingerprints": ["string"]
}
```

No DynamoDB write occurs in `/attempt`.

### POST /analyze

The current session sends its complete attempt list.

```json
{
  "session_id": "session-agent-a-001",
  "repo_id": "demo-checkout",
  "component": "checkoutService",
  "attempts": []
}
```

Bedrock produces structured debugging reasoning.

### POST /memory

Stores completed debugging knowledge.

```json
{
  "session_id": "session-agent-a-001",
  "repo_id": "demo-checkout",
  "component": "checkoutService",
  "error": "Checkout request failed with timeout",
  "hypothesis_category": "payment_api",
  "failed_hypotheses": [],
  "evidence": [],
  "root_cause": "Payment API response exceeds the client timeout",
  "fix": "Increase payment request timeout from 2 seconds to 5 seconds",
  "verification": "Checkout test passed"
}
```

### GET /recall

Retrieves prior resolved debugging memories.

```text
GET /recall?repo_id=demo-checkout&component=checkoutService
```

Optional:

```text
hypothesis_category
session_id
```

## 10. Security

- No AWS credentials in React.
- AWS access belongs to Lambda's IAM role.
- Do not store secrets/API keys in DynamoDB.
- Use environment variables for configuration.
- Do not commit credentials or secret keys to Git.

## 11. Deployment

```text
React
  ↓
Static hosting / local demo

Lambda
  ↓
AWS backend

DynamoDB
  ↓
Persistent memory

Bedrock
  ↓
AI reasoning
```

If deployment time is limited, prioritize an AWS-backed working demo over unnecessary hosting infrastructure.

## 12. Failure Strategy

If Bedrock fails during the demo:

- preserve the deterministic attempt timeline
- show a clear error state
- never fake a successful live Bedrock response

A development fallback fixture may exist, but the final demo must distinguish fixture content from live output.

## 13. Architecture Principle

Every AWS service must have a clear reason to exist:

> Lambda executes the logic. DynamoDB remembers. Bedrock reasons.
