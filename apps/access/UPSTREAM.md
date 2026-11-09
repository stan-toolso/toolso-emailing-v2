# apps/access — origine et adaptations

- Dépôt d'origine : https://gitlab.com/toolso/toolso-access
- Branche / commit : `master` @ `63728be5dae4e2418ca53697ff8f41cdd8ea9932` (2023-04-26)
- Importé le 2026-11-09 par copie de l'instantané (sans `.git`, `node_modules`, `.bitmap`, `.vscode`).

Le schéma GraphQL (`src/api/typeDefs.graphql`), les modèles Sequelize (tables `User`, `SuperUser`, `Entreprise`,
`UserEntreprise`, `EmailingDatabase`, `Site`) et les résolveurs sont repris tels quels : l'UI et l'API emailing les
consomment sans changement.

## Ce qui a été retiré

| Élément d'origine | Devenir |
|---|---|
| `handler/api.js` (Lambda + `aws-serverless-express`) | remplacé par `src/server.js` (Express sur `PORT`, défaut 4000, écoute `0.0.0.0`) |
| `handler/emailing_jobs.js`, `src/services/EmailingDatabaseJobService.js` | supprimés : ils recevaient les règles EventBridge et invoquaient la Lambda `<uid>_job` de chaque base. Dans l'instance autonome, chaque base a son propre process `scheduler` (apps/api, `ROLE=scheduler`) qui exécute ses jobs lui-même : il n'y a plus de dispatch central |
| `handler/site_jobs.js`, `src/services/SiteJobService.js` | supprimés pour la même raison (invocation de Lambdas `toolso_site_<uid>_job_handler`, hors périmètre v2). `SiteService` et `Site.model` restent car le schéma GraphQL expose `User.sites` |
| `scripts/local_api.js`, `scripts/update_model.js`, `scripts/fill_data.js`, `scripts/do_global_job.js` | remplacés par `npm start`, `npm run sync-model`, `npm run create-superuser` / `add-database` ; `do_global_job.js` pointait vers un fichier inexistant |
| `aws-sdk` (Secrets Manager, SES, Lambda) | configuration par variables d'environnement, mails par `nodemailer` |
| `@bit/toolso.srv-utils.log` | module local `src/log/index.js` (log4js, niveau `LOG_LEVEL`, défaut INFO ; l'original était figé à ALL) |
| `apollo-server-express` 2.x | `@apollo/server` 5 + `@as-integrations/express4` (Apollo Server 2 et 3 sont en fin de vie). `AuthenticationError` / `ForbiddenError` sont fournies par `src/api/errors.js` avec les mêmes `extensions.code` (`UNAUTHENTICATED`, `FORBIDDEN`) |
| `apollo-client`, `apollo-cache-inmemory`, `apollo-link-http`, `fetch`, `node-fetch`, `i`, `npm`, `graphql-sequelize`, `graphql-relay`, `body-parser` | jamais requis par le code (vérifié par grep) : retirés. `body-parser` est remplacé par `express.json()` |
| `moment-timezone` (requis par `UserService` sans être déclaré dans `package.json`) | remplacé par une soustraction de 7 jours en `Date` natif |

## Adaptations

- `src/storage/sequelize.js` : connexion par `DATABASE_URL` (`PGSSL=true` active SSL sans vérification de certificat), plus de Secrets Manager. `initAccess()` et `get()` conservés.
- `src/services/UserService.js` : secret JWT lu dans `JWT_SECRET`. Algorithme (HS256 par défaut de `jsonwebtoken`), payload `{ id, email }` et durée (7 jours) inchangés. `getWithToken` ne plante plus quand le token est inconnu (retourne `null` au lieu d'une `TypeError`, ce que l'UI traite comme un lien expiré).
- `src/services/ToolsoEmailService.js` : envoi via `nodemailer` avec `SMTP_URL` et `MAIL_FROM` (défaut `"Toolso" <no-reply@toolso.io>`). Sans `SMTP_URL`, un avertissement est émis et le mail est journalisé au lieu d'être envoyé. Les templates pug sont rendus depuis un chemin absolu (plus dépendant du dossier courant).
- Liens dans les mails, construits à partir de `PUBLIC_URL` (hôte de l'UI, HashRouter) et vérifiés contre `src/App.js` de toolso-emailing-ui :
  - réinitialisation : `${PUBLIC_URL}/#/resetpassword/<token>` (route UI `/resetpassword/:token`) ;
  - invitation : `${PUBLIC_URL}/#/join/<token>` (route UI `/join/:token`), ou `${PUBLIC_URL}/` si l'utilisateur a déjà un mot de passe.
  L'origine écrivait `#resetpassword/…` sans slash : les deux formes sont normalisées en `/resetpassword/…` par le HashRouter.
- `views/emails/emailLayout.pug` : le logo est servi depuis `${PUBLIC_URL}/img/toolso_logo_white_300.png` (fichier présent dans `public/img/` de l'UI).
- `src/api/graphql.js` : `initExpress()` est désormais **asynchrone** (Apollo Server 4+ exige `start()`), ajoute `GET /health` (vérifie la base par `SELECT 1`, 503 sinon) et déclare le résolveur du scalaire `JSON` (`graphql-scalars`), absent de l'origine qui laissait le scalaire sans implémentation.
- `src/config.js` : lecture centralisée des variables d'environnement (voir `.env.example`).
- `console.log(entrepriseId)` dans `EmailingDatabaseService` / `SiteService` → `log.debug`.

## Exploitation

- `npm start` : serveur (`src/server.js`, `dotenv` chargé au démarrage).
- `npm run sync-model` : `sequelize.sync({ alter: true })`.
- `npm run create-superuser -- --email … --password … [--firstname … --lastname …]` : crée ou met à jour l'utilisateur (bcrypt, 10 tours comme à l'origine) et son `SuperUser`.
- `npm run add-database -- --uid … --name … --api-endpoint https://hôte/api/<uid> --entreprise "Nom" [--admin email]` : idempotent ; `buildConfig: {}` (seule valeur trouvée dans le code d'origine, `scripts/fill_data.js`). L'admin absent de la base est créé et invité (mail avec lien `join`), et son rattachement est actif immédiatement (`pending: false`), contrairement à une invitation depuis l'UI.
- `npm run set-database-endpoint -- --uid <uid> [--uid …] (--api-endpoint <url> | --api-base <url> | --disable) [--disable-others] | --list` : après reprise de la base access d'AWS, pointe les bases migrées vers `https://<hôte>/api/<uid>` et désactive les autres (`deploy/bin/migrate-from-aws.sh --access` l'appelle). Testé dans `test/set-database-endpoint.test.js`.
- `npm run dev-postgres` : PostgreSQL embarqué (`embedded-postgres` 17.x, devDependency) dans `.pgdata/` pour le développement.
- `npm test` : test de bout en bout (`test/smoke.test.js`) sur un PostgreSQL embarqué jetable. Le flag `--experimental-vm-modules` est nécessaire à Jest pour importer `embedded-postgres` (ESM).
- `Dockerfile` : `node:22-alpine`, `npm ci --omit=dev`, utilisateur `node`, port 4000.

## État de sécurité des dépendances (2026-11-09)

`npm audit --omit=dev` : aucune vulnérabilité critique. Restent `uuid@8` (modérée, dépendance de `sequelize` 6, pas de correctif sans changer de version majeure de Sequelize) et ses dépendants.
