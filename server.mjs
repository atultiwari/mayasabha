// Local server for MayaSabha: static files + a tiny WebSocket relay so a phone can act as a remote.
// Stage pages (on the computer driving the projector) announce their buttons; phone pages (/remote/)
// show those buttons and send presses back. Open stage pages via http://localhost so mic/camera work.
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { networkInterfaces } from 'node:os';
import { basename, extname, join, normalize, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { WebSocketServer } from 'ws';
import QRCode from 'qrcode';
import { lanAddresses, remoteUrls } from './kit/network.js';
import { parseClientMessage } from './kit/protocol.js';

const ROOT = fileURLToPath(new URL('.', import.meta.url)).replace(/[\\/]$/, '');
const PORT = Number(process.env.PORT) || 5190;
const HOST = process.env.HOST || '0.0.0.0';
const MAX_MESSAGE_BYTES = 4096;
const TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json',
  '.png': 'image/png',
  '.svg': 'image/svg+xml',
  '.mp3': 'audio/mpeg',
  '.wav': 'audio/wav',
  '.wasm': 'application/wasm',
  '.task': 'application/octet-stream',
  '.mp4': 'video/mp4',
  '.webp': 'image/webp',
};
const BLOCKED_DIRS = ['/node_modules/', '/tests/'];
const BLOCKED_FILES = new Set(['server.mjs', 'package.json', 'package-lock.json']);
const MAX_MESSAGES_PER_SECOND = 20;
const MAX_CLIENTS = 20;

/** Maps a URL path to a file inside ROOT, or null if it is outside, hidden or private. */
function resolveSafePath(urlPath) {
  const filePath = normalize(join(ROOT, urlPath.endsWith('/') ? `${urlPath}index.html` : urlPath));
  if (!filePath.startsWith(ROOT + sep)) return null;
  const rel = filePath.slice(ROOT.length);
  if (rel.split(sep).some((part) => part.startsWith('.'))) return null;
  if (BLOCKED_DIRS.some((d) => rel.replaceAll(sep, '/').includes(d)) || BLOCKED_FILES.has(basename(rel))) return null;
  return filePath;
}

// ---- small JSON/SVG API for the home page ------------------------------------------------------
function currentRemoteUrls() {
  return remoteUrls(lanAddresses(networkInterfaces()), PORT);
}

async function handleApi(pathname, res) {
  if (pathname === '/api/info') {
    res.writeHead(200, { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' });
    res.end(JSON.stringify({ success: true, data: { port: PORT, remoteUrls: currentRemoteUrls() } }));
    return true;
  }
  if (pathname === '/api/remote-qr.svg') {
    const [url] = currentRemoteUrls(); // only ever encodes our own address, never request input
    if (!url) {
      res.writeHead(404).end('No Wi-Fi address found');
      return true;
    }
    const svg = await QRCode.toString(url, { type: 'svg', margin: 1, color: { dark: '#14121f', light: '#ffffff' } });
    res.writeHead(200, { 'Content-Type': 'image/svg+xml', 'Cache-Control': 'no-store' });
    res.end(svg);
    return true;
  }
  return false;
}

const server = createServer(async (req, res) => {
  let filePath;
  try {
    const { pathname } = new URL(req.url, 'http://x');
    if (pathname.startsWith('/api/')) {
      if (!(await handleApi(pathname, res))) res.writeHead(404).end('Not found');
      return;
    }
    filePath = resolveSafePath(decodeURIComponent(pathname));
  } catch {
    res.writeHead(400).end('Bad request');
    return;
  }
  if (!filePath) {
    res.writeHead(403).end('Forbidden');
    return;
  }
  try {
    const body = await readFile(filePath);
    res.writeHead(200, { 'Content-Type': TYPES[extname(filePath)] ?? 'application/octet-stream', 'Cache-Control': 'no-store' });
    res.end(body);
  } catch {
    res.writeHead(404).end('Not found');
  }
});

// ---- WebSocket relay -------------------------------------------------------------------------
// Only pages served by this server may connect (blocks other websites open in the same browser).
function sameOrigin(info) {
  const { origin } = info;
  const { host } = info.req.headers;
  try {
    return Boolean(origin && host) && new URL(origin).host === host;
  } catch {
    return false;
  }
}

const wss = new WebSocketServer({
  server, path: '/ws', maxPayload: MAX_MESSAGE_BYTES,
  verifyClient: (info) => sameOrigin(info) && wss.clients.size < MAX_CLIENTS,
});
let lastLayout = null; // most recent button layout from a stage, replayed to newly joined remotes

function broadcast(role, payload) {
  const text = JSON.stringify(payload);
  for (const client of wss.clients) {
    if (client.readyState === 1 && client.role === role) client.send(text);
  }
}

wss.on('connection', (socket) => {
  socket.role = 'unknown';
  let windowStart = Date.now();
  let count = 0;
  socket.on('message', (raw) => {
    const now = Date.now();
    if (now - windowStart > 1000) {
      windowStart = now;
      count = 0;
    }
    count += 1;
    if (count > MAX_MESSAGES_PER_SECOND) return; // drop button spam
    const msg = parseClientMessage(raw.toString());
    if (!msg) return; // ignore anything malformed
    if (msg.type === 'hello') {
      socket.role = msg.role;
      if (msg.role === 'stage' && msg.layout) {
        lastLayout = msg.layout;
        broadcast('remote', { type: 'layout', layout: lastLayout });
      }
      if (msg.role === 'remote' && lastLayout) socket.send(JSON.stringify({ type: 'layout', layout: lastLayout }));
      return;
    }
    if (msg.type === 'press' && socket.role === 'remote') broadcast('stage', msg);
  });
  socket.on('error', (err) => console.warn('ws client error:', err.message));
});

server.on('error', (err) => {
  console.error(err.code === 'EADDRINUSE' ? `Port ${PORT} is busy. Try: PORT=5191 npm start` : err);
  process.exit(1);
});

server.listen(PORT, HOST, () => {
  console.log(`MayaSabha running.`);
  console.log(`  Stage (open on the computer driving the projector): http://localhost:${PORT}/`);
  for (const url of currentRemoteUrls()) console.log(`  Phone remote (same Wi-Fi):                          ${url}`);
});
