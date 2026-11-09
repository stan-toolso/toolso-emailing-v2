#!/usr/bin/env bash
# Crée (ou met à jour) une base emailing et sa stack : base et rôle PostgreSQL, .env, docker compose,
# schéma (sync-model), démarrage, enregistrement dans l'access API, fragments nginx, certificat tracking.
#
#   sudo bin/add-database.sh <uid> "<nom affiché>" "<entreprise>" [domaine-de-tracking …]
#   sudo bin/add-database.sh clubdesjeux "Club des jeux" "Club des Jeux SAS" lk.clubdesjeux.fr
#
# Options : --admin <email> (administrateur de la base dans access, défaut ADMIN_EMAIL),
#           --skip-register (ne pas appeler add-database de l'access API), --no-tls (pas de certificat tracking).
# Relançable : une instance existante garde son .env (mot de passe, secrets), son compose et sa conf
# nginx sont regénérés, TRACKING_HOSTS est mis à jour si des domaines sont passés.
source "$(dirname "$0")/lib.sh"
require_docker
load_platform_env

admin="" skip_register=0 no_tls=0
positional=()
while [[ $# -gt 0 ]]; do
  case "$1" in
    --admin) admin="$2"; shift 2 ;;
    --skip-register) skip_register=1; shift ;;
    --no-tls) no_tls=1; shift ;;
    -h|--help) sed -n '2,12p' "$0"; exit 0 ;;
    --*) die "Option inconnue : $1" ;;
    *) positional+=("$1"); shift ;;
  esac
done
[[ ${#positional[@]} -ge 3 ]] || die "Usage : $0 <uid> \"<nom>\" \"<entreprise>\" [domaines de tracking…]"
uid="${positional[0]}"; name="${positional[1]}"; company="${positional[2]}"
tracking_hosts="$(printf '%s\n' "${positional[@]:3}" | tr '[:upper:]' '[:lower:]' | sed '/^$/d' | paste -sd ',' -)"
require_uid "$uid"
admin="${admin:-${ADMIN_EMAIL:-}}"

container_running postgres || die "PostgreSQL n'est pas démarré (bin/compose.sh platform up -d)."
load_env "$POSTGRES_ENV"
load_env "$ACCESS_ENV"
: "${JWT_SECRET:?JWT_SECRET manquant dans env/access.env}"

dir="$(instance_dir "$uid")"
env_file="$dir/.env"
db="emailing_$uid"
role="emailing_$uid"
install -d -m 0750 "$dir"

# ---------- 1. Rôle et base PostgreSQL ----------
if [[ -f "$env_file" ]]; then
  db_password="$(env_get "$env_file" DATABASE_URL | sed -E 's|^postgres://[^:]+:([^@]+)@.*$|\1|')"
  [[ -n "$db_password" ]] || die "Impossible de lire le mot de passe dans $env_file (DATABASE_URL)."
else
  db_password="$(random_secret 24)"
fi
info "Base PostgreSQL $db (rôle $role)"
if [[ "$(psql_admin -tAc "SELECT 1 FROM pg_roles WHERE rolname = '$role'")" != "1" ]]; then
  psql_admin -c "CREATE ROLE $role LOGIN PASSWORD '$db_password';" >/dev/null
  ok "Rôle $role créé."
else
  psql_admin -c "ALTER ROLE $role WITH LOGIN PASSWORD '$db_password';" >/dev/null
  ok "Rôle $role existant (mot de passe aligné sur le .env)."
fi
if [[ "$(psql_admin -tAc "SELECT 1 FROM pg_database WHERE datname = '$db'")" != "1" ]]; then
  psql_admin -c "CREATE DATABASE $db OWNER $role ENCODING 'UTF8';" >/dev/null
  ok "Base $db créée."
else
  ok "Base $db existante conservée."
fi

# ---------- 2. Fichiers de l'instance ----------
install -d -m 0775 "$TOOLSO_DATA_DIR/files/$uid" "$TOOLSO_DATA_DIR/files/$uid/exports" "$TOOLSO_DATA_DIR/files/$uid/uploads"
# L'image Node officielle fournit l'utilisateur node (uid 1000) : on lui donne le dossier
# (sans effet si l'api tourne en root).
chown -R 1000:1000 "$TOOLSO_DATA_DIR/files/$uid"

if [[ ! -f "$env_file" ]]; then
  info "Génération de $env_file"
  render_template "$DEPLOY_DIR/templates/instance.env" \
    "UID=$uid" "DATE=$(date -Iseconds)" "DB_PASSWORD=$db_password" "JWT_SECRET=$JWT_SECRET" \
    "PUBLIC_URL=$PUBLIC_URL" "TRACKING_HOSTS=$tracking_hosts" \
    "SMTP_URL=${SMTP_URL:-}" "MAIL_FROM=${MAIL_FROM:-}" "SUPPORT_EMAIL=${SUPPORT_EMAIL:-${ADMIN_EMAIL:-}}" "TZ=$TZ" \
    > "$env_file"
  chmod 600 "$env_file"
else
  ok "$env_file existant conservé."
  if [[ -n "$tracking_hosts" ]]; then
    env_set "$env_file" TRACKING_HOSTS "$tracking_hosts"
    ok "TRACKING_HOSTS mis à jour : $tracking_hosts"
  else
    tracking_hosts="$(env_get "$env_file" TRACKING_HOSTS)"
  fi
fi

render_template "$DEPLOY_DIR/templates/instance.compose.yml" "UID=$uid" "DATA_DIR=$TOOLSO_DATA_DIR" > "$dir/docker-compose.yml"
ok "$dir/docker-compose.yml généré."

# ---------- 3. Schéma et démarrage ----------
docker image inspect toolso-emailing-api:latest >/dev/null 2>&1 || {
  info "Image toolso-emailing-api absente : construction"
  compose_platform --profile build build api-image
}
info "Création / mise à jour du schéma (npm run sync-model)"
compose_instance "$uid" run --rm --no-deps api npm run sync-model

info "Démarrage de la stack toolso-$uid (api, worker, worker_huge, scheduler)"
compose_instance "$uid" up -d --remove-orphans
if wait_http_ok "api_$uid" http://127.0.0.1:4001/health 30; then
  ok "api_$uid répond sur /health."
else
  warn "api_$uid ne répond pas encore (bin/logs.sh $uid api)."
fi

# ---------- 4. Enregistrement dans l'access API ----------
api_endpoint="$PUBLIC_URL/api/$uid"
if [[ "$skip_register" == "0" ]]; then
  container_running access || die "access n'est pas démarré : impossible d'enregistrer la base (bin/compose.sh platform up -d access)."
  info "Enregistrement dans l'access API ($api_endpoint)"
  args=(--uid "$uid" --name "$name" --api-endpoint "$api_endpoint" --entreprise "$company")
  [[ -n "$admin" ]] && args+=(--admin "$admin")
  if compose_platform exec -T access npm run add-database -- "${args[@]}"; then
    ok "Base enregistrée dans access."
  else
    warn "add-database (access) a échoué : base déjà enregistrée ? Vérifier dans l'UI (Sources) ou relancer avec --skip-register."
  fi
fi

# ---------- 5. nginx et TLS tracking ----------
"$DEPLOY_DIR/bin/render-nginx.sh"
if [[ -n "$tracking_hosts" && "$TLS_MODE" == "tls" && "$no_tls" == "0" && ! -f "$TOOLSO_DATA_DIR/letsencrypt/live/tracking-$uid/fullchain.pem" ]]; then
  info "Certificat des domaines de tracking (DNS requis : $tracking_hosts → ce serveur)"
  "$DEPLOY_DIR/bin/tls.sh" issue-tracking "$uid" || warn "Certificat tracking non obtenu : vérifier le DNS puis relancer bin/tls.sh issue-tracking $uid."
fi

cat <<MSG

$(ok "Instance $uid prête.")
   API      : $api_endpoint   (santé : $api_endpoint/health)
   Fichiers : $PUBLIC_URL/files/$uid/
   Tracking : ${tracking_hosts:-aucun domaine}
   Stack    : bin/compose.sh $uid ps  ·  bin/logs.sh $uid  ·  bin/psql.sh $uid
MSG
