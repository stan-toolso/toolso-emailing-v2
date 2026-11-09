# apps/api — origine et adaptations

Dépôt d'origine : https://gitlab.com/toolso/toolso-emailing-api — branche `master` @ `d818211` (2 novembre 2026, v1.1.698).
Import par copie le 2026-11-09 (sans `.git`, `node_modules`, `handlers/`, `handler.js`, `deploy/`, `.gitlab-ci.yml`, `.husky`, `.vscode`).

Le code métier (`src/services/**`, modèles Sequelize, resolvers GraphQL, routes REST, vues) est repris tel quel.
Seuls les adaptateurs d'infrastructure changent. Ce document liste chaque écart avec la v1.

## Processus

| v1 (AWS) | v2 (instance autonome) |
|---|---|
| Lambda `{uid}_api` + API Gateway (`handlers/api.js`, aws-serverless-express) | `ROLE=api` : `src/entrypoints/api.js` → Express `listen` sur `PORT` (4001) |
| Lambda `{uid}_action` sur SQS `actions_{uid}` (`handlers/action.js`) | `ROLE=worker` : `src/entrypoints/worker.js` boucle sur la table `ActionQueue` (file `default`), exécution par `src/queue/executeAction.js` |
| Lambda partagée `huge_actions` (`handlers/huge_action.js`) | même worker avec `WORKER_QUEUE=huge` |
| EventBridge → `toolso-access/emailing_jobs` → Lambda `{uid}_job` (`handlers/job.js`) | `ROLE=scheduler` : `src/entrypoints/scheduler.js` (croner) + `config/schedules.json` (fréquences relevées sur AWS), verrou `pg_try_advisory_lock` par job, exécution par `src/jobs/runJob.js` |
| Lambda `{uid}_ses_webhook` (`handlers/ses_webhook.js`) | `src/api/webhooks/webhookHandlers.js` (même code, entrée `handleWebhook(router, body)`) ; routes `POST /webhooks/{ses,sib,toolso}` + alias `/ses`, `/sib`, `/toolso` |
| Lambdas `tracking_api` (lk.*), `track_events`, `mirror_api` (hors dépôt, récupérées depuis le compte AWS) | `src/api/tracking/trackingRoutes.js` (`/tk/v1`, `/tkc/v1`, `/tko/v1`, `/unsub`, `/m/:mirrorId`), consommateur `track_event`, vues `views/tracking/` ; plainte FBL : `POST /webhooks/fbl` (`fblComplaintHandler.js`) |
| `sendinblue_webhook` (dispatch par tag `tls_<uid>`) | sans objet : une base par instance, Brevo appelle directement `/api/<uid>/webhooks/sib` |
| `src/main.js` | nouveau : entrée unique (`ROLE` = api / worker / scheduler / all), arrêt propre sur SIGTERM |

## Services AWS remplacés

| Service | Remplacement | Fichiers |
|---|---|---|
| Secrets Manager (`pg_toolso_emailing_{uid}`, `jwt_secret`, `pg_toolso_usage`) | variables `DATABASE_URL`, `JWT_SECRET`, `USAGE_DATABASE_URL` | `storage/sequelize.js`, `services/JwtSecretService.js`, `api/middlewares/TokenMiddleware.js`, `services/usage/UsageService.js` |
| SQS | table `ActionQueue` (`FOR UPDATE SKIP LOCKED`, 5 tentatives avec délai croissant, puis `failed`) ; `countActions()` = actions `pending` + `running` | `services/ActionService.js` (même interface), `storage/models/ActionQueue.model.js` |
| DynamoDB `toolso-emailing-mirrors` + S3 `toolso-emailing-mirror-body` | table `Mirror` (corps compressé zlib en `bytea`, expiration 30 j, purge par `database_cleaner`) | `services/MirrorService.js`, `storage/models/Mirror.model.js`, `services/ContentSender.js`, `services/ContactEventService.js` |
| S3 `toolso-emailing-tmp-files` (URL présignée + lecture) | disque `FILES_DIR/tmp` ; `generateUploadUrl` renvoie `signedUrl = API_PUBLIC_URL/uploads/<key>?jwt_token=…` ; route `PUT /uploads/:key` (`api/uploadRoutes.js`). Contrat identique pour `react-s3-uploader` (PUT du fichier brut, 200 attendu) | `services/FileStorageService.js`, `api/graphql/resolvers/generateUploadUrl.js`, `action_consummers/upload_*_list.js` |
| S3 exports `public-read` | disque `FILES_DIR/exports`, lien `FILES_PUBLIC_URL/exports/<fichier>` servi par nginx ; purge après 30 j | `services/utils/ExportUtils.js` |
| SES (mails de plateforme `no-reply@emailing.toolso.io`) | `nodemailer` sur `SMTP_URL`, expéditeur `MAIL_FROM` ; sans `SMTP_URL` : journalisé, non envoyé | `services/ToolsoEmailService.js` |
| Routeur `AwsSesRouter` (ESP client, identifiants chiffrés en base) | conservé, SDK v3 `@aws-sdk/client-ses` | `services/emailRouters/AwsSesRouter.js` |
| Lambda `complaintScorer` (compte AWS tiers) | HTTP `COMPLAINT_SCORER_URL` (POST JSON, réponse `{ complaintProbability }`) ; sans URL : score indéfini (comportement v1 en cas d'erreur) | `services/ContactComplaintScoreService.js` |
| X-Ray, `aws-embedded-metrics` | supprimés (`infra/getPg.js`, `infra/getNodeFetch.js` conservés comme passe-plats) | `expressApp.js`, `graphql.js`, `expressResolvers/*`, `ContentSender.js`, `ToolsoRouter.js`, `hrefReplace.js` |
| Access API `https://accessapi.toolso.io/graphql` | `ACCESS_API_URL` (process `access` local) | `services/PermissionService.js` |
| Google Analytics : fichiers de compte de service commités dans `config/` | **retirés du dépôt** ; `GOOGLE_APPLICATION_CREDENTIALS` désigne le fichier monté | `services/GAnalyticsService.js` |

## URL et adresses en dur remplacées

- `https://emailing.toolso.io/#/{uid}/…` (mails de notification) → `${PUBLIC_URL}/#/{uid}/…` (`BatService`, `ScheduleService`, `ContentService`, `ActivationService`).
- `it@toolso.io` (alertes internes) → `SUPPORT_EMAIL` (liste séparée par virgules ; vide = pas d'envoi).
- Domaine de tracking par défaut `https://y40bsa1lt9.execute-api…` → `API_PUBLIC_URL` (`ContentSender`, `htmlReplace`) ; un `trackingDomain` configuré (réglage ou expéditeur) est utilisé tel quel, et nginx route ces domaines vers l'api.
- Page miroir `https://vl0deu0vq8.execute-api…/{mirrorId}` → `${trackingDomain ou API_PUBLIC_URL}/m/{mirrorId}` ; les webhooks ignorent les clics sur un lien miroir via `config.isMirrorLink` (ancien hôte compris).
- Validation des clics suspects (`lk.toolso.io` + reCAPTCHA) → même hôte avec `?validate=1` (ou `CLICK_VALIDATION_HOST`), clés `RECAPTCHA_SITE_KEY` / `RECAPTCHA_SECRET` ; contrôle d'IP (`pro.ip-api.com`) seulement si `IP_API_KEY` est défini. La clé API ip-api et le secret reCAPTCHA étaient en dur dans la Lambda : à reconfigurer en variables.

## Comportements volontairement modifiés

- `newActionsWithPackage` attend l'insertion des paquets (en v1 l'envoi SQS n'était pas attendu).
- `database_cleaner` purge en plus les miroirs expirés, les fichiers (`tmp` 7 j, `exports` 30 j) et les actions en échec de plus de 30 jours.
- `build_model` n'est plus un job planifié : `npm run sync-model` (crée aussi l'extension `pg_trgm` et le rôle `grafanareader` attendus par le SQL complémentaire).
- Logs : niveau par défaut `INFO` (v1 : `WARN`).
- Dépendances déclarées explicitement : `cheerio`, `async`, `moment-timezone` (transitives en v1). `memjs` (inutilisé) retiré. Node 22.
- `ToolsoRouter.js` : un commentaire contenant des identifiants AWS (clé `AKIA…` d'un compte client) a été **supprimé** ; ces clés doivent être révoquées côté AWS.

## Scripts

`scripts/legacy/` contient les scripts d'exploitation de la v1 (inutilisables tels quels). Nouveaux : `sync-model.js`, `run-job.js <job>`, `queue-status.js`, `dev-postgres.js`.

Migration depuis AWS (appelés par `deploy/bin/migrate-mirrors.sh` et `deploy/bin/replay-sqs-actions.sh`, voir `docs/05-migration-depuis-aws.md`) :
- `import-mirrors.js --dir <pages> [--bodies-dir <corps S3>]` : import des items DynamoDB `toolso-emailing-mirrors` (JSON du CLI ou NDJSON) dans la table `Mirror`, upsert. La conversion est dans `src/migration/dynamoMirror.js` : en v1, `CompressedBody` était le **texte base64** du deflate (`zlib.deflateSync(html).toString('base64')` passé à un attribut binaire), donc doublement encodé à la lecture par le CLI ; au-delà de 990 octets il était retiré de l'item et le même texte écrit dans S3 `toolso-emailing-mirror-body` sous la clé `mirrorId` (seulement si le mail contenait le lien miroir). La table `Mirror` stocke le deflate brut.
- `enqueue-actions.js --file <ndjson>` : insère dans `ActionQueue` des actions `{ type, payload }` ou des messages SQS bruts (`Body`), format identique entre la file SQS `actions_<uid>` de la v1 et la v2.

## Tests

- `npm run test:unit` : les 6 suites Jest d'origine (32 tests, sequelize mocké).
- `npm test` : idem + `test/integration/instance.test.js` sur PostgreSQL embarqué (schéma, health, upload, miroir, tracking → file → worker, désabonnement, webhook, file d'actions, verrou du scheduler, purges), `test/integration/import-mirrors.test.js` et `test/integration/enqueue-actions.test.js` (scripts de migration), `test/services/dynamoMirror.test.js` (décodage des corps v1).
- `npm run cucumber` : scénario `qualityScore.feature` d'origine.
