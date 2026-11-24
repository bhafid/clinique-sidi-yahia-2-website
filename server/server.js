'use strict';
/**
 * Clinique Sidi Yahia 2 - Serveur web (site public + administration)
 * Node.js >= 22.13, aucune dépendance externe.
 *
 * Seuls sont servis : les pages HTML listées dans config.PAGES, /assets/* et les
 * images de /uploads/praticiens/*. Tout le reste (database/, server/, scripts/,
 * fichiers cachés...) renvoie 404 : le fichier SQLite n'est jamais téléchargeable.
 */
const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
const db = require('./lib/db');
const { send, isHttps } = require('./lib/http');
const { renderPage } = require('./lib/render');
const { purgeExpiredSessions } = require('./lib/session');
const { handleAdmin } = require('./admin/routes');
const { ROOT, UPLOAD_DIR, PAGES, PORT, HOST, BASE_PATH, IS_PROD } = require('./config');

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp',
  '.gif': 'image/gif',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
};

const STATIC_DIRS = [
  { prefix: '/assets/', dir: path.join(ROOT, 'assets'), exts: null },
  { prefix: '/uploads/praticiens/', dir: UPLOAD_DIR, exts: new Set(['.jpg', '.jpeg', '.png', '.webp']) },
];

function baseHeaders(req, res) {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  res.setHeader('X-Frame-Options', 'SAMEORIGIN');
  res.setHeader('Permissions-Policy', 'camera=(), microphone=(), geolocation=()');
  if (isHttps(req)) res.setHeader('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');
}

function resolveStatic(pathname) {
  for (const s of STATIC_DIRS) {
    if (!pathname.startsWith(s.prefix)) continue;
    let rel;
    try { rel = decodeURIComponent(pathname.slice(s.prefix.length)); } catch { return null; }
    if (!rel || rel.includes('\0') || rel.split(/[\\/]/).some((seg) => !seg || seg.startsWith('.'))) return null;
    const full = path.resolve(s.dir, rel);
    if (!full.startsWith(s.dir + path.sep)) return null;
    const ext = path.extname(full).toLowerCase();
    if (!MIME[ext] || (s.exts && !s.exts.has(ext))) return null;
    return { full, ext };
  }
  return null;
}

function notFound(res) {
  send(res, 404, '<!DOCTYPE html><html lang="fr"><meta charset="utf-8"><title>Page introuvable</title>'
    + '<body style="font-family:sans-serif;text-align:center;padding:4rem;"><h1>404</h1>'
    + `<p>Cette page n'existe pas.</p><p><a href="${BASE_PATH || '/'}">Retour à l'accueil</a></p></body></html>`);
}

function servePage(req, res, fileName) {
  const html = fs.readFileSync(path.join(ROOT, fileName), 'utf8');
  send(res, 200, renderPage(fileName, html), { 'Cache-Control': 'no-cache' });
}

function serveFile(req, res, file) {
  fs.stat(file.full, (err, stat) => {
    if (err || !stat.isFile()) return notFound(res);
    res.writeHead(200, {
      'Content-Type': MIME[file.ext],
      'Content-Length': stat.size,
      'Cache-Control': 'public, max-age=3600',
    });
    if (req.method === 'HEAD') return res.end();
    fs.createReadStream(file.full).on('error', () => res.destroy()).pipe(res);
  });
}

async function handle(req, res) {
  baseHeaders(req, res);
  let url;
  try { url = new URL(req.url, 'http://localhost'); } catch { return send(res, 400, 'Requête invalide'); }
  if (BASE_PATH && (url.pathname === BASE_PATH || url.pathname.startsWith(BASE_PATH + '/'))) {
    url.pathname = url.pathname.slice(BASE_PATH.length) || '/';
  }
  const { pathname } = url;

  if (pathname === '/admin' || pathname.startsWith('/admin/')) return handleAdmin(req, res, url);

  if (req.method !== 'GET' && req.method !== 'HEAD') {
    return send(res, 405, 'Méthode non autorisée', { Allow: 'GET, HEAD' });
  }

  const pageName = pathname === '/' ? 'index.html' : pathname.slice(1);
  if (Object.prototype.hasOwnProperty.call(PAGES, pageName)) return servePage(req, res, pageName);

  const file = resolveStatic(pathname);
  if (file) return serveFile(req, res, file);

  return notFound(res);
}

db.initSchema();
purgeExpiredSessions();
setInterval(purgeExpiredSessions, 15 * 60 * 1000).unref();

const server = http.createServer((req, res) => {
  handle(req, res).catch((err) => {
    console.error(new Date().toISOString(), req.method, req.url, err);
    if (!res.headersSent) send(res, err.status || 500, err.status ? err.message : 'Erreur interne du serveur');
    else res.destroy();
  });
});
server.requestTimeout = 30 * 1000;
server.headersTimeout = 15 * 1000;

server.listen(PORT, HOST, () => {
  console.log(`Serveur démarré sur http://${HOST === '0.0.0.0' ? 'localhost' : HOST}:${PORT}/ (${IS_PROD ? 'production' : 'développement'})`);
  console.log(`Administration : http://${HOST === '0.0.0.0' ? 'localhost' : HOST}:${PORT}/admin/login`);
});

function shutdown() {
  server.close(() => { db.close(); process.exit(0); });
  setTimeout(() => process.exit(0), 3000).unref();
}
process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);
