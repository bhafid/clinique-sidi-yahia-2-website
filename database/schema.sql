-- =============================================================================
-- Clinique Sidi Yahia 2 - Schéma SQLite (idempotent : exécutable plusieurs fois)
-- Fichier de base : database/clinique.sqlite (JAMAIS servi publiquement)
-- =============================================================================
PRAGMA foreign_keys = ON;

-- -----------------------------------------------------------------------------
-- Administrateurs (authentification)
-- password_hash : format "scrypt$N$r$p$sel_base64$hash_base64" (jamais de clair)
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS admins (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  username      TEXT    NOT NULL UNIQUE COLLATE NOCASE,
  password_hash TEXT    NOT NULL,
  created_at    DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- -----------------------------------------------------------------------------
-- Départements / pôles médicaux
-- slug : identifiant stable (lien avec les pages publiques), généré à la création
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS departements (
  id              INTEGER PRIMARY KEY AUTOINCREMENT,
  nom             TEXT    NOT NULL UNIQUE,
  slug            TEXT    NOT NULL UNIQUE,
  description     TEXT,
  ordre_affichage INTEGER DEFAULT 0,
  created_at      DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- -----------------------------------------------------------------------------
-- Praticiens référents
-- ON DELETE RESTRICT : impossible de supprimer un département qui a des praticiens
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS praticiens (
  id              INTEGER PRIMARY KEY AUTOINCREMENT,
  nom             TEXT    NOT NULL,
  prenom          TEXT    NOT NULL,
  specialite      TEXT    NOT NULL,
  photo_path      TEXT,
  photo_position  TEXT    DEFAULT 'center 15%',
  biographie      TEXT,
  departement_id  INTEGER NOT NULL
                  REFERENCES departements(id) ON DELETE RESTRICT ON UPDATE CASCADE,
  est_actif       INTEGER DEFAULT 1 CHECK (est_actif IN (0, 1)),
  ordre_affichage INTEGER DEFAULT 0,
  created_at      DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at      DATETIME
);

CREATE INDEX IF NOT EXISTS idx_praticiens_departement ON praticiens (departement_id);
CREATE INDEX IF NOT EXISTS idx_praticiens_actif       ON praticiens (est_actif);
-- Empêche les doublons (et rend la migration idempotente)
CREATE UNIQUE INDEX IF NOT EXISTS ux_praticiens_identite
  ON praticiens (nom COLLATE NOCASE, prenom COLLATE NOCASE);

-- -----------------------------------------------------------------------------
-- Sessions d'administration (le jeton n'est stocké que sous forme de hash SHA-256)
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS sessions (
  token_hash TEXT    PRIMARY KEY,
  admin_id   INTEGER NOT NULL REFERENCES admins(id) ON DELETE CASCADE,
  csrf_token TEXT    NOT NULL,
  created_at INTEGER NOT NULL,
  last_seen  INTEGER NOT NULL,
  ip         TEXT,
  user_agent TEXT
);
CREATE INDEX IF NOT EXISTS idx_sessions_admin ON sessions (admin_id);
