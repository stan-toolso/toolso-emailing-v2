# deploy/ — instance autonome Toolso Emailing

Packaging Docker Compose pour un serveur dédié (Ubuntu 24.04) : une stack **plateforme**
partagée (PostgreSQL 17, access API, nginx + UI statique, certbot) et une stack **par base
emailing** (api, worker, worker_huge, scheduler) raccordée au réseau Docker `toolso`.
Le guide complet est dans [`docs/04-deploiement.md`](../docs/04-deploiement.md).

Un serveur a un **rôle** (`SERVER_ROLE` de `env/platform.env`, fixé par `install.sh --role`) : `all` (serveur unique,
défaut), `control` (access + interface pour tout un parc, petite VM) ou `data` (serveur de bases : PostgreSQL et
instances, nginx sans interface, bases enregistrées sur le serveur de contrôle). Voir
[`docs/09-parc-de-serveurs.md`](../docs/09-parc-de-serveurs.md).

```
deploy/
├── docker-compose.yml          stack plateforme (postgres, access, nginx | nginx_edge, certbot, api-image), profils ui / edge
├── env/*.env.example           gabarits de platform.env, postgres.env, access.env (les .env sont ignorés par git)
├── templates/                  gabarits d'instance (compose + .env) et fragments nginx
├── nginx/                      nginx.conf, conf.d/ (fragments générés dont 10-main.conf), snippets/
├── postgres/initdb/            création du rôle « access » au premier démarrage
├── instances/<uid>/            stacks générées par bin/add-database.sh (ignorées par git)
├── reference/Dockerfile.*      Dockerfiles de référence si une app n'en fournit pas
├── test/roles.test.sh          test sans Docker des rôles all / control / data
└── bin/
    ├── install.sh              prérequis, env, build, démarrage, superutilisateur, cron
    ├── add-database.sh         base PG + .env + stack + sync-model + enregistrement access + nginx (+ TLS tracking)
    ├── register-database.sh    (control) déclare / déplace / désactive une base dans l'access, --list = registre du parc
    ├── capacity.sh             capacité du serveur (disque, mémoire, charge, connexions, cache PG) : plein ou non
    ├── remove-database.sh      arrêt d'une instance (--purge pour tout supprimer)
    ├── tls.sh                  issue | issue-tracking <uid> | renew | status | disable
    ├── render-nginx.sh         regénère la conf nginx dérivée (mode TLS, instances) et recharge
    ├── upgrade.sh              git pull, build, sync-model, redémarrage ordonné
    ├── backup.sh / restore.sh  pg_dump par base + fichiers + config, rotation, rclone optionnel ; backup --only <uid>
    ├── migrate-from-aws.sh     reprise d'une base RDS (et de la base access) depuis AWS — docs/05-migration-depuis-aws.md
    ├── migrate-mirrors.sh      reprise des miroirs DynamoDB/S3 d'une base dans la table Mirror
    ├── migrate-from-media.sh   reprise des contacts d'un produit toolso-media (conversion) — docs/06-migration-depuis-media.md
    ├── jwt-secret-from-aws.sh  reprise du secret JWT de la plateforme AWS dans les .env
    ├── replay-sqs-actions.sh   rejeu des messages SQS reçus pendant la bascule dans la file d'actions
    ├── compose.sh              docker compose platform|<uid> …
    ├── logs.sh / psql.sh       journaux, console psql
    └── lib.sh                  fonctions communes
```

Démarrage rapide :

```bash
sudo deploy/bin/install.sh --host emailing.exemple.com --email admin@exemple.com \
     --smtp-url smtp://user:pass@smtp.exemple.com:587
sudo deploy/bin/tls.sh issue                                   # après le DNS
sudo deploy/bin/add-database.sh exemple "Base exemple" "Entreprise exemple" lk.exemple.com
```

Parc de serveurs (serveur de contrôle + serveurs de bases) :

```bash
# serveur de contrôle (VM)
sudo deploy/bin/install.sh --role control --host emailing.exemple.com --email admin@exemple.com --smtp-url …
# chaque serveur de bases
sudo deploy/bin/install.sh --role data --host db1.exemple.com --email admin@exemple.com --smtp-url … \
     --control-url https://emailing.exemple.com --control-ssh root@emailing.exemple.com
sudo deploy/bin/add-database.sh exemple "Base exemple" "Entreprise exemple" lk.exemple.com
sudo deploy/bin/capacity.sh
```
