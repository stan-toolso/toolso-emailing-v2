#!/usr/bin/env node
/**
 * Enregistre les identifiants d'un routeur d'envoi (MailRouter.credentials, chiffrés avec JWT_SECRET comme par l'UI),
 * lus sur l'entrée standard pour ne jamais apparaître sur une ligne de commande ni dans un journal.
 *   node scripts/set-mail-router-credentials.js --list
 *   … --router-id <id> [--field apiKeyV3] < fichier      (Brevo : la clé d'API seule, rangée dans credentials.apiKeyV3)
 *   … --router-id <id> --json < credentials.json         (objet JSON complet, ex. SES { accessKeyId, secretAccessKey, region })
 * N'affiche jamais la valeur ; seulement les noms des champs enregistrés.
 */
require('dotenv').config();
process.env.LOG_LEVEL = process.env.LOG_LEVEL || 'WARN';
const { parseArgs } = require('util');

const usage = () => {
  console.error('Usage : node scripts/set-mail-router-credentials.js --list | --router-id <id> [--field <nom> | --json] < secret');
  process.exit(2);
};
let values;
try {
  ({ values } = parseArgs({ options: { list: { type: 'boolean', default: false }, 'router-id': { type: 'string' }, field: { type: 'string' }, json: { type: 'boolean', default: false } } }));
} catch (err) {
  console.error(err.message);
  usage();
}
if (!values.list && !/^\d+$/.test(values['router-id'] ?? '')) {
  usage();
}

const readStdin = () =>
  new Promise((resolve, reject) => {
    let data = '';
    process.stdin.setEncoding('utf8');
    process.stdin.on('data', (c) => (data += c));
    process.stdin.on('end', () => resolve(data));
    process.stdin.on('error', reject);
  });

(async () => {
  const sequelizeModule = require('../src/storage/sequelize');
  try {
    const sequelize = await sequelizeModule.initWithPostgresql(2);
    const { MailRouter } = sequelize.models;
    if (values.list) {
      const routers = await MailRouter.findAll({ order: [['id', 'ASC']] });
      for (const r of routers) {
        console.log(`${r.id}\t${r.type}\t${r.credentials ? 'identifiants: oui' : 'identifiants: NON'}\t${r.name}`);
      }
    } else {
      const router = await MailRouter.findByPk(Number(values['router-id']));
      if (!router) {
        throw new Error(`Routeur ${values['router-id']} introuvable (--list)`);
      }
      const raw = (await readStdin()).trim();
      if (!raw) {
        throw new Error('Entrée standard vide');
      }
      let credentials;
      if (values.json) {
        credentials = JSON.parse(raw);
        if (!credentials || typeof credentials !== 'object' || Array.isArray(credentials)) {
          throw new Error('--json attend un objet JSON');
        }
      } else {
        const field = values.field || (router.type === 'sib' ? 'apiKeyV3' : null);
        if (!field) {
          throw new Error(`Routeur de type ${router.type} : préciser --field <nom> ou --json`);
        }
        credentials = { [field]: raw };
      }
      const { encryptString } = require('../src/services/SettingsService');
      router.credentials = await encryptString(JSON.stringify(credentials));
      await router.save();
      console.log(`Routeur ${router.id} (${router.type}, ${router.name}) : identifiants enregistrés (champs : ${Object.keys(credentials).join(', ')})`);
    }
    await sequelizeModule.close();
    process.exit(0);
  } catch (err) {
    console.error(`Échec : ${err.message}`);
    await sequelizeModule.close().catch(() => {});
    process.exit(1);
  }
})();
