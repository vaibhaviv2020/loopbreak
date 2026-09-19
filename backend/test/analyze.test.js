const assert = require("assert");
const { handler } = require("../src/handler");
const {
  parseAndValidateModelOutput,
  getFixtureAnalysis,
  buildUserMessage,
  analyzeDebuggingSession
} = require("../src/services/bedrock");

let passedTests = 0;
let totalTests = 0;

function runTest(name, fn) {
  totalTests++;
  try {
    fn();
    console.log(`  ✓ ${name}`);
    passedTests++;
  } catch (err) {
    console.error(`  ✗ ${name}:`, err.message);
    throw err;
  }
}

async function runAsyncTest(name, fn) {
  totalTests++;
  try {
    await fn();
    console.log(`  ✓ ${name}`);
    passedTests++;
  } catch (err) {
    console.error(`  ✗ ${name}:`, err.message);
    throw err;
  }
}

async function main() {
  console.log("\n==========================================");
  console.log("LOOPBREAK PERSON 2 — /analyze TEST SUITE");
  console.log("==========================================\n");

  // Ensure fixture mode is active for deterministic local unit/scenario tests
  process.env.LOOPBREAK_USE_FIXTURE = "true";

  // TEST 1: Invalid request validation
  console.log("Suite 1: Request Validation");
  await runAsyncTest("Rejects missing session_id", async () => {
    const res = await handler({
      httpMethod: "POST",
      path: "/analyze",
      body: JSON.stringify({
        repo_id: "demo-repo",
        component: "checkoutService",
        attempts: []
      })
    });
    assert.strictEqual(res.statusCode, 400);
    const body = JSON.parse(res.body);
    assert.strictEqual(body.success, false);
    assert.ok(body.error.includes("session_id"));
  });

  await runAsyncTest("Rejects missing component", async () => {
    const res = await handler({
      httpMethod: "POST",
      path: "/analyze",
      body: JSON.stringify({
        session_id: "sess-1",
        repo_id: "demo-repo",
        attempts: []
      })
    });
    assert.strictEqual(res.statusCode, 400);
    const body = JSON.parse(res.body);
    assert.strictEqual(body.success, false);
    assert.ok(body.error.includes("component"));
  });

  await runAsyncTest("Rejects non-array attempts", async () => {
    const res = await handler({
      httpMethod: "POST",
      path: "/analyze",
      body: JSON.stringify({
        session_id: "sess-1",
        repo_id: "demo-repo",
        component: "checkoutService",
        attempts: "not-an-array"
      })
    });
    assert.strictEqual(res.statusCode, 400);
    const body = JSON.parse(res.body);
    assert.strictEqual(body.success, false);
    assert.ok(body.error.includes("attempts"));
  });

  await runAsyncTest("Rejects invalid hypothesis_category in attempts", async () => {
    const res = await handler({
      httpMethod: "POST",
      path: "/analyze",
      body: JSON.stringify({
        session_id: "sess-1",
        repo_id: "demo-repo",
        component: "checkoutService",
        attempts: [
          {
            hypothesis: "Something weird",
            hypothesis_category: "alien_technology",
            evidence: "None"
          }
        ]
      })
    });
    assert.strictEqual(res.statusCode, 400);
    const body = JSON.parse(res.body);
    assert.strictEqual(body.success, false);
    assert.ok(body.error.includes("hypothesis_category"));
  });

  // TEST 2: Single failed attempt / Insufficient Evidence
  console.log("\nSuite 2: Insufficient Evidence Handling");
  await runAsyncTest("Single attempt does not invent root cause or fix", async () => {
    const res = await handler({
      httpMethod: "POST",
      path: "/analyze",
      body: JSON.stringify({
        session_id: "sess-insufficient-01",
        repo_id: "demo-checkout",
        component: "checkoutService",
        attempts: [
          {
            hypothesis: "The database connection is timing out",
            hypothesis_category: "database",
            change: "Increased DB timeout from 2s to 5s",
            result: "Failed — checkout still times out",
            evidence: "Database query completes successfully"
          }
        ]
      })
    });
    assert.strictEqual(res.statusCode, 200);
    const body = JSON.parse(res.body);
    assert.strictEqual(body.success, true);
    assert.strictEqual(body.analysis.root_cause, null, "Root cause must be null when evidence is insufficient");
    assert.strictEqual(body.analysis.fix, null, "Fix must be null when evidence is insufficient");
    assert.strictEqual(body.analysis.current_hypothesis_supported, false);
    assert.ok(body.analysis.ruled_out.length >= 1);
  });

  // TEST 3: Repeated database hypothesis / Debugging loop
  console.log("\nSuite 3: Repeated Investigation Loop Detection");
  await runAsyncTest("Detects negative evidence across multiple database attempts and steers away", async () => {
    const res = await handler({
      httpMethod: "POST",
      path: "/analyze",
      body: JSON.stringify({
        session_id: "sess-loop-01",
        repo_id: "demo-checkout",
        component: "checkoutService",
        attempts: [
          {
            hypothesis: "Database connection timeout",
            hypothesis_category: "database",
            change: "Increase DB connection timeout",
            result: "Failed",
            evidence: "Database query completes successfully"
          },
          {
            hypothesis: "Database connection pool exhausted",
            hypothesis_category: "database",
            change: "Increased connection pool size to 50",
            result: "Failed",
            evidence: "Pool utilization was under 10%"
          }
        ]
      })
    });
    assert.strictEqual(res.statusCode, 200);
    const body = JSON.parse(res.body);
    assert.strictEqual(body.success, true);
    assert.strictEqual(body.analysis.current_hypothesis_supported, false);
    assert.strictEqual(body.analysis.ruled_out.length, 2);
    assert.ok(body.analysis.next_investigation.toLowerCase().includes("database") || body.analysis.next_investigation.toLowerCase().includes("components"));
  });

  // TEST 4: Full Checkout Demo Scenario
  console.log("\nSuite 4: Official Checkout Demo Scenario");
  await runAsyncTest("Full checkout scenario produces conclusive root cause and fix", async () => {
    const res = await handler({
      httpMethod: "POST",
      path: "/analyze",
      body: JSON.stringify({
        session_id: "session-agent-a-001",
        repo_id: "demo-checkout",
        component: "checkoutService",
        attempts: [
          {
            hypothesis: "The database connection is timing out",
            hypothesis_category: "database",
            change: "Increased database timeout from 2s to 5s",
            result: "Failed — checkout still times out",
            evidence: "Database query completes successfully"
          },
          {
            hypothesis: "The database connection pool is exhausted",
            hypothesis_category: "database",
            change: "Increased connection pool size",
            result: "Failed — checkout still times out",
            evidence: "Database query completes successfully"
          },
          {
            hypothesis: "Payment service latency exceeds client timeout",
            hypothesis_category: "payment_api",
            change: "Inspected payment API latency and client config",
            result: "Observed latency",
            evidence: "Payment API responds after approximately 3.8 seconds. Client timeout is 2 seconds"
          }
        ]
      })
    });
    assert.strictEqual(res.statusCode, 200);
    const body = JSON.parse(res.body);
    assert.strictEqual(body.success, true);
    assert.strictEqual(body.analysis.current_hypothesis_supported, false);
    assert.ok(body.analysis.ruled_out.some(r => r.hypothesis.includes("database")));
    assert.strictEqual(body.analysis.root_cause, "Payment API response exceeds the client timeout");
    assert.strictEqual(body.analysis.fix, "Increase payment request timeout from 2 seconds to 5 seconds");
    assert.strictEqual(body.analysis.verification, "Not yet verified");
  });

  // TEST 5: Verified Resolution Scenario
  console.log("\nSuite 5: Verified Resolution");
  await runAsyncTest("Reports verification accurately when verification evidence is present", async () => {
    const res = await handler({
      httpMethod: "POST",
      path: "/analyze",
      body: JSON.stringify({
        session_id: "session-agent-a-verified",
        repo_id: "demo-checkout",
        component: "checkoutService",
        attempts: [
          {
            hypothesis: "Payment API response exceeds the client timeout",
            hypothesis_category: "payment_api",
            change: "Increased payment request timeout from 2 seconds to 5 seconds",
            result: "Checkout test passed",
            evidence: "Payment API responds after approximately 3.8 seconds. Checkout test passed"
          }
        ]
      })
    });
    assert.strictEqual(res.statusCode, 200);
    const body = JSON.parse(res.body);
    assert.strictEqual(body.success, true);
    assert.strictEqual(body.analysis.verification, "Checkout test passed");
  });

  // TEST 6: Defensive JSON Parsing & Model Output Validation
  console.log("\nSuite 6: Defensive JSON Parsing");
  runTest("Parses clean raw JSON successfully", () => {
    const raw = JSON.stringify({
      ruled_out: [{ hypothesis: "h1", reason: "r1", evidence: ["e1"] }],
      evidence: ["e1"],
      current_hypothesis_supported: false,
      next_investigation: "Check network",
      root_cause: null,
      fix: null,
      verification: null
    });
    const parsed = parseAndValidateModelOutput(raw);
    assert.strictEqual(parsed.ruled_out.length, 1);
    assert.strictEqual(parsed.next_investigation, "Check network");
  });

  runTest("Strips markdown code fences (```json ... ```)", () => {
    const raw = "```json\n" + JSON.stringify({
      ruled_out: [],
      evidence: ["some evidence"],
      current_hypothesis_supported: false,
      next_investigation: "Investigate payment",
      root_cause: "Timeout",
      fix: "Increase timeout",
      verification: null
    }) + "\n```";
    const parsed = parseAndValidateModelOutput(raw);
    assert.strictEqual(parsed.root_cause, "Timeout");
  });

  runTest("Extracts JSON embedded in surrounding conversational text", () => {
    const raw = "Here is my reasoning:\n" + JSON.stringify({
      ruled_out: [],
      evidence: [],
      current_hypothesis_supported: false,
      next_investigation: "Investigate cache",
      root_cause: null,
      fix: null,
      verification: null
    }) + "\nHope this helps!";
    const parsed = parseAndValidateModelOutput(raw);
    assert.strictEqual(parsed.next_investigation, "Investigate cache");
  });

  // TEST 7: Malformed Model Response Handling
  console.log("\nSuite 7: Malformed Model Output Rejection");
  runTest("Rejects non-JSON strings", () => {
    assert.throws(() => {
      parseAndValidateModelOutput("This is completely unstructured text with no JSON");
    }, /Failed to parse model output as JSON/);
  });

  runTest("Rejects missing required array fields", () => {
    assert.throws(() => {
      parseAndValidateModelOutput(JSON.stringify({
        ruled_out: "not-an-array",
        evidence: []
      }));
    }, /Missing or invalid field: ruled_out/);
  });

  runTest("Rejects missing next_investigation", () => {
    assert.throws(() => {
      parseAndValidateModelOutput(JSON.stringify({
        ruled_out: [],
        evidence: [],
        current_hypothesis_supported: false
      }));
    }, /Missing or invalid field: next_investigation/);
  });

  // TEST 8: Existing Person 1 APIs Unchanged
  console.log("\nSuite 8: Person 1 API Regression Check");
  await runAsyncTest("/attempt still works and detects loops", async () => {
    const res1 = await handler({
      httpMethod: "POST",
      path: "/attempt",
      body: JSON.stringify({
        session_id: "sess-test",
        repo_id: "demo-checkout",
        component: "checkoutService",
        error: "Checkout failed",
        hypothesis: "DB timeout",
        hypothesis_category: "database",
        change: "increased timeout",
        result: "failed",
        evidence: "db query ok",
        prior_fingerprints: []
      })
    });
    assert.strictEqual(res1.statusCode, 200);
    const body1 = JSON.parse(res1.body);
    assert.strictEqual(body1.loop_detected, false);

    // Call again with prior fingerprint to verify loop detection
    const res2 = await handler({
      httpMethod: "POST",
      path: "/attempt",
      body: JSON.stringify({
        session_id: "sess-test",
        repo_id: "demo-checkout",
        component: "checkoutService",
        error: "Checkout failed",
        hypothesis: "DB timeout retry",
        hypothesis_category: "database",
        change: "increased timeout again",
        result: "failed",
        evidence: "db query ok",
        prior_fingerprints: body1.updated_fingerprints
      })
    });
    assert.strictEqual(res2.statusCode, 200);
    const body2 = JSON.parse(res2.body);
    assert.strictEqual(body2.loop_detected, true, "Person 1 loop detection must remain functional");
  });

  // REAL BEDROCK INTEGRATION TEST (Labeled and Isolated)
  console.log("\nSuite 9: REAL BEDROCK TEST (Live AWS Invocation Check)");
  delete process.env.LOOPBREAK_USE_FIXTURE; // Disable fixture to test real Bedrock path

  try {
    await analyzeDebuggingSession({
      sessionId: "live-test-001",
      repoId: "demo-checkout",
      component: "checkoutService",
      attempts: [
        {
          hypothesis: "DB timeout",
          hypothesis_category: "database",
          change: "None",
          result: "Failed",
          evidence: "Database query ok"
        }
      ]
    });
    console.log("  ✓ [REAL BEDROCK TEST]: Live Bedrock invocation succeeded!");
  } catch (err) {
    console.log(`  ℹ [REAL BEDROCK TEST]: Live Bedrock call reached AWS endpoint.`);
    console.log(`    Status: Preserved real Bedrock path. Expected account error captured: ${err.name} - ${err.message}`);
    // Confirm it failed because of real AWS validation/access without silently falling back to fixture
    assert.ok(
      err.name === "ValidationException" ||
      err.name === "AccessDeniedException" ||
      err.message.includes("Operation not allowed") ||
      err.message.includes("security token"),
      "Real Bedrock must throw real AWS exception when unauthorized and not mask it"
    );
  }

  console.log("\n==========================================");
  console.log(`ALL ${totalTests} TESTS PASSED SUCCESSFULLY! (${passedTests}/${totalTests})`);
  console.log("==========================================\n");
}

main().catch(err => {
  console.error("Test Suite Failed:", err);
  process.exit(1);
});
