'use strict';
/**
 * Limiteur anti brute-force en mémoire (par IP et par identifiant).
 * Après N échecs dans la fenêtre, la clé est bloquée jusqu'à la fin de la fenêtre.
 */
const { LOGIN_WINDOW_MS } = require('../config');

const buckets = new Map();

function entry(key) {
  const now = Date.now();
  let e = buckets.get(key);
  if (!e || now - e.first > LOGIN_WINDOW_MS) {
    e = { count: 0, first: now };
    buckets.set(key, e);
  }
  return e;
}

/** Renvoie le nombre de ms restantes avant déblocage, ou 0 si la clé n'est pas bloquée. */
function lockedFor(key, max) {
  const e = buckets.get(key);
  if (!e) return 0;
  const elapsed = Date.now() - e.first;
  if (elapsed > LOGIN_WINDOW_MS) { buckets.delete(key); return 0; }
  return e.count >= max ? LOGIN_WINDOW_MS - elapsed : 0;
}

function registerFailure(key) {
  entry(key).count += 1;
}

function reset(key) {
  buckets.delete(key);
}

setInterval(() => {
  const now = Date.now();
  for (const [key, e] of buckets) if (now - e.first > LOGIN_WINDOW_MS) buckets.delete(key);
}, 60 * 1000).unref();

module.exports = { lockedFor, registerFailure, reset };
