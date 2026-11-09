# toolso-emailing-v2 — instance autonome de Toolso Emailing

Adaptation de la plateforme Toolso Emailing (dépôts GitLab `toolso-emailing-api`, `toolso-emailing-ui`, `toolso-access`),
historiquement déployée sur AWS (Lambda, SQS, EventBridge, DynamoDB, S3, Secrets Manager, RDS), en **instance autonome**
déployable sur un serveur dédié (Scaleway Elastic Metal) : PostgreSQL, process Node.js, nginx. Périmètre fonctionnel et
interface web identiques.

## Organisation

| Dossier | Contenu |
|---|---|
| `apps/api/` | API GraphQL/REST, worker de la file d'actions, planificateur des jobs, webhooks, tracking, miroir (`ROLE=api\|worker\|scheduler\|all`). Voir `apps/api/UPSTREAM.md`. |
| `apps/access/` | API d'authentification / entreprises / bases (process séparé, port 4000). Voir `apps/access/UPSTREAM.md`. |
| `apps/ui/` | Interface web (CRA 4 / CoreUI 3), build statique servi par nginx. Voir `apps/ui/UPSTREAM.md`. |
| `deploy/` | Docker Compose (stack plateforme : postgres, access, nginx ; une stack par base : api, worker, worker_huge, scheduler), configuration nginx, scripts d'exploitation (`deploy/bin/`). |
| `docs/` | `01` analyse de l'existant, `02` architecture cible, `04` déploiement, `05` migration depuis AWS. |

Une instance = une base emailing (`RESOURCE_UID`). Plusieurs instances cohabitent sur un même serveur derrière un nginx et
un PostgreSQL partagés ; l'access API est commune.

## Démarrage rapide (développement)

```bash
# PostgreSQL local sans Docker (binaire embarqué)
cd apps/api && npm install && npm run dev-postgres      # affiche DATABASE_URL
cp .env.example .env                                     # renseigner DATABASE_URL, JWT_SECRET, RESOURCE_UID, PUBLIC_URL…
npm run sync-model && npm start                          # ROLE=all : api + worker + scheduler
cd ../access && npm install && cp .env.example .env && npm run sync-model && npm run create-superuser -- --email admin@example.com --password … && npm start
cd ../ui && npm ci && npm start                          # REACT_APP_ACCESS_API_ENDPOINT=http://localhost:4000/graphql
```

Tests : `npm test` dans `apps/api` (unitaires + intégration sur PostgreSQL embarqué) et `apps/access` ; `npm run cucumber` dans `apps/api`.

## Production

Voir `docs/04-deploiement.md` (installation, ajout d'une base, TLS, sauvegardes, mise à jour) et `docs/05-migration-depuis-aws.md`
(reprise d'une base existante : dump RDS, secret JWT, miroirs, webhooks, DNS de tracking).
