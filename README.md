# LoopBreak

## Shared Debugging Memory for AI Agents

LoopBreak is a shared, persistent, agent-agnostic debugging memory layer
that turns failed debugging attempts into reusable engineering
knowledge.

When one developer or AI coding agent gets stuck, LoopBreak captures
what was tried, what failed, the evidence, and the eventual fix. When
another agent or developer later encounters the same problem or
component, LoopBreak recalls that debugging knowledge so known dead ends
are not repeated.

### One-line pitch

> An agent already learned this. The next agent doesn't have to learn it
> again.

## Core Problem

AI coding agents can repeatedly investigate the same failed hypothesis,
especially across separate sessions. Useful debugging knowledge is often
trapped inside one conversation or one agent session.

LoopBreak makes that knowledge persistent and reusable.

## Core Flow

``` text
OBSERVE → ATTEMPT → FAIL → DETECT REPEAT → BEDROCK ANALYZE
→ LEARN → STORE → NEW SESSION → RECALL → SKIP DEAD END
→ INVESTIGATE → FIX → VERIFY → STORE
```

## MVP --- Must Build

1.  Capture structured debugging attempts.
2.  Detect repeated hypotheses with a deterministic fingerprint/hash.
3.  Send accumulated evidence to Amazon Bedrock.
4.  Produce ruled-out hypotheses, evidence, unsupported reasoning, and
    the next investigation.
5.  Store debugging knowledge in Amazon DynamoDB.
6.  Start a fresh Agent B session and retrieve real stored memory.
7.  Build two hero screens: Debug Session and Debug Memory.

## Optional Only After MVP Works

-   Bedrock/Titan embeddings
-   cosine similarity
-   semantic matching
-   real similarity percentage
-   controlled before/after benchmark

## Explicitly Cut

-   S3
-   API Gateway unless required
-   live Cursor/Claude/Copilot integrations
-   building a full coding agent
-   generic AI debugger claims
-   README/document synchronization
-   unnecessary AWS services

## Demo Scenario

Use a deterministic checkout failure.

### Agent A

1.  Checkout request fails.
2.  Hypothesis: database connection issue.
3.  DB timeout/retry change fails.
4.  Another DB-related hypothesis fails.
5.  LoopBreak detects repeated unsupported investigation.
6.  Bedrock examines the evidence.
7.  Database hypothesis is ruled out.
8.  Evidence points toward payment-service latency.
9.  Payment response takes about 3.8 seconds while the client timeout is
    2 seconds.
10. Timeout is changed to 5 seconds.
11. Verification passes.
12. Debugging memory is stored in DynamoDB.

### Agent B

Agent B starts as a fresh session and encounters the checkout component.

LoopBreak retrieves the previous debugging memory:

-   previous failed hypotheses
-   evidence that ruled them out
-   previous root cause
-   previous fix
-   verification result

Agent B skips the known dead ends and investigates the correct path.

## Positioning

LoopBreak is not an AI debugger, a replacement for Cursor/Claude
Code/Codex, or a generic loop detector.

It is:

> A shared, persistent, agent-agnostic debugging memory layer that turns
> failed debugging attempts into reusable engineering knowledge.

The differentiation is that debugging knowledge persists outside an
individual agent session and can be recalled by another agent or
developer.

## AWS

``` text
Developer / AI Agent
        ↓
   LoopBreak UI
        ↓
   Lambda Function
      ↙       ↘
DynamoDB      Bedrock
  Memory     Reasoning
      ↘       ↙
   Debugging Knowledge
        ↓
   Future Agent B
```

### Services

-   AWS Lambda --- backend/API logic
-   Amazon DynamoDB --- persistent debugging memory
-   Amazon Bedrock --- evidence-driven reasoning

## Integrity Rules

Never fabricate similarity percentages, benchmark results, token
savings, eliminated attempts, or live-agent behavior.

If a metric is not actually measured, do not display it as a result.

## Demo Rule

The scripted attempt sequence may be deterministic for reliability.

The two things that must be real:

1.  The Bedrock reasoning call.
2.  The DynamoDB memory write/read during Agent A → Agent B.

## Success Criterion

The judge should understand this in under 30 seconds:

> Agent A discovered and stored a debugging dead end. Agent B
> encountered the same problem later. LoopBreak remembered the dead end
> and helped Agent B avoid repeating it.
