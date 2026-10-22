#!/usr/bin/env node
import fs from "node:fs/promises";
import http from "node:http";
import path from "node:path";

const root = path.resolve(process.cwd());
const port = Number(process.argv[2] || 4173);
const mime = new Map([
  [".html", "text/html; charset=utf-8"],
  [".css", "text/css; charset=utf-8"],
  [".js", "text/javascript; charset=utf-8"],
  [".json", "application/json; charset=utf-8"],
  [".svg", "image/svg+xml"],
  [".png", "image/png"]
]);

if (!Number.isInteger(port) || port < 1 || port > 65535) {
  console.error("Port must be an integer between 1 and 65535.");
  process.exit(2);
}

const server = http.createServer(async function (request, response) {
  if (request.method !== "GET" && request.method !== "HEAD") {
    response.writeHead(405, { "Content-Type": "text/plain; charset=utf-8", "Allow": "GET, HEAD" });
    response.end("Method not allowed.\n");
    return;
  }

  let pathname;
  try {
    pathname = decodeURIComponent(new URL(request.url || "/", "http://127.0.0.1").pathname);
  } catch (_) {
    response.writeHead(400, { "Content-Type": "text/plain; charset=utf-8" });
    response.end("Invalid URL.\n");
    return;
  }

  if (pathname === "/") pathname = "/app/";
  let target = path.resolve(root, "." + pathname);
  const rootPrefix = root.endsWith(path.sep) ? root : root + path.sep;
  if (target !== root && !target.startsWith(rootPrefix)) {
    response.writeHead(403, { "Content-Type": "text/plain; charset=utf-8" });
    response.end("Forbidden.\n");
    return;
  }

  try {
    let stat = await fs.stat(target);
    if (stat.isDirectory()) {
      target = path.join(target, "index.html");
      stat = await fs.stat(target);
    }
    if (!stat.isFile()) throw new Error("Not a file.");

    const headers = {
      "Content-Type": mime.get(path.extname(target).toLowerCase()) || "application/octet-stream",
      "Content-Length": stat.size,
      "Cache-Control": "no-store",
      "X-Content-Type-Options": "nosniff",
      "Referrer-Policy": "no-referrer",
      "Content-Security-Policy": "default-src 'self'; script-src 'self'; style-src 'self'; connect-src 'self'; img-src 'self' data:; object-src 'none'; base-uri 'none'; frame-ancestors 'none'"
    };
    response.writeHead(200, headers);
    if (request.method === "HEAD") response.end();
    else response.end(await fs.readFile(target));
  } catch (_) {
    response.writeHead(404, { "Content-Type": "text/plain; charset=utf-8", "Cache-Control": "no-store" });
    response.end("Not found.\n");
  }
});

server.listen(port, "127.0.0.1", function () {
  console.log("KingPreflight preview: http://127.0.0.1:" + port + "/app/");
  console.log("Static files are served from this project; the server listens only on 127.0.0.1.");
  console.log("Press Ctrl+C to stop.");
});
