const assert = require("assert");
const path = require("path");
const fs = require("fs");
const { runAgentA, runAgentB, resetDemoRepo } = require("../src/agent");
const { LoopBreakClient } = require("../src/client");

const REPO_ROOT = path.resolve(__dirname, "../../demo-repo");

// Use fixture mode and local memory for deterministic test verification
process.env.LOOPBREAK_USE_FIXTURE = "true";
process.env.LOOPBREAK_LOCAL_MEMORY = "true";

async function testFullAgentCycle() {
  console.log("==========================================");
  console.log("LB-AGENT END-TO-END WORKFLOW TEST SUITE");
  console.log("==========================================\n");

  const emittedEvents = [];
  function emit(type, data) {
    emittedEvents.push({ type, data });
    console.log(`  [EVENT ${type}]:`, data.message || data.result || data.hypothesis || "");
  }

  const client = new LoopBreakClient("http://127.0.0.1:3000", true); // Direct in-process handler for unit test

  // 1. Run Agent A
  console.log("Phase 1: Running Agent A...");
  const agentARes = await runAgentA({
    repoRoot: REPO_ROOT,
    client,
    emit
  });

  assert.strictEqual(agentARes.success, true);
  assert.strictEqual(agentARes.loopDetected, true, "Loop must be detected on repeated database category");
  assert.strictEqual(agentARes.attempts, 2, "Agent A must record 2 failed attempts before loop detection");
  assert.ok(agentARes.memory, "Verified memory must be generated and stored");
  assert.strictEqual(agentARes.memory.verification, "Checkout test passed");

  // Verify events emitted during Agent A
  const eventTypes = emittedEvents.map(e => e.type);
  assert.ok(eventTypes.includes("session_started"));
  assert.ok(eventTypes.includes("attempt_submitted"));
  assert.ok(eventTypes.includes("attempt_result"));
  assert.ok(eventTypes.includes("loop_detected"));
  assert.ok(eventTypes.includes("analysis_started"));
  assert.ok(eventTypes.includes("analysis_result"));
  assert.ok(eventTypes.includes("fix_applied"));
  assert.ok(eventTypes.includes("verification"));
  assert.ok(eventTypes.includes("memory_saved"));
  assert.ok(eventTypes.includes("session_ended"));
  console.log("  ✓ Agent A completed full loop -> Bedrock -> real fix -> real pass -> memory save\n");

  // 2. Run Fresh Agent B
  console.log("Phase 2: Running Fresh Agent B...");
  const agentBRes = await runAgentB({
    repoRoot: REPO_ROOT,
    client,
    emit
  });

  assert.strictEqual(agentBRes.success, true);
  assert.strictEqual(agentBRes.verified, true, "Agent B must verify real test pass");
  assert.ok(agentBRes.recalledMemoriesCount >= 1, "Agent B must recall at least 1 memory from Agent A");

  const bEvents = emittedEvents.filter(e => e.data?.agent === "B").map(e => e.type);
  assert.ok(bEvents.includes("session_started"));
  assert.ok(bEvents.includes("recall_result"));
  assert.ok(bEvents.includes("tool_call"));
  assert.ok(bEvents.includes("fix_applied"));
  assert.ok(bEvents.includes("verification"));
  assert.ok(bEvents.includes("session_ended"));

  console.log("  ✓ Fresh Agent B recalled memory -> skipped dead end -> verified fix with real tests!\n");

  console.log("==========================================");
  console.log("ALL LB-AGENT END-TO-END WORKFLOW TESTS PASSED!");
  console.log("==========================================\n");
}

testFullAgentCycle().catch(err => {
  console.error("Agent Test Suite Failed:", err);
  process.exit(1);
});
