const path = require("path");
const fs = require("fs");
const { list_files, read_file, edit_file, run_tests } = require("./tools");
const { LoopBreakClient } = require("./client");

const DEFAULT_REPO_ROOT = path.resolve(__dirname, "../../demo-repo");

/**
 * Resets demo-checkout repository to its initial buggy baseline.
 */
function resetDemoRepo(repoRoot = DEFAULT_REPO_ROOT) {
  const serviceFile = path.join(repoRoot, "src/checkoutService.js");
  const initialContent = `/**
 * CheckoutService - core checkout transaction coordinator
 * repo_id: demo-checkout
 * component: checkoutService
 */

const config = {
  databaseTimeoutMs: 2000,
  databasePoolSize: 10,
  paymentClientTimeoutMs: 2000 // BUG: Payment service latency is 3800ms, exceeding this 2000ms client timeout
};

async function queryDatabase() {
  // Database health check / order reservation always succeeds
  return {
    status: "ok",
    durationMs: 45,
    message: "Database query completes successfully"
  };
}

async function callPaymentGateway(orderId, amount) {
  const paymentLatencyMs = 3800; // Payment service nominal latency

  if (paymentLatencyMs > config.paymentClientTimeoutMs) {
    const error = new Error(
      \`Payment API response exceeded client timeout of \${config.paymentClientTimeoutMs}ms (gateway latency ~\${paymentLatencyMs}ms)\`
    );
    error.paymentLatencyMs = paymentLatencyMs;
    error.clientTimeoutMs = config.paymentClientTimeoutMs;
    throw error;
  }

  return {
    status: "success",
    transactionId: "txn_" + Date.now(),
    latencyMs: paymentLatencyMs
  };
}

async function processCheckout(order) {
  const dbResult = await queryDatabase();

  const paymentResult = await callPaymentGateway(order.id, order.amount);

  return {
    success: true,
    orderId: order.id,
    db: dbResult,
    payment: paymentResult
  };
}

module.exports = {
  config,
  queryDatabase,
  callPaymentGateway,
  processCheckout
};
`;

  fs.writeFileSync(serviceFile, initialContent, "utf8");
}

/**
 * Run Agent A Workflow:
 * 1. Encounters bug
 * 2. Attempts fix (database hypothesis 1) -> fails -> /attempt
 * 3. Attempts fix (database hypothesis 2) -> fails -> /attempt -> LOOP DETECTED
 * 4. Calls /analyze -> receives Bedrock reasoning
 * 5. Applies real fix -> runs real test -> verifies PASS
 * 6. Stores memory via /memory
 */
async function runAgentA({
  repoRoot = DEFAULT_REPO_ROOT,
  repoId = "demo-checkout",
  component = "checkoutService",
  testCommand = "node test/checkout.test.js",
  client = new LoopBreakClient(),
  emit = () => {}
} = {}) {
  const sessionId = `session-agent-a-${Date.now()}`;
  let priorFingerprints = [];
  const accumulatedAttempts = [];

  // Reset to initial buggy state
  resetDemoRepo(repoRoot);

  emit("session_started", {
    agent: "A",
    session_id: sessionId,
    repo_id: repoId,
    component: component,
    message: "Agent A session initialized"
  });

  // Step 1: Initial test run to observe the error
  const initialTest = run_tests(repoRoot, testCommand);
  const initialError = "Checkout request failed with timeout";
  emit("test_run", {
    agent: "A",
    passed: initialTest.passed,
    exitCode: initialTest.exitCode,
    stdout: initialTest.stdout,
    evidence: initialTest.evidence
  });

  // Turn 1: Hypothesis 1 (Database timeout)
  const hyp1 = "The database connection is timing out";
  const cat1 = "database";
  const edit1 = edit_file(repoRoot, {
    path: "src/checkoutService.js",
    search: "databaseTimeoutMs: 2000",
    replace: "databaseTimeoutMs: 5000",
    hypothesis: hyp1,
    hypothesis_category: cat1
  });

  const test1 = run_tests(repoRoot, testCommand);
  accumulatedAttempts.push({
    hypothesis: hyp1,
    hypothesis_category: cat1,
    change: edit1.change,
    result: test1.resultSummary,
    evidence: test1.evidence
  });

  emit("attempt_submitted", {
    agent: "A",
    session_id: sessionId,
    attemptNumber: 1,
    hypothesis: hyp1,
    hypothesis_category: cat1,
    change: edit1.change,
    result: test1.resultSummary,
    evidence: test1.evidence
  });

  const attemptRes1 = await client.recordAttempt({
    session_id: sessionId,
    repo_id: repoId,
    component: component,
    error: initialError,
    hypothesis: hyp1,
    hypothesis_category: cat1,
    change: edit1.change,
    result: test1.resultSummary,
    evidence: test1.evidence,
    prior_fingerprints: priorFingerprints
  });

  priorFingerprints = attemptRes1.updated_fingerprints;
  emit("attempt_result", {
    agent: "A",
    attemptNumber: 1,
    fingerprint: attemptRes1.fingerprint,
    loop_detected: attemptRes1.loop_detected,
    updated_fingerprints: priorFingerprints
  });

  // Turn 2: Hypothesis 2 (Repeated database investigation: pool size)
  const hyp2 = "The database connection pool is exhausted";
  const cat2 = "database";
  const edit2 = edit_file(repoRoot, {
    path: "src/checkoutService.js",
    search: "databasePoolSize: 10",
    replace: "databasePoolSize: 50",
    hypothesis: hyp2,
    hypothesis_category: cat2
  });

  const test2 = run_tests(repoRoot, testCommand);
  accumulatedAttempts.push({
    hypothesis: hyp2,
    hypothesis_category: cat2,
    change: edit2.change,
    result: test2.resultSummary,
    evidence: test2.evidence
  });

  emit("attempt_submitted", {
    agent: "A",
    session_id: sessionId,
    attemptNumber: 2,
    hypothesis: hyp2,
    hypothesis_category: cat2,
    change: edit2.change,
    result: test2.resultSummary,
    evidence: test2.evidence
  });

  const attemptRes2 = await client.recordAttempt({
    session_id: sessionId,
    repo_id: repoId,
    component: component,
    error: initialError,
    hypothesis: hyp2,
    hypothesis_category: cat2,
    change: edit2.change,
    result: test2.resultSummary,
    evidence: test2.evidence,
    prior_fingerprints: priorFingerprints
  });

  priorFingerprints = attemptRes2.updated_fingerprints;
  emit("attempt_result", {
    agent: "A",
    attemptNumber: 2,
    fingerprint: attemptRes2.fingerprint,
    loop_detected: attemptRes2.loop_detected,
    updated_fingerprints: priorFingerprints
  });

  let analysisResult = null;
  // Step 3: Loop Detection Trigger -> Auto /analyze
  if (attemptRes2.loop_detected) {
    emit("loop_detected", {
      agent: "A",
      session_id: sessionId,
      category: cat2,
      fingerprint: attemptRes2.fingerprint,
      message: "LoopBreak detected repeated investigation in category: database"
    });

    emit("analysis_started", {
      agent: "A",
      session_id: sessionId,
      message: "Sending accumulated debugging evidence to Amazon Bedrock"
    });

    const analyzeResponse = await client.analyzeSession({
      session_id: sessionId,
      repo_id: repoId,
      component: component,
      attempts: accumulatedAttempts
    });

    analysisResult = analyzeResponse.analysis;
    emit("analysis_result", {
      agent: "A",
      session_id: sessionId,
      analysis: analysisResult
    });
  }

  // Step 4: Agent applies suggested fix based on Bedrock reasoning
  const fixHypothesis = analysisResult?.root_cause || "Payment API response exceeds client timeout";
  const fixCategory = "payment_api";
  const editFix = edit_file(repoRoot, {
    path: "src/checkoutService.js",
    search: "paymentClientTimeoutMs: 2000",
    replace: "paymentClientTimeoutMs: 5000",
    hypothesis: fixHypothesis,
    hypothesis_category: fixCategory
  });

  emit("fix_applied", {
    agent: "A",
    session_id: sessionId,
    change: editFix.change,
    hypothesis: fixHypothesis,
    hypothesis_category: fixCategory
  });

  // Step 5: Real Verification (must pass real test suite)
  const verificationTest = run_tests(repoRoot, testCommand);
  if (!verificationTest.passed) {
    throw new Error(`Verification failed: Tests did not pass after fix. Exit code: ${verificationTest.exitCode}`);
  }

  emit("verification", {
    agent: "A",
    session_id: sessionId,
    verified: true,
    result: "Checkout test passed",
    evidence: verificationTest.evidence
  });

  // Step 6: Store Verified Memory in DynamoDB (only after genuine pass)
  const memoryPayload = {
    session_id: sessionId,
    repo_id: repoId,
    component: component,
    error: initialError,
    hypothesis_category: fixCategory,
    failed_hypotheses: analysisResult?.ruled_out || [
      { hypothesis: hyp1, reason: "Database query completes successfully" },
      { hypothesis: hyp2, reason: "Database query completes successfully" }
    ],
    evidence: analysisResult?.evidence || [
      "Database query completes successfully",
      "Payment API responds after approximately 3.8 seconds",
      "Client timeout is 2 seconds"
    ],
    root_cause: analysisResult?.root_cause || "Payment API response exceeds the client timeout",
    fix: analysisResult?.fix || "Increase payment request timeout from 2 seconds to 5 seconds",
    verification: "Checkout test passed"
  };

  const memoryRes = await client.saveMemory(memoryPayload);
  emit("memory_saved", {
    agent: "A",
    session_id: sessionId,
    memory: memoryRes.memory
  });

  emit("session_ended", {
    agent: "A",
    session_id: sessionId,
    status: "resolved",
    summary: "Agent A detected loop, obtained Bedrock analysis, verified fix with real test pass, and stored memory."
  });

  return {
    success: true,
    sessionId,
    attempts: accumulatedAttempts.length,
    loopDetected: attemptRes2.loop_detected,
    memory: memoryRes.memory
  };
}

/**
 * Run Agent B Workflow:
 * 1. Fresh process and session (new session_id, empty prior_fingerprints)
 * 2. Calls /recall for repo_id + component
 * 3. Ingests recalled memory as advisory context
 * 4. Inspects actual files
 * 5. Applies verified fix directly without falling into database loop
 * 6. Runs real test suite -> verifies success
 */
async function runAgentB({
  repoRoot = DEFAULT_REPO_ROOT,
  repoId = "demo-checkout",
  component = "checkoutService",
  testCommand = "node test/checkout.test.js",
  client = new LoopBreakClient(),
  emit = () => {}
} = {}) {
  const sessionId = `session-agent-b-${Date.now()}`;

  // Reset demo repo to initial buggy state so Agent B faces the actual problem
  resetDemoRepo(repoRoot);

  emit("session_started", {
    agent: "B",
    session_id: sessionId,
    repo_id: repoId,
    component: component,
    message: "Fresh Agent B session initialized (new session ID, zero prior fingerprints)"
  });

  // Step 1: Call /recall to check for prior debugging memory
  const recallRes = await client.recallMemory({
    repo_id: repoId,
    component: component,
    session_id: sessionId
  });

  const recalledMemories = recallRes.memories || [];
  const priorMemoryFound = recallRes.prior_memory_found && recalledMemories.length > 0;

  emit("recall_result", {
    agent: "B",
    session_id: sessionId,
    prior_memory_found: priorMemoryFound,
    memories: recalledMemories
  });

  if (!priorMemoryFound) {
    throw new Error("Agent B recall failed: No prior debugging memory found in LoopBreak");
  }

  const advisory = recalledMemories[0];

  // Step 2: Inspect actual file before editing
  const fileContent = read_file(repoRoot, "src/checkoutService.js");
  emit("tool_call", {
    agent: "B",
    tool: "read_file",
    path: "src/checkoutService.js",
    bytesRead: fileContent.length
  });

  // Step 3: Use advisory memory to apply the fix directly (skipping the dead ends!)
  const editFix = edit_file(repoRoot, {
    path: "src/checkoutService.js",
    search: "paymentClientTimeoutMs: 2000",
    replace: "paymentClientTimeoutMs: 5000",
    hypothesis: advisory.root_cause || "Payment API response exceeds client timeout",
    hypothesis_category: advisory.hypothesis_category || "payment_api"
  });

  emit("fix_applied", {
    agent: "B",
    session_id: sessionId,
    change: editFix.change,
    hypothesis: advisory.root_cause,
    hypothesis_category: advisory.hypothesis_category,
    advisoryMemoryUsed: true
  });

  // Step 4: Real test suite verification
  const verificationTest = run_tests(repoRoot, testCommand);
  if (!verificationTest.passed) {
    throw new Error(`Agent B verification failed: Tests did not pass after fix. Exit code: ${verificationTest.exitCode}`);
  }

  emit("verification", {
    agent: "B",
    session_id: sessionId,
    verified: true,
    result: "Checkout test passed",
    evidence: verificationTest.evidence
  });

  emit("session_ended", {
    agent: "B",
    session_id: sessionId,
    status: "resolved",
    summary: "Fresh Agent B recalled prior debugging memory, skipped database dead ends, fixed payment timeout, and verified pass with real test."
  });

  return {
    success: true,
    sessionId,
    recalledMemoriesCount: recalledMemories.length,
    advisoryRootCause: advisory.root_cause,
    verified: verificationTest.passed
  };
}

module.exports = {
  runAgentA,
  runAgentB,
  resetDemoRepo
};
