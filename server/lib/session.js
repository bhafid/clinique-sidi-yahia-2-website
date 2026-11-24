'use strict';
/**
 * Sessions d'administration stockées en base.
 * - Cookie HttpOnly + SameSite=Strict (+ Secure en HTTPS / production), limité à /admin
 * - Seul le hash SHA-256 du jeton est conservé en base
 * - Expiration : 30 min d'inactivité, 8 h maximum ; nouveau jeton à chaque connexion
 */
const db = require('./db');
const { randomToken, sha256 } = require('./security');
const { parseCookies, setCookie, clearCookie, isHttps, clientIp } = require('./http');
const { SESSION_IDLE_MS, SESSION_ABSOLUTE_MS, IS_PROD, BASE_PATH } = require('../config');

const COOKIE_NAME = 'csy_admin_sid';
const COOKIE_PATH = `${BASE_PATH}/admin`;

const cookieOpts = (req) => ({ path: COOKIE_PATH, httpOnly: true, sameSite: 'Strict', secure: IS_PROD || isHttps(req) });

function createSession(req, res, adminId) {
  const token = randomToken(32);
  const now = Date.now();
  db.run(
    'INSERT INTO sessions (token_hash, admin_id, csrf_token, created_at, last_seen, ip, user_agent) VALUES (?, ?, ?, ?, ?, ?, ?)',
    sha256(token), adminId, randomToken(32), now, now, clientIp(req),
    String(req.headers['user-agent'] || '').slice(0, 200),
  );
  setCookie(res, COOKIE_NAME, token, { ...cookieOpts(req), maxAge: SESSION_ABSOLUTE_MS / 1000 });
}

function getSession(req) {
  const token = parseCookies(req)[COOKIE_NAME];
  if (!token || token.length > 100) return null;
  const tokenHash = sha256(token);
  const row = db.get(
    `SELECT s.token_hash, s.admin_id, s.csrf_token, s.created_at, s.last_seen, a.username
       FROM sessions s JOIN admins a ON a.id = s.admin_id
      WHERE s.token_hash = ?`,
    tokenHash,
  );
  if (!row) return null;
  const now = Date.now();
  if (now - row.last_seen > SESSION_IDLE_MS || now - row.created_at > SESSION_ABSOLUTE_MS) {
    db.run('DELETE FROM sessions WHERE token_hash = ?', tokenHash);
    return null;
  }
  db.run('UPDATE sessions SET last_seen = ? WHERE token_hash = ?', now, tokenHash);
  return row;
}

function destroySession(req, res) {
  const token = parseCookies(req)[COOKIE_NAME];
  if (token) db.run('DELETE FROM sessions WHERE token_hash = ?', sha256(token));
  clearCookie(res, COOKIE_NAME, cookieOpts(req));
}

function purgeExpiredSessions() {
  const now = Date.now();
  db.run('DELETE FROM sessions WHERE last_seen < ? OR created_at < ?', now - SESSION_IDLE_MS, now - SESSION_ABSOLUTE_MS);
}

module.exports = { createSession, getSession, destroySession, purgeExpiredSessions, cookieOpts };
