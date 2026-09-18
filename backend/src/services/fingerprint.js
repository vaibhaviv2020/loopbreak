const crypto = require("crypto");

function normalize(value) {
  return String(value || "")
    .toLowerCase()
    .trim()
    .replace(/\s+/g, " ");
}

function createFingerprint(repoId, component, hypothesisCategory) {
  const normalized = [
    normalize(repoId),
    normalize(component),
    normalize(hypothesisCategory)
  ].join("|");

  return crypto
    .createHash("sha256")
    .update(normalized)
    .digest("hex");
}

module.exports = {
  createFingerprint
};