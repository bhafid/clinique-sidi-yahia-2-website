'use strict';
/**
 * Utilitaires HTTP : cookies, lecture de corps bornée, réponses, IP client.
 */
const { TRUST_PROXY } = require('../config');

function parseCookies(req) {
  const out = {};
  const header = req.headers.cookie;
  if (!header) return out;
  for (const part of header.split(';')) {
    const idx = part.indexOf('=');
    if (idx < 0) continue;
    const name = part.slice(0, idx).trim();
    const value = part.slice(idx + 1).trim();
    if (!name || name in out) continue;
    try { out[name] = decodeURIComponent(value); } catch { out[name] = value; }
  }
  return out;
}

function setCookie(res, name, value, opts = {}) {
  const parts = [`${name}=${encodeURIComponent(value)}`];
  parts.push(`Path=${opts.path || '/'}`);
  if (opts.maxAge !== undefined) parts.push(`Max-Age=${Math.floor(opts.maxAge)}`);
  if (opts.httpOnly !== false) parts.push('HttpOnly');
  parts.push(`SameSite=${opts.sameSite || 'Strict'}`);
  if (opts.secure) parts.push('Secure');
  const prev = res.getHeader('Set-Cookie');
  const list = Array.isArray(prev) ? prev : prev ? [String(prev)] : [];
  list.push(parts.join('; '));
  res.setHeader('Set-Cookie', list);
}

function clearCookie(res, name, opts = {}) {
  setCookie(res, name, '', { ...opts, maxAge: 0 });
}

class HttpError extends Error {
  constructor(status, message) { super(message); this.status = status; }
}

/** Lit le corps de la requête en mémoire avec une limite stricte. */
function readBody(req, limit) {
  return new Promise((resolve, reject) => {
    const declared = Number(req.headers['content-length'] || 0);
    if (declared > limit * 4) {
      req.resume();
      reject(new HttpError(413, 'Requête trop volumineuse'));
      return;
    }
    const chunks = [];
    let size = 0;
    let tooLarge = false;
    let done = false;
    req.on('data', (chunk) => {
      size += chunk.length;
      if (size > limit) {
        tooLarge = true;
        chunks.length = 0;
        if (size > limit * 4) req.destroy();
        return;
      }
      chunks.push(chunk);
    });
    req.on('end', () => {
      done = true;
      if (tooLarge) reject(new HttpError(413, 'Requête trop volumineuse'));
      else resolve(Buffer.concat(chunks));
    });
    req.on('close', () => { if (!done) reject(new HttpError(413, 'Requête interrompue')); });
    req.on('error', reject);
  });
}

function parseUrlEncoded(buf) {
  const out = {};
  for (const [key, value] of new URLSearchParams(buf.toString('utf8'))) {
    if (!(key in out)) out[key] = value;
  }
  return out;
}

function send(res, status, body, headers = {}) {
  const payload = Buffer.isBuffer(body) ? body : Buffer.from(String(body ?? ''), 'utf8');
  res.writeHead(status, {
    'Content-Type': 'text/html; charset=utf-8',
    'Content-Length': payload.length,
    ...headers,
  });
  res.end(res.req && res.req.method === 'HEAD' ? undefined : payload);
}

function redirect(res, location, status = 303) {
  res.writeHead(status, { Location: location, 'Content-Length': 0 });
  res.end();
}

function clientIp(req) {
  if (TRUST_PROXY) {
    const fwd = req.headers['x-forwarded-for'];
    if (fwd) return String(fwd).split(',')[0].trim();
  }
  return req.socket.remoteAddress || 'inconnue';
}

function isHttps(req) {
  if (req.socket.encrypted) return true;
  return TRUST_PROXY && String(req.headers['x-forwarded-proto'] || '').split(',')[0].trim() === 'https';
}

/** Vérifie que la requête provient bien du même site (défense CSRF complémentaire). */
function isSameOrigin(req) {
  const host = req.headers.host;
  const source = req.headers.origin || req.headers.referer;
  if (!source) return true; // certains navigateurs n'envoient rien : le jeton CSRF reste exigé
  if (source === 'null') return false;
  try { return new URL(source).host === host; } catch { return false; }
}

module.exports = {
  parseCookies, setCookie, clearCookie, HttpError, readBody, parseUrlEncoded,
  send, redirect, clientIp, isHttps, isSameOrigin,
};
