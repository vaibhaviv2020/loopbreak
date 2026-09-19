const {
  BedrockRuntimeClient,
  InvokeModelCommand
} = require("@aws-sdk/client-bedrock-runtime");

const DEFAULT_REGION = "eu-north-1";
const DEFAULT_MODEL_ID = "eu.anthropic.claude-haiku-4-5-20251001-v1:0";

const client = new BedrockRuntimeClient({
  region: process.env.AWS_REGION || DEFAULT_REGION
});

const SYSTEM_PROMPT = `You are an evidence-driven debugging reasoning engine for LoopBreak.
Your responsibility is to analyze accumulated debugging attempts from software engineering sessions and output structured reasoning.

CRITICAL INTEGRITY RULES:
1. ZERO HALLUCINATION: Rely STRICTLY on the supplied error, component, attempts, and evidence. Never invent logs, API responses, database results, stack traces, files, timings, metrics, patches, or verification results.
2. DISTINGUISH EVIDENCE FROM INFERENCE: Clearly separate what was explicitly observed in the evidence from what you infer.
3. RULED-OUT HYPOTHESES: Identify hypotheses that have negative evidence or failed changes. State the explicit evidence that rules them out.
4. DETECT REPEATED DEAD ENDS: If multiple attempts investigate the same hypothesis category (e.g., database) and fail, mark that direction as unsupported and steer away from it.
5. NEXT INVESTIGATION: Recommend the next logical investigation supported by the available evidence.
6. ROOT CAUSE AND FIX: Only determine a root cause and suggest a fix when the supplied evidence is sufficient to conclusively support it. If evidence is insufficient, set "root_cause": null and "fix": null. Absence of evidence is not proof of failure.
7. VERIFICATION: Only report a fix as verified if explicit verification evidence was supplied in the attempts. If not verified or pending, report "Not yet verified" or null.
8. OUTPUT FORMAT: Respond ONLY with valid, raw JSON adhering strictly to the schema below. Do not wrap in conversational markdown or explanation outside the JSON.

SCHEMA:
{
  "ruled_out": [
    {
      "hypothesis": "string describing ruled out hypothesis",
      "reason": "string explaining why it is ruled out using evidence",
      "evidence": ["array of supporting evidence strings from input"]
    }
  ],
  "evidence": ["array of all key evidence strings extracted from attempts"],
  "current_hypothesis_supported": false,
  "next_investigation": "string describing the next recommended investigation direction",
  "root_cause": "string explaining root cause if evidence is sufficient, otherwise null",
  "fix": "string describing the code or configuration fix if evidence is sufficient, otherwise null",
  "verification": "string describing verification if verified in input, otherwise null"
}`;

/**
 * Builds the user prompt message from the session attempts.
 */
function buildUserMessage(repoId, component, attempts) {
  const attemptsSummary = attempts.map((att, idx) => {
    return `Attempt ${idx + 1}:
- Hypothesis: ${att.hypothesis || "N/A"}
- Category: ${att.hypothesis_category || "N/A"}
- Change Applied: ${att.change || "None"}
- Result: ${att.result || "N/A"}
- Observed Evidence: ${att.evidence || "None"}`;
  }).join("\n\n");

  return `Repository: ${repoId}
Component: ${component}
Debugging History (${attempts.length} attempts):

${attemptsSummary}

Analyze this debugging history based strictly on the supplied evidence. Output JSON only.`;
}

/**
 * Defensively extracts and validates the JSON output from the model.
 */
function parseAndValidateModelOutput(rawText) {
  if (!rawText || typeof rawText !== "string") {
    throw new Error("Empty or invalid model response text");
  }

  let cleaned = rawText.trim();

  // Strip markdown code fences if present (e.g. ```json ... ```)
  const fenceMatch = cleaned.match(/```(?:json)?\s*([\s\S]*?)\s*```/);
  if (fenceMatch) {
    cleaned = fenceMatch[1].trim();
  } else {
    // If text surrounds the JSON, find outermost { and }
    const firstBrace = cleaned.indexOf("{");
    const lastBrace = cleaned.lastIndexOf("}");
    if (firstBrace !== -1 && lastBrace !== -1 && lastBrace > firstBrace) {
      cleaned = cleaned.substring(firstBrace, lastBrace + 1);
    }
  }

  let parsed;
  try {
    parsed = JSON.parse(cleaned);
  } catch (err) {
    throw new Error(`Failed to parse model output as JSON: ${err.message}`);
  }

  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
    throw new Error("Model output is not a JSON object");
  }

  // Validate required fields
  if (!Array.isArray(parsed.ruled_out)) {
    throw new Error("Missing or invalid field: ruled_out must be an array");
  }
  if (!Array.isArray(parsed.evidence)) {
    throw new Error("Missing or invalid field: evidence must be an array");
  }
  if (typeof parsed.current_hypothesis_supported !== "boolean") {
    // Normalize if returned as string or array
    if (parsed.current_hypothesis_supported === "false" || Array.isArray(parsed.current_hypothesis_supported)) {
      parsed.current_hypothesis_supported = false;
    } else if (parsed.current_hypothesis_supported === "true") {
      parsed.current_hypothesis_supported = true;
    } else {
      throw new Error("Missing or invalid field: current_hypothesis_supported must be a boolean");
    }
  }
  if (!parsed.next_investigation || (typeof parsed.next_investigation !== "string" && !Array.isArray(parsed.next_investigation))) {
    throw new Error("Missing or invalid field: next_investigation must be a string");
  }
  if (Array.isArray(parsed.next_investigation)) {
    parsed.next_investigation = parsed.next_investigation.join("; ");
  }

  // Normalize null/empty fields
  if (parsed.root_cause !== null && typeof parsed.root_cause !== "string") {
    parsed.root_cause = null;
  }
  if (parsed.fix !== null && typeof parsed.fix !== "string") {
    parsed.fix = null;
  }
  if (parsed.verification !== null && typeof parsed.verification !== "string") {
    parsed.verification = null;
  }

  return {
    ruled_out: parsed.ruled_out.map(item => ({
      hypothesis: String(item.hypothesis || ""),
      reason: String(item.reason || ""),
      evidence: Array.isArray(item.evidence) ? item.evidence.map(String) : []
    })),
    evidence: parsed.evidence.map(String),
    current_hypothesis_supported: parsed.current_hypothesis_supported,
    next_investigation: parsed.next_investigation,
    root_cause: parsed.root_cause,
    fix: parsed.fix,
    verification: parsed.verification
  };
}

/**
 * Deterministic fixture analysis for local development and offline testing.
 * Enabled strictly when LOOPBREAK_USE_FIXTURE=true.
 */
function getFixtureAnalysis(repoId, component, attempts) {
  const allEvidence = [];
  const dbAttempts = [];
  let hasPaymentEvidence = false;
  let hasVerification = false;

  for (const att of attempts) {
    if (att.evidence) {
      allEvidence.push(att.evidence);
      if (att.evidence.toLowerCase().includes("payment api") || att.evidence.toLowerCase().includes("client timeout")) {
        hasPaymentEvidence = true;
      }
      if (att.evidence.toLowerCase().includes("passed") || (att.result && att.result.toLowerCase().includes("passed"))) {
        hasVerification = true;
      }
    }
    if (att.hypothesis_category === "database") {
      dbAttempts.push(att);
    }
  }

  const ruledOut = [];
  if (dbAttempts.length > 0) {
    for (const dbAtt of dbAttempts) {
      ruledOut.push({
        hypothesis: dbAtt.hypothesis || "Database issue",
        reason: "Database operations succeeded without error",
        evidence: [dbAtt.evidence || "Database query completes successfully"]
      });
    }
  }

  // Insufficient evidence scenario
  if (attempts.length === 1 && !hasPaymentEvidence && !hasVerification) {
    return {
      ruled_out: ruledOut,
      evidence: allEvidence.length > 0 ? allEvidence : ["Initial attempt inconclusive"],
      current_hypothesis_supported: false,
      next_investigation: "Collect additional telemetry and examine downstream API latency",
      root_cause: null,
      fix: null,
      verification: null
    };
  }

  // Full checkout scenario with payment evidence
  if (hasPaymentEvidence) {
    return {
      ruled_out: ruledOut.length > 0 ? ruledOut : [
        {
          hypothesis: "The database connection is timing out",
          reason: "Database query completes successfully",
          evidence: ["Database query completes successfully"]
        }
      ],
      evidence: allEvidence.length > 0 ? allEvidence : [
        "Database query completes successfully",
        "Payment API responds after approximately 3.8 seconds",
        "Client timeout is 2 seconds"
      ],
      current_hypothesis_supported: false,
      next_investigation: "Investigate the payment API response timeout",
      root_cause: "Payment API response exceeds the client timeout",
      fix: "Increase payment request timeout from 2 seconds to 5 seconds",
      verification: hasVerification ? "Checkout test passed" : "Not yet verified"
    };
  }

  // General fallback reasoning
  return {
    ruled_out: ruledOut,
    evidence: allEvidence,
    current_hypothesis_supported: false,
    next_investigation: `Investigate non-${dbAttempts.length > 0 ? "database" : "current"} components and check upstream/downstream services`,
    root_cause: null,
    fix: null,
    verification: hasVerification ? "Verified" : null
  };
}

/**
 * Analyzes a debugging session using Amazon Bedrock or deterministic fixture.
 */
async function analyzeDebuggingSession({ sessionId, repoId, component, attempts }) {
  // Explicit Development Fixture Mode
  if (process.env.LOOPBREAK_USE_FIXTURE === "true") {
    return getFixtureAnalysis(repoId, component, attempts);
  }

  // Production Real Bedrock Path
  const modelId = process.env.BEDROCK_MODEL_ID || DEFAULT_MODEL_ID;
  const userMessage = buildUserMessage(repoId, component, attempts);

  const payload = {
    anthropic_version: "bedrock-2023-05-31",
    max_tokens: 1024,
    temperature: 0,
    system: SYSTEM_PROMPT,
    messages: [
      {
        role: "user",
        content: userMessage
      }
    ]
  };

  const command = new InvokeModelCommand({
    modelId,
    contentType: "application/json",
    accept: "application/json",
    body: JSON.stringify(payload)
  });

  // REAL BEDROCK CALL — Errors are NOT silently swallowed or fallen back to fixture
  const response = await client.send(command);
  const responseBodyText = new TextDecoder().decode(response.body);

  const responseJson = JSON.parse(responseBodyText);
  const contentText = responseJson.content?.[0]?.text;

  if (!contentText) {
    throw new Error("Bedrock returned empty content text");
  }

  return parseAndValidateModelOutput(contentText);
}

module.exports = {
  analyzeDebuggingSession,
  parseAndValidateModelOutput,
  buildUserMessage,
  getFixtureAnalysis,
  SYSTEM_PROMPT,
  DEFAULT_MODEL_ID,
  DEFAULT_REGION
};
