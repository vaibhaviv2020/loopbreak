const MAX_OUTPUT_CHARS = 4000;

const REDACTION_PATTERNS = [
  // AWS Access Key ID
  { pattern: /AKIA[0-9A-Z]{16}/g, replacement: "[REDACTED_AWS_ACCESS_KEY]" },
  // AWS Secret / general session token approximations
  { pattern: /(aws_secret_access_key|aws_session_token)\s*[:=]\s*['"]?[A-Za-z0-9/+=]{16,}['"]?/gi, replacement: "$1=[REDACTED]" },
  // Authorization Bearer token
  { pattern: /Bearer\s+[A-Za-z0-9\-._~+/]+=*/gi, replacement: "Bearer [REDACTED_TOKEN]" },
  // Generic password / secret / api key
  { pattern: /(password|secret|api[_-]?key)\s*[:=]\s*['"]?[^\s'";,]+['"]?/gi, replacement: "$1=[REDACTED]" }
];

function redactSensitiveData(text) {
  if (typeof text !== "string") return "";

  let result = text;
  for (const { pattern, replacement } of REDACTION_PATTERNS) {
    result = result.replace(pattern, replacement);
  }

  // Bound maximum characters
  if (result.length > MAX_OUTPUT_CHARS) {
    const half = Math.floor(MAX_OUTPUT_CHARS / 2);
    result =
      result.slice(0, half) +
      `\n... [OUTPUT TRUNCATED: ${result.length - MAX_OUTPUT_CHARS} characters omitted] ...\n` +
      result.slice(-half);
  }

  return result;
}

module.exports = {
  redactSensitiveData,
  MAX_OUTPUT_CHARS
};
