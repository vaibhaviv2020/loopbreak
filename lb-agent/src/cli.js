#!/usr/bin/env node

const { runAgentA, runAgentB, resetDemoRepo } = require("./agent");
const { SSERelay } = require("./sse-relay");
const { LoopBreakClient } = require("./client");

const args = process.argv.slice(2);
const command = args[0] || "demo";

// Check if running in fixture mode or real mode
const isFixture = process.env.LOOPBREAK_USE_FIXTURE === "true";
console.log(`[lb-agent] Starting in ${isFixture ? "Deterministic Fixture" : "Production Bedrock/DynamoDB"} mode.`);

async function main() {
  const relay = new SSERelay();
  await relay.start();

  const client = new LoopBreakClient();

  // Wire trigger handler for external requests (e.g. from React UI)
  relay.setTriggerHandler(async ({ agent }) => {
    console.log(`[lb-agent] Received trigger for agent: ${agent}`);
    if (agent === "A" || agent === "agent-a") {
      await runAgentA({ client, emit: (t, d) => relay.emit(t, d) });
    } else if (agent === "B" || agent === "agent-b") {
      await runAgentB({ client, emit: (t, d) => relay.emit(t, d) });
    } else {
      // Full demo cycle
      console.log("[lb-agent] Executing full Agent A -> Agent B demo sequence...");
      await runAgentA({ client, emit: (t, d) => relay.emit(t, d) });
      // Small pause between A and B
      await new Promise(r => setTimeout(r, 1200));
      await runAgentB({ client, emit: (t, d) => relay.emit(t, d) });
    }
  });

  if (command === "serve") {
    console.log("[lb-agent] Server running in listen mode. Waiting for triggers from React console or CLI...");
    return; // Keep process running
  }

  if (command === "agent-a") {
    console.log("[lb-agent] Executing Agent A workflow...");
    await runAgentA({ client, emit: (t, d) => relay.emit(t, d) });
    console.log("[lb-agent] Agent A finished.");
    process.exit(0);
  }

  if (command === "agent-b") {
    console.log("[lb-agent] Executing Agent B workflow...");
    await runAgentB({ client, emit: (t, d) => relay.emit(t, d) });
    console.log("[lb-agent] Agent B finished.");
    process.exit(0);
  }

  if (command === "reset") {
    console.log("[lb-agent] Resetting demo-checkout repo to initial buggy state...");
    resetDemoRepo();
    console.log("[lb-agent] Reset complete.");
    process.exit(0);
  }

  // Default: "demo"
  console.log("\n=======================================================");
  console.log("LOOPBREAK: 3-MINUTE BHARAT BUILD E2E DEMO SEQUENCE");
  console.log("=======================================================\n");

  console.log(">>> [PHASE 1]: Agent A encounters checkout timeout bug.");
  const resA = await runAgentA({ client, emit: (t, d) => relay.emit(t, d) });
  console.log(`>>> [PHASE 1 COMPLETE]: Agent A detected loop, obtained Bedrock analysis, applied verified fix, and saved memory to DynamoDB.\n`);

  console.log(">>> Pausing before launching fresh Agent B session...");
  await new Promise(r => setTimeout(r, 1500));

  console.log(">>> [PHASE 2]: Fresh Agent B starts in new session.");
  const resB = await runAgentB({ client, emit: (t, d) => relay.emit(t, d) });
  console.log(`>>> [PHASE 2 COMPLETE]: Fresh Agent B recalled memory, skipped database dead ends, fixed payment timeout, and verified pass with real test!\n`);

  console.log("=======================================================");
  console.log("DEMO SUCCESSFUL: Debugging knowledge persisted across sessions.");
  console.log("=======================================================\n");

  // Keep server alive briefly so pending SSE events finish flushing
  setTimeout(() => {
    process.exit(0);
  }, 1000);
}

main().catch(err => {
  console.error("[lb-agent] Fatal execution error:", err);
  process.exit(1);
});
