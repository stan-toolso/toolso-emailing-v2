# Analyse de l'existant — Toolso Emailing (API, UI, Access)

Analyse réalisée le 2026-11-09 à partir de :

- `https://gitlab.com/toolso/toolso-emailing-api` — `master` @ `d818211` (2 nov. 2026), 1116 commits, v1.1.698
- `https://gitlab.com/toolso/toolso-emailing-ui` — `master` @ `b834239` (1er sept. 2026), 525 commits
- `https://gitlab.com/toolso/toolso-access` — `master` @ `63728be` (26 avr. 2023) — API d'authentification / multi-entreprise consommée par l'UI et par l'API

Objectif du projet v2 : même périmètre fonctionnel, même interface, mais une **instance autonome** (PostgreSQL, process Node, nginx) déployable sur un serveur dédié (Scaleway Elastic Metal), sans Lambda / SQS / EventBridge / DynamoDB / S3 / Secrets Manager.

---

## 1. Architecture actuelle (AWS, multi-tenant)

Chaque base cliente (« emailing database », identifiée par `RESOURCE_UID`) possède **ses propres Lambdas** déployées à partir d'un même artefact zip :

| Lambda | Handler | Déclencheur | Mémoire / timeout | Rôle |
|---|---|---|---|---|
| `{uid}_api` | `handlers/api.js` | API Gateway (HTTP) + invocation directe `call_type=on_demand` | 512 Mo / 30 s | Express + Apollo GraphQL (`/graphql`) + routes REST (inscription, contenus, BAT, pixel consent…) |
| `{uid}_action` | `handlers/action.js` | SQS `actions_{uid}` | 384 Mo / 5 min | Consommateur de la file d'actions (12 types) |
| `huge_actions` (partagée) | `handlers/huge_action.js` | SQS `huge_actions` | 1024 Mo / 10 min | Exports de contacts volumineux (`action.uid` porte la base cible) |
| `{uid}_job` | `handlers/job.js` | Invoquée par `toolso-access` (`handler/emailing_jobs.js`) qui reçoit les règles EventBridge et fan-out sur toutes les bases `enabled` | 1024 Mo / 15 min | 22 jobs planifiés (voir §3) |
| `{uid}_ses_webhook` | `handlers/ses_webhook.js` | API Gateway, chemins `/ses`, `/sib`, `/toolso` | 256 Mo / 30 s | Webhooks ESP → actions `insert_contact_event` / `insert_contact_message` |

Services AWS consommés par le code (`src/infra/getAws.js` + usages directs) :

| Service | Usage | Fichiers |
|---|---|---|
| **Secrets Manager** | `pg_toolso_emailing_{uid}` (credentials PG de la base), `jwt_secret`, `pg_toolso_access`, `pg_toolso_usage` | `storage/sequelize.js`, `JwtSecretService.js`, `api/middlewares/TokenMiddleware.js`, `usage/UsageService.js` |
| **SQS** | Production des actions (`sendMessage`, `sendMessageBatch` par 10), comptage (`getQueueAttributes`) | `ActionService.js` |
| **DynamoDB** | Table `toolso-emailing-mirrors` : `mirrorId → messageId, To, Subject, Source, CompressedBody (gzip), ExpDate (TTL 30 j)` ; lecture `getMessageIdFromMirrorId` pour rattacher un désabonnement par mail (`unsubscribe#<mirrorId>`) | `ContentSender.js`, `ContactEventService.js` |
| **S3** | `toolso-emailing-tmp-files` (upload CSV listes d'exclusion/inclusion via URL présignée + exports contacts en `public-read`), `toolso-emailing-mirror-body` (corps > 990 o), `toolso-emailing-personalize`, `toolso-reco` | `S3Service.js`, `ExportUtils.js`, `generateUploadUrl.js`, `upload_*_list.js` |
| **SES** | Mails transactionnels de la plateforme (`no-reply@emailing.toolso.io` : alertes, BAT, exports, suggestions) + **routeur d'envoi `AwsSesRouter`** (credentials SES par `MailRouter`, chiffrées en base) | `ToolsoEmailService.js`, `emailRouters/AwsSesRouter.js` |
| **Lambda invoke** | `arn:aws:lambda:eu-west-1:403862746353:function:complaintScorer` (modèle ML de probabilité de plainte, compte AWS tiers) | `ContactComplaintScoreService.js` |
| **X-Ray / embedded-metrics** | Tracing et métriques CloudWatch — instrumentation partout (`_X_AMZN_TRACE_ID`) | tous les handlers, `getPg.js`, `getNodeFetch.js`, `graphql.js` |

Services externes **non AWS** (restent des appels HTTP sortants, a priori inchangés) :

- **Routeur Toolso** (`emailRouters/ToolsoRouter.js`) : MTA Toolso appelé en HTTP (`mailRouter.config`), qui renvoie les événements sur le webhook `/toolso`.
- **Sendinblue / Brevo** (`SendinblueRouter.js`) : API HTTP, webhook `/sib`.
- **Tracking & miroir** : domaine de tracking (setting `trackingDomain` ou `Sender.trackingDomain`, défaut `https://y40bsa1lt9.execute-api.eu-west-1.amazonaws.com`) pour `/tk/v1/` (clics), `/tko/v1/` (pixel), `/unsub/` ; page miroir `https://vl0deu0vq8.execute-api.eu-west-1.amazonaws.com/{mirrorId}` qui lit DynamoDB/S3. **Ce service n'est dans aucun des dépôts analysés.**
- **Google Analytics Data API** (`GAnalyticsService.js`, credentials `config/settings-toolsoganalytics.json` commités) pour les revenus AdSense.
- **Access API** `https://accessapi.toolso.io/graphql` (`PermissionService.js`) : rôle de l'utilisateur sur la base, liste des utilisateurs de l'entreprise.
- **Campaign Manager** `https://campaign-manager.toolso.io` (UI uniquement : menu « Campaigns » / « Incomes » au niveau entreprise, activé par `entreprise.settings.campaigns` ou rôle `superAdmin`).
- **Usage / facturation** : base PG `pg_toolso_usage` (tables `usages`, `resources`, `pricings`) alimentée par le job `calculate_usages`.

Déploiement actuel : GitLab CI → zip (code + `node_modules`) → S3 `toolso-emailing-packages` → `deploy/activate*.js` met à jour code + configuration de chaque Lambda (`RESOURCE_UID`, `VERSION`, `LOG_LEVEL`, `AWS_API_FORBIDDEN`). UI : `npm run build` → S3 + invalidation CloudFront (`emailing.toolso.io`).

Schéma de base : **Sequelize `sync({ alter: true })`** (job `build_model` + `scripts/update_model_with_sequelize.js`) suivi de `postSynchroSQL` (vues `SendingStrategiesResults`, `ScheduleReport`, `RouterComplaints`, `RouterUnsubs`, `ContactByStatus`… avec `GRANT SELECT … TO grafanareader`). 39 modèles, Postgres avec `ssl: true`, `statement_timeout` 14 min.

Runtime : `nodejs16.x`. Pas de `.nvmrc`. `moment-timezone` est utilisé mais n'est pas une dépendance directe (transitive). `preinstall: npx npm-force-resolutions`.

Tests : Jest (`test/services/*.test.js`, 6 fichiers) + Cucumber (`features/qualityScore.feature`) + lint. UI : Jest (CRA) + Cypress.

---

## 2. toolso-access (auth, entreprises, bases)

API GraphQL Lambda (`accessapi.toolso.io`), Postgres `pg_toolso_access`. Modèles : `User` (bcrypt, `resetToken`), `Entreprise` (`settings` JSON, dont `campaigns`), `UserEntreprise` (`role` admin|worker, `pending`, `disabled`), `SuperUser`, `EmailingDatabase` (`uid`, `name`, `enabled`, `apiEndpoint`, `buildConfig`, `entrepriseId`), `Site` (autre produit Toolso).

Schéma utilisé par l'UI et l'API emailing :

- Query : `me` (+ `entreprises`, `emailingDatabases(entrepriseId)`), `meWithToken(token)`, `entreprise(id)`, `getMyDatabaseRole(uid)`, `getEnterpriseAndUsers(uid)`
- Mutation : `authWithPassword`, `resetPassword`, `requestNewResetLink`, `createUserEntreprise` (invitation par mail), `updateUserEntreprise`, `removeUserEntreprise`, `acceptUserEntreprise`, `ignoreUserEntreprise`

Le JWT (`jwt_secret`, 7 jours, payload `{id, email}`) est **partagé** : émis par toolso-access, vérifié par l'API emailing (`TokenMiddleware`). Les permissions fines par base (`Permission` : `contacts.perm`, `apiKeys.perm`, `role`) sont dans la base emailing, enrichies du rôle récupéré sur l'access API.

Rôle de dispatch des jobs : `handler/emailing_jobs.js` reçoit chaque règle EventBridge (nom de règle = `JobType`) et invoque `{uid}_job` pour chaque base `enabled`. **Les fréquences (expressions cron) sont dans la console AWS, pas dans le code.**

---

## 3. Inventaire fonctionnel à conserver

### Actions (file SQS → `handlers/action.js`)

`insert_contact_event`, `insert_contact_message`, `update_contact_status`, `remove_contact`, `schedule_content_for_contact`, `package_action` (lots de 100 payloads), `upload_exclusion_list`, `upload_inclusion_list`, `export_contacts` (file `huge_actions`), `log_payload`, `send_content_for_contact` (le gros volume : un message par mail à envoyer, concurrence pilotée par `send_schedule_max_concurrency`), `update_sending_config_scores` (désactivée).

`scan_contact_to_update_status` lit `countActions()` (profondeur de file) pour s'auto-réguler.

### Jobs planifiés (`handlers/job.js`, `JobType`)

`scan_contact_to_update_status`, `update_contacts_stats`, `update_contents_stats`, `check_contents_stats`, `update_inscriptions_stats`, `check_recurrent_schedules`, `check_schedules_to_send`, `check_sent_schedules`, `update_contact_event_stats_aggregates`, `update_sending_configs`, `update_activation_configs`, `database_cleaner`, `update_schedules_report`, `calculate_sending_strategies_stats`, `contact_event_cleaner`, `calculate_usages`, `update_adsense_incomes_today`, `update_adsense_incomes_yesterday`, `build_model`, `check_schedules_missing_contents`, `update_contents_stats_table`. (`update_contents_scores` est déclaré mais non câblé.)

### API HTTP (`src/api/expressApp.js`)

GraphQL `/graphql` (856 lignes de schéma, 105 resolvers, upload via `graphql-upload`), routes REST legacy et `/v2/*` (contacts, inscriptions par `source`, contenus, templates, preview, BAT, pixel consent), middlewares `ApiKeyMiddleware` (clé API → token) et `TokenMiddleware` (JWT).

### Webhooks (`handlers/ses_webhook.js`)

`/ses` (SNS SES : bounces, complaints, delivery, mails reçus → unsub/messages), `/sib` (Brevo), `/toolso` (routeur Toolso : delivery, open, click, unsub, bounces avec heuristiques Orange, click validation). Déchiffrement des liens trackés `/tk/v1/{key}/{AES}`.

### UI (CRA 4, CoreUI 3, React 17, Apollo 3, HashRouter)

- Pages globales (`routes.js`) : Dashboard, recherche contact, **AdminUsers / InviteUserModal (access API)**, stats contenus, **Campaigns & Incomes (Campaign Manager)**.
- Pages par base (`emailingRoutes.js`, préfixe `/#/{uid}/…`) : contacts, inscriptions, sources, ESP, messages & règles, listes d'exclusion/inclusion (upload direct S3 via `react-s3-uploader` + `generateUploadUrl`), activation, contenus, templates, parts, BAT, stats, revenus, partenaires, suggestions, envois (deliv, settings, schedules), admin.
- Login / reset / join : access API. Sélecteur d'entreprise et de base (`EmailingDatabaseSwitcher`) à partir de `me.emailingDatabases` (chaque base a son `apiEndpoint`).
- Variables build : `REACT_APP_API_ENDPOINT` (force l'endpoint API), `REACT_APP_ACCESS_API_ENDPOINT`.

---

## 4. Points d'attention relevés

1. **Fréquences des jobs inconnues** (règles EventBridge hors dépôt) — à récupérer dans la console AWS (`aws events list-rules` + `list-targets-by-rule`).
2. **Service tracking / miroir / unsub** (`y40bsa1lt9`, `vl0deu0vq8`) hors des dépôts fournis : soit il reste un service Toolso mutualisé (il faudra alors qu'il sache lire le miroir ailleurs que dans DynamoDB — ou on garde DynamoDB pour lui seul), soit l'instance l'héberge (page miroir + redirections de tracking + webhook `/toolso` en local).
3. **complaintScorer** (Lambda ML dans un autre compte AWS) : appel sortant conservable si des credentials AWS sont fournis à l'instance ; sinon à neutraliser (score neutre) ou à ré-héberger.
4. **Campaign Manager** et **Access API** : produits Toolso transverses. Pour une instance 100 % autonome, l'auth doit être embarquée (réimplémentation du schéma access, ~10 resolvers, tables `User/Entreprise/UserEntreprise/SuperUser/EmailingDatabase`).
5. **Usage / facturation** (`pg_toolso_usage`) : n'a de sens que chez Toolso ; à rendre optionnel.
6. **Credentials Google Analytics commités** dans `config/` ; à sortir en variable d'environnement / fichier monté.
7. **Node 16 → Node 20/22** : `aws-sdk` v2 à retirer de toute façon ; `apollo-server-express@2`, `graphql-upload@13`, `sequelize@6` fonctionnent sur Node 20. UI CRA 4 (webpack 4) : build nécessite `NODE_OPTIONS=--openssl-legacy-provider` sur Node ≥ 17 (ou migration Vite — hors périmètre « interface identique » mais sans impact visuel).
8. `huge_actions` : les exports contacts ont besoin de plus de mémoire/temps ; en process long sur serveur dédié ce n'est plus une contrainte, mais il faut garder une file séparée pour ne pas bloquer les envois.
9. Pool PG actuel très petit (`max: 2` par Lambda API, `MAX_CONCURRENCY ?? 50` pour les jobs) : à redimensionner pour des process longs.
10. Les mails de notification contiennent des liens en dur vers `https://emailing.toolso.io/#/{uid}/…` et des destinataires `it@toolso.io` → paramétrer `UI_BASE_URL` et `TOOLSO_SUPPORT_EMAIL`.
