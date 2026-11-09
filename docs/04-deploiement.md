# Déploiement de l'instance autonome

Guide d'exploitation du packaging `deploy/` : installation sur un serveur dédié, ajout de bases,
DNS et TLS, mise à jour, sauvegarde, dimensionnement et opérations courantes. Le contrat
d'architecture (processus, ports, URL, variables) est décrit dans `02-architecture-cible.md`
et dans l'instruction de contexte « architecture-instance-autonome ».

## 1. Vue d'ensemble

```
Internet ──▶ nginx (:80/:443, conteneur « nginx », image apps/ui)
              ├─ /                   UI statique (CRA, HashRouter)
              ├─ /access/graphql     ──▶ access:4000           (stack plateforme)
              ├─ /api/<uid>/…        ──▶ api_<uid>:4001/…      (préfixe retiré)
              ├─ /files/<uid>/…      disque  /var/lib/toolso-emailing/files/<uid>/exports/
              └─ lk.domaine.com/*    ──▶ api_<uid>:4001/*      (domaines de tracking, à la racine)

Stack plateforme (toolso-platform)        Stack par base (toolso-<uid>)
  postgres   postgres:17                    api_<uid>          ROLE=api
  access     apps/access                    worker_<uid>       ROLE=worker, file default
  nginx      apps/ui (+ conf deploy/nginx)  worker_huge_<uid>  ROLE=worker, WORKER_QUEUE=huge
  certbot    à la demande (profil tls)      scheduler_<uid>    ROLE=scheduler
  api-image  build seulement (profil build) → toutes les instances partagent l'image toolso-emailing-api
```

Tous les conteneurs sont sur le réseau Docker externe `toolso` : nginx résout `access` et
`api_<uid>` par le DNS interne de Docker. Les données vivent hors des conteneurs dans
`/var/lib/toolso-emailing/` (`postgres/`, `files/<uid>/`, `letsencrypt/`, `certbot-www/`).

Les scripts sont dans `deploy/bin/`, idempotents (relançables sans dégât) et à lancer en root
(`sudo`). Toute la configuration vit dans des fichiers `.env` ignorés par git :
`deploy/env/platform.env`, `postgres.env`, `access.env` et `deploy/instances/<uid>/.env`.

## 2. Prérequis

- Serveur Ubuntu 24.04 LTS (Scaleway Elastic Metal ou équivalent), accès root, ports 80 et 443
  ouverts en entrée, port 25/587 ouvert en sortie vers le SMTP de plateforme (et les ESP).
- Un nom d'hôte public pour l'UI et les API (`PUBLIC_HOST`, ex. `emailing.exemple.com`).
- Un ou plusieurs domaines de tracking par base (ex. `lk.exemple.com`), facultatifs.
- Un compte SMTP pour les mails de plateforme (invitations, réinitialisation de mot de passe,
  notifications d'export).
- Le dépôt cloné sur le serveur, par exemple dans `/opt/toolso-emailing` (`git clone … && cd …`).
  Les trois applications doivent être présentes avec leur `Dockerfile` : `apps/api`, `apps/access`,
  `apps/ui` (des Dockerfiles de référence sont dans `deploy/reference/`).

Docker Engine et le plugin compose sont installés par `install.sh` s'ils manquent (dépôt officiel
Docker). Rien d'autre n'est installé sur l'hôte : PostgreSQL, Node et nginx tournent en conteneurs.

## 3. Installation pas à pas

```bash
sudo deploy/bin/install.sh \
  --host emailing.exemple.com \
  --email admin@exemple.com \
  --smtp-url 'smtp://user:pass@smtp.exemple.com:587' \
  --mail-from 'Toolso Emailing <no-reply@exemple.com>' \
  --support-email support@exemple.com
```

Sans option, le script pose les questions. Il réalise, dans l'ordre :

1. installation de Docker si nécessaire ;
2. création de `deploy/env/platform.env` (paramètres publics), `postgres.env` et `access.env`
   (mots de passe et `JWT_SECRET` tirés d'`openssl rand`) ; les fichiers existants sont conservés ;
3. dossiers `/var/lib/toolso-emailing/{postgres,files,letsencrypt,certbot-www}` et
   `/var/backups/toolso-emailing`, réseau Docker `toolso`, cron `/etc/cron.d/toolso-emailing`
   (renouvellement TLS 2×/jour, sauvegarde quotidienne à 2 h 30) ;
4. génération de la configuration nginx en mode **sans TLS** (`TLS_MODE=plain`), construction des
   images (`ui`, `access`, `api`), démarrage de PostgreSQL, création du rôle `access`,
   `npm run sync-model` de l'access API, démarrage de `access` et `nginx` ;
5. création du superutilisateur access (`--superuser-password`, sinon généré et affiché une fois).

À ce stade l'UI répond en HTTP sur `http://emailing.exemple.com` (ou sur l'IP si le DNS n'est pas
encore là). Vérifier : `deploy/bin/compose.sh platform ps`, `deploy/bin/logs.sh platform access`.

### Options utiles

| Option | Effet |
|---|---|
| `--data-dir /chemin` | emplacement des données (défaut `/var/lib/toolso-emailing`) |
| `--skip-docker` | ne pas tenter d'installer Docker |
| `--no-cron` | ne pas installer le cron (TLS, sauvegardes) |
| `--yes` | aucune question (toutes les valeurs doivent être passées en option) |

## 4. DNS et TLS

### Enregistrements DNS

| Nom | Type | Cible | Usage |
|---|---|---|---|
| `emailing.exemple.com` | A / AAAA | IP du serveur | UI, `/access/graphql`, `/api/<uid>/`, `/files/<uid>/` |
| `lk.exemple.com` (par base) | A / AAAA ou CNAME vers l'hôte principal | IP du serveur | liens trackés, pixel d'ouverture, désabonnement, miroir, webhooks |

Les domaines de tracking apparaissent dans les mails envoyés : préférer un sous-domaine du
domaine expéditeur de chaque client. Les en-têtes SPF/DKIM/DMARC relèvent des ESP configurés dans
l'application, pas de ce déploiement.

### Certificats (Let's Encrypt, webroot)

```bash
sudo deploy/bin/tls.sh issue                       # certificat « main » pour PUBLIC_HOST, passage en TLS_MODE=tls
sudo deploy/bin/tls.sh issue-tracking exemple  # certificat « tracking-exemple » (tous les TRACKING_HOSTS de la base)
sudo deploy/bin/tls.sh status                      # certificats présents
sudo deploy/bin/tls.sh renew                       # renouvellement (lancé par cron), recharge nginx si un certificat a changé
```

Fonctionnement : nginx sert `/.well-known/acme-challenge/` depuis `/var/lib/toolso-emailing/certbot-www`
en 80 ; le conteneur `certbot` (profil `tls`, lancé à la demande) y dépose les défis. Une fois le
certificat `main` obtenu, `TLS_MODE=tls` est écrit dans `platform.env` et `render-nginx.sh` bascule
nginx : 80 redirige vers HTTPS, 443 sert le site (TLS 1.2/1.3, HSTS, HTTP/2). Les domaines de
tracking passent en HTTPS dès que leur certificat `tracking-<uid>` existe ; sans certificat ils ne
sont pas servis en TLS (un avertissement le rappelle). `add-database.sh` tente d'obtenir le
certificat tracking automatiquement si le mode TLS est actif (`--no-tls` pour s'en abstenir).

`--staging` utilise le serveur de test de Let's Encrypt (limites de débit plus souples).

### Sans TLS ou derrière un autre proxy

`TLS_MODE=plain` (valeur initiale) : nginx écoute en 80 seulement. Derrière un autre
reverse proxy TLS, garder ce mode et laisser `PUBLIC_SCHEME=https` dans `platform.env` pour que les
URL publiques générées (`API_PUBLIC_URL`, liens des mails) soient en `https`. Les ports publiés
sont réglables (`HTTP_PORT`, `HTTPS_PORT`). `tls.sh disable` repasse en mode `plain`.

## 5. Ajouter une base emailing

Pour reprendre une base existante de la plateforme AWS (RDS, miroirs DynamoDB, base access, secret JWT),
suivre `05-migration-depuis-aws.md` : la base est d'abord créée vide avec `add-database.sh`, puis
remplacée par le dump RDS avec `migrate-from-aws.sh`.

```bash
sudo deploy/bin/add-database.sh exemple "Base exemple" "Entreprise exemple" lk.exemple.com
#                                 <uid>      <nom affiché>   <entreprise>        [domaines de tracking…]
# options : --admin email (administrateur de la base dans access, défaut ADMIN_EMAIL)
#           --skip-register (ne pas appeler add-database de l'access API)   --no-tls
```

L'identifiant `uid` (lettres minuscules, chiffres, `_`, 2 à 31 caractères) nomme la base
`emailing_<uid>`, son rôle PostgreSQL, les conteneurs `api_<uid>`…, le dossier
`/var/lib/toolso-emailing/files/<uid>` et le préfixe public `/api/<uid>/`. Le script :

1. crée le rôle et la base PostgreSQL (mot de passe aléatoire) ;
2. écrit `deploy/instances/<uid>/.env` à partir de `deploy/templates/instance.env` (toutes les
   variables du contrat ; `JWT_SECRET` repris d'`access.env`, `API_PUBLIC_URL`, `FILES_PUBLIC_URL`,
   `TRACKING_HOSTS`, SMTP de plateforme) et `docker-compose.yml` à partir de
   `templates/instance.compose.yml` ;
3. lance `npm run sync-model` (schéma) puis `docker compose up -d` (api, worker, worker_huge,
   scheduler) et attend `GET /health` de l'api ;
4. enregistre la base dans l'access API (`npm run add-database -- --uid … --api-endpoint
   https://<hôte>/api/<uid> …`), ce qui crée l'entreprise et donne les droits à l'administrateur ;
5. génère les fragments nginx (`conf.d/instances/<uid>.conf`, `conf.d/tracking/<uid>.conf`), recharge
   nginx, et demande le certificat tracking si le mode TLS est actif.

Relancer le script sur une base existante est sans danger : le `.env` est conservé (les domaines
de tracking passés en argument le mettent à jour), le compose et la conf nginx sont regénérés.
Pour modifier une variable (ex. `WORKER_CONCURRENCY`, `JOBS_DISABLED`), éditer
`deploy/instances/<uid>/.env` puis `deploy/bin/compose.sh <uid> up -d` ; pour les domaines de
tracking, relancer `add-database.sh` avec la nouvelle liste puis `tls.sh issue-tracking <uid>`.

Retirer une base : `sudo deploy/bin/remove-database.sh <uid>` arrête la stack, retire la conf nginx
et archive `instances/<uid>` dans `instances/.removed/` (base et fichiers conservés) ;
`--purge` supprime définitivement la base, le rôle, les fichiers et le certificat tracking. La
base reste déclarée dans l'access API : la retirer dans l'UI.

## 6. Mise à jour

```bash
sudo deploy/bin/upgrade.sh              # git pull --ff-only, build, puis redémarrage ordonné
sudo deploy/bin/upgrade.sh --no-pull    # code déjà à jour (ex. checkout d'un tag à la main)
sudo deploy/bin/upgrade.sh --only exemple --no-build   # une seule instance
```

Ordre appliqué pour chaque instance : arrêt de `worker`, `worker_huge`, `scheduler` (les actions en
cours se terminent, `stop_grace_period` 60 s), `npm run sync-model`, redémarrage de `api` (attente
de `/health`), puis des workers et du scheduler. Ensuite `access` (`sync-model`, redémarrage) et
`nginx` (nouvelle image UI, configuration regénérée, `nginx -s reload`). Les anciennes images sont
élaguées. Une interruption de service de quelques secondes par api est à prévoir ; les envois en
file reprennent au redémarrage des workers.

Retour arrière : `git checkout <tag précédent>` puis `upgrade.sh --no-pull`. `sync-model` ne
supprime pas de colonnes ; une restauration de base (§7) n'est nécessaire qu'en cas de migration
de données irréversible.

## 7. Sauvegarde et restauration

`deploy/bin/backup.sh` (cron quotidien) écrit dans `BACKUP_DIR/<date_heure>/` :

| Fichier | Contenu |
|---|---|
| `globals.sql` | rôles PostgreSQL (`pg_dumpall --globals-only`) |
| `access.dump`, `emailing_<uid>.dump` | `pg_dump -Fc` de chaque base |
| `files_<uid>.tar.gz` | `/var/lib/toolso-emailing/files/<uid>` (uploads, exports) |
| `config.tar.gz` | `deploy/env`, `deploy/instances/*/.env` et compose, fragments nginx (secrets inclus : dossier en 0700) |

Rotation : dossiers de plus de `BACKUP_KEEP_DAYS` jours supprimés (14 par défaut). Si
`BACKUP_RCLONE_REMOTE` est défini (ex. `s3:mon-bucket/toolso-emailing`, rclone configuré en root),
chaque sauvegarde est copiée vers le distant et la même rotation y est appliquée. Options :
`--db-only`, `--files-only`, `--dest`, `--keep-days`. Un verrou évite deux exécutions simultanées.

Restauration :

```bash
sudo deploy/bin/restore.sh /var/backups/toolso-emailing/2026-11-09_023000 --db exemple      # une base (stack arrêtée puis relancée)
sudo deploy/bin/restore.sh /var/backups/toolso-emailing/2026-11-09_023000 --files exemple   # fichiers d'une instance
sudo deploy/bin/restore.sh /var/backups/toolso-emailing/2026-11-09_023000 --db access
```

Serveur neuf (sinistre) : cloner le dépôt, `install.sh` (recrée Docker, réseau, postgres, access),
`restore.sh <sauvegarde> --config` (remet `env/` et `instances/`), `install.sh` à nouveau pour
aligner le rôle `access` et le superutilisateur sur les fichiers restaurés, puis pour chaque base
`add-database.sh <uid> "<nom>" "<entreprise>" --skip-register` (recrée rôle, base vide, stack),
puis `restore.sh <sauvegarde> --db access --db <uid> --files <uid>` (ou `--all`), enfin
`tls.sh issue` et `tls.sh issue-tracking <uid>`.

## 8. Dimensionnement indicatif

Limites mémoire par défaut (modifiables dans `platform.env` et `instances/<uid>/.env`) :

| Conteneur | Limite | Remarque |
|---|---|---|
| postgres | 2 g (`PG_MEM_LIMIT`) | `shared_buffers` 1 GB, `effective_cache_size` 3 GB, `work_mem` 16 MB, 200 connexions |
| access | 256 m | |
| nginx | 128 m | |
| api_<uid> | 384 m | |
| worker_<uid> | 512 m | `WORKER_CONCURRENCY` 10 |
| worker_huge_<uid> | 1 g | exports volumineux, concurrence 2 |
| scheduler_<uid> | 384 m | |

Soit environ **2,3 Go par base** au plafond (la consommation réelle au repos est bien moindre,
~150 Mo par process Node) et **2,5 Go pour la plateforme**. Un serveur de 32 Go accueille
confortablement 8 à 10 bases actives ; au-delà, augmenter `PG_MAX_CONNECTIONS` (chaque process Node
ouvre jusqu'à `PG_POOL_MAX` = 10 connexions, soit 40 par base), `PG_SHARED_BUFFERS` (≈ 25 % de la
RAM) et `PG_EFFECTIVE_CACHE_SIZE` (≈ 50–75 %). Après modification de `platform.env`,
`deploy/bin/compose.sh platform up -d postgres` recrée le conteneur (quelques secondes d'arrêt).

Disque : la base PostgreSQL est le poste principal (événements de contacts, file d'actions) ;
prévoir SSD/NVMe, et surveiller `/var/lib/toolso-emailing/files/<uid>/uploads` (CSV importés) et
`exports`. Les journaux Docker sont plafonnés (5 × 20 Mo par conteneur).

Petite instance : `ROLE=all` lance api + worker + scheduler dans un seul process. Le gabarit
compose ne le propose pas (quatre conteneurs restent le mode nominal), mais on peut réduire une
instance en ne démarrant que `api` avec `ROLE=all` dans son `.env` et
`compose.sh <uid> up -d api` (puis `stop worker worker_huge scheduler`).

## 9. Exploitation courante

| Besoin | Commande |
|---|---|
| état des conteneurs | `deploy/bin/compose.sh platform ps` · `deploy/bin/compose.sh <uid> ps` |
| journaux | `deploy/bin/logs.sh platform [postgres\|access\|nginx]` · `deploy/bin/logs.sh <uid> [api\|worker\|worker_huge\|scheduler]` (`--since 1h`, `TAIL=1000`) |
| redémarrer un worker | `deploy/bin/compose.sh <uid> restart worker` (ou `worker_huge`, `scheduler`, `api`) |
| arrêter / relancer une instance | `deploy/bin/compose.sh <uid> stop` · `up -d` |
| console SQL | `deploy/bin/psql.sh <uid>` · `deploy/bin/psql.sh access` |
| file d'actions | `deploy/bin/psql.sh <uid> -c 'select queue, status, count(*) from "ActionQueue" group by 1,2'` |
| santé | `curl -s https://<hôte>/api/<uid>/health` · `curl -s https://<hôte>/access/health` · `curl -s http://127.0.0.1/nginx-health` |
| recharger nginx | `deploy/bin/render-nginx.sh` (regénère + `nginx -t` + reload) |
| tester la conf nginx | `docker exec nginx nginx -t` |
| modifier une variable d'instance | éditer `deploy/instances/<uid>/.env` puis `deploy/bin/compose.sh <uid> up -d` |
| désactiver un job planifié | `JOBS_DISABLED=job1,job2` dans le `.env`, puis `compose.sh <uid> up -d scheduler` |
| purger une base | `deploy/bin/remove-database.sh <uid> --purge` |
| espace disque | `docker system df` · `du -sh /var/lib/toolso-emailing/*` |

Fichiers de l'instance : `/var/lib/toolso-emailing/files/<uid>/` est monté sur `/data/files` dans
les quatre conteneurs ; nginx n'expose que `exports/` sous `/files/<uid>/`. Le dossier est donné à
l'utilisateur `node` (uid 1000) de l'image officielle.

Sécurité : seuls 80 et 443 sont publiés ; PostgreSQL et les api ne sont joignables que sur le
réseau Docker `toolso`. Les fichiers `deploy/env/*.env` et `instances/*/.env` sont en 0600 et hors
git ; les sauvegardes contiennent ces secrets.

## 10. Hypothèses sur les applications

Le packaging suppose les interfaces suivantes (contrat d'architecture) :

- `apps/api` : `Dockerfile` Node 22, `CMD ["node", "src/main.js"]`, `ROLE`, `PORT` 4001,
  `WORKER_QUEUE`, `GET /health`, script `npm run sync-model` ; fichiers sous `FILES_DIR=/data/files`
  avec un sous-dossier `exports/` servi en public ; process exécuté en `node` (uid 1000) ou root.
- `apps/access` : `Dockerfile` Node 22, `CMD ["node", "src/server.js"]`, port 4000, `GET /health`,
  scripts `npm run sync-model`, `npm run create-superuser -- --email … --password …`,
  `npm run add-database -- --uid … --name … --api-endpoint … --entreprise … [--admin …]`.
- `apps/ui` : `Dockerfile` produisant une image `nginx:1.27-alpine` avec le build dans
  `/usr/share/nginx/html` ; argument de build `REACT_APP_ACCESS_API_ENDPOINT` (défaut `/access/graphql`).
