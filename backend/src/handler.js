const { createFingerprint } = require("./services/fingerprint");
const { putMemory, getMemories } = require("./services/dynamodb");
const { analyzeDebuggingSession } = require("./services/bedrock");

const requiredAttemptFields = [
  "session_id",
  "repo_id",
  "component",
  "error",
  "hypothesis",
  "hypothesis_category",
  "change",
  "result",
  "evidence"
];

const allowedCategories = [
  "database",
  "payment_api",
  "auth",
  "network",
  "cache",
  "configuration",
  "frontend"
];

function response(statusCode, body) {
  return {
    statusCode,
    headers: {
      "Content-Type": "application/json",
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Headers": "Content-Type",
      "Access-Control-Allow-Methods": "GET,POST,OPTIONS"
    },
    body: JSON.stringify(body)
  };
}

function parseBody(event) {
  if (!event.body) {
    return {};
  }

  try {
    return typeof event.body === "string"
      ? JSON.parse(event.body)
      : event.body;
  } catch {
    throw new Error("Malformed JSON");
  }
}

function validateAttempt(body) {
  for (const field of requiredAttemptFields) {
    if (!body[field]) {
      return `Missing required field: ${field}`;
    }
  }

  if (!allowedCategories.includes(body.hypothesis_category)) {
    return "Invalid hypothesis_category";
  }

  return null;
}

async function handleAttempt(body) {
  const validationError = validateAttempt(body);

  if (validationError) {
    return response(400, {
      success: false,
      error: validationError
    });
  }

  const fingerprint = createFingerprint(
    body.repo_id,
    body.component,
    body.hypothesis_category
  );

  const priorFingerprints = Array.isArray(body.prior_fingerprints)
    ? body.prior_fingerprints
    : [];

  const loopDetected = priorFingerprints.includes(fingerprint);

  const updatedFingerprints = [
    ...new Set([...priorFingerprints, fingerprint])
  ];

  return response(200, {
    success: true,
    fingerprint,
    loop_detected: loopDetected,
    updated_fingerprints: updatedFingerprints
  });
}

async function handleMemory(body) {
  const requiredFields = [
    "session_id",
    "repo_id",
    "component",
    "error",
    "hypothesis_category",
    "failed_hypotheses",
    "evidence",
    "root_cause",
    "fix",
    "verification"
  ];

  for (const field of requiredFields) {
    if (
      body[field] === undefined ||
      body[field] === null ||
      body[field] === ""
    ) {
      return response(400, {
        success: false,
        error: `Missing required field: ${field}`
      });
    }
  }

  if (!allowedCategories.includes(body.hypothesis_category)) {
    return response(400, {
      success: false,
      error: "Invalid hypothesis_category"
    });
  }

  const timestamp = body.timestamp || new Date().toISOString();

  const memory = {
    PK: `${body.repo_id}#${body.component}`,
    SK: timestamp,
    session_id: body.session_id,
    repo_id: body.repo_id,
    component: body.component,
    error: body.error,
    hypothesis_category: body.hypothesis_category,
    failed_hypotheses: body.failed_hypotheses,
    evidence: body.evidence,
    root_cause: body.root_cause,
    fix: body.fix,
    verification: body.verification,
    timestamp,
    memory_type: "resolved_debugging_memory"
  };

  await putMemory(memory);

  return response(200, {
    success: true,
    memory
  });
}

async function handleRecall(
  repoId,
  component,
  hypothesisCategory,
  sessionId
) {
  if (!repoId || !component) {
    return response(400, {
      success: false,
      error: "Missing required repo_id or component"
    });
  }

  const memories = await getMemories(repoId, component);

  let relevantMemories = memories.filter(
    memory => memory.memory_type === "resolved_debugging_memory"
  );

  if (hypothesisCategory) {
    relevantMemories = relevantMemories.filter(
      memory => memory.hypothesis_category === hypothesisCategory
    );
  }

  if (sessionId) {
    relevantMemories = relevantMemories.filter(
      memory => memory.session_id !== sessionId
    );
  }

  return response(200, {
    success: true,
    prior_memory_found: relevantMemories.length > 0,
    memories: relevantMemories
  });
}

function validateAnalyze(body) {
  if (!body || typeof body !== "object") {
    return "Request body must be an object";
  }

  const required = ["session_id", "repo_id", "component", "attempts"];
  for (const field of required) {
    if (body[field] === undefined || body[field] === null || body[field] === "") {
      return `Missing required field: ${field}`;
    }
  }

  if (!Array.isArray(body.attempts)) {
    return "Field 'attempts' must be an array";
  }

  for (let i = 0; i < body.attempts.length; i++) {
    const att = body.attempts[i];
    if (!att || typeof att !== "object") {
      return `Attempt at index ${i} must be an object`;
    }
    if (att.hypothesis_category && !allowedCategories.includes(att.hypothesis_category)) {
      return `Invalid hypothesis_category at attempt index ${i}`;
    }
  }

  return null;
}

async function handleAnalyze(body) {
  const validationError = validateAnalyze(body);
  if (validationError) {
    return response(400, {
      success: false,
      error: validationError
    });
  }

  try {
    const analysis = await analyzeDebuggingSession({
      sessionId: body.session_id,
      repoId: body.repo_id,
      component: body.component,
      attempts: body.attempts
    });

    return response(200, {
      success: true,
      analysis
    });
  } catch (err) {
    console.error("Bedrock analysis error:", err.name, err.message);

    if (
      err.name === "AccessDeniedException" ||
      err.message?.includes("AccessDenied") ||
      err.message?.includes("Operation not allowed")
    ) {
      return response(403, {
        success: false,
        error: "Bedrock access denied or model access not granted"
      });
    }

    if (err.name === "ThrottlingException" || err.name === "ModelNotReadyException") {
      return response(429, {
        success: false,
        error: "Bedrock service is currently throttled or busy"
      });
    }

    if (
      err.name === "ValidationException" ||
      err.message?.startsWith("Missing or invalid field") ||
      err.message?.includes("Failed to parse model output")
    ) {
      return response(500, {
        success: false,
        error: "Failed to produce valid structured reasoning from model"
      });
    }

    return response(500, {
      success: false,
      error: "Internal Bedrock analysis failure"
    });
  }
}

exports.handler = async event => {
  try {
    const method =
      event.requestContext?.http?.method || event.httpMethod;

    const path =
      event.rawPath || event.path || "/";

    if (method === "OPTIONS") {
      return response(200, {
        success: true
      });
    }

    if (method === "POST" && path === "/attempt") {
      const body = parseBody(event);
      return await handleAttempt(body);
    }

    if (method === "POST" && path === "/memory") {
      const body = parseBody(event);
      return await handleMemory(body);
    }

    if (method === "GET" && path === "/recall") {
      const params = event.queryStringParameters || {};

      return await handleRecall(
        params.repo_id,
        params.component,
        params.hypothesis_category,
        params.session_id
      );
    }

    if (method === "POST" && path === "/analyze") {
      const body = parseBody(event);
      return await handleAnalyze(body);
    }

    return response(404, {
      success: false,
      error: "Route not found"
    });
  } catch (error) {
    console.error("Backend error:", error);

    return response(500, {
      success: false,
      error: "Internal server error"
    });
  }
};