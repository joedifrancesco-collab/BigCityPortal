// BCP local server: static files, RSS proxy, config persistence. No dependencies.
const http = require('http');
const fs = require('fs');
const path = require('path');
const dns = require('dns').promises;
const net = require('net');

const PORT = Number(process.env.BCP_PORT) || 3000;
const HOST = '127.0.0.1';
const PUBLIC = path.join(__dirname, 'public');
const CONFIG = path.join(__dirname, 'data', 'config.json');
const MIME = {
  '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8', '.json': 'application/json', '.svg': 'image/svg+xml',
  '.png': 'image/png', '.ico': 'image/x-icon',
};
const feedCache = new Map();
const CACHE_MS = 10 * 60 * 1000;

function isPrivateIp(ip) {
  if (net.isIPv6(ip)) return ip === '::1' || /^(fc|fd|fe80)/i.test(ip) || ip.startsWith('::ffff:');
  const [a, b] = ip.split('.').map(Number);
  return a === 10 || a === 127 || a === 0 || (a === 172 && b >= 16 && b <= 31) ||
    (a === 192 && b === 168) || (a === 169 && b === 254);
}

async function fetchFeed(url) {
  const cached = feedCache.get(url);
  if (cached && Date.now() - cached.time < CACHE_MS) return cached.body;
  const u = new URL(url);
  if (!/^https?:$/.test(u.protocol)) throw new Error('Only http(s) URLs allowed');
  const { address } = await dns.lookup(u.hostname);
  if (isPrivateIp(address)) throw new Error('Private addresses are not allowed');
  const res = await fetch(u, {
    headers: { 'User-Agent': 'BigCityPortal/0.1', Accept: 'application/rss+xml, application/atom+xml, application/xml, text/xml' },
    redirect: 'error',
    signal: AbortSignal.timeout(10000),
  });
  if (!res.ok) throw new Error(`Upstream ${res.status}`);
  const body = (await res.text()).slice(0, 2_000_000);
  feedCache.set(url, { time: Date.now(), body });
  return body;
}

function readBody(req, limit = 1_000_000) {
  return new Promise((resolve, reject) => {
    let size = 0; const chunks = [];
    req.on('data', c => { size += c.length; if (size > limit) { reject(new Error('Too large')); req.destroy(); } else chunks.push(c); });
    req.on('end', () => resolve(Buffer.concat(chunks).toString('utf8')));
    req.on('error', reject);
  });
}

function send(res, status, body, type = 'application/json') {
  res.writeHead(status, { 'Content-Type': type, 'X-Content-Type-Options': 'nosniff' });
  res.end(body);
}

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, `http://${HOST}:${PORT}`);
  try {
    if (url.pathname.startsWith('/api/')) {
      // Block cross-site requests to the API
      const origin = req.headers.origin;
      if (origin && origin !== `http://localhost:${PORT}` && origin !== `http://${HOST}:${PORT}`) return send(res, 403, '{"error":"Forbidden"}');

      if (url.pathname === '/api/rss' && req.method === 'GET') {
        const target = url.searchParams.get('url');
        if (!target) return send(res, 400, '{"error":"Missing url"}');
        return send(res, 200, await fetchFeed(target), 'text/xml; charset=utf-8');
      }
      if (url.pathname === '/api/config') {
        if (req.method === 'GET') {
          return send(res, 200, fs.existsSync(CONFIG) ? fs.readFileSync(CONFIG, 'utf8') : 'null');
        }
        if (req.method === 'PUT') {
          const body = await readBody(req);
          JSON.parse(body);
          fs.mkdirSync(path.dirname(CONFIG), { recursive: true });
          fs.writeFileSync(CONFIG, body);
          return send(res, 200, '{"ok":true}');
        }
      }
      return send(res, 404, '{"error":"Not found"}');
    }

    const rel = url.pathname === '/' ? 'index.html' : decodeURIComponent(url.pathname);
    const file = path.join(PUBLIC, rel);
    if (!file.startsWith(PUBLIC + path.sep) || !fs.existsSync(file) || !fs.statSync(file).isFile()) return send(res, 404, 'Not found', 'text/plain');
    send(res, 200, fs.readFileSync(file), MIME[path.extname(file)] || 'application/octet-stream');
  } catch (e) {
    send(res, 500, JSON.stringify({ error: e.message }));
  }
});

server.listen(PORT, HOST, () => console.log(`Big City Portal running at http://localhost:${PORT}`));
