# Administration & Base SQLite — Clinique Sidi Yahia 2

Back-end **Node.js ≥ 22.13** sans dépendance externe (`node:sqlite`, `node:crypto`, `node:http`).

## 1. Arborescence

```text
├── database/
│   ├── schema.sql              # Schéma SQLite (PRAGMA foreign_keys = ON)
│   └── clinique.sqlite         # Base locale (non versionnée, JAMAIS servie par HTTP)
├── uploads/
│   └── praticiens/             # Photos des praticiens (JPG, PNG, WebP uniquement)
├── scripts/
│   ├── init-db.js              # Initialisation du schéma
│   ├── migrate-from-site.js    # Migration idempotente des départements, praticiens et photos
│   └── create-admin.js         # Création / réinitialisation d'un compte administrateur
├── server/
│   ├── config.js               # Configuration (port, limites, correspondance pages/pôles)
│   ├── server.js               # Point d'entrée HTTP (liste blanche stricte des fichiers servis)
│   ├── lib/
│   │   ├── db.js               # Connexion SQLite (WAL, foreign_keys, transactions)
│   │   ├── security.js         # Hachage scrypt, comparaisons temps constant, échappement HTML
│   │   ├── session.js          # Sessions en base (SHA-256), cookies HttpOnly + SameSite=Strict
│   │   ├── ratelimit.js        # Limitation anti brute-force par IP et par identifiant
│   │   ├── http.js             # Cookies, lecture bornée, vérification Same-Origin
│   │   ├── multipart.js        # Analyseur multipart/form-data borné
│   │   ├── uploads.js          # Validation MIME + magic bytes, renommage unique, suppression disque
│   │   └── render.js           # Injection serveur des praticiens actifs dans les pages HTML
│   └── admin/
│       ├── routes.js           # Authentification, garde /admin/*, CRUD Départements & Praticiens
│       ├── views.js            # Vues HTML sécurisées (CSP stricte)
│       └── static/             # admin.css et admin.js (prévisualisation photo, confirmations)
└── package.json
```

## 2. Commandes

```bash
# 1. Initialiser la base SQLite
npm run db:init

# 2. Migrer les départements, praticiens et photos existants (idempotent)
npm run db:migrate

# 3. Créer un administrateur (mot de passe ≥ 12 caractères, majuscule, minuscule, chiffre)
npm run admin:create -- admin

# Réinitialiser le mot de passe d'un administrateur existant (ferme aussi ses sessions)
npm run admin:create -- admin --reset

# 4. Démarrer le serveur (par défaut http://127.0.0.1:3000)
npm start
```

## 3. Sécurité mise en place

- **Protection de SQLite** : le serveur n'expose que les 9 pages HTML déclarées dans `server/config.js`, `/assets/*` et les images JPG/PNG/WebP de `/uploads/praticiens/*`. Toute requête vers `/database/*`, `/server/*`, `/scripts/*` renvoie `404`.
- **Mots de passe** : hachage `scrypt` (`N=32768`, sel aléatoire 16 octets), aucun mot de passe en clair, vérification en temps constant.
- **Sessions** : jeton aléatoire 256 bits, seul le hash SHA-256 est stocké en base ; cookie `HttpOnly; SameSite=Strict; Path=/admin` (+ `Secure` en production/HTTPS) ; expiration 30 min d'inactivité / 8 h max ; régénération à chaque connexion.
- **CSRF & Anti-brute force** : jeton CSRF vérifié sur chaque `POST` (login, CRUD, déconnexion) + vérification `Origin`/`Referer` + blocage après 5 échecs par identifiant ou 20 par IP sur 15 min.
- **Upload photos** : vérification du type MIME **et** des octets magiques (JPG, PNG, WebP), taille max 2 Mo, renommage aléatoire, suppression automatique sur le disque lors du remplacement ou de la suppression d'un praticien.

## 4. Déploiement en production (VPS / Reverse Proxy)

Variables d'environnement recommandées derrière Nginx ou Caddy (HTTPS) :

```bash
NODE_ENV=production HOST=127.0.0.1 PORT=3000 TRUST_PROXY=1 node server/server.js
```
