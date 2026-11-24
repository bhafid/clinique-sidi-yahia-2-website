'use strict';
/**
 * Gestion sécurisée des photos de praticiens.
 * - Type vérifié par signature binaire (« magic bytes ») ET type MIME déclaré : JPG, PNG, WebP
 * - Taille maximale 2 Mo
 * - Renommage aléatoire unique (le nom envoyé par l'utilisateur n'est jamais utilisé)
 * - Suppression limitée au dossier uploads/praticiens
 */
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const { UPLOAD_DIR, UPLOAD_URL_PREFIX, MAX_UPLOAD_BYTES } = require('../config');

const DECLARED_ALLOWED = new Set(['image/jpeg', 'image/jpg', 'image/pjpeg', 'image/png', 'image/webp']);
const PHOTO_PATH_RE = /^uploads\/praticiens\/[a-z0-9-]+\.(jpg|png|webp)$/;

class UploadError extends Error {}

function detectImageType(buf) {
  if (buf.length >= 3 && buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) return { ext: 'jpg', mime: 'image/jpeg' };
  if (buf.length >= 8 && buf.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) {
    return { ext: 'png', mime: 'image/png' };
  }
  if (buf.length >= 12 && buf.toString('latin1', 0, 4) === 'RIFF' && buf.toString('latin1', 8, 12) === 'WEBP') {
    return { ext: 'webp', mime: 'image/webp' };
  }
  return null;
}

/** Valide et enregistre la photo. Renvoie le chemin relatif public, ou null si aucun fichier. */
function savePhoto(file) {
  if (!file || !file.data || file.data.length === 0) return null;
  if (file.data.length > MAX_UPLOAD_BYTES) throw new UploadError('La photo dépasse la taille maximale de 2 Mo.');
  if (!DECLARED_ALLOWED.has(file.contentType)) throw new UploadError('Format non autorisé : JPG, PNG ou WebP uniquement.');
  const type = detectImageType(file.data);
  if (!type) throw new UploadError("Le fichier n'est pas une image JPG, PNG ou WebP valide.");

  fs.mkdirSync(UPLOAD_DIR, { recursive: true });
  const name = `${Date.now().toString(36)}-${crypto.randomBytes(12).toString('hex')}.${type.ext}`;
  fs.writeFileSync(path.join(UPLOAD_DIR, name), file.data, { flag: 'wx', mode: 0o644 });
  return UPLOAD_URL_PREFIX + name;
}

function isValidPhotoPath(relPath) {
  return typeof relPath === 'string' && PHOTO_PATH_RE.test(relPath);
}

/** Supprime une photo du disque (uniquement dans uploads/praticiens). */
function deletePhoto(relPath) {
  if (!isValidPhotoPath(relPath)) return;
  const full = path.join(UPLOAD_DIR, path.basename(relPath));
  try { fs.unlinkSync(full); } catch (err) { if (err.code !== 'ENOENT') console.error('Suppression photo :', err.message); }
}

module.exports = { savePhoto, deletePhoto, isValidPhotoPath, detectImageType, UploadError };
