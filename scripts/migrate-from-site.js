'use strict';
/**
 * Script de migration idempotent des données actuelles du site vers SQLite.
 *
 * Étapes :
 * 1. Initialise le schéma SQLite (PRAGMA foreign_keys = ON).
 * 2. Insère les départements uniques (sans doublon).
 * 3. Copie chaque photo existante depuis assets/images/ vers uploads/praticiens/
 *    (nom stable dérivé du fichier source, évite les doublons à chaque relance).
 * 4. Insère les praticiens actuels liés à leur departement_id (sans doublon).
 * 5. Affiche un rapport clair de la migration.
 *
 * Usage : npm run db:migrate
 */
const fs = require('node:fs');
const path = require('node:path');
const db = require('../server/lib/db');
const { ROOT, UPLOAD_DIR, UPLOAD_URL_PREFIX } = require('../server/config');

const DEPARTEMENTS_ACTUELS = [
  {
    nom: 'Maternité & Obstétrique',
    slug: 'maternite',
    description: 'Suivi de grossesse, accouchements sécurisés, césariennes et accompagnement maternel 24h/24.',
    ordre_affichage: 1,
  },
  {
    nom: 'Gynécologie',
    slug: 'gynecologie',
    description: 'Gynécologie médicale et chirurgicale, dépistage, contraception, endométriose et troubles hormonaux.',
    ordre_affichage: 2,
  },
  {
    nom: 'Pédiatrie & Néonatologie',
    slug: 'pediatrie',
    description: 'Accueil du nouveau-né en maternité, néonatologie, suivi de croissance et consultations pédiatriques.',
    ordre_affichage: 3,
  },
  {
    nom: 'Chirurgie Viscérale & Générale',
    slug: 'chirurgie',
    description: 'Chirurgie viscérale, générale et mini-invasive par cœlioscopie, protocole RAAC.',
    ordre_affichage: 4,
  },
  {
    nom: 'Chirurgie Infantile',
    slug: 'chirurgie-infantile',
    description: 'Chirurgie pédiatrique du nourrisson et de l\'enfant : hernies, ectopie, phimosis et malformations.',
    ordre_affichage: 5,
  },
  {
    nom: 'Anesthésie & Réanimation',
    slug: 'anesthesie',
    description: 'Consultation pré-anesthésique, péridurale obstétricale, sécurité au bloc et prise en charge de la douleur.',
    ordre_affichage: 6,
  },
  {
    nom: 'Urologie & Santé Pelvienne',
    slug: 'urologie',
    description: 'Prise en charge des pathologies urologiques, lithiases et santé pelvienne.',
    ordre_affichage: 7,
  },
  {
    nom: 'Gastro-Entéro-Hépatologie & Endoscopie',
    slug: 'gastro',
    description: 'Consultations digestives, fibroscopie et coloscopie sous anesthésie.',
    ordre_affichage: 8,
  },
];

const PRATICIENS_ACTUELS = [
  {
    nom: 'Benimam',
    prenom: 'Nabila',
    specialite: 'Gynéco-Obstétricienne',
    departement_slug: 'maternite',
    source_photo: 'assets/images/dr-obstetrics.jpg',
    dest_photo_name: 'mig-dr-benimam.jpg',
    photo_position: 'center 15%',
    biographie: 'Spécialiste en gynécologie-obstétrique, suivi de grossesse, accouchements et chirurgie gynécologique.',
    ordre_affichage: 1,
  },
  {
    nom: 'Louafi',
    prenom: 'Hana',
    specialite: 'Gynécologue',
    departement_slug: 'gynecologie',
    source_photo: 'assets/images/dr-louafi.jpg',
    dest_photo_name: 'mig-dr-louafi.jpg',
    photo_position: 'center 15%',
    biographie: 'Spécialiste en gynécologie, suivi gynécologique, dépistage, contraception et troubles hormonaux.',
    ordre_affichage: 1,
  },
  {
    nom: 'El Hassane',
    prenom: 'Ahmed',
    specialite: 'Pédiatre - Néonatologue',
    departement_slug: 'pediatrie',
    source_photo: 'assets/images/dr-pediatrics.jpg',
    dest_photo_name: 'mig-dr-elhassane.jpg',
    photo_position: 'center 12%',
    biographie: 'Spécialiste en pédiatrie et néonatologie, prise en charge du nouveau-né, suivi de croissance et consultations pédiatriques.',
    ordre_affichage: 1,
  },
  {
    nom: 'Toualbi',
    prenom: 'Souad',
    specialite: 'Pédiatre - Néonatologue',
    departement_slug: 'pediatrie',
    source_photo: 'assets/images/dr-toualbi.jpg',
    dest_photo_name: 'mig-dr-toualbi.jpg',
    photo_position: 'center 15%',
    biographie: 'Spécialiste en pédiatrie et néonatologie, suivi médical du nourrisson et de l\'enfant, vaccinations et développement psychomoteur.',
    ordre_affichage: 2,
  },
  {
    nom: 'Bencharef',
    prenom: 'Abdelkader',
    specialite: 'Chirurgie Viscérale & Générale',
    departement_slug: 'chirurgie',
    source_photo: 'assets/images/dr-surgeon.jpg',
    dest_photo_name: 'mig-dr-bencharef.jpg',
    photo_position: 'center 15%',
    biographie: 'Spécialiste en chirurgie viscérale et générale, expert en cœlioscopie et chirurgie de la paroi abdominale.',
    ordre_affichage: 1,
  },
  {
    nom: 'Begar',
    prenom: 'Fethia',
    specialite: 'Chirurgienne Infantile',
    departement_slug: 'chirurgie-infantile',
    source_photo: 'assets/images/dr-begar.jpg',
    dest_photo_name: 'mig-dr-begar.jpg',
    photo_position: 'center 18%',
    biographie: 'Spécialiste en chirurgie pédiatrique : hernies, ectopie testiculaire, phimosis, appendicite et malformations congénitales.',
    ordre_affichage: 1,
  },
  {
    nom: 'Marchoud',
    prenom: 'Ines',
    specialite: 'Anesthésiste - Réanimateur',
    departement_slug: 'anesthesie',
    source_photo: 'assets/images/dr-marchoud.jpg',
    dest_photo_name: 'mig-dr-marchoud.jpg',
    photo_position: 'center 18%',
    biographie: 'Spécialiste en anesthésie-réanimation, consultation pré-anesthésique, péridurale obstétricale et prise en charge de la douleur.',
    ordre_affichage: 1,
  },
  {
    nom: 'Hasni',
    prenom: 'Abdelaziz',
    specialite: 'Anesthésiste - Réanimateur',
    departement_slug: 'anesthesie',
    source_photo: 'assets/images/dr-hasni.jpg',
    dest_photo_name: 'mig-dr-hasni.jpg',
    photo_position: 'center 20%',
    biographie: 'Spécialiste en anesthésie-réanimation, évaluation pré-opératoire, sécurité au bloc opératoire et réanimation.',
    ordre_affichage: 2,
  },
  {
    nom: 'Baitich',
    prenom: 'Amine',
    specialite: 'Anesthésiste - Réanimateur',
    departement_slug: 'anesthesie',
    source_photo: 'assets/images/dr-baitich.jpg',
    dest_photo_name: 'mig-dr-baitich.jpg',
    photo_position: 'center 25%',
    biographie: 'Spécialiste en anesthésie-réanimation, anesthésie générale et locorégionale, surveillance post-opératoire et prise en charge de la douleur.',
    ordre_affichage: 3,
  },
];

function copyPhotoIfNeeded(sourceRel, destName) {
  const src = path.join(ROOT, sourceRel);
  if (!fs.existsSync(src)) {
    console.warn(`  [!] Photo source introuvable : ${sourceRel}`);
    return { photoPath: null, copied: false };
  }
  fs.mkdirSync(UPLOAD_DIR, { recursive: true });
  const dest = path.join(UPLOAD_DIR, destName);
  let copied = false;
  if (!fs.existsSync(dest)) {
    fs.copyFileSync(src, dest);
    copied = true;
  }
  return { photoPath: UPLOAD_URL_PREFIX + destName, copied };
}

function migrate() {
  db.initSchema();

  const stats = {
    depsInserted: 0,
    depsSkipped: 0,
    praticiensInserted: 0,
    praticiensSkipped: 0,
    photosCopied: 0,
  };

  const depIdsBySlug = new Map();

  db.transaction(() => {
    for (const dep of DEPARTEMENTS_ACTUELS) {
      const existing = db.get('SELECT id FROM departements WHERE slug = ? OR nom = ?', dep.slug, dep.nom);
      if (existing) {
        depIdsBySlug.set(dep.slug, existing.id);
        stats.depsSkipped += 1;
      } else {
        const res = db.run(
          'INSERT INTO departements (nom, slug, description, ordre_affichage) VALUES (?, ?, ?, ?)',
          dep.nom, dep.slug, dep.description, dep.ordre_affichage,
        );
        depIdsBySlug.set(dep.slug, Number(res.lastInsertRowid));
        stats.depsInserted += 1;
      }
    }

    for (const p of PRATICIENS_ACTUELS) {
      const existing = db.get(
        'SELECT id FROM praticiens WHERE nom = ? COLLATE NOCASE AND prenom = ? COLLATE NOCASE',
        p.nom, p.prenom,
      );
      if (existing) {
        stats.praticiensSkipped += 1;
        continue;
      }

      const depId = depIdsBySlug.get(p.departement_slug);
      if (!depId) throw new Error(`Département introuvable pour ${p.nom} ${p.prenom} : ${p.departement_slug}`);

      const { photoPath, copied } = copyPhotoIfNeeded(p.source_photo, p.dest_photo_name);
      if (copied) stats.photosCopied += 1;

      db.run(
        `INSERT INTO praticiens
           (nom, prenom, specialite, photo_path, photo_position, biographie, departement_id, est_actif, ordre_affichage)
         VALUES (?, ?, ?, ?, ?, ?, ?, 1, ?)`,
        p.nom, p.prenom, p.specialite, photoPath, p.photo_position, p.biographie, depId, p.ordre_affichage,
      );
      stats.praticiensInserted += 1;
    }
  });

  const totalDeps = db.get('SELECT COUNT(*) AS n FROM departements').n;
  const totalPraticiens = db.get('SELECT COUNT(*) AS n FROM praticiens').n;

  console.log('=== Rapport de migration vers SQLite ===');
  console.log(`Départements : +${stats.depsInserted} ajouté(s), ${stats.depsSkipped} déjà présent(s) (total : ${totalDeps})`);
  console.log(`Praticiens   : +${stats.praticiensInserted} ajouté(s), ${stats.praticiensSkipped} déjà présent(s) (total : ${totalPraticiens})`);
  console.log(`Photos       : ${stats.photosCopied} copiée(s) dans uploads/praticiens/`);
  db.close();
}

migrate();
