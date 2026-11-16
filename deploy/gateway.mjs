// Gateway in front of VideoHub: password (Basic auth), and a Host/Origin/Referer rewrite to 127.0.0.1:7788 as a fallback
// (VideoHub only trusts its own loopback names unless config.allowedHosts lists the public one). Handles SSE and WebSocket.
import http from 'node:http';
import net from 'node:net';
import crypto from 'node:crypto';
const T_HOST = '127.0.0.1', T_PORT = 7788, ORIGIN = `http://${T_HOST}:${T_PORT}`;
const PORT = Number(process.env.GATEWAY_PORT || 8080);
const USER = process.env.VH_USER || '', PASS = process.env.VH_PASS || '';
if (!USER || PASS.length < 12) { console.error('VH_USER and VH_PASS (12+ chars) are required'); process.exit(1); }
const want = Buffer.from('Basic ' + Buffer.from(`${USER}:${PASS}`).toString('base64'));
function authOk(h) { const got = Buffer.from(String(h || '')); return got.length === want.length && crypto.timingSafeEqual(got, want); }
function fix(raw) {
  const out = [];
  for (let i = 0; i < raw.length; i += 2) {
    const n = raw[i], l = n.toLowerCase(); let v = raw[i + 1];
    if (l === 'authorization') continue;
    if (l === 'host') v = `${T_HOST}:${T_PORT}`;
    else if (l === 'origin') v = ORIGIN;
    else if (l === 'referer') { try { const u = new URL(v); v = ORIGIN + u.pathname + u.search; } catch { v = ORIGIN + '/'; } }
    out.push([n, v]);
  }
  return out;
}
const server = http.createServer((req, res) => {
  if (!authOk(req.headers.authorization)) { res.writeHead(401, { 'WWW-Authenticate': 'Basic realm="VideoHub"' }); return res.end('401'); }
  const headers = {};
  for (const [n, v] of fix(req.rawHeaders)) { const l = n.toLowerCase(); headers[l] = headers[l] === undefined ? v : [].concat(headers[l], v); }
  const up = http.request({ host: T_HOST, port: T_PORT, method: req.method, path: req.url, headers }, r => { res.writeHead(r.statusCode || 502, r.headers); r.pipe(res); });
  up.on('error', () => { if (!res.headersSent) res.writeHead(502); res.end('502'); });
  req.pipe(up);
});
server.on('upgrade', (req, socket, head) => {
  if (!authOk(req.headers.authorization)) { socket.end('HTTP/1.1 401 Unauthorized\r\nContent-Length: 0\r\n\r\n'); return; }
  const up = net.connect(T_PORT, T_HOST, () => {
    let s = `${req.method} ${req.url} HTTP/1.1\r\n`;
    for (const [n, v] of fix(req.rawHeaders)) s += `${n}: ${v}\r\n`;
    up.write(s + '\r\n'); if (head?.length) up.write(head);
    socket.pipe(up).pipe(socket);
  });
  up.on('error', () => socket.destroy()); socket.on('error', () => up.destroy());
});
server.listen(PORT, '0.0.0.0', () => console.log(`gateway on ${PORT}`));
