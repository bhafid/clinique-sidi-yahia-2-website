'use strict';
/**
 * Rendu dynamique (côté serveur) des praticiens dans les pages publiques.
 * Les pages HTML contiennent des marqueurs remplacés à chaque requête :
 *   <!--@praticiens:grid-->        grille filtrable par département (page d'accueil)
 *   <!--@praticiens:highlights-->  encarts « praticien référent » (pages de spécialité)
 *   <!--@praticiens:options-->     options du sélecteur de médecin (formulaire de rendez-vous)
 */
const db = require('./db');
const { escapeHtml: e } = require('./security');
const { isValidPhotoPath } = require('./uploads');
const { PAGES, BOOKING_SPECIALTY, PHOTO_POSITIONS, PLACEHOLDER_PHOTO } = require('../config');

const MARKER_RE = /<!--@praticiens:(grid|highlights|options)-->/g;

function loadPraticiens(fileName) {
  const rows = db.all(
    `SELECT p.id, p.nom, p.prenom, p.specialite, p.photo_path, p.photo_position, p.biographie,
            d.id AS dep_id, d.nom AS dep_nom, d.slug AS dep_slug, d.ordre_affichage AS dep_ordre
       FROM praticiens p
       JOIN departements d ON d.id = p.departement_id
      WHERE p.est_actif = 1
      ORDER BY d.ordre_affichage, d.nom, p.ordre_affichage, p.nom, p.prenom`,
  );
  const slugs = PAGES[fileName] && PAGES[fileName].departements;
  if (!slugs) return rows;
  return slugs.flatMap((slug) => rows.filter((r) => r.dep_slug === slug));
}

const fullName = (p) => `Dr. ${p.nom} ${p.prenom}`;
const photoSrc = (p) => (isValidPhotoPath(p.photo_path) ? p.photo_path : PLACEHOLDER_PHOTO);
const photoPos = (p) => (PHOTO_POSITIONS.includes(p.photo_position) ? p.photo_position : 'center 15%');
const booking = (p) => BOOKING_SPECIALTY[p.dep_slug] || p.dep_nom;

function renderGrid(list) {
  if (!list.length) {
    return '      <p class="section-description" style="text-align:center;">L\'équipe médicale sera bientôt présentée ici.</p>\n';
  }
  const departements = [];
  for (const p of list) if (!departements.some((d) => d.slug === p.dep_slug)) departements.push({ slug: p.dep_slug, nom: p.dep_nom });

  let filters = '';
  if (departements.length > 1) {
    const btnStyle = 'padding: 0.55rem 1.1rem; font-size: 0.9rem;';
    filters = `      <div class="doctor-filters" style="display:flex; flex-wrap:wrap; gap:0.6rem; justify-content:center; margin-bottom:2.5rem;">
        <button type="button" class="btn btn-primary doctor-filter-btn" data-filter="all" style="${btnStyle}">Tous les pôles</button>
${departements.map((d) => `        <button type="button" class="btn btn-secondary doctor-filter-btn" data-filter="${e(d.slug)}" style="${btnStyle}">${e(d.nom)}</button>`).join('\n')}
      </div>\n`;
  }

  const cards = list.map((p) => `        <div class="team-card" data-category="${e(p.dep_slug)}">
          <div class="team-thumb">
            <img src="${e(photoSrc(p))}" alt="${e(fullName(p))}, ${e(p.specialite)}" loading="lazy" style="object-position: ${e(photoPos(p))};">
          </div>
          <div class="team-info">
            <span class="team-role">${e(p.specialite)}</span>
            <h4 class="team-name">${e(fullName(p))}</h4>
            <p class="team-credentials">${e(p.biographie)}</p>
            <div class="team-footer">
              <span class="team-consult">Sur Rendez-vous</span>
              <a href="#" class="btn-book-doc" data-open-modal="appointment" data-doctor="${e(fullName(p))}"
                data-specialty="${e(booking(p))}">Consulter &rarr;</a>
            </div>
          </div>
        </div>`).join('\n\n');

  return `${filters}      <div class="team-grid">\n${cards}\n      </div>\n`;
}

function renderHighlights(list) {
  if (!list.length) return '';
  const cards = list.map((p) => `      <div
        style="background: #fff; border-radius: var(--radius-lg); border: 1px solid var(--color-border); padding: 3rem; display: grid; grid-template-columns: 240px 1fr; gap: 2.5rem; align-items: center; box-shadow: var(--shadow-md);">
        <div style="border-radius: var(--radius-md); overflow: hidden; height: 260px;">
          <img src="${e(photoSrc(p))}" alt="${e(fullName(p))}, ${e(p.specialite)}"
            style="width:100%; height:100%; object-fit: cover; object-position: ${e(photoPos(p))};">
        </div>
        <div>
          <span class="badge badge-teal" style="margin-bottom: 0.5rem;">${e(p.dep_nom)}</span>
          <h3 style="font-size: 1.6rem; color: var(--color-primary); margin-bottom: 0.5rem;">${e(fullName(p))}</h3>
          <p style="color: var(--color-teal); font-weight: 600; margin-bottom: 1rem;">${e(p.specialite)}</p>
          <p style="font-size: 0.95rem; line-height: 1.6; color: var(--text-secondary); margin-bottom: 1.5rem;">
            ${e(p.biographie)}
          </p>
          <button class="btn btn-primary" data-open-modal="appointment"
            data-specialty="${e(booking(p))}" data-doctor="${e(fullName(p))}">
            Prendre Rendez-vous avec le Dr. ${e(p.nom)}
          </button>
        </div>
      </div>`).join('\n\n');

  return `  <section class="section section-muted">
    <div class="container" style="max-width: 900px; display: flex; flex-direction: column; gap: 2rem;">
${cards}
    </div>
  </section>\n`;
}

function renderOptions(list) {
  return list.map((p) => `                <option value="${e(fullName(p))}">${e(fullName(p))} (${e(p.specialite)})</option>`).join('\n');
}

function renderPage(fileName, html) {
  if (!html.includes('<!--@praticiens:')) return html;
  const list = loadPraticiens(fileName);
  return html.replace(MARKER_RE, (_, kind) => {
    if (kind === 'grid') return renderGrid(list);
    if (kind === 'highlights') return renderHighlights(list);
    return renderOptions(list);
  });
}

module.exports = { renderPage };
