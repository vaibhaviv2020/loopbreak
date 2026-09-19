const assert = require("assert");
const path = require("path");
const fs = require("fs");
const { resolveSafePath } = require("../src/sandbox");
const { redactSensitiveData } = require("../src/redact");
const { list_files, read_file, edit_file, run_tests } = require("../src/tools");
const { resetDemoRepo } = require("../src/agent");

const REPO_ROOT = path.resolve(__dirname, "../../demo-repo");

// Ensure clean buggy baseline before testing tools
resetDemoRepo(REPO_ROOT);

console.log("==========================================");
console.log("LB-AGENT TOOLS & SECURITY TEST SUITE");
console.log("==========================================\n");

// 1. Sandbox Traversal Tests
console.log("Test 1: Sandbox Path Security");
assert.throws(() => {
  resolveSafePath(REPO_ROOT, "../package.json");
}, /Path traversal detected/);

assert.throws(() => {
  resolveSafePath(REPO_ROOT, "../../etc/passwd");
}, /Path traversal detected/);

assert.throws(() => {
  resolveSafePath(REPO_ROOT, "C:\\Windows\\System32");
}, /Security error/);

const safeSrc = resolveSafePath(REPO_ROOT, "src/checkoutService.js");
assert.ok(safeSrc.startsWith(REPO_ROOT));
console.log("  ✓ Traversal attacks blocked correctly");

// 2. Redaction Tests
console.log("\nTest 2: Secret & Key Redaction");
const textWithKeys = "Found key AKIA1234567890ABCDEF and Bearer secret-token-xyz with password='my-secret-password'";
const redacted = redactSensitiveData(textWithKeys);
assert.ok(!redacted.includes("AKIA1234567890ABCDEF"));
assert.ok(redacted.includes("[REDACTED_AWS_ACCESS_KEY]"));
assert.ok(!redacted.includes("secret-token-xyz"));
console.log("  ✓ Sensitive credentials redacted");

// 3. list_files & read_file Tests
console.log("\nTest 3: File Inspection");
const files = list_files(REPO_ROOT);
assert.ok(files.some(f => f.path.includes("checkoutService.js")));
assert.ok(files.some(f => f.path.includes("checkout.test.js")));

const content = read_file(REPO_ROOT, "src/checkoutService.js");
assert.ok(content.includes("paymentClientTimeoutMs"));
console.log("  ✓ list_files and read_file work in sandbox");

// 4. edit_file Validation
console.log("\nTest 4: edit_file Constraints");
assert.throws(() => {
  edit_file(REPO_ROOT, {
    path: "src/checkoutService.js",
    search: "a",
    replace: "b"
    // Missing hypothesis
  });
}, /explicit 'hypothesis'/);

assert.throws(() => {
  edit_file(REPO_ROOT, {
    path: "src/checkoutService.js",
    search: "a",
    replace: "b",
    hypothesis: "Testing",
    hypothesis_category: "quantum_flux"
  });
}, /valid 'hypothesis_category'/);
console.log("  ✓ edit_file strictly enforces hypothesis and allowed category");

// 5. run_tests Execution
console.log("\nTest 5: run_tests Real Test Suite Execution");
const testRes = run_tests(REPO_ROOT, "node test/checkout.test.js");
assert.strictEqual(testRes.passed, false, "Initial checkout test must fail");
assert.strictEqual(testRes.exitCode, 1);
assert.ok(testRes.evidence.includes("Database query completes successfully"));
assert.ok(testRes.evidence.includes("Payment API"));
console.log("  ✓ Real test suite executed cleanly and returned bounded evidence");

console.log("\n==========================================");
console.log("ALL LB-AGENT TOOL TESTS PASSED!");
console.log("==========================================\n");
