# Parc de serveurs : un serveur de contrôle et des serveurs de bases

Organisation retenue le 2026-11-18 : on installe les bases sur un serveur jusqu'à ce qu'il soit plein, puis on
commande un nouveau serveur et on y installe les bases suivantes. Les comptes et l'interface sont sur une petite
machine à part, commune à tout le parc : une seule adresse et une seule connexion pour les utilisateurs, quel que soit
le serveur qui héberge leurs bases.

```
                 navigateur ── https://emailing.exemple.com (interface, /access/graphql)
                      │                         ┌──────────────────────────────┐
                      │                         │ serveur de contrôle (VM)     │
                      │                         │ SERVER_ROLE=control          │
                      │                         │ nginx + interface, access,   │
                      │                         │ PostgreSQL (base access)     │
                      │                         └──────────────▲───────────────┘
                      │   apiEndpoint de chaque base           │ vérification des droits (ACCESS_API_URL)
                      ▼                                        │ enregistrement des bases (SSH)
   ┌───────────────────────────────┐       ┌───────────────────┴───────────┐
   │ serveur de bases 1            │       │ serveur de bases 2            │  …
   │ SERVER_ROLE=data              │       │ SERVER_ROLE=data              │
   │ https://db1…/api/<uid>/       │       │ https://db2…/api/<uid>/       │
   │ lk.<site> (tracking)          │       │ lk.<site> (tracking)          │
   │ PostgreSQL + instances        │       │ PostgreSQL + instances        │
   └───────────────────────────────┘       └───────────────────────────────┘
```

Le mode historique (un seul serveur avec tout, `SERVER_ROLE=all`) reste la valeur par défaut et ne change pas.

## 1. Rôles et variables

| `SERVER_ROLE` | Ce qui tourne | Conteneurs de la stack plateforme |
|---|---|---|
| `all` (défaut) | interface, access, PostgreSQL, bases | `postgres`, `access`, `nginx` (image de l'interface) |
| `control` | interface, access, PostgreSQL de la base access ; **aucune base emailing** | `postgres`, `access`, `nginx` |
| `data` | PostgreSQL, bases emailing ; **ni interface ni access** | `postgres`, `nginx_edge` (image nginx officielle) |

Variables de `deploy/env/platform.env` propres au parc :

| Variable | Rôle |
|---|---|
| `SERVER_ROLE` | `all`, `control` ou `data` (fixé par `install.sh --role`) |
| `PUBLIC_HOST` | hôte de ce serveur : interface (control) ou API des bases (data, ex. `db1.exemple.com`) |
| `CONTROL_URL` | (data) URL du serveur de contrôle, ex. `https://emailing.exemple.com` |
| `CONTROL_SSH` | (data) accès SSH au serveur de contrôle, ex. `root@emailing.exemple.com` ; vide = commandes d'enregistrement affichées au lieu d'être lancées |
| `CONTROL_DEPLOY_DIR` | (data) dossier `deploy/` sur le serveur de contrôle (défaut : le même chemin que sur ce serveur) |
| `NGINX_EDGE_IMAGE` | (data) image nginx, défaut `nginx:1.27-alpine` |
| `CAPACITY_*` | seuils de `bin/capacity.sh` (§ 6) |

Sur un serveur de bases, chaque instance reçoit :

- `PUBLIC_URL` = `CONTROL_URL` (liens des mails vers l'interface) ;
- `API_PUBLIC_URL` = `https://<PUBLIC_HOST>/api/<uid>` et `FILES_PUBLIC_URL` = `https://<PUBLIC_HOST>/files/<uid>` ;
- `ACCESS_API_URL` = `CONTROL_URL/access/graphql` (vérification des droits à chaque action de l'interface) ;
- `JWT_SECRET` = **le secret du parc**, identique sur tous les serveurs : il valide les jetons émis par l'access et
  chiffre les identifiants des routeurs d'envoi stockés dans chaque base (sans lui, une base ne peut pas changer de
  serveur). Sur un serveur de bases, `env/access.env` ne contient que ce secret.

Dans l'access, `EmailingDatabase.apiEndpoint` vaut `https://<serveur de bases>/api/<uid>` : l'interface appelle
directement le serveur de chaque base (CORS ouvert par l'api). Le nginx d'un serveur de bases n'envoie pas
`X-Frame-Options: SAMEORIGIN` mais `Content-Security-Policy: frame-ancestors 'self' <CONTROL_URL>`, pour que l'aperçu
des contenus (iframe) s'affiche dans l'interface.

## 2. Installer le serveur de contrôle

Machine virtuelle Ubuntu 24.04 (ex. Scaleway Instances, Paris, même région que les serveurs de bases), **4 Go de RAM**
au moins : le build de l'interface (CRA) demande environ 2 Go. Avec 2 Go, ajouter un fichier d'échange de 4 Go avant
l'installation (`fallocate -l 4G /swapfile && chmod 600 /swapfile && mkswap /swapfile && swapon /swapfile`).
Ports ouverts : 80, 443, et 22 restreint aux IP d'administration et des serveurs de bases.

```bash
git clone <dépôt> /opt/toolso-emailing && cd /opt/toolso-emailing
sudo deploy/bin/install.sh --role control --host emailing.exemple.com --email admin@exemple.com \
     --smtp-url smtp://user:pass@smtp.exemple.com:587 --mail-from "Toolso Emailing <no-reply@exemple.com>"
# DNS emailing.exemple.com → IP de la VM, puis :
sudo deploy/bin/tls.sh issue
```

Le script affiche le mot de passe du superutilisateur. PostgreSQL est réglé petit (`PG_SHARED_BUFFERS=256MB`,
`PG_MEM_LIMIT=1g`, 50 connexions). Le cron installe le renouvellement TLS et la sauvegarde quotidienne (base access et
configuration).

## 3. Installer un serveur de bases

Serveur dédié Ubuntu 24.04 (ex. Scaleway Elastic Metal EM-I120E-NVMe), disques en RAID 1. Ports 80 et 443 ouverts,
22 restreint.

1. **Clé SSH vers le serveur de contrôle** (enregistrement automatique des bases) :

   ```bash
   sudo ssh-keygen -t ed25519 -N "" -f /root/.ssh/id_ed25519      # sur le serveur de bases
   # ajouter /root/.ssh/id_ed25519.pub dans /root/.ssh/authorized_keys du serveur de contrôle
   sudo ssh root@emailing.exemple.com true                         # accepter l'empreinte une fois
   ```

   Sans SSH, tout fonctionne aussi : les scripts affichent la commande `register-database.sh` à lancer sur le serveur
   de contrôle, et le JWT_SECRET est passé par `--jwt-secret-file` ou saisi.

2. **Installation** :

   ```bash
   git clone <dépôt> /opt/toolso-emailing && cd /opt/toolso-emailing
   sudo deploy/bin/install.sh --role data --host db1.exemple.com --email admin@exemple.com \
        --smtp-url smtp://user:pass@smtp.exemple.com:587 --mail-from "Toolso Emailing <no-reply@exemple.com>" \
        --control-url https://emailing.exemple.com --control-ssh root@emailing.exemple.com
   # DNS db1.exemple.com → IP du serveur, puis :
   sudo deploy/bin/tls.sh issue
   ```

   Le script lit le JWT_SECRET sur le serveur de contrôle (SSH), règle PostgreSQL d'après la RAM (25 % en
   `shared_buffers`, conteneur limité à 50 %, 1000 connexions), construit seulement l'image api, démarre PostgreSQL et
   nginx, vérifie que `CONTROL_URL/access/health` répond et que le SSH fonctionne. Le cron ajoute le contrôle de capacité
   quotidien (§ 6).

3. **Accès aux bases sources** si l'on y reprend des bases (AWS, toolso-media) : ajouter l'IP du serveur aux groupes de
   sécurité concernés.

**SMTP des mails de plateforme** (invitations, mot de passe oublié, BAT, alertes), sur chaque serveur du parc :
`sudo deploy/bin/set-smtp.sh --ses-region eu-west-1 --from "Toolso Emailing <no-reply@exemple.com>"` (SES : clé d'accès IAM saisie, mot de passe SMTP dérivé sur place, port 2587 car Scaleway bloque 25, 465 et 587 en sortie ; tout autre SMTP : `--host`, avec un port ouvert)
(utilisateur et mot de passe demandés au clavier ; met à jour platform.env, access.env et le .env de chaque base, puis
recrée les conteneurs ; `--check` montre la configuration sans les identifiants).

**Copie distante des sauvegardes**, sur chaque serveur : `sudo deploy/bin/set-backup-remote.sh --bucket <bucket> [--region nl-ams]`
(clé d'accès Object Storage demandée au clavier, écrite dans `/root/.config/rclone/rclone.conf` ; préfixe = nom du serveur ;
`--check` vérifie l'accès). Bucket dans une autre région que les serveurs. Restauration : `bin/restore.sh` (§ 7).

## 4. Ajouter une base

Sur le serveur de bases choisi (celui qui n'est pas plein, `bin/capacity.sh`) :

```bash
sudo deploy/bin/add-database.sh <uid> "<nom>" "<entreprise>" lk.<domaine-du-site>
```

Comme avant : base et rôle PostgreSQL, `.env`, stack, schéma, nginx, certificat du domaine de tracking. L'enregistrement
dans l'access se fait sur le serveur de contrôle (`register-database.sh` par SSH) avec
`apiEndpoint = https://<PUBLIC_HOST>/api/<uid>`. La base apparaît alors dans l'interface pour l'administrateur
(`--admin`, défaut `ADMIN_EMAIL`).

Sur le serveur de contrôle, `sudo deploy/bin/register-database.sh --list` donne le registre : quelle base est servie par
quel serveur (`apiEndpoint`) et si elle est active.

## 5. Mettre à jour le parc

1. Serveur de contrôle d'abord : `sudo deploy/bin/upgrade.sh` (access, interface).
2. Puis chaque serveur de bases : `sudo deploy/bin/upgrade.sh` (image api, puis chaque instance : arrêt des workers,
   `sync-model`, redémarrage).

Une évolution qui change le contrat entre l'access et les api (GraphQL d'access, jetons) doit rester compatible le temps
de mettre à jour tous les serveurs.

## 6. Quand un serveur est plein

`sudo deploy/bin/capacity.sh` mesure et compare aux seuils de `platform.env` ; code de sortie 1 si l'un est dépassé.

| Mesure | Seuil par défaut | Variable |
|---|---|---|
| Disque des données occupé | > 60 % | `CAPACITY_MAX_DISK_PCT` |
| Mémoire disponible | < 15 % | `CAPACITY_MIN_MEM_AVAILABLE_PCT` |
| Charge moyenne 15 min par cœur | > 0,7 | `CAPACITY_MAX_LOAD_PER_CORE` |
| Nombre d'instances | ≥ 25 | `CAPACITY_MAX_INSTANCES` |
| Connexions PostgreSQL | ≥ 80 % de `max_connections` | `CAPACITY_MAX_CONN_PCT` |
| Lectures servies par le cache PostgreSQL | < 99 % | `CAPACITY_MIN_CACHE_HIT_PCT` |

Le cron le lance chaque jour à 10 h 15 (après le créneau du matin) en mode `--quiet` : une ligne n'est ajoutée à
`/var/log/toolso-emailing-capacity.log` que si un seuil est dépassé.

Règle : **un serveur qui dépasse un seuil ne reçoit plus de nouvelle base** ; on commande le serveur suivant
(§ 3). Les bases déjà installées continuent de grossir, d'où la marge des seuils. Si un serveur se dégrade malgré tout
(une base qui grossit vite), on déplace une base (§ 7).

## 7. Déplacer une base vers un autre serveur

À faire hors des heures d'envoi ; coupure de quelques minutes pour l'interface de cette base, les clics et ouvertures
reçus pendant la bascule DNS sont perdus. La veille : baisser le TTL DNS du domaine de tracking à 300 s.

Sur le **nouveau** serveur (B), créer l'instance vide sans l'enregistrer ni demander de certificat :

```bash
sudo deploy/bin/add-database.sh <uid> "<nom>" "<entreprise>" lk.<domaine> --skip-register --no-tls
sudo deploy/bin/compose.sh <uid> stop
```

Sur l'**ancien** serveur (A) :

```bash
sudo deploy/bin/compose.sh <uid> stop                       # plus d'envoi ni de traitement
sudo deploy/bin/backup.sh --only <uid>                      # base + fichiers + config dans BACKUP_DIR/<date>_<uid>
sudo rsync -a /var/backups/toolso-emailing/<date>_<uid>/ root@<B>:/var/backups/toolso-emailing/<date>_<uid>/
```

Sur **B** :

```bash
sudo deploy/bin/restore.sh /var/backups/toolso-emailing/<date>_<uid> --db <uid> --files <uid> --yes
# DNS lk.<domaine> → IP de B, puis :
sudo deploy/bin/tls.sh issue-tracking <uid>
sudo deploy/bin/compose.sh <uid> up -d
```

Sur le **serveur de contrôle** : `sudo deploy/bin/register-database.sh --uid <uid> --api-endpoint https://<B>/api/<uid>`.

Puis sur **A**, une fois l'envoi vérifié sur B : `sudo deploy/bin/remove-database.sh <uid>` (sans `--unregister` : la
base reste enregistrée, avec la nouvelle adresse) ; `--purge` quelques jours plus tard.

Le `.env` de l'instance sur B est celui créé par `add-database.sh` (nouveau mot de passe, URL de B) : seule la base et
les fichiers viennent de A. Le JWT_SECRET étant commun au parc, les identifiants des routeurs d'envoi restent lisibles.

## 8. Sauvegardes et panne du serveur de contrôle

- Chaque serveur sauvegarde ce qu'il héberge (`backup.sh`, cron 2 h 30) : le serveur de contrôle la base access et sa
  configuration, chaque serveur de bases ses bases, leurs fichiers et sa configuration. Copie distante :
  `BACKUP_RCLONE_REMOTE` (Object Storage), à configurer sur chaque serveur.
- Si le serveur de contrôle tombe : plus de connexion à l'interface ni d'action qui vérifie les droits. Les envois
  planifiés, le tracking, les désabonnements, les inscriptions par API (clé de source) et les webhooks continuent sur
  les serveurs de bases : dans le code, seul `PermissionService` appelle l'access, pour les actions de l'interface et
  pour trouver les destinataires de trois notifications envoyées aux utilisateurs d'une base (suggestions de
  contenus, alertes d'activation, suspension de contenu), qui échouent pendant la panne. À confirmer lors de la
  validation sur serveur de test.
- Le reconstruire : nouvelle VM, `install.sh --role control` avec le même hôte, `restore.sh <sauvegarde> --config`
  (remet `env/`, dont le JWT_SECRET du parc), `install.sh` à nouveau, `restore.sh <sauvegarde> --db access`,
  `tls.sh issue`. Moins d'une heure.

## 9. Tests

`bash deploy/test/roles.test.sh` vérifie sans Docker, pour chaque rôle : la configuration nginx générée (interface ou
serveur de bases, en-têtes, fragments d'instance et de tracking), le profil docker compose, le `.env` d'une instance
(URL de l'interface, de l'api, de l'access) et l'enregistrement d'une base (local, par SSH, ou commande affichée).
L'installation réelle (Docker, certificats, SSH) reste à valider sur des serveurs de test.
