'use strict';
/**
 * Primitives de sécurité : hachage scrypt (KDF à mémoire dure recommandée par l'OWASP),
 * jetons aléatoires, comparaisons à temps constant, échappement HTML.
 */
const crypto = require('node:crypto');

const SCRYPT = { N: 1 << 15, r: 8, p: 1, keylen: 64, maxmem: 128 * 1024 * 1024 };
const MIN_PASSWORD_LENGTH = 12;

function scryptAsync(password, salt, keylen, opts) {
  return new Promise((resolve, reject) => {
    crypto.scrypt(password, salt, keylen, opts, (err, key) => (err ? reject(err) : resolve(key)));
  });
}

async function hashPassword(password) {
  const salt = crypto.randomBytes(16);
  const { N, r, p, keylen, maxmem } = SCRYPT;
  const key = await scryptAsync(String(password).normalize('NFKC'), salt, keylen, { N, r, p, maxmem });
  return `scrypt$${N}$${r}$${p}$${salt.toString('base64')}$${key.toString('base64')}`;
}

async function verifyPassword(password, stored) {
  const parts = String(stored || '').split('$');
  if (parts.length !== 6 || parts[0] !== 'scrypt') return false;
  const N = Number(parts[1]); const r = Number(parts[2]); const p = Number(parts[3]);
  if (![N, r, p].every(Number.isInteger) || N > (1 << 20)) return false;
  const salt = Buffer.from(parts[4], 'base64');
  const expected = Buffer.from(parts[5], 'base64');
  const key = await scryptAsync(String(password).normalize('NFKC'), salt, expected.length,
    { N, r, p, maxmem: SCRYPT.maxmem });
  return key.length === expected.length && crypto.timingSafeEqual(key, expected);
}

/** Hash factice : comparé quand l'utilisateur n'existe pas (temps de réponse constant). */
let dummyHashPromise = null;
function dummyHash() {
  if (!dummyHashPromise) dummyHashPromise = hashPassword(crypto.randomBytes(24).toString('hex'));
  return dummyHashPromise;
}

function checkPasswordStrength(password) {
  const pw = String(password || '');
  const errors = [];
  if (pw.length < MIN_PASSWORD_LENGTH) errors.push(`au moins ${MIN_PASSWORD_LENGTH} caractères`);
  if (!/[a-z]/.test(pw) || !/[A-Z]/.test(pw)) errors.push('des minuscules et des majuscules');
  if (!/\d/.test(pw)) errors.push('au moins un chiffre');
  return errors;
}

const randomToken = (bytes = 32) => crypto.randomBytes(bytes).toString('base64url');
const sha256 = (value) => crypto.createHash('sha256').update(String(value)).digest('hex');

function safeEqual(a, b) {
  const ba = Buffer.from(String(a ?? ''));
  const bb = Buffer.from(String(b ?? ''));
  return ba.length > 0 && ba.length === bb.length && crypto.timingSafeEqual(ba, bb);
}

const HTML_ESCAPES = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };
function escapeHtml(value) {
  return String(value ?? '').replace(/[&<>"']/g, (c) => HTML_ESCAPES[c]);
}

module.exports = {
  hashPassword, verifyPassword, dummyHash, checkPasswordStrength,
  randomToken, sha256, safeEqual, escapeHtml,
};
