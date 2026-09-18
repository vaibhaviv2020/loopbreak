const { createFingerprint } = require("./services/fingerprint");
const { putMemory, getMemories } = require("./services/dynamodb");

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
      return response(501, {
        success: false,
        error: "Bedrock analysis integration is not connected yet"
      });
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