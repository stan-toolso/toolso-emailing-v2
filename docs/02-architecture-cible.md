# Architecture cible — instance autonome (proposition)

> Statut : **proposition** du 2026-11-09, en attente des décisions listées en §5. Complète `01-analyse-existant.md`.

## 1. Vue d'ensemble

```
                 ┌──────────────────────────── serveur dédié (Scaleway Elastic Metal) ────────────────────────────┐
 Internet ─TLS─▶ │ nginx :443                                                                                     │
                 │   /                → UI statique (build CRA, HashRouter : une seule index.html)                 │
                 │   /api/            → api :4001        Express + Apollo (/graphql) + REST + access (/access/graphql) │
                 │   /api/webhooks/*  → api :4001        /ses  /sib  /toolso  (ex-Lambda ses_webhook)               │
                 │   /api/m/:mirrorId → api :4001        page miroir (ex-DynamoDB + API Gateway vl0bsa…)             │
                 │   /api/uploads/*   → api :4001        PUT direct des CSV (ex-URL présignée S3)                    │
                 │   /files/*         → disque           exports contacts (ex-S3 public-read)                        │
                 │                                                                                                  │
                 │ worker ×N            consommateur de la file d'actions (table PG, FOR UPDATE SKIP LOCKED)         │
                 │ worker-huge ×1       file « huge » (exports volumineux)                                           │
                 │ scheduler ×1         cron en process → exécute les 22 jobs (verrou pg_advisory_lock)              │
                 │ postgres 16          base emailing + schéma access (users, entreprises, bases)                     │
                 │ volumes              /var/lib/toolso-emailing/{postgres,files}                                    │
                 └──────────────────────────────────────────────────────────────────────────────────────────────────┘
```

Un seul code Node (`apps/api`) démarré avec trois rôles (`ROLE=api|worker|scheduler`), un seul `.env`, un build UI statique. Les handlers Lambda deviennent de simples fonctions appelées par ces trois entrées ; le code métier (`src/services/**`, 39 modèles, resolvers GraphQL) est repris **tel quel** autant que possible.

## 2. Table de correspondance AWS → autonome

| Aujourd'hui | Demain | Impact code |
|---|---|---|
| Lambda `{uid}_api` + API Gateway | Process `api` (Express `listen`), déjà prévu par `scripts/local_api.js` | `handlers/api.js` → `src/entrypoints/api.js` ; suppression `aws-serverless-express` |
| SQS `actions_{uid}` / `huge_actions` + Lambda `action` | Table `ActionQueue` (`id, queue, type, payload jsonb, status, availableAt, attempts, lockedAt, lastError`) ; worker en boucle `SELECT … FOR UPDATE SKIP LOCKED` ; `countActions()` = `COUNT(*) WHERE status='pending'` | Réécriture de `ActionService` (même interface `newAction / newActions / newActionsWithPackage / countActions`), `handlers/action.js` devient `executeAction(action)` |
| EventBridge → `toolso-access/emailing_jobs` → Lambda `job` | Process `scheduler` (cron en process, expressions dans `config/schedules.json`, surchargeables par env), exécution directe des fonctions de `src/services/jobs/*`, verrou PG par job pour éviter le chevauchement, timeout configurable | `handlers/job.js` → `runJob(jobType)` ; **fréquences à récupérer dans AWS** |
| Lambda `ses_webhook` + API Gateway | Routes `POST /webhooks/ses`, `/webhooks/sib`, `/webhooks/toolso` dans l'`api` (mêmes corps, mêmes réponses) | Adapter l'entrée (`req.body` au lieu de `event.body`) |
| Secrets Manager | Variables d'environnement (`DATABASE_URL`, `JWT_SECRET`, `SMTP_URL`, `GOOGLE_APPLICATION_CREDENTIALS`…) | `sequelize.js`, `JwtSecretService`, `TokenMiddleware`, `UsageService` |
| DynamoDB `toolso-emailing-mirrors` (+ S3 `mirror-body`) | Table `Mirror` (`mirrorId` PK, `messageId`, `to`, `subject`, `source`, `compressedBody bytea`, `expDate`) + purge dans `database_cleaner` ; page `GET /m/:mirrorId` rendue par l'api | `ContentSender.sendMessage`, `ContactEventService.getMessageIdFromMirrorId` |
| S3 `tmp-files` (upload CSV via URL présignée) | `generateUploadUrl` renvoie `{ signedUrl: <API>/uploads/<key>?jwt_token=…, s3Key }` ; route `PUT /uploads/:key` écrit sur disque ; `readFromS3` → lecture disque. **Aucun changement UI** (`react-s3-uploader` fait un `PUT` sur `signedUrl`) | `S3Service` → `FileStorageService` (même API : `sendToS3/readFromS3/getUploadUrl`) |
| S3 exports `public-read` | Fichier dans `/files/exports/<nom aléatoire>`, lien `https://<host>/files/exports/…` dans le mail | `ExportUtils` |
| SES transactionnel (`no-reply@emailing.toolso.io`) | `nodemailer` SMTP (`SMTP_URL`, `MAIL_FROM`) — peut pointer vers le routeur Toolso ou tout SMTP | `ToolsoEmailService` |
| `AwsSesRouter` (ESP client) | Conservé : c'est un ESP configuré par `MailRouter` (credentials en base), migré vers `@aws-sdk/client-ses` v3 | Aucune dépendance infra |
| Lambda `complaintScorer` (compte tiers) | Appel HTTP configurable `COMPLAINT_SCORER_URL` ; si absent → score indéfini (comportement actuel en cas d'erreur : `undefined`) | `ContactComplaintScoreService` — **décision §5** |
| X-Ray / `aws-embedded-metrics` | Supprimés ; logs log4js (JSON) ; endpoint `/health` ; métriques Prometheus optionnelles plus tard | Nettoyage transversal (`getAws`, `getPg`, `getNodeFetch`, segments) |
| `accessapi.toolso.io` | Module `access` embarqué dans l'api (`/access/graphql`, schéma identique, mêmes tables, même `JWT_SECRET`) ; `PermissionService` appelle le module en process | **décision §5** |
| `campaign-manager.toolso.io` | Menu masqué (`entreprise.settings.campaigns` absent) ou URL conservée | **décision §5** |
| `pg_toolso_usage` | Job `calculate_usages` désactivé sauf `USAGE_DATABASE_URL` défini | `calculate_usages` |
| Déploiement zip → Lambda | Image(s) Docker + `docker-compose.yml` (postgres, api, worker, worker-huge, scheduler, nginx, certbot) ; `make deploy` / script `deploy.sh` ; migrations = `build_model` (sync alter) au démarrage ou commande dédiée | **décision §5** (Docker vs systemd) |

## 3. UI

- Code repris tel quel (`apps/ui`). Build avec `REACT_APP_API_ENDPOINT=/api` et `REACT_APP_ACCESS_API_ENDPOINT=/api/access/graphql` (chemins relatifs → fonctionne quel que soit le domaine).
- `EmailingDatabase.apiEndpoint` en base access = `/api` (ou `https://<host>/api`).
- Node ≥ 17 : `NODE_OPTIONS=--openssl-legacy-provider` pour le build CRA 4 (sans effet sur le rendu).
- nginx : `try_files $uri /index.html`, cache long sur `static/`, gzip.

## 4. Organisation du dépôt v2

```
apps/api/        code API/worker/scheduler (import de toolso-emailing-api @ d818211 + module access @ 63728be)
apps/ui/         code UI (import de toolso-emailing-ui @ b834239)
deploy/          docker-compose.yml, nginx/, Dockerfiles, .env.example, scripts (install, backup, restore, migrate-from-rds)
docs/            analyse, architecture, runbook
```

Import par copie de l'instantané (SHA d'origine consigné), l'historique restant sur GitLab.

## 5. Décisions à prendre

1. **Tenancy** : une base emailing par serveur, ou plusieurs `uid` par instance (un jeu de process par base derrière nginx `/api/{uid}/`) ?
2. **Authentification** : embarquer l'access API (recommandé pour une instance autonome) ou continuer à utiliser `accessapi.toolso.io` ?
3. **Services Toolso externes** : tracking/miroir/unsub (`y40bsa1lt9`, `vl0deu0vq8`), `complaintScorer`, Campaign Manager — ré-hébergés / désactivés / conservés en appels sortants ?
4. **Packaging** : Docker Compose (recommandé) ou services systemd natifs ?
5. **Fréquences des jobs** : export des règles EventBridge (`aws events list-rules`, `list-targets-by-rule`).
6. **Migration de données** : reprise d'une base existante (pg_dump RDS → instance) ou instance neuve ?
7. **SMTP** pour les mails de plateforme et adresse de support (remplace `it@toolso.io`).
