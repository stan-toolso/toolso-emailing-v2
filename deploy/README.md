# deploy/ — instance autonome Toolso Emailing

Packaging Docker Compose pour un serveur dédié (Ubuntu 24.04) : une stack **plateforme**
partagée (PostgreSQL 17, access API, nginx + UI statique, certbot) et une stack **par base
emailing** (api, worker, worker_huge, scheduler) raccordée au réseau Docker `toolso`.
Le guide complet est dans [`docs/04-deploiement.md`](../docs/04-deploiement.md).

```
deploy/
├── docker-compose.yml          stack plateforme (postgres, access, nginx, certbot, api-image)
├── env/*.env.example           gabarits de platform.env, postgres.env, access.env (les .env sont ignorés par git)
├── templates/                  gabarits d'instance (compose + .env) et fragments nginx
├── nginx/                      nginx.conf, conf.d/ (10-main.conf + fragments générés), snippets/
├── postgres/initdb/            création du rôle « access » au premier démarrage
├── instances/<uid>/            stacks générées par bin/add-database.sh (ignorées par git)
├── reference/Dockerfile.*      Dockerfiles de référence si une app n'en fournit pas
└── bin/
    ├── install.sh              prérequis, env, build, démarrage, superutilisateur, cron
    ├── add-database.sh         base PG + .env + stack + sync-model + enregistrement access + nginx (+ TLS tracking)
    ├── remove-database.sh      arrêt d'une instance (--purge pour tout supprimer)
    ├── tls.sh                  issue | issue-tracking <uid> | renew | status | disable
    ├── render-nginx.sh         regénère la conf nginx dérivée (mode TLS, instances) et recharge
    ├── upgrade.sh              git pull, build, sync-model, redémarrage ordonné
    ├── backup.sh / restore.sh  pg_dump par base + fichiers + config, rotation, rclone optionnel
    ├── compose.sh              docker compose platform|<uid> …
    ├── logs.sh / psql.sh       journaux, console psql
    └── lib.sh                  fonctions communes
```

Démarrage rapide :

```bash
sudo deploy/bin/install.sh --host emailing.exemple.com --email admin@exemple.com \
     --smtp-url smtp://user:pass@smtp.exemple.com:587
sudo deploy/bin/tls.sh issue                                   # après le DNS
sudo deploy/bin/add-database.sh clubdesjeux "Club des jeux" "Club des Jeux SAS" lk.clubdesjeux.fr
```
