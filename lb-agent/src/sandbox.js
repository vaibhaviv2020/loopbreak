const path = require("path");
const fs = require("fs");

/**
 * Resolves a path strictly within repoRoot.
 * Rejects path traversal (e.g. .., ../.., escapes).
 */
function resolveSafePath(repoRoot, requestedPath) {
  if (!repoRoot || typeof repoRoot !== "string") {
    throw new Error("Sandbox error: Invalid repository root");
  }

  if (!requestedPath || typeof requestedPath !== "string") {
    throw new Error("Sandbox error: Path must be a non-empty string");
  }

  // Reject explicit traversal characters
  if (requestedPath.includes("..") || requestedPath.includes("\0")) {
    throw new Error(`Security error: Path traversal detected in "${requestedPath}"`);
  }

  const normalizedRoot = path.resolve(repoRoot);
  const resolvedPath = path.resolve(normalizedRoot, requestedPath);

  // Ensure resolved path starts with normalized root
  if (
    resolvedPath !== normalizedRoot &&
    !resolvedPath.startsWith(normalizedRoot + path.sep)
  ) {
    throw new Error(
      `Security error: Path "${requestedPath}" escapes repository root "${repoRoot}"`
    );
  }

  return resolvedPath;
}

module.exports = {
  resolveSafePath
};
