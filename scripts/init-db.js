'use strict';
/**
 * Initialise la base SQLite (crée les tables si elles n'existent pas).
 * Usage : npm run db:init
 */
const db = require('../server/lib/db');
const { DB_PATH } = require('../server/config');

db.initSchema();
const tables = db.all("SELECT name FROM sqlite_master WHERE type = 'table' AND name NOT LIKE 'sqlite_%' ORDER BY name");
console.log(`Base initialisée : ${DB_PATH}`);
console.log(`Tables : ${tables.map((t) => t.name).join(', ')}`);
db.close();
