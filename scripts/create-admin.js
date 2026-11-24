'use strict';
/**
 * Crée (ou réinitialise) un compte administrateur.
 *
 * Usage interactif (mot de passe masqué) :
 *   npm run admin:create -- <identifiant>
 *   npm run admin:create -- <identifiant> --reset     (change le mot de passe et ferme ses sessions)
 *
 * Usage non interactif (déploiement automatisé) :
 *   ADMIN_PASSWORD='...' npm run admin:create -- <identifiant>
 */
const readline = require('node:readline');
const db = require('../server/lib/db');
const { hashPassword, checkPasswordStrength } = require('../server/lib/security');

function ask(question, hidden) {
  return new Promise((resolve) => {
    const rl = readline.createInterface({ input: process.stdin, output: process.stdout, terminal: true });
    if (hidden) {
      rl._writeToOutput = (text) => {
        if (text.includes(question)) rl.output.write(question);
        else if (!/[\r\n]/.test(text)) rl.output.write('*'.repeat(text.length));
      };
    }
    rl.question(question, (answer) => {
      rl.close();
      if (hidden) process.stdout.write('\n');
      resolve(answer);
    });
  });
}

async function main() {
  const args = process.argv.slice(2);
  const reset = args.includes('--reset');
  const username = (args.find((a) => !a.startsWith('--')) || '').trim();

  if (!/^[a-zA-Z0-9._@-]{3,64}$/.test(username)) {
    console.error('Identifiant invalide (3 à 64 caractères : lettres, chiffres, . _ @ -).');
    console.error('Usage : npm run admin:create -- <identifiant> [--reset]');
    process.exit(1);
  }

  db.initSchema();
  const existing = db.get('SELECT id FROM admins WHERE username = ?', username);
  if (existing && !reset) {
    console.error(`Le compte « ${username} » existe déjà. Ajoutez --reset pour changer son mot de passe.`);
    process.exit(1);
  }
  if (!existing && reset) {
    console.error(`Le compte « ${username} » n'existe pas.`);
    process.exit(1);
  }

  let password = process.env.ADMIN_PASSWORD;
  if (!password) {
    password = await ask('Mot de passe : ', true);
    const confirm = await ask('Confirmez le mot de passe : ', true);
    if (password !== confirm) {
      console.error('Les mots de passe ne correspondent pas.');
      process.exit(1);
    }
  }

  const weaknesses = checkPasswordStrength(password);
  if (weaknesses.length) {
    console.error(`Mot de passe trop faible. Il faut : ${weaknesses.join(', ')}.`);
    process.exit(1);
  }

  const hash = await hashPassword(password);
  if (existing) {
    db.transaction(() => {
      db.run('UPDATE admins SET password_hash = ? WHERE id = ?', hash, existing.id);
      db.run('DELETE FROM sessions WHERE admin_id = ?', existing.id);
    });
    console.log(`Mot de passe de « ${username} » mis à jour. Ses sessions ouvertes ont été fermées.`);
  } else {
    db.run('INSERT INTO admins (username, password_hash) VALUES (?, ?)', username, hash);
    console.log(`Compte administrateur « ${username} » créé.`);
  }
  db.close();
}

main().catch((err) => {
  console.error('Erreur :', err.message);
  process.exit(1);
});
