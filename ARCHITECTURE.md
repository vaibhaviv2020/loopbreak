# LoopBreak Architecture

## 1. Goal

Build the smallest real AWS-backed system that demonstrates persistent
debugging knowledge across sessions.

Priorities:

-   real AWS usage
-   persistent memory
-   real Bedrock reasoning
-   deterministic behavior
-   low implementation risk
-   strong 3-minute demo

## 2. High-Level Architecture

``` text
┌─────────────────────────────┐
│       React Frontend        │
│                             │
│  Debug Session | Memory     │
└──────────────┬──────────────┘
               │
               ▼
┌─────────────────────────────┐
│       AWS Lambda            │
│                             │
│ Capture / Detect / Recall   │
│ Bedrock orchestration       │
└───────┬───────────┬─────────┘
        │           │
        ▼           ▼
┌─────────────┐ ┌─────────────┐
│ DynamoDB    │ │ Amazon      │
│ Debug       │ │ Bedrock     │
│ Memory      │ │ Reasoning   │
└─────────────┘ └─────────────┘
```

## 3. Responsibilities

### React

Responsible for:

-   Debug Session screen
-   attempt timeline
-   loop-detected state
-   evidence display
-   Bedrock recommendation
-   Debug Memory screen
-   Agent B recall experience

React must not contain AWS credentials or Bedrock logic.

### Lambda

Responsible for:

-   receiving debugging events
-   generating deterministic fingerprints
-   checking repeated hypotheses
-   reading/writing DynamoDB
-   calling Bedrock
-   returning structured results

Keep backend logic centralized in one Lambda initially.

### DynamoDB

Suggested table:

`LoopBreakMemory`

Primary key:

```text
PK = repo_id#component
SK = timestamp
```

This gives Agent B a direct DynamoDB Query path for recall instead of a Scan.

Useful attributes:

``` text
session_id
repo_id
component
error_fingerprint
hypothesis_category
hypothesis_fingerprint
error
hypothesis
evidence
result
root_cause
fix
verification
timestamp
```

Do not over-engineer the schema.

## 4. Deterministic Loop Detection

Loop detection should not depend on an LLM.

Create a normalized fingerprint from:

``` text
repo_id + component + error + hypothesis
```

Normalize:

-   lowercase
-   whitespace
-   punctuation where appropriate

Hash the normalized representation, for example with SHA-256.

If the same/equivalent fingerprint appears again in the same debugging
session:

``` text
LOOP DETECTED
```

## 5. Bedrock Reasoning

Bedrock receives accumulated evidence.

Conceptual input:

``` json
{
  "error": "...",
  "attempts": [
    {
      "hypothesis": "...",
      "change": "...",
      "result": "...",
      "evidence": "..."
    }
  ]
}
```

Expected structured output:

``` json
{
  "ruled_out": [
    {
      "hypothesis": "...",
      "why": "..."
    }
  ],
  "evidence": [],
  "current_hypothesis_supported": false,
  "next_investigation": "...",
  "root_cause": "..."
}
```

The model should reason only from supplied evidence and explicitly
identify uncertainty.

## 6. Memory Recall

Agent B sends:

``` json
{
  "repo_id": "checkout-demo",
  "component": "checkoutService",
  "error": "..."
}
```

Lambda searches DynamoDB for relevant prior memories.

### MVP matching

1.  Exact component/error fingerprint.
2.  Exact repository/component match.
3.  Related stored debugging record if available.

Do not show a numeric similarity score unless actual embeddings and
cosine similarity have been implemented.

Instead show factual match reasons such as:

``` text
Related because:
• Same component
• Same error family
• Previous investigation involved the same dependency
```

## 7. Optional Semantic Layer

Only after the basic system works:

``` text
Bedrock embedding
      ↓
Vector representation
      ↓
Cosine similarity
      ↓
Relevant prior memories
```

This is optional and must not block the core demo.

## 8. Minimal API

### POST /attempt

Records an attempt.

``` json
{
  "session_id": "...",
  "repo_id": "...",
  "component": "...",
  "error": "...",
  "hypothesis": "...",
  "hypothesis_category": "database",
  "change": "...",
  "result": "...",
  "evidence": "..."
}
```

### POST /analyze

The current React session owns the accumulated attempt list and sends the complete array in the request body. Lambda does not maintain in-memory session state.

Sends the accumulated attempts to Bedrock.

### POST /memory

Stores completed debugging knowledge.

### POST /recall

Retrieves prior debugging memories for Agent B.

## 9. Security

-   No AWS credentials in React.
-   AWS access belongs to Lambda's IAM role.
-   Do not store secrets/API keys in DynamoDB.
-   Use environment variables for configuration.

## 10. Deployment

``` text
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

If deployment time is limited, prioritize an AWS-backed working demo
over unnecessary hosting infrastructure.

## 11. Failure Strategy

If Bedrock fails during the demo:

-   preserve the deterministic attempt timeline
-   show a clear error state
-   never fake a successful live Bedrock response

A development fallback fixture may exist, but the final demo must
distinguish fixture content from live output.

## 12. Architecture Principle

Every AWS service must have a clear reason to exist:

> Lambda executes the logic. DynamoDB remembers. Bedrock reasons.
