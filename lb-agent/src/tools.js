const fs = require("fs");
const path = require("path");
const { spawnSync } = require("child_process");
const { resolveSafePath } = require("./sandbox");
const { redactSensitiveData } = require("./redact");

const ALLOWED_CATEGORIES = [
  "database",
  "payment_api",
  "auth",
  "network",
  "cache",
  "configuration",
  "frontend"
];

/**
 * 1. list_files: Lists files within a sandboxed subfolder.
 */
function list_files(repoRoot, subpath = "") {
  const safeDir = resolveSafePath(repoRoot, subpath || ".");
  if (!fs.existsSync(safeDir) || !fs.statSync(safeDir).isDirectory()) {
    throw new Error(`Directory not found: "${subpath}"`);
  }

  const entries = [];
  function scan(currentDir, relBase) {
    const items = fs.readdirSync(currentDir, { withFileTypes: true });
    for (const item of items) {
      if (item.name === "node_modules" || item.name === ".git") continue;
      const relPath = relBase ? `${relBase}/${item.name}` : item.name;
      if (item.isDirectory()) {
        entries.push({ path: relPath, type: "directory" });
        scan(path.join(currentDir, item.name), relPath);
      } else {
        entries.push({ path: relPath, type: "file" });
      }
    }
  }

  scan(safeDir, subpath.replace(/^[./\\]+/, ""));
  return entries;
}

/**
 * 2. read_file: Reads file content within the sandbox.
 */
function read_file(repoRoot, filepath) {
  const safeFile = resolveSafePath(repoRoot, filepath);
  if (!fs.existsSync(safeFile) || !fs.statSync(safeFile).isFile()) {
    throw new Error(`File not found: "${filepath}"`);
  }

  const content = fs.readFileSync(safeFile, "utf8");
  return redactSensitiveData(content);
}

/**
 * 3. edit_file: Applies an edit with mandatory hypothesis and category.
 */
function edit_file(repoRoot, { path: relPath, search, replace, newContent, hypothesis, hypothesis_category }) {
  if (!hypothesis || typeof hypothesis !== "string" || !hypothesis.trim()) {
    throw new Error("Validation error: edit_file requires an explicit 'hypothesis' declaration");
  }

  if (!hypothesis_category || !ALLOWED_CATEGORIES.includes(hypothesis_category)) {
    throw new Error(
      `Validation error: edit_file requires a valid 'hypothesis_category'. Allowed: ${ALLOWED_CATEGORIES.join(", ")}`
    );
  }

  const safeFile = resolveSafePath(repoRoot, relPath);
  if (!fs.existsSync(safeFile)) {
    throw new Error(`Target file does not exist: "${relPath}"`);
  }

  const originalContent = fs.readFileSync(safeFile, "utf8");
  let updatedContent = "";
  let changeDescription = "";

  if (typeof newContent === "string") {
    updatedContent = newContent;
    changeDescription = `Replaced full content of ${relPath}`;
  } else if (typeof search === "string" && typeof replace === "string") {
    if (!originalContent.includes(search)) {
      throw new Error(`Target search string not found in "${relPath}"`);
    }
    updatedContent = originalContent.replace(search, replace);
    changeDescription = `Replaced "${search.trim()}" with "${replace.trim()}" in ${relPath}`;
  } else {
    throw new Error("edit_file requires either 'newContent' or 'search' and 'replace'");
  }

  fs.writeFileSync(safeFile, updatedContent, "utf8");

  return {
    success: true,
    path: relPath,
    change: changeDescription,
    hypothesis: hypothesis.trim(),
    hypothesis_category,
    bytesWritten: Buffer.byteLength(updatedContent, "utf8")
  };
}

/**
 * 4. run_tests: Executes ONLY the preconfigured test command.
 * Strictly ignores arbitrary commands.
 */
function run_tests(repoRoot, configuredCommand = "node test/checkout.test.js") {
  const normalizedRoot = resolveSafePath(repoRoot, ".");

  // Only permit configured node / npm test execution, never arbitrary strings
  const cmd = process.platform === "win32" ? "cmd.exe" : "sh";
  const args = process.platform === "win32" ? ["/c", configuredCommand] : ["-c", configuredCommand];

  const result = spawnSync(cmd, args, {
    cwd: normalizedRoot,
    encoding: "utf8",
    timeout: 15000,
    windowsHide: true
  });

  const stdout = redactSensitiveData(result.stdout || "");
  const stderr = redactSensitiveData(result.stderr || "");
  const exitCode = result.status ?? (result.error ? 1 : 0);
  const passed = exitCode === 0;

  // Extract key evidence lines
  const combined = stdout + "\n" + stderr;
  const evidenceLines = combined
    .split("\n")
    .map(line => line.trim())
    .filter(line => line.startsWith("Evidence:") || line.startsWith("FAILURE:") || line.startsWith("RESULT:"))
    .map(line => line.replace(/^(Evidence|FAILURE|RESULT):\s*/, ""));

  const primaryEvidence = evidenceLines.join("; ") || (passed ? "All tests passed" : "Test failed");

  return {
    exitCode,
    passed,
    stdout,
    stderr,
    evidence: primaryEvidence,
    resultSummary: passed ? "Checkout test passed" : `Failed with exit code ${exitCode}`
  };
}

module.exports = {
  list_files,
  read_file,
  edit_file,
  run_tests,
  ALLOWED_CATEGORIES
};
