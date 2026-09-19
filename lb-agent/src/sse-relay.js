const http = require("http");

const DEFAULT_PORT = process.env.SSE_PORT || 8787;
const DEFAULT_HOST = process.env.SSE_HOST || "127.0.0.1";

class SSERelay {
  constructor(port = DEFAULT_PORT, host = DEFAULT_HOST) {
    this.port = port;
    this.host = host;
    this.clients = new Set();
    this.server = null;
    this.triggerHandler = null;
    this.lastEvent = null;
    this.eventHistory = [];
  }

  setTriggerHandler(fn) {
    this.triggerHandler = fn;
  }

  start() {
    return new Promise((resolve, reject) => {
      this.server = http.createServer((req, res) => {
        // CORS headers
        res.setHeader("Access-Control-Allow-Origin", "*");
        res.setHeader("Access-Control-Allow-Headers", "Content-Type");
        res.setHeader("Access-Control-Allow-Methods", "GET,POST,OPTIONS");

        if (req.method === "OPTIONS") {
          res.writeHead(200);
          res.end(JSON.stringify({ success: true }));
          return;
        }

        const url = new URL(req.url, `http://${req.headers.host || this.host}`);

        if (url.pathname === "/events") {
          res.writeHead(200, {
            "Content-Type": "text/event-stream",
            "Cache-Control": "no-cache",
            Connection: "keep-alive"
          });

          // Send initial connection event
          res.write(`data: ${JSON.stringify({ type: "connected", timestamp: new Date().toISOString() })}\n\n`);

          // If there's recent history, send it so reconnecting clients catch up
          for (const ev of this.eventHistory.slice(-10)) {
            res.write(`data: ${JSON.stringify(ev)}\n\n`);
          }

          this.clients.add(res);

          req.on("close", () => {
            this.clients.delete(res);
          });
          return;
        }

        if (url.pathname === "/status" && req.method === "GET") {
          res.writeHead(200, { "Content-Type": "application/json" });
          res.end(
            JSON.stringify({
              status: "running",
              activeClients: this.clients.size,
              lastEvent: this.lastEvent
            })
          );
          return;
        }

        if (url.pathname === "/trigger" && req.method === "POST") {
          let body = "";
          req.on("data", chunk => (body += chunk));
          req.on("end", async () => {
            try {
              const payload = body ? JSON.parse(body) : {};
              if (this.triggerHandler) {
                // Execute trigger asynchronously
                this.triggerHandler(payload).catch(err => {
                  console.error("[SSERelay] Trigger execution error:", err);
                });
                res.writeHead(202, { "Content-Type": "application/json" });
                res.end(JSON.stringify({ success: true, message: `Agent ${payload.agent || "run"} triggered` }));
              } else {
                res.writeHead(503, { "Content-Type": "application/json" });
                res.end(JSON.stringify({ success: false, error: "No agent trigger handler registered" }));
              }
            } catch (err) {
              res.writeHead(400, { "Content-Type": "application/json" });
              res.end(JSON.stringify({ success: false, error: err.message }));
            }
          });
          return;
        }

        res.writeHead(404, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ error: "Not found" }));
      });

      this.server.on("error", reject);
      this.server.listen(this.port, this.host, () => {
        console.log(`[SSERelay] Observability SSE server running at http://${this.host}:${this.port}/events`);
        resolve(this);
      });
    });
  }

  emit(eventType, data = {}) {
    const payload = {
      type: eventType,
      data,
      timestamp: new Date().toISOString()
    };

    this.lastEvent = payload;
    this.eventHistory.push(payload);
    if (this.eventHistory.length > 50) {
      this.eventHistory.shift();
    }

    const sseMessage = `data: ${JSON.stringify(payload)}\n\n`;
    for (const client of this.clients) {
      try {
        client.write(sseMessage);
      } catch (err) {
        this.clients.delete(client);
      }
    }
  }

  stop() {
    return new Promise(resolve => {
      for (const client of this.clients) {
        try {
          client.end();
        } catch {}
      }
      this.clients.clear();
      if (this.server) {
        this.server.close(() => resolve());
      } else {
        resolve();
      }
    });
  }
}

module.exports = {
  SSERelay,
  DEFAULT_PORT,
  DEFAULT_HOST
};
