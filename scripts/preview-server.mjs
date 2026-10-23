import fs from 'node:fs/promises';
import http from 'node:http';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
const root = fileURLToPath(new URL('../', import.meta.url));
const assets = new Map([
  ['/app/index.html', 'text/html; charset=utf-8'],
  ['/app/app.js', 'text/javascript; charset=utf-8'],
  ['/app/styles.css', 'text/css; charset=utf-8'],
  ['/src/scanner.js', 'text/javascript; charset=utf-8']
]);
export function createPreviewServer() {
  return http.createServer(async (request, response) => {
    const finish = (status, text) => { response.writeHead(status, {'Content-Type':'text/plain; charset=utf-8','Cache-Control':'no-store'}); response.end(text); };
    const port = response.socket.localPort;
    if (![ `127.0.0.1:${port}`, `localhost:${port}` ].includes(request.headers.host)) return finish(403, 'Forbidden host.');
    if (!['GET', 'HEAD'].includes(request.method)) return finish(405, 'Method not allowed.');
    let pathname;
    try { pathname = decodeURIComponent(new URL(request.url, 'http://127.0.0.1').pathname); }
    catch { return finish(400, 'Invalid URL.'); }
    if (pathname === '/' || pathname === '/app/') pathname = '/app/index.html';
    if (!assets.has(pathname)) return finish(404, 'Not found.');
    try {
      const target = path.join(root, pathname.slice(1));
      // Reject symlinks in every asset path component before opening it.
      let current = root;
      for (const part of pathname.slice(1).split('/')) {
        current = path.join(current, part);
        if ((await fs.lstat(current)).isSymbolicLink()) return finish(403, 'Linked assets are not served.');
      }
      const body = await fs.readFile(target);
      response.writeHead(200, {
        'Content-Type': assets.get(pathname), 'Content-Length':body.length,
        'Cache-Control':'no-store', 'X-Content-Type-Options':'nosniff',
        'Referrer-Policy':'no-referrer',
        'Content-Security-Policy':"default-src 'self'; script-src 'self'; style-src 'self'; connect-src 'self'; img-src 'self' data:; object-src 'none'; base-uri 'none'; frame-ancestors 'none'"
      });
      response.end(request.method === 'HEAD' ? undefined : body);
    } catch { finish(404, 'Not found.'); }
  });
}
if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  const port = Number(process.argv[2] || 4173);
  if (!Number.isInteger(port) || port < 1 || port > 65535) { console.error('Port must be an integer between 1 and 65535.'); process.exitCode = 2; }
  else {
    const server = createPreviewServer();
    server.on('error', error => { console.error(`Preview server failed: ${error.code || 'unknown error'}`); process.exitCode = 1; });
    server.listen(port, '127.0.0.1', () => console.log(`KingPreflight preview: http://127.0.0.1:${port}/app/`));
  }
}
