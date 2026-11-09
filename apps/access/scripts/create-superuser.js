#!/usr/bin/env node
// Crée ou met à jour un super-utilisateur :
//   npm run create-superuser -- --email admin@exemple.com --password 'secret' [--firstname Prénom --lastname Nom]
require('dotenv').config();
const { parseArgs } = require('util');
const log = require('../src/log').getLogger('CreateSuperUser');
const { initAccess } = require('../src/storage/sequelize');

const { values } = parseArgs({
  options: {
    email: { type: 'string' },
    password: { type: 'string' },
    firstname: { type: 'string' },
    lastname: { type: 'string' }
  }
});

if (!values.email || !values.password) {
  console.error('Usage: npm run create-superuser -- --email <email> --password <password> [--firstname <firstname>] [--lastname <lastname>]');
  process.exit(2);
}

(async () => {
  const sequelize = await initAccess(true);
  const UserService = require('../src/services/UserService');
  const userService = new UserService();
  const { SuperUser } = sequelize.models;

  const email = values.email.toLowerCase().trim();
  let user = await userService.getWithEmail(email);
  if (!user) {
    user = await userService.createUserWithPassword({ email, firstname: values.firstname || null, lastname: values.lastname || null }, values.password);
    log.info(`User ${email} created (id ${user.id})`);
  } else {
    if (values.firstname) user.firstname = values.firstname;
    if (values.lastname) user.lastname = values.lastname;
    await userService.setUserPassword(user, values.password);
    log.info(`User ${email} updated (id ${user.id}, password reset)`);
  }

  let superUser = await SuperUser.findOne({ where: { userId: user.id } });
  if (!superUser) {
    superUser = await SuperUser.create({ userId: user.id, disabled: false });
    log.info(`SuperUser created for ${email}`);
  } else if (superUser.disabled) {
    superUser.disabled = false;
    await superUser.save();
    log.info(`SuperUser re-enabled for ${email}`);
  } else {
    log.info(`SuperUser already exists for ${email}`);
  }

  await sequelize.close();
})().catch((err) => {
  log.error('Failed to create superuser', err);
  process.exit(1);
});
