const http = require("http");
const { handler } = require("./handler");

const PORT = process.env.PORT || 3000;
const HOST = process.env.HOST || "127.0.0.1";

const server = http.createServer(async (req, res) => {
  // CORS Preflight headers
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  res.setHeader("Access-Control-Allow-Methods", "GET,POST,OPTIONS");

  if (req.method === "OPTIONS") {
    res.writeHead(200);
    res.end(JSON.stringify({ success: true }));
    return;
  }

  const parsedUrl = new URL(req.url, `http://${req.headers.host || HOST}`);
  const pathname = parsedUrl.pathname;
  const queryParams = Object.fromEntries(parsedUrl.searchParams.entries());

  let rawBody = "";
  req.on("data", chunk => {
    rawBody += chunk;
  });

  req.on("end", async () => {
    const event = {
      httpMethod: req.method,
      path: pathname,
      rawPath: pathname,
      body: rawBody,
      queryStringParameters: queryParams,
      headers: req.headers
    };

    try {
      const lambdaRes = await handler(event);
      res.writeHead(lambdaRes.statusCode, lambdaRes.headers || { "Content-Type": "application/json" });
      res.end(lambdaRes.body);
    } catch (err) {
      console.error("Local server error:", err);
      res.writeHead(500, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ success: false, error: "Internal server error" }));
    }
  });
});

if (require.main === module) {
  server.listen(PORT, HOST, () => {
    console.log(`LoopBreak backend running locally on http://${HOST}:${PORT}`);
  });
}

module.exports = { server };
