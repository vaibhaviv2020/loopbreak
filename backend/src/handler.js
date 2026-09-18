const { createFingerprint } = require("./services/fingerprint");
const { putMemory, getMemories } = require("./services/dynamodb");

const requiredFields = [
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

async function handleAttempt(body) {
  for (const field of requiredFields) {
    if (!body[field]) {
      return response(400, {
        success: false,
        error: `Missing required field: ${field}`
      });
    }
  }

  const allowedCategories = [
    "database",
    "payment_api",
    "auth",
    "network",
    "cache",
    "configuration",
    "frontend"
  ];

  if (!allowedCategories.includes(body.hypothesis_category)) {
    return response(400, {
      success: false,
      error: "Invalid hypothesis_category"
    });
  }

  const fingerprint = createFingerprint(
    body.repo_id,
    body.component,
    body.hypothesis_category
  );

  const existingMemories = await getMemories(
    body.repo_id,
    body.component
  );

  const loopDetected = existingMemories.some(
    memory => memory.fingerprint === fingerprint
  );

  const timestamp = new Date().toISOString();

  const memory = {
    PK: `${body.repo_id}#${body.component}`,
    SK: timestamp,
    session_id: body.session_id,
    repo_id: body.repo_id,
    component: body.component,
    error: body.error,
    hypothesis: body.hypothesis,
    hypothesis_category: body.hypothesis_category,
    change: body.change,
    result: body.result,
    evidence: body.evidence,
    fingerprint,
    memory_type: "debugging_attempt",
    timestamp
  };

  await putMemory(memory);

  return response(200, {
    success: true,
    fingerprint,
    loop_detected: loopDetected
  });
}

async function handleMemory(repoId, component) {
  if (!repoId || !component) {
    return response(400, {
      success: false,
      error: "Missing required repo_id or component"
    });
  }

  const memories = await getMemories(repoId, component);

  return response(200, {
    success: true,
    memories
  });
}

exports.handler = async (event) => {
  try {
    const method = event.requestContext?.http?.method || event.httpMethod;
    const path = event.rawPath || event.path || "/";

    if (method === "OPTIONS") {
      return response(200, { success: true });
    }

    if (method === "POST" && path === "/attempt") {
      const body = parseBody(event);
      return await handleAttempt(body);
    }

    if (method === "GET" && path === "/memory") {
      const params = event.queryStringParameters || {};
      return await handleMemory(params.repo_id, params.component);
    }

    if (method === "GET" && path === "/recall") {
      const params = event.queryStringParameters || {};
      return await handleMemory(params.repo_id, params.component);
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