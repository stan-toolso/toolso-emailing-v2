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
# Les valeurs déjà présentes dans env/platform.env priment ; les options ne servent qu'à le créer.
source "$(dirname "$0")/lib.sh"
require_root

host="" email="" smtp_url="" mail_from="" support_email="" su_password="" data_dir=""
skip_docker=0 no_cron=0
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
    --yes) export ASSUME_YES=1; shift ;;
    -h|--help) sed -n '2,14p' "$0"; exit 0 ;;
    *) die "Option inconnue : $1" ;;
  esac
done

ask() {
  # ask VAR "question" [défaut] : demande une valeur si VAR est vide (erreur en mode --yes).
  local -n ref="$1"
  [[ -n "$ref" ]] && return 0
  [[ "${ASSUME_YES:-0}" == "1" ]] && die "Valeur requise : $2 (option en ligne de commande)."
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
if [[ ! -f "$PLATFORM_ENV" ]]; then
  info "Création de env/platform.env"
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
  ok "env/platform.env créé (TLS_MODE=plain jusqu'à bin/tls.sh issue)."
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
install -d -m 0750 "$TOOLSO_DATA_DIR" "$TOOLSO_DATA_DIR/postgres" "$TOOLSO_DATA_DIR/letsencrypt"
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
  chmod 644 /etc/cron.d/toolso-emailing
  ok "Cron installé (/etc/cron.d/toolso-emailing)."
fi

# ---------- 4. nginx, images, démarrage ----------
"$DEPLOY_DIR/bin/render-nginx.sh" --no-reload

info "Construction des images (ui+nginx, access, api)"
compose_platform --profile build build

info "Démarrage de PostgreSQL"
compose_platform up -d postgres
wait_postgres
# Rôle « access » : créé par postgres/initdb au premier démarrage ; ici on s'assure qu'il existe
# (volume préexistant) et que son mot de passe suit env/postgres.env.
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

cat <<MSG

$(ok "Plateforme installée.")
   UI            : ${PUBLIC_SCHEME}://${PUBLIC_HOST}  (nginx en mode ${TLS_MODE})
   Étapes suivantes :
     1. DNS : ${PUBLIC_HOST} → IP de ce serveur, puis   sudo $DEPLOY_DIR/bin/tls.sh issue
     2. Première base :  sudo $DEPLOY_DIR/bin/add-database.sh <uid> "<nom>" "<entreprise>" [lk.domaine.com …]
     3. État : $DEPLOY_DIR/bin/compose.sh platform ps   ·  journaux : $DEPLOY_DIR/bin/logs.sh platform
MSG
