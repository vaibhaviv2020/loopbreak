/**
 * LoopBreak API Client for lb-agent.
 * Communicates with backend /attempt, /analyze, /memory, /recall.
 */

const { handler } = require("../../backend/src/handler");

const DEFAULT_API_URL = process.env.LOOPBREAK_API_URL || "http://127.0.0.1:3000";

class LoopBreakClient {
  constructor(baseUrl = DEFAULT_API_URL, useDirectHandler = false) {
    this.baseUrl = baseUrl.replace(/\/+$/, "");
    this.useDirectHandler = useDirectHandler;
  }

  async _request(pathname, method, body = null, query = null) {
    if (!this.useDirectHandler) {
      try {
        const url = new URL(`${this.baseUrl}${pathname}`);
        if (query) {
          for (const [k, v] of Object.entries(query)) {
            if (v !== undefined && v !== null) {
              url.searchParams.set(k, String(v));
            }
          }
        }

        const options = {
          method,
          headers: { "Content-Type": "application/json" }
        };
        if (body) {
          options.body = JSON.stringify(body);
        }

        const res = await fetch(url.toString(), options);
        const data = await res.json();
        if (!res.ok || data.success === false) {
          throw new Error(data.error || `HTTP ${res.status}`);
        }
        return data;
      } catch (err) {
        // If HTTP connection failed, fall back to in-process handler for resilience
        console.warn(`[LoopBreakClient] HTTP request failed (${err.message}). Using direct handler.`);
      }
    }

    // In-process Lambda event fallback
    const event = {
      httpMethod: method,
      path: pathname,
      rawPath: pathname,
      body: body ? JSON.stringify(body) : null,
      queryStringParameters: query || {}
    };

    const res = await handler(event);
    const parsed = JSON.parse(res.body);
    if (res.statusCode >= 400 || parsed.success === false) {
      throw new Error(parsed.error || `Backend returned status ${res.statusCode}`);
    }
    return parsed;
  }

  async recordAttempt(payload) {
    return this._request("/attempt", "POST", payload);
  }

  async analyzeSession(payload) {
    return this._request("/analyze", "POST", payload);
  }

  async saveMemory(payload) {
    return this._request("/memory", "POST", payload);
  }

  async recallMemory(params) {
    return this._request("/recall", "GET", null, params);
  }
}

module.exports = {
  LoopBreakClient
};
