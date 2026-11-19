#!/usr/bin/env bash
# Installation de la plateforme sur un serveur Ubuntu 24.04 (idempotent, relançable) :
#   prérequis Docker, dossiers de données, fichiers d'environnement avec secrets aléatoires,
#   réseau Docker « toolso », build des images, démarrage postgres/access/nginx, schéma access,
#   superutilisateur, cron (renouvellement TLS, sauvegarde).
#
#   sudo bin/install.sh --host emailing.exemple.com --email admin@exemple.com \
#        --smtp-url smtp://user:pass@smtp.exemple.com:587 --mail-from "Toolso Emailing <no-reply@exemple.com>"
#
# Options : --support-email, --superuser-password (sinon généré et affiché), --data-dir,
#           --skip-docker (ne pas installer Docker), --no-cron, --yes (aucune question).
# Rôle du serveur (parc de serveurs, docs/09-parc-de-serveurs.md) :
#   --role all       serveur unique : access, interface, PostgreSQL et bases (défaut)
#   --role control   serveur de contrôle : access + interface (petite machine virtuelle), aucune base
#   --role data      serveur de bases : PostgreSQL + bases, sans interface ; options associées :
#        --control-url https://emailing.exemple.com   (obligatoire) interface et access API du parc
#        --control-ssh root@emailing.exemple.com      SSH vers le serveur de contrôle : reprise du JWT_SECRET
#                                                     et enregistrement automatique des bases
#        --control-deploy-dir /opt/toolso-emailing/deploy   dossier deploy/ sur le serveur de contrôle
#        --jwt-secret-file <fichier>                  JWT_SECRET du parc (sinon lu par SSH ou demandé)
#   sudo bin/install.sh --role control --host emailing.exemple.com --email admin@exemple.com --smtp-url …
#   sudo bin/install.sh --role data --host db1.exemple.com --email admin@exemple.com --smtp-url … \
#        --control-url https://emailing.exemple.com --control-ssh root@emailing.exemple.com
# Les valeurs déjà présentes dans env/platform.env priment ; les options ne servent qu'à le créer.
source "$(dirname "$0")/lib.sh"
require_root

host="" email="" smtp_url="" mail_from="" support_email="" su_password="" data_dir=""
skip_docker=0 no_cron=0
role="" control_url="" control_ssh="" control_deploy_dir="" jwt_secret_file=""
while [[ $# -gt 0 ]]; do
  case "$1" in
    --host) host="$2"; shift 2 ;;
    --email) email="$2"; shift 2 ;;
    --smtp-url) smtp_url="$2"; shift 2 ;;
    --mail-from) mail_from="$2"; shift 2 ;;
    --support-email) support_email="$2"; shift 2 ;;
    --superuser-password) su_password="$2"; shift 2 ;;
    --data-dir) data_dir="$2"; shift 2 ;;
    --skip-docker) skip_docker=1; shift ;;
    --no-cron) no_cron=1; shift ;;
    --role) role="$2"; shift 2 ;;
    --control-url) control_url="$2"; shift 2 ;;
    --control-ssh) control_ssh="$2"; shift 2 ;;
    --control-deploy-dir) control_deploy_dir="$2"; shift 2 ;;
    --jwt-secret-file) jwt_secret_file="$2"; shift 2 ;;
    --yes) export ASSUME_YES=1; shift ;;
    -h|--help) sed -n '2,25p' "$0"; exit 0 ;;
    *) die "Option inconnue : $1" ;;
  esac
done

ask() {
  # ask VAR "question" [défaut] : demande une valeur si VAR est vide ; en mode --yes, prend la valeur
  # par défaut, ou s'arrête s'il n'y en a pas.
  local -n ref="$1"
  [[ -n "$ref" ]] && return 0
  if [[ "${ASSUME_YES:-0}" == "1" ]]; then
    [[ -n "${3:-}" ]] || die "Valeur requise : $2 (option en ligne de commande)."
    ref="$3"; return 0
  fi
  read -r -p "$2${3:+ [$3]} : " ref
  ref="${ref:-${3:-}}"
  [[ -n "$ref" ]] || die "Valeur requise : $2"
}

# ---------- 1. Docker ----------
if [[ "$skip_docker" == "0" ]] && ! (command -v docker >/dev/null && docker compose version >/dev/null 2>&1); then
  info "Installation de Docker Engine + plugin compose (dépôt officiel)"
  require_cmd apt-get curl
  export DEBIAN_FRONTEND=noninteractive
  apt-get update -qq
  apt-get install -y -qq ca-certificates curl gnupg openssl git
  install -m 0755 -d /etc/apt/keyrings
  if [[ ! -f /etc/apt/keyrings/docker.asc ]]; then
    curl -fsSL https://download.docker.com/linux/ubuntu/gpg -o /etc/apt/keyrings/docker.asc
    chmod a+r /etc/apt/keyrings/docker.asc
  fi
  # shellcheck source=/dev/null
  codename="$(. /etc/os-release && echo "${UBUNTU_CODENAME:-$VERSION_CODENAME}")"
  echo "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.asc] https://download.docker.com/linux/ubuntu $codename stable" \
    > /etc/apt/sources.list.d/docker.list
  apt-get update -qq
  apt-get install -y -qq docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin
  systemctl enable --now docker
  ok "Docker installé : $(docker --version)"
else
  ok "Docker présent : $(docker --version 2>/dev/null || echo 'ignoré (--skip-docker)')"
fi
require_docker
require_cmd openssl

# ---------- 2. Fichiers d'environnement ----------
# Rôle : celui de env/platform.env s'il existe (les options ne servent qu'à le créer).
existing_role="$(env_get "$PLATFORM_ENV" SERVER_ROLE)"
if [[ -f "$PLATFORM_ENV" ]]; then
  [[ -z "$role" || "$role" == "${existing_role:-all}" ]] || die "env/platform.env existe avec SERVER_ROLE=${existing_role:-all} : --role $role ignoré (modifier le fichier à la main si voulu)."
  role="${existing_role:-all}"
fi
role="${role:-all}"
valid_role "$role" || die "--role doit valoir all, control ou data (reçu : $role)."
if [[ "$role" == "data" && ! -f "$PLATFORM_ENV" ]]; then
  ask control_url "URL du serveur de contrôle (interface et access, ex. https://emailing.exemple.com)"
  [[ "$control_url" =~ ^https?://[^/]+/?$ ]] || die "--control-url attend une URL sans chemin (ex. https://emailing.exemple.com)."
fi

# pg_tune : réglages PostgreSQL de départ selon le rôle et la mémoire du serveur (écrits dans platform.env).
pg_tune() {
  local file="$1" ram_mb
  ram_mb="$(awk '/^MemTotal:/ {print int($2/1024)}' /proc/meminfo 2>/dev/null || echo 0)"
  case "$role" in
    control)
      # Petite machine virtuelle : seule la base access (quelques Mo).
      env_set "$file" PG_SHARED_BUFFERS 256MB
      env_set "$file" PG_EFFECTIVE_CACHE_SIZE 768MB
      env_set "$file" PG_MAINTENANCE_WORK_MEM 64MB
      env_set "$file" PG_MAX_CONNECTIONS 50
      env_set "$file" PG_MEM_LIMIT 1g
      ;;
    data)
      # Serveur de bases dédié : 25 % de la RAM en shared_buffers, cache estimé à 60 %, conteneur limité à 50 %
      # (le reste pour les process Node des instances) ; ~40 connexions par instance.
      if [[ "$ram_mb" -ge 8192 ]]; then
        env_set "$file" PG_SHARED_BUFFERS "$((ram_mb / 4))MB"
        env_set "$file" PG_EFFECTIVE_CACHE_SIZE "$((ram_mb * 6 / 10))MB"
        env_set "$file" PG_MAINTENANCE_WORK_MEM 1GB
        env_set "$file" PG_MAX_CONNECTIONS 1000
        env_set "$file" PG_MEM_LIMIT "$((ram_mb / 2))m"
        ok "PostgreSQL réglé pour $((ram_mb / 1024)) Go de RAM (shared_buffers $((ram_mb / 4)) Mo, limite $((ram_mb / 2)) Mo, 1000 connexions)."
      else
        warn "Moins de 8 Go de RAM : réglages PostgreSQL par défaut conservés (env/platform.env)."
      fi
      ;;
  esac
}

if [[ ! -f "$PLATFORM_ENV" ]]; then
  info "Création de env/platform.env (rôle $role)"
  ask host "Hôte public de l'UI (ex. emailing.exemple.com)"
  ask email "E-mail administrateur (Let's Encrypt, superutilisateur)"
  ask smtp_url "URL SMTP des mails de plateforme (smtp://user:pass@hôte:587)"
  ask mail_from "Expéditeur des mails de plateforme" "Toolso Emailing <no-reply@$host>"
  ask support_email "E-mail de support affiché aux utilisateurs" "$email"
  data_dir="${data_dir:-/var/lib/toolso-emailing}"
  sed -e "s|^PUBLIC_HOST=.*|PUBLIC_HOST=$host|" \
      -e "s|^ADMIN_EMAIL=.*|ADMIN_EMAIL=$email|" \
      -e "s|^SMTP_URL=.*|SMTP_URL=$smtp_url|" \
      -e "s|^MAIL_FROM=.*|MAIL_FROM=\"$mail_from\"|" \
      -e "s|^SUPPORT_EMAIL=.*|SUPPORT_EMAIL=$support_email|" \
      -e "s|^TOOLSO_DATA_DIR=.*|TOOLSO_DATA_DIR=$data_dir|" \
      "$DEPLOY_DIR/env/platform.env.example" > "$PLATFORM_ENV"
  chmod 600 "$PLATFORM_ENV"
  env_set "$PLATFORM_ENV" SERVER_ROLE "$role"
  if [[ "$role" == "data" ]]; then
    env_set "$PLATFORM_ENV" CONTROL_URL "${control_url%/}"
    env_set "$PLATFORM_ENV" CONTROL_SSH "$control_ssh"
    env_set "$PLATFORM_ENV" CONTROL_DEPLOY_DIR "${control_deploy_dir:-$DEPLOY_DIR}"
  fi
  pg_tune "$PLATFORM_ENV"
  ok "env/platform.env créé (rôle $role, TLS_MODE=plain jusqu'à bin/tls.sh issue)."
else
  ok "env/platform.env existant conservé."
fi
load_platform_env

if [[ ! -f "$POSTGRES_ENV" ]]; then
  info "Création de env/postgres.env (mots de passe aléatoires)"
  {
    echo "POSTGRES_USER=postgres"
    echo "POSTGRES_PASSWORD=$(random_secret 24)"
    echo "ACCESS_DB_PASSWORD=$(random_secret 24)"
  } > "$POSTGRES_ENV"
  chmod 600 "$POSTGRES_ENV"
  ok "env/postgres.env créé."
fi
load_env "$POSTGRES_ENV"

if [[ ! -f "$ACCESS_ENV" && "$SERVER_ROLE" == "data" ]]; then
  # Serveur de bases : pas d'access ici, seulement le JWT_SECRET du parc (identique sur tous les serveurs :
  # il valide les jetons de l'interface et chiffre les identifiants des routeurs d'envoi en base).
  info "Création de env/access.env (JWT_SECRET du parc)"
  jwt=""
  if [[ -n "$jwt_secret_file" ]]; then
    jwt="$(env_get "$jwt_secret_file" JWT_SECRET)"
    [[ -n "$jwt" ]] || jwt="$(head -n 1 "$jwt_secret_file" | tr -d '[:space:]')"
  elif [[ -n "${CONTROL_SSH:-}" ]]; then
    info "Lecture du JWT_SECRET sur le serveur de contrôle ($CONTROL_SSH)"
    jwt="$(control_ssh sed -n 's/^JWT_SECRET=//p' "$CONTROL_DEPLOY_DIR/env/access.env" | tail -n 1 | sed -E 's/^"(.*)"$/\1/')" \
      || die "Lecture du JWT_SECRET par SSH impossible ($CONTROL_SSH:$CONTROL_DEPLOY_DIR/env/access.env) : vérifier la clé SSH, ou passer --jwt-secret-file."
  elif [[ "${ASSUME_YES:-0}" != "1" ]]; then
    read -r -s -p "JWT_SECRET du parc (env/access.env du serveur de contrôle) : " jwt; echo
  fi
  [[ -n "$jwt" ]] || die "JWT_SECRET du parc requis : --jwt-secret-file <fichier>, --control-ssh, ou saisie."
  {
    echo "# Serveur de bases : pas d'access API ici. JWT_SECRET partagé par tout le parc (serveur de contrôle $CONTROL_URL)."
    echo "JWT_SECRET=$jwt"
  } > "$ACCESS_ENV"
  chmod 600 "$ACCESS_ENV"
  ok "env/access.env créé."
fi

if [[ ! -f "$ACCESS_ENV" ]]; then
  info "Création de env/access.env (JWT_SECRET aléatoire)"
  {
    echo "DATABASE_URL=postgres://access:${ACCESS_DB_PASSWORD}@postgres:5432/access"
    echo "JWT_SECRET=$(random_secret 48)"
    echo "SMTP_URL=${SMTP_URL:-}"
    echo "MAIL_FROM=\"${MAIL_FROM:-}\""
    echo "PUBLIC_URL=${PUBLIC_URL}"
    echo "LOG_LEVEL=INFO"
  } > "$ACCESS_ENV"
  chmod 600 "$ACCESS_ENV"
  ok "env/access.env créé."
fi

# ---------- 3. Dossiers, réseau, cron ----------
info "Dossiers de données dans $TOOLSO_DATA_DIR"
install -d -m 0750 "$TOOLSO_DATA_DIR" "$TOOLSO_DATA_DIR/letsencrypt"
# Point de montage de PostgreSQL : l'utilisateur postgres du conteneur (uid 999) doit pouvoir le traverser
# pour atteindre PGDATA (sous-dossier pgdata, 0700, créé par l'image).
install -d -m 0755 "$TOOLSO_DATA_DIR/postgres"
install -d -m 0755 "$TOOLSO_DATA_DIR/files" "$TOOLSO_DATA_DIR/certbot-www"
install -d -m 0750 "${BACKUP_DIR:-/var/backups/toolso-emailing}"
chmod 700 "$DEPLOY_DIR/env"

if ! docker network inspect toolso >/dev/null 2>&1; then
  docker network create toolso >/dev/null
  ok "Réseau Docker « toolso » créé."
fi

if [[ "$no_cron" == "0" ]]; then
  cat > /etc/cron.d/toolso-emailing <<CRON
# Toolso Emailing : renouvellement TLS et sauvegarde quotidienne (généré par deploy/bin/install.sh)
SHELL=/bin/bash
PATH=/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin
17 3,15 * * * root $DEPLOY_DIR/bin/tls.sh renew >> /var/log/toolso-emailing-tls.log 2>&1
30 2 * * * root $DEPLOY_DIR/bin/backup.sh >> /var/log/toolso-emailing-backup.log 2>&1
CRON
  if role_has_instances; then
    # Contrôle de capacité quotidien juste après le créneau d'envoi du matin (lignes ajoutées si un seuil est dépassé).
    echo "15 10 * * * root $DEPLOY_DIR/bin/capacity.sh --quiet >> /var/log/toolso-emailing-capacity.log 2>&1" >> /etc/cron.d/toolso-emailing
  fi
  chmod 644 /etc/cron.d/toolso-emailing
  ok "Cron installé (/etc/cron.d/toolso-emailing)."
fi

# ---------- 4. nginx, images, démarrage ----------
"$DEPLOY_DIR/bin/render-nginx.sh" --no-reload

case "$SERVER_ROLE" in
  all)
    info "Construction des images (ui+nginx, access, api)"
    compose_platform --profile build build ;;
  control)
    info "Construction des images (ui+nginx, access)"
    compose_platform build ;;
  data)
    info "Construction de l'image api et téléchargement de nginx"
    compose_platform --profile build build api-image
    compose_platform pull nginx_edge ;;
esac

info "Démarrage de PostgreSQL"
compose_platform up -d postgres
wait_postgres
# Rôle « access » : créé par postgres/initdb au premier démarrage ; ici on s'assure qu'il existe
# (volume préexistant) et que son mot de passe suit env/postgres.env.
if role_has_access; then
psql_admin <<'SQL'
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'access') THEN
    CREATE ROLE access LOGIN;
  END IF;
END $$;
SQL
psql_admin -c "ALTER ROLE access WITH LOGIN PASSWORD '$ACCESS_DB_PASSWORD';" >/dev/null
psql_admin -c "ALTER DATABASE access OWNER TO access;" >/dev/null
ok "Rôle et base « access » prêts."

info "Schéma de l'access API (npm run sync-model)"
compose_platform run --rm --no-deps access npm run sync-model

info "Démarrage de access et nginx"
compose_platform up -d access nginx
wait_http_ok access http://127.0.0.1:4000/health 30 || warn "access ne répond pas encore sur /health (bin/logs.sh platform access)."

# ---------- 5. Superutilisateur ----------
generated_password=0
if [[ -z "$su_password" ]]; then su_password="$(random_secret 12)"; generated_password=1; fi
info "Superutilisateur access ($ADMIN_EMAIL)"
if compose_platform exec -T access npm run create-superuser -- --email "$ADMIN_EMAIL" --password "$su_password"; then
  if [[ "$generated_password" == "1" ]]; then
    printf '\n%s\n' "   Mot de passe du superutilisateur $ADMIN_EMAIL : $su_password   (notez-le, il n'est pas conservé)"
  fi
else
  warn "create-superuser a échoué (compte déjà existant ?) : mot de passe inchangé."
fi
else
  # ---------- Serveur de bases : nginx seul, contrôle du lien avec le serveur de contrôle ----------
  info "Démarrage de nginx (serveur de bases)"
  compose_platform up -d nginx_edge
  if command -v curl >/dev/null 2>&1; then
    if curl -fsS -m 10 -o /dev/null "$CONTROL_URL/access/health"; then
      ok "Serveur de contrôle joignable ($CONTROL_URL/access/health)."
    else
      warn "Serveur de contrôle injoignable sur $CONTROL_URL/access/health : les instances en ont besoin pour vérifier les droits."
    fi
  fi
  if [[ -n "${CONTROL_SSH:-}" ]]; then
    if control_ssh test -x "$CONTROL_DEPLOY_DIR/bin/register-database.sh"; then
      ok "SSH vers le serveur de contrôle opérationnel ($CONTROL_SSH) : les bases y seront enregistrées automatiquement."
    else
      warn "SSH vers $CONTROL_SSH impossible ou $CONTROL_DEPLOY_DIR/bin/register-database.sh absent : l'enregistrement des bases sera à faire à la main."
    fi
  fi
fi

if [[ "$SERVER_ROLE" == "control" ]]; then
cat <<MSG

$(ok "Serveur de contrôle installé (access + interface).")
   Interface : ${PUBLIC_SCHEME}://${PUBLIC_HOST}  (nginx en mode ${TLS_MODE})
   Étapes suivantes :
     1. DNS : ${PUBLIC_HOST} → IP de ce serveur, puis   sudo $DEPLOY_DIR/bin/tls.sh issue
     2. Serveurs de bases : sudo deploy/bin/install.sh --role data --control-url ${PUBLIC_SCHEME}://${PUBLIC_HOST} \\
          --control-ssh root@${PUBLIC_HOST} …   (clé SSH du serveur de bases autorisée ici)
     3. Bases déclarées : sudo $DEPLOY_DIR/bin/register-database.sh --list
MSG
exit 0
fi
if [[ "$SERVER_ROLE" == "data" ]]; then
cat <<MSG

$(ok "Serveur de bases installé.")
   Hôte      : ${PUBLIC_SCHEME}://${PUBLIC_HOST}  (nginx en mode ${TLS_MODE}, /api/<uid>/ et /files/<uid>/)
   Interface : ${CONTROL_URL}
   Étapes suivantes :
     1. DNS : ${PUBLIC_HOST} → IP de ce serveur, puis   sudo $DEPLOY_DIR/bin/tls.sh issue
     2. Première base :  sudo $DEPLOY_DIR/bin/add-database.sh <uid> "<nom>" "<entreprise>" [lk.domaine.com …]
     3. Capacité : sudo $DEPLOY_DIR/bin/capacity.sh
MSG
exit 0
fi

cat <<MSG

$(ok "Plateforme installée.")
   UI            : ${PUBLIC_SCHEME}://${PUBLIC_HOST}  (nginx en mode ${TLS_MODE})
   Étapes suivantes :
     1. DNS : ${PUBLIC_HOST} → IP de ce serveur, puis   sudo $DEPLOY_DIR/bin/tls.sh issue
     2. Première base :  sudo $DEPLOY_DIR/bin/add-database.sh <uid> "<nom>" "<entreprise>" [lk.domaine.com …]
     3. État : $DEPLOY_DIR/bin/compose.sh platform ps   ·  journaux : $DEPLOY_DIR/bin/logs.sh platform
MSG
