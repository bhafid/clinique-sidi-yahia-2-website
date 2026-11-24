'use strict';
/**
 * Configuration centrale du serveur (surchargeable par variables d'environnement).
 */
const path = require('node:path');

const ROOT = path.resolve(__dirname, '..');

module.exports = {
  ROOT,
  DB_PATH: process.env.DB_PATH || path.join(ROOT, 'database', 'clinique.sqlite'),
  SCHEMA_PATH: path.join(ROOT, 'database', 'schema.sql'),
  SEED_PATH: path.join(ROOT, 'database', 'seed', 'site-actuel.json'),
  UPLOAD_DIR: path.join(ROOT, 'uploads', 'praticiens'),
  UPLOAD_URL_PREFIX: 'uploads/praticiens/',
  PLACEHOLDER_PHOTO: 'assets/images/logo.png',

  PORT: Number(process.env.PORT) || 3000,
  HOST: process.env.HOST || '127.0.0.1',
  BASE_PATH: (process.env.BASE_PATH || '').replace(/\/+$/, ''),
  IS_PROD: process.env.NODE_ENV === 'production',
  // Mettre TRUST_PROXY=1 uniquement derrière un reverse proxy (Nginx, Caddy...)
  TRUST_PROXY: process.env.TRUST_PROXY === '1',

  SESSION_IDLE_MS: 30 * 60 * 1000,       // 30 min d'inactivité
  SESSION_ABSOLUTE_MS: 8 * 60 * 60 * 1000, // 8 h maximum
  MAX_UPLOAD_BYTES: 2 * 1024 * 1024,     // 2 Mo

  LOGIN_WINDOW_MS: 15 * 60 * 1000,       // fenêtre anti brute-force
  LOGIN_MAX_PER_USER: 5,
  LOGIN_MAX_PER_IP: 20,

  /**
   * Pages publiques servies par le serveur.
   * departements : slugs affichés dans les encarts de la page (null = tous).
   */
  PAGES: {
    'index.html': { departements: null },
    'contact.html': { departements: null },
    'maternite.html': { departements: ['maternite'] },
    'gynecologie.html': { departements: ['maternite', 'gynecologie'] },
    'pediatrie.html': { departements: ['pediatrie'] },
    'chirurgie.html': { departements: ['chirurgie', 'chirurgie-infantile'] },
    'anesthesie.html': { departements: ['anesthesie'] },
    'urologie.html': { departements: ['urologie'] },
    'gastro.html': { departements: ['gastro'] },
  },

  /** Valeur du « Pôle médical » pré-sélectionné dans le formulaire de rendez-vous. */
  BOOKING_SPECIALTY: {
    maternite: 'Maternité & Obstétrique',
    gynecologie: 'Gynécologie Médicale',
    pediatrie: 'Pédiatrie & Néonatologie',
    chirurgie: 'Chirurgie Générale & Mini-invasive',
    'chirurgie-infantile': 'Chirurgie Infantile',
    anesthesie: 'Consultation Pré-Anesthésie',
    urologie: 'Urologie & Lithiase',
    gastro: 'Gastro-Entéro-Hépatologie & Endoscopie',
  },

  /** Cadrages photo autorisés (évite toute injection CSS). */
  PHOTO_POSITIONS: ['center 0%', 'center 5%', 'center 10%', 'center 12%', 'center 15%', 'center 18%',
    'center 20%', 'center 25%', 'center 28%', 'center 30%', 'center 35%', 'center 40%', 'center 50%'],
};
