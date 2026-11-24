'use strict';
/**
 * Vues HTML de l'administration (rendu serveur, toutes les données sont échappées).
 * Aucun style ni script en ligne : compatible avec la CSP stricte de l'administration.
 */
const { escapeHtml: e } = require('../lib/security');
const { isValidPhotoPath } = require('../lib/uploads');
const { PHOTO_POSITIONS, PLACEHOLDER_PHOTO, BASE_PATH } = require('../config');

const u = (sub) => `${BASE_PATH}${sub}`;
const csrfField = (session) => `<input type="hidden" name="_csrf" value="${e(session.csrf_token)}">`;
const photoUrl = (p) => `${BASE_PATH}/${isValidPhotoPath(p) ? p : PLACEHOLDER_PHOTO}`;

function alerts({ flash, error, info }) {
  return [
    flash ? `<div class="alert alert-success" role="status">${e(flash)}</div>` : '',
    info ? `<div class="alert alert-info" role="status">${e(info)}</div>` : '',
    error ? `<div class="alert alert-error" role="alert">${e(error)}</div>` : '',
  ].join('');
}

function errorsBlock(errors) {
  if (!errors || !errors.length) return '';
  return `<div class="alert alert-error" role="alert"><strong>Veuillez corriger les points suivants :</strong>
    <ul>${errors.map((x) => `<li>${e(x)}</li>`).join('')}</ul></div>`;
}

function layout({ title, session = null, body, flash = null, error = null, info = null, active = '' }) {
  const nav = session ? `
  <header class="topbar">
    <div class="topbar-inner">
      <a class="brand" href="${u('/admin/praticiens')}"><img src="${u('/assets/images/logo.png')}" alt=""> <span>Sidi Yahia 2 <small>Administration</small></span></a>
      <nav class="nav">
        <a href="${u('/admin/praticiens')}" class="${active === 'praticiens' ? 'active' : ''}">Praticiens</a>
        <a href="${u('/admin/departements')}" class="${active === 'departements' ? 'active' : ''}">Départements</a>
        <a href="${u('/')}" target="_blank" rel="noopener">Voir le site ↗</a>
      </nav>
      <form method="post" action="${u('/admin/logout')}" class="logout">
        ${csrfField(session)}
        <span class="who" title="Connecté">${e(session.username)}</span>
        <button type="submit" class="btn btn-ghost">Déconnexion</button>
      </form>
    </div>
  </header>` : '';

  return `<!DOCTYPE html>
<html lang="fr">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta name="robots" content="noindex, nofollow">
  <title>${e(title)} · Administration · Clinique Sidi Yahia 2</title>
  <link rel="stylesheet" href="${u('/admin/static/admin.css')}">
</head>
<body class="${session ? 'is-admin' : 'is-login'}">
${nav}
  <main class="${session ? 'container' : 'login-wrap'}">
    ${alerts({ flash, error, info })}
    ${body}
  </main>
  <script src="${u('/admin/static/admin.js')}" defer></script>
</body>
</html>`;
}

/* ------------------------------------------------------------------------- */
function loginPage({ csrf, error, info, username }) {
  return layout({
    title: 'Connexion', error, info,
    body: `
    <div class="login-card">
      <img src="${u('/assets/images/logo.png')}" alt="Clinique Sidi Yahia 2" class="login-logo">
      <h1>Espace administration</h1>
      <p class="muted">Clinique Sidi Yahia 2 · Accès réservé</p>
      <form method="post" action="${u('/admin/login')}" class="form">
        <input type="hidden" name="_csrf" value="${e(csrf)}">
        <label for="username">Identifiant</label>
        <input id="username" name="username" type="text" required maxlength="64" autocomplete="username" autofocus value="${e(username)}">
        <label for="password">Mot de passe</label>
        <input id="password" name="password" type="password" required maxlength="256" autocomplete="current-password">
        <button type="submit" class="btn btn-primary btn-block">Se connecter</button>
      </form>
      <p class="muted small">🔒 Connexion protégée. Les tentatives sont limitées et journalisées.</p>
    </div>`,
  });
}

function errorPage({ session = null, title, message, back = null }) {
  return layout({
    title, session,
    body: `<div class="card narrow"><h1>${e(title)}</h1><p>${e(message)}</p>
      <p><a class="btn btn-secondary" href="${e(back || (session ? u('/admin/praticiens') : u('/admin/login')))}">← Retour</a></p></div>`,
  });
}

/* ------------------------------------------------------------------------- */
function departementsList({ session, flash, error, rows }) {
  const body = rows.length ? `
    <div class="table-wrap"><table class="table">
      <thead><tr><th>Ordre</th><th>Nom</th><th>Identifiant (page)</th><th>Description</th><th>Praticiens</th><th class="right">Actions</th></tr></thead>
      <tbody>
      ${rows.map((d) => `<tr>
        <td>${e(d.ordre_affichage)}</td>
        <td><strong>${e(d.nom)}</strong></td>
        <td><code>${e(d.slug)}</code></td>
        <td class="muted clamp">${e(d.description || '—')}</td>
        <td><span class="badge ${d.nb ? 'badge-on' : 'badge-off'}">${e(d.nb)}</span></td>
        <td class="right actions">
          <a class="btn btn-small btn-secondary" href="${u(`/admin/departements/${e(d.id)}/edit`)}">Modifier</a>
          <form method="post" action="${u(`/admin/departements/${e(d.id)}/delete`)}" data-confirm="Supprimer définitivement le département « ${e(d.nom)} » ?">
            ${csrfField(session)}<button type="submit" class="btn btn-small btn-danger">Supprimer</button>
          </form>
        </td></tr>`).join('')}
      </tbody></table></div>` : '<div class="card empty">Aucun département pour le moment.</div>';

  return layout({
    title: 'Départements', session, flash, error, active: 'departements',
    body: `<div class="page-head"><div><h1>Départements</h1><p class="muted">Pôles médicaux affichés sur le site public.</p></div>
      <a class="btn btn-primary" href="${u('/admin/departements/new')}">+ Ajouter un département</a></div>${body}`,
  });
}

function departementForm({ session, dep, errors, isNew }) {
  const action = isNew ? u('/admin/departements') : u(`/admin/departements/${e(dep.id)}`);
  return layout({
    title: isNew ? 'Nouveau département' : 'Modifier le département', session, active: 'departements',
    body: `<div class="page-head"><h1>${isNew ? 'Nouveau département' : `Modifier : ${e(dep.nom)}`}</h1>
      <a class="btn btn-secondary" href="${u('/admin/departements')}">← Retour à la liste</a></div>
    ${errorsBlock(errors)}
    <form method="post" action="${action}" class="card form">
      ${csrfField(session)}
      <label for="nom">Nom du département *</label>
      <input id="nom" name="nom" required minlength="2" maxlength="80" value="${e(dep.nom)}" placeholder="Ex : Maternité & Obstétrique">
      ${!isNew && dep.slug ? `<p class="hint">Identifiant technique (lien avec les pages du site) : <code>${e(dep.slug)}</code></p>` : ''}
      <label for="description">Description</label>
      <textarea id="description" name="description" rows="4" maxlength="600">${e(dep.description || '')}</textarea>
      <label for="ordre_affichage">Ordre d'affichage</label>
      <input id="ordre_affichage" name="ordre_affichage" type="number" min="0" max="999" value="${e(dep.ordre_affichage ?? 0)}">
      <p class="hint">Les départements sont affichés du plus petit au plus grand numéro.</p>
      <div class="form-actions"><button type="submit" class="btn btn-primary">${isNew ? 'Créer le département' : 'Enregistrer'}</button></div>
    </form>`,
  });
}

/* ------------------------------------------------------------------------- */
function praticiensList({ session, flash, rows }) {
  const body = rows.length ? `
    <div class="table-wrap"><table class="table">
      <thead><tr><th>Photo</th><th>Nom complet</th><th>Spécialité</th><th>Département</th><th>Statut</th><th class="right">Actions</th></tr></thead>
      <tbody>
      ${rows.map((p) => `<tr>
        <td><img class="thumb" src="${e(photoUrl(p.photo_path))}" data-pos="${e(p.photo_position || 'center 15%')}" alt="" loading="lazy"></td>
        <td><strong>Dr. ${e(p.nom)} ${e(p.prenom)}</strong></td>
        <td>${e(p.specialite)}</td>
        <td>${e(p.departement_nom)}</td>
        <td>${p.est_actif ? '<span class="badge badge-on">Actif</span>' : '<span class="badge badge-off">Masqué</span>'}</td>
        <td class="right actions">
          <a class="btn btn-small btn-secondary" href="${u(`/admin/praticiens/${e(p.id)}/edit`)}">Modifier</a>
          <form method="post" action="${u(`/admin/praticiens/${e(p.id)}/delete`)}" data-confirm="Supprimer définitivement le Dr. ${e(p.nom)} ${e(p.prenom)} et sa photo ?">
            ${csrfField(session)}<button type="submit" class="btn btn-small btn-danger">Supprimer</button>
          </form>
        </td></tr>`).join('')}
      </tbody></table></div>` : '<div class="card empty">Aucun praticien pour le moment.</div>';

  return layout({
    title: 'Praticiens', session, flash, active: 'praticiens',
    body: `<div class="page-head"><div><h1>Praticiens référents</h1><p class="muted">${rows.length} praticien(s) · seuls les praticiens « Actifs » apparaissent sur le site.</p></div>
      <a class="btn btn-primary" href="${u('/admin/praticiens/new')}">+ Ajouter un praticien</a></div>${body}`,
  });
}

function praticienForm({ session, pra, departements, errors, isNew }) {
  if (!departements.length) {
    return layout({
      title: 'Nouveau praticien', session, active: 'praticiens',
      body: `<div class="card narrow"><h1>Aucun département</h1><p>Créez d'abord un département avant d'ajouter un praticien.</p>
        <p><a class="btn btn-primary" href="${u('/admin/departements/new')}">+ Ajouter un département</a></p></div>`,
    });
  }
  const action = isNew ? u('/admin/praticiens') : u(`/admin/praticiens/${e(pra.id)}`);
  const pos = PHOTO_POSITIONS.includes(pra.photo_position) ? pra.photo_position : 'center 15%';
  return layout({
    title: isNew ? 'Nouveau praticien' : 'Modifier le praticien', session, active: 'praticiens',
    body: `<div class="page-head"><h1>${isNew ? 'Nouveau praticien' : `Modifier : Dr. ${e(pra.nom)} ${e(pra.prenom)}`}</h1>
      <a class="btn btn-secondary" href="${u('/admin/praticiens')}">← Retour à la liste</a></div>
    ${errorsBlock(errors)}
    <form method="post" action="${action}" enctype="multipart/form-data" class="form form-grid">
      ${csrfField(session)}
      <div class="card">
        <div class="row">
          <div><label for="nom">Nom *</label>
            <input id="nom" name="nom" required maxlength="80" value="${e(pra.nom)}" placeholder="Ex : Benimam"></div>
          <div><label for="prenom">Prénom *</label>
            <input id="prenom" name="prenom" required maxlength="80" value="${e(pra.prenom)}" placeholder="Ex : Nabila"></div>
        </div>
        <p class="hint">Saisissez le nom sans « Dr. » : il est ajouté automatiquement sur le site.</p>
        <label for="specialite">Spécialité *</label>
        <input id="specialite" name="specialite" required maxlength="120" value="${e(pra.specialite)}" placeholder="Ex : Gynéco-Obstétricienne">
        <label for="departement_id">Département *</label>
        <select id="departement_id" name="departement_id" required>
          <option value="">— Choisir un département —</option>
          ${departements.map((d) => `<option value="${e(d.id)}"${Number(pra.departement_id) === d.id ? ' selected' : ''}>${e(d.nom)}</option>`).join('')}
        </select>
        <label for="biographie">Biographie / présentation</label>
        <textarea id="biographie" name="biographie" rows="5" maxlength="1000">${e(pra.biographie || '')}</textarea>
        <div class="row">
          <div><label for="ordre_affichage">Ordre d'affichage</label>
            <input id="ordre_affichage" name="ordre_affichage" type="number" min="0" max="999" value="${e(pra.ordre_affichage ?? 0)}"></div>
          <div class="check"><label><input type="checkbox" name="est_actif" value="1"${pra.est_actif ? ' checked' : ''}> Actif (visible sur le site)</label></div>
        </div>
      </div>

      <div class="card photo-card">
        <label>Photo</label>
        <img id="photoPreview" class="preview" src="${e(photoUrl(pra.photo_path))}" data-pos="${e(pos)}" alt="Aperçu de la photo">
        <label for="photo" class="btn btn-secondary btn-block file-btn">Choisir une photo…</label>
        <input id="photo" name="photo" type="file" accept=".jpg,.jpeg,.png,.webp,image/jpeg,image/png,image/webp" class="visually-hidden">
        <p id="photoError" class="field-error" role="alert"></p>
        <p class="hint">JPG, PNG ou WebP · 2 Mo maximum · format portrait conseillé.</p>
        <label for="photo_position">Cadrage vertical</label>
        <select id="photo_position" name="photo_position">
          ${PHOTO_POSITIONS.map((v) => `<option value="${e(v)}"${v === pos ? ' selected' : ''}>${e(v.replace('center ', 'Haut de l\'image + '))}</option>`).join('')}
        </select>
        ${!isNew && pra.photo_path ? '<label class="check"><input type="checkbox" name="remove_photo" value="1"> Retirer la photo actuelle</label>' : ''}
      </div>

      <div class="form-actions full"><button type="submit" class="btn btn-primary">${isNew ? 'Créer le praticien' : 'Enregistrer les modifications'}</button></div>
    </form>`,
  });
}

module.exports = { loginPage, errorPage, departementsList, departementForm, praticiensList, praticienForm };
