'use strict';
/**
 * Accès SQLite via le module natif node:sqlite (Node >= 22.13, aucune dépendance).
 */
const fs = require('node:fs');
const path = require('node:path');
const { DatabaseSync } = require('node:sqlite');
const { DB_PATH, SCHEMA_PATH } = require('../config');

let db = null;

function getDb() {
  if (!db) {
    fs.mkdirSync(path.dirname(DB_PATH), { recursive: true });
    db = new DatabaseSync(DB_PATH);
    db.exec('PRAGMA foreign_keys = ON; PRAGMA journal_mode = WAL; PRAGMA busy_timeout = 5000;');
  }
  return db;
}

function initSchema() {
  getDb().exec(fs.readFileSync(SCHEMA_PATH, 'utf8'));
}

const all = (sql, ...params) => getDb().prepare(sql).all(...params);
const get = (sql, ...params) => getDb().prepare(sql).get(...params);
const run = (sql, ...params) => getDb().prepare(sql).run(...params);

function transaction(fn) {
  const d = getDb();
  d.exec('BEGIN IMMEDIATE');
  try {
    const result = fn();
    d.exec('COMMIT');
    return result;
  } catch (err) {
    d.exec('ROLLBACK');
    throw err;
  }
}

function isUniqueError(err) {
  return /UNIQUE constraint failed/i.test(String(err && err.message));
}
function isForeignKeyError(err) {
  return /FOREIGN KEY constraint failed/i.test(String(err && err.message));
}

function close() {
  if (db) { db.close(); db = null; }
}

module.exports = { getDb, initSchema, all, get, run, transaction, isUniqueError, isForeignKeyError, close };
