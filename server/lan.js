// Who may use the hub. By default only this PC: a page on another website (or a DNS name pointed at 127.0.0.1)
// must not drive the hub, because its job queue can run commands. A server on a private network can name the
// host names and addresses other PCs use to reach it (config.allowedHosts); those count as this PC's own.
// Claude's MCP tools, RenderGuard and scripts send no Origin/Sec-Fetch-Site.
export const LOOPBACK = new Set(['127.0.0.1', 'localhost', '[::1]']);

export function allowedHostSet(list) {
  const extra = (Array.isArray(list) ? list : []).filter(x => typeof x === 'string' && x.trim()).map(x => x.trim().toLowerCase());
  return new Set([...LOOPBACK, ...extra]);
}

// null when the request may go on, else why not: 'host' | 'site' | 'origin'
export function foreignWhy(req, { allowed = LOOPBACK, port } = {}) {
  const host = String(req.headers.host || '').toLowerCase().replace(/:\d+$/, '');
  if (!allowed.has(host)) return 'host';
  const sfs = req.headers['sec-fetch-site'];
  if (sfs && sfs !== 'same-origin' && sfs !== 'none') return 'site';
  const origin = req.headers.origin;
  if (origin && !['GET', 'HEAD', 'OPTIONS'].includes(req.method)) {
    let o = null; try { o = new URL(origin); } catch { }
    if (!o || !allowed.has(o.hostname.toLowerCase().replace(/^\[(.*)\]$/, '[$1]')) || String(o.port || '80') !== String(port)) return 'origin';
  }
  return null;
}

// the link a user on another PC opens for a page of the hub (config.publicUrl), or null on a PC-local install
export function publicLink(publicUrl, hash) {
  if (typeof publicUrl !== 'string' || !/^https?:\/\/[^/\s]+/i.test(publicUrl)) return null;
  return publicUrl.replace(/\/+$/, '') + '/' + hash;
}
