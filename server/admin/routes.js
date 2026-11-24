'use strict';
/**
 * Routes de l'administration (/admin/*).
 * - /admin/login et /admin/static/* : publics
 * - Tout le reste : session obligatoire (garde d'authentification)
 * - Toute requête POST : vérification d'origine + jeton CSRF de session
 */
const fs = require('node:fs');
const path = require('node:path');
const db = require('../lib/db');
const views = require('./views');
const sec = require('../lib/security');
const {
  readBody, parseUrlEncoded, send, redirect, parseCookies, setCookie, clearCookie,
  clientIp, isSameOrigin, isHttps,
} = require('../lib/http');
const { parseMultipart } = require('../lib/multipart');
const { createSession, getSession, destroySession } = require('../lib/session');
const limiter = require('../lib/ratelimit');
const { savePhoto, deletePhoto, UploadError } = require('../lib/uploads');
const cfg = require('../config');

const LOGIN_CSRF_COOKIE = 'csy_login_csrf';
const STATIC_DIR = path.join(__dirname, 'static');
const STATIC_FILES = { 'admin.css': 'text/css; charset=utf-8', 'admin.js': 'text/javascript; charset=utf-8' };

const FLASH = {
  'dep-created': 'Département ajouté.',
  'dep-updated': 'Département mis à jour.',
  'dep-deleted': 'Département supprimé.',
  'pra-created': 'Praticien ajouté.',
  'pra-updated': 'Praticien mis à jour.',
  'pra-deleted': 'Praticien supprimé (et sa photo effacée du serveur).',
};

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const isRead = (method) => method === 'GET' || method === 'HEAD';
const u = (sub) => `${cfg.BASE_PATH}${sub}`;

function adminHeaders(res) {
  res.setHeader('Content-Security-Policy',
    "default-src 'none'; img-src 'self' blob: data:; style-src 'self'; script-src 'self'; "
    + "form-action 'self'; frame-ancestors 'none'; base-uri 'none'");
  res.setHeader('Cache-Control', 'no-store');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('X-Robots-Tag', 'noindex, nofollow');
  res.setHeader('Referrer-Policy', 'same-origin');
}

/* ----------------------------------------------------------------------------
 * Nettoyage / validation des champs
 * ------------------------------------------------------------------------- */
const cleanLine = (v) => String(v ?? '').replace(/[\u0000-\u001f\u007f]/g, ' ').replace(/\s+/g, ' ').trim();
const cleanText = (v) => String(v ?? '').replace(/\r\n?/g, '\n').replace(/[\u0000-\u0008\u000b-\u001f\u007f]/g, '').trim();

function toInt(v, min, max, def) {
  const n = Number.parseInt(String(v ?? ''), 10);
  if (!Number.isFinite(n)) return def;
  return Math.min(max, Math.max(min, n));
}

function slugify(s) {
  return s.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase()
    .replace(/&/g, ' et ').replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 60) || 'departement';
}

function uniqueSlug(base) {
  let slug = base;
  let i = 2;
  while (db.get('SELECT 1 FROM departements WHERE slug = ?', slug)) slug = `${base}-${i++}`;
  return slug;
}

/* ----------------------------------------------------------------------------
 * Point d'entrée
 * ------------------------------------------------------------------------- */
async function handleAdmin(req, res, url) {
  adminHeaders(res);
  const p = url.pathname.replace(/\/+$/, '') || '/admin';
  const { method } = req;

  if (p.startsWith('/admin/static/')) {
    const name = p.slice('/admin/static/'.length);
    if (!Object.prototype.hasOwnProperty.call(STATIC_FILES, name) || !isRead(method)) return send(res, 404, 'Introuvable');
    res.setHeader('Cache-Control', 'no-cache');
    return send(res, 200, fs.readFileSync(path.join(STATIC_DIR, name)), { 'Content-Type': STATIC_FILES[name] });
  }

  if (p === '/admin/login') {
    if (isRead(method)) {
      if (getSession(req)) return redirect(res, u('/admin/praticiens'));
      return renderLogin(req, res, { info: url.searchParams.get('bye') ? 'Vous êtes déconnecté.' : null });
    }
    if (method === 'POST') return doLogin(req, res);
    return send(res, 405, 'Méthode non autorisée', { Allow: 'GET, POST' });
  }

  // ---- Garde d'authentification -------------------------------------------
  const session = getSession(req);
  if (!session) {
    if (isRead(method)) return redirect(res, u('/admin/login'));
    req.resume();
    return send(res, 401, views.errorPage({ title: 'Session expirée', message: 'Votre session a expiré. Veuillez vous reconnecter.', back: u('/admin/login') }));
  }

  // ---- Lecture du corps + CSRF pour toute écriture -------------------------
  let form = { fields: {}, files: {} };
  if (method === 'POST') {
    if (!isSameOrigin(req)) {
      req.resume();
      return send(res, 403, views.errorPage({ session, title: 'Requête refusée', message: 'Origine de la requête non autorisée.' }));
    }
    const ctype = String(req.headers['content-type'] || '');
    try {
      if (ctype.startsWith('multipart/form-data')) {
        form = parseMultipart(await readBody(req, cfg.MAX_UPLOAD_BYTES + 64 * 1024), ctype);
      } else {
        form.fields = parseUrlEncoded(await readBody(req, 64 * 1024));
      }
    } catch (err) {
      if (err.status === 413) {
        return send(res, 413, views.errorPage({
          session, title: 'Fichier trop volumineux',
          message: 'La photo dépasse la taille maximale autorisée (2 Mo). Revenez au formulaire et choisissez une image plus légère.',
          back: u('/admin/praticiens'),
        }));
      }
      throw err;
    }
    if (!sec.safeEqual(form.fields._csrf, session.csrf_token)) {
      return send(res, 403, views.errorPage({ session, title: 'Jeton de sécurité invalide', message: 'Le formulaire a expiré. Rechargez la page et réessayez.' }));
    }
  } else if (!isRead(method)) {
    return send(res, 405, 'Méthode non autorisée', { Allow: 'GET, HEAD, POST' });
  }

  const ctx = { req, res, session, form, method, flash: FLASH[url.searchParams.get('ok')] || null };
  const post = method === 'POST';
  let m;

  if (p === '/admin') return redirect(res, u('/admin/praticiens'));
  if (p === '/admin/logout') {
    if (!post) return redirect(res, u('/admin/praticiens'));
    console.info(`[auth] déconnexion de "${session.username}"`);
    destroySession(req, res);
    return redirect(res, u('/admin/login?bye=1'));
  }

  if (p === '/admin/departements') return post ? saveDepartement(ctx, null) : listDepartements(ctx);
  if (p === '/admin/departements/new' && !post) return departementForm(ctx, null);
  if ((m = /^\/admin\/departements\/(\d+)\/edit$/.exec(p)) && !post) return departementForm(ctx, Number(m[1]));
  if ((m = /^\/admin\/departements\/(\d+)$/.exec(p)) && post) return saveDepartement(ctx, Number(m[1]));
  if ((m = /^\/admin\/departements\/(\d+)\/delete$/.exec(p)) && post) return deleteDepartement(ctx, Number(m[1]));

  if (p === '/admin/praticiens') return post ? savePraticien(ctx, null) : listPraticiens(ctx);
  if (p === '/admin/praticiens/new' && !post) return praticienForm(ctx, null);
  if ((m = /^\/admin\/praticiens\/(\d+)\/edit$/.exec(p)) && !post) return praticienForm(ctx, Number(m[1]));
  if ((m = /^\/admin\/praticiens\/(\d+)$/.exec(p)) && post) return savePraticien(ctx, Number(m[1]));
  if ((m = /^\/admin\/praticiens\/(\d+)\/delete$/.exec(p)) && post) return deletePraticien(ctx, Number(m[1]));

  return notFound(ctx);
}

function notFound(ctx) {
  return send(ctx.res, 404, views.errorPage({ session: ctx.session, title: 'Page introuvable', message: "Cet élément n'existe pas ou a été supprimé." }));
}

/* ----------------------------------------------------------------------------
 * Authentification
 * ------------------------------------------------------------------------- */
function loginCookieOpts(req) {
  return { path: u('/admin/login'), httpOnly: true, sameSite: 'Strict', secure: cfg.IS_PROD || isHttps(req) };
}

function renderLogin(req, res, { status = 200, error = null, info = null, username = '' } = {}) {
  const token = sec.randomToken(24);
  setCookie(res, LOGIN_CSRF_COOKIE, token, { ...loginCookieOpts(req), maxAge: 30 * 60 });
  return send(res, status, views.loginPage({ csrf: token, error, info, username }));
}

async function doLogin(req, res) {
  if (!isSameOrigin(req)) {
    req.resume();
    return renderLogin(req, res, { status: 403, error: 'Origine de la requête non autorisée.' });
  }
  let fields;
  try {
    fields = parseUrlEncoded(await readBody(req, 8 * 1024));
  } catch (err) {
    if (err.status) return renderLogin(req, res, { status: 400, error: 'Requête invalide.' });
    throw err;
  }
  if (!sec.safeEqual(fields._csrf, parseCookies(req)[LOGIN_CSRF_COOKIE])) {
    return renderLogin(req, res, { status: 403, error: 'Le formulaire a expiré. Veuillez réessayer.' });
  }

  const username = cleanLine(fields.username).slice(0, 64);
  const password = String(fields.password ?? '').slice(0, 256);
  const ip = clientIp(req);
  const ipKey = `ip:${ip}`;
  const userKey = `user:${username.toLowerCase()}`;

  const wait = Math.max(limiter.lockedFor(ipKey, cfg.LOGIN_MAX_PER_IP), limiter.lockedFor(userKey, cfg.LOGIN_MAX_PER_USER));
  if (wait > 0) {
    console.warn(`[auth] tentative bloquée (anti brute-force) pour "${username}" depuis ${ip}`);
    return renderLogin(req, res, {
      status: 429, username,
      error: `Trop de tentatives de connexion. Réessayez dans ${Math.ceil(wait / 60000)} minute(s).`,
    });
  }

  const admin = username ? db.get('SELECT id, username, password_hash FROM admins WHERE username = ?', username) : null;
  const valid = await sec.verifyPassword(password, admin ? admin.password_hash : await sec.dummyHash());

  if (!admin || !valid || !password) {
    limiter.registerFailure(ipKey);
    limiter.registerFailure(userKey);
    console.warn(`[auth] échec de connexion pour "${username}" depuis ${ip}`);
    await sleep(300 + Math.floor(Math.random() * 300));
    return renderLogin(req, res, { status: 401, username, error: 'Identifiant ou mot de passe incorrect.' });
  }

  limiter.reset(userKey);
  clearCookie(res, LOGIN_CSRF_COOKIE, loginCookieOpts(req));
  createSession(req, res, admin.id); // nouveau jeton à chaque connexion (anti fixation de session)
  console.info(`[auth] connexion de "${admin.username}" depuis ${ip}`);
  return redirect(res, u('/admin/praticiens'));
}

/* ----------------------------------------------------------------------------
 * Départements
 * ------------------------------------------------------------------------- */
function departementsWithCount() {
  return db.all(
    `SELECT d.id, d.nom, d.slug, d.description, d.ordre_affichage, COUNT(p.id) AS nb
       FROM departements d LEFT JOIN praticiens p ON p.departement_id = d.id
      GROUP BY d.id ORDER BY d.ordre_affichage, d.nom`,
  );
}

function listDepartements(ctx, { status = 200, error = null } = {}) {
  return send(ctx.res, status, views.departementsList({
    session: ctx.session, flash: ctx.flash, error, rows: departementsWithCount(),
  }));
}

function departementForm(ctx, id, { dep = null, errors = [], status = 200 } = {}) {
  let current = dep;
  if (!current && id) {
    current = db.get('SELECT * FROM departements WHERE id = ?', id);
    if (!current) return notFound(ctx);
  }
  return send(ctx.res, status, views.departementForm({
    session: ctx.session, errors, dep: current || { nom: '', description: '', ordre_affichage: 0 }, isNew: !id,
  }));
}

function saveDepartement(ctx, id) {
  const existing = id ? db.get('SELECT * FROM departements WHERE id = ?', id) : null;
  if (id && !existing) return notFound(ctx);

  const f = ctx.form.fields;
  const data = {
    id,
    slug: existing ? existing.slug : null,
    nom: cleanLine(f.nom),
    description: cleanText(f.description),
    ordre_affichage: toInt(f.ordre_affichage, 0, 999, 0),
  };
  const errors = [];
  if (data.nom.length < 2 || data.nom.length > 80) errors.push('Le nom doit contenir entre 2 et 80 caractères.');
  if (data.description.length > 600) errors.push('La description ne doit pas dépasser 600 caractères.');
  if (errors.length) return departementForm(ctx, id, { dep: data, errors, status: 422 });

  try {
    if (existing) {
      db.run('UPDATE departements SET nom = ?, description = ?, ordre_affichage = ? WHERE id = ?',
        data.nom, data.description || null, data.ordre_affichage, id);
    } else {
      db.run('INSERT INTO departements (nom, slug, description, ordre_affichage) VALUES (?, ?, ?, ?)',
        data.nom, uniqueSlug(slugify(data.nom)), data.description || null, data.ordre_affichage);
    }
  } catch (err) {
    if (db.isUniqueError(err)) {
      return departementForm(ctx, id, { dep: data, errors: ['Un département porte déjà ce nom.'], status: 409 });
    }
    throw err;
  }
  return redirect(ctx.res, u(`/admin/departements?ok=${existing ? 'dep-updated' : 'dep-created'}`));
}

function deleteDepartement(ctx, id) {
  const dep = db.get('SELECT id, nom FROM departements WHERE id = ?', id);
  if (!dep) return notFound(ctx);
  const { nb } = db.get('SELECT COUNT(*) AS nb FROM praticiens WHERE departement_id = ?', id);
  const blocked = `Impossible de supprimer « ${dep.nom} » : ${nb} praticien(s) y sont encore rattaché(s). `
    + 'Réaffectez-les à un autre département ou supprimez-les d\'abord.';
  if (nb > 0) return listDepartements(ctx, { status: 409, error: blocked });
  try {
    db.run('DELETE FROM departements WHERE id = ?', id);
  } catch (err) {
    if (db.isForeignKeyError(err)) return listDepartements(ctx, { status: 409, error: blocked });
    throw err;
  }
  return redirect(ctx.res, u('/admin/departements?ok=dep-deleted'));
}

/* ----------------------------------------------------------------------------
 * Praticiens
 * ------------------------------------------------------------------------- */
function listPraticiens(ctx) {
  const rows = db.all(
    `SELECT p.id, p.nom, p.prenom, p.specialite, p.photo_path, p.photo_position, p.est_actif, p.ordre_affichage,
            d.nom AS departement_nom
       FROM praticiens p
       JOIN departements d ON d.id = p.departement_id
      ORDER BY d.ordre_affichage, d.nom, p.ordre_affichage, p.nom, p.prenom`,
  );
  return send(ctx.res, 200, views.praticiensList({ session: ctx.session, flash: ctx.flash, rows }));
}

function praticienForm(ctx, id, { pra = null, errors = [], status = 200 } = {}) {
  let current = pra;
  if (!current && id) {
    current = db.get('SELECT * FROM praticiens WHERE id = ?', id);
    if (!current) return notFound(ctx);
  }
  const departements = db.all('SELECT id, nom FROM departements ORDER BY ordre_affichage, nom');
  return send(ctx.res, status, views.praticienForm({
    session: ctx.session, errors, departements, isNew: !id,
    pra: current || {
      nom: '', prenom: '', specialite: '', biographie: '', departement_id: null,
      est_actif: 1, photo_path: null, photo_position: 'center 15%', ordre_affichage: 0,
    },
  }));
}

function readPraticien(fields) {
  return {
    nom: cleanLine(fields.nom).replace(/^(dr|docteur|pr|professeur)\.?\s+/i, ''),
    prenom: cleanLine(fields.prenom),
    specialite: cleanLine(fields.specialite),
    biographie: cleanText(fields.biographie),
    departement_id: toInt(fields.departement_id, 1, Number.MAX_SAFE_INTEGER, null),
    est_actif: fields.est_actif === '1' ? 1 : 0,
    photo_position: cfg.PHOTO_POSITIONS.includes(fields.photo_position) ? fields.photo_position : 'center 15%',
    ordre_affichage: toInt(fields.ordre_affichage, 0, 999, 0),
  };
}

function savePraticien(ctx, id) {
  const existing = id ? db.get('SELECT * FROM praticiens WHERE id = ?', id) : null;
  if (id && !existing) return notFound(ctx);

  const data = readPraticien(ctx.form.fields);
  const errors = [];
  if (data.nom.length < 1 || data.nom.length > 80) errors.push('Le nom est obligatoire (80 caractères maximum).');
  if (data.prenom.length < 1 || data.prenom.length > 80) errors.push('Le prénom est obligatoire (80 caractères maximum).');
  if (data.specialite.length < 2 || data.specialite.length > 120) errors.push('La spécialité est obligatoire (120 caractères maximum).');
  if (data.biographie.length > 1000) errors.push('La biographie ne doit pas dépasser 1000 caractères.');
  if (!data.departement_id || !db.get('SELECT 1 FROM departements WHERE id = ?', data.departement_id)) {
    errors.push('Veuillez choisir un département valide.');
  }

  let newPhoto = null;
  if (!errors.length && ctx.form.files.photo) {
    try {
      newPhoto = savePhoto(ctx.form.files.photo);
    } catch (err) {
      if (!(err instanceof UploadError)) throw err;
      errors.push(err.message);
    }
  }

  const formState = { ...data, id, photo_path: existing ? existing.photo_path : null };
  if (errors.length) return praticienForm(ctx, id, { pra: formState, errors, status: 422 });

  let photoPath = existing ? existing.photo_path : null;
  if (newPhoto) photoPath = newPhoto;
  else if (ctx.form.fields.remove_photo === '1') photoPath = null;

  const values = [data.nom, data.prenom, data.specialite, data.biographie || null, data.departement_id,
    data.est_actif, data.photo_position, data.ordre_affichage, photoPath];
  try {
    if (existing) {
      db.run(
        `UPDATE praticiens SET nom = ?, prenom = ?, specialite = ?, biographie = ?, departement_id = ?,
                est_actif = ?, photo_position = ?, ordre_affichage = ?, photo_path = ?, updated_at = CURRENT_TIMESTAMP
          WHERE id = ?`,
        ...values, id,
      );
    } else {
      db.run(
        `INSERT INTO praticiens (nom, prenom, specialite, biographie, departement_id, est_actif, photo_position, ordre_affichage, photo_path)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        ...values,
      );
    }
  } catch (err) {
    if (newPhoto) deletePhoto(newPhoto);
    if (db.isUniqueError(err)) {
      return praticienForm(ctx, id, { pra: formState, errors: ['Un praticien portant ce nom et ce prénom existe déjà.'], status: 409 });
    }
    throw err;
  }

  // Ancienne photo remplacée ou retirée : suppression du fichier sur le disque
  if (existing && existing.photo_path && existing.photo_path !== photoPath) deletePhoto(existing.photo_path);
  return redirect(ctx.res, u(`/admin/praticiens?ok=${existing ? 'pra-updated' : 'pra-created'}`));
}

function deletePraticien(ctx, id) {
  const pra = db.get('SELECT id, photo_path FROM praticiens WHERE id = ?', id);
  if (!pra) return notFound(ctx);
  db.run('DELETE FROM praticiens WHERE id = ?', id);
  deletePhoto(pra.photo_path);
  return redirect(ctx.res, u('/admin/praticiens?ok=pra-deleted'));
}

module.exports = { handleAdmin };
