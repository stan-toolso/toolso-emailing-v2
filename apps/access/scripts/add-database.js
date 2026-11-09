#!/usr/bin/env node
// Déclare une base emailing dans l'access API (idempotent) :
//   npm run add-database -- --uid exemple --name "Base exemple" --api-endpoint https://hote/api/exemple --entreprise "Nom" [--admin email]
// Crée l'Entreprise si absente (par nom), crée ou met à jour l'EmailingDatabase (enabled, apiEndpoint, entreprise)
// et rattache l'utilisateur --admin à l'entreprise avec le rôle admin (invité par mail s'il n'existe pas encore).
require('dotenv').config();
const { parseArgs } = require('util');
const log = require('../src/log').getLogger('AddDatabase');
const { initAccess } = require('../src/storage/sequelize');
const UserRole = require('../src/storage/models/UserRole');

const { values } = parseArgs({
  options: {
    uid: { type: 'string' },
    name: { type: 'string' },
    'api-endpoint': { type: 'string' },
    entreprise: { type: 'string' },
    admin: { type: 'string' }
  }
});

if (!values.uid || !values.name || !values['api-endpoint'] || !values.entreprise) {
  console.error('Usage: npm run add-database -- --uid <uid> --name <name> --api-endpoint <url> --entreprise <name> [--admin <email>]');
  process.exit(2);
}

(async () => {
  const sequelize = await initAccess(true);
  const { Entreprise, EmailingDatabase, UserEntreprise } = sequelize.models;

  let entreprise = await Entreprise.findOne({ where: { name: values.entreprise } });
  if (!entreprise) {
    entreprise = await Entreprise.create({ name: values.entreprise, settings: null });
    log.info(`Entreprise "${values.entreprise}" created (id ${entreprise.id})`);
  } else {
    log.info(`Entreprise "${values.entreprise}" already exists (id ${entreprise.id})`);
  }

  const apiEndpoint = values['api-endpoint'].replace(/\/+$/, '');
  let database = await EmailingDatabase.findOne({ where: { uid: values.uid } });
  if (!database) {
    database = await EmailingDatabase.create({
      uid: values.uid,
      name: values.name,
      apiEndpoint,
      enabled: true,
      buildConfig: {},
      entrepriseId: entreprise.id
    });
    log.info(`EmailingDatabase ${values.uid} created (id ${database.id})`);
  } else {
    database.name = values.name;
    database.apiEndpoint = apiEndpoint;
    database.enabled = true;
    database.entrepriseId = entreprise.id;
    if (!database.buildConfig) database.buildConfig = {};
    await database.save();
    log.info(`EmailingDatabase ${values.uid} updated (id ${database.id})`);
  }

  if (values.admin) {
    const UserService = require('../src/services/UserService');
    const UserEntrepriseService = require('../src/services/UserEntrepriseService');
    const userService = new UserService();
    const email = values.admin.toLowerCase().trim();
    const user = await userService.getWithEmail(email);
    let userEntreprise = user ? await UserEntreprise.findOne({ where: { userId: user.id, entrepriseId: entreprise.id } }) : null;
    if (!userEntreprise) {
      // Même parcours que l'invitation depuis l'UI (création de l'utilisateur et mail d'invitation si besoin),
      // mais le rattachement est actif immédiatement : c'est une décision d'exploitation, pas une invitation à accepter.
      userEntreprise = await new UserEntrepriseService().create({ entrepriseId: entreprise.id, email, role: UserRole.admin });
      userEntreprise.pending = false;
      await userEntreprise.save();
      log.info(`User ${email} attached to entreprise "${entreprise.name}" as admin`);
    } else {
      userEntreprise.role = UserRole.admin;
      userEntreprise.disabled = false;
      userEntreprise.pending = false;
      await userEntreprise.save();
      log.info(`User ${email} is admin of entreprise "${entreprise.name}"`);
    }
  }

  await sequelize.close();
})().catch((err) => {
  log.error('Failed to add database', err);
  process.exit(1);
});
