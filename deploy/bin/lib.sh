#!/usr/bin/env bash
# shellcheck disable=SC2034  # variables utilisées par les scripts qui sourcent ce fichier
# Fonctions communes aux scripts deploy/bin/*.sh. À sourcer, pas à exécuter :
#   source "$(dirname "$0")/lib.sh"
# Variables exportées : DEPLOY_DIR, REPO_DIR, PLATFORM_ENV, et celles de env/platform.env si présent.

set -euo pipefail
# Bash 5.2 : pas d'interprétation de « & » dans les remplacements de render_template.
shopt -u patsub_replacement 2>/dev/null || true


DEPLOY_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
REPO_DIR="$(cd "$DEPLOY_DIR/.." && pwd)"
PLATFORM_ENV="$DEPLOY_DIR/env/platform.env"
POSTGRES_ENV="$DEPLOY_DIR/env/postgres.env"
ACCESS_ENV="$DEPLOY_DIR/env/access.env"
INSTANCES_DIR="$DEPLOY_DIR/instances"
UID_PATTERN='^[a-z][a-z0-9_]{1,30}$'

# ---------- affichage ----------
if [[ -t 1 ]]; then
  _c_info=$'\e[1;34m'; _c_ok=$'\e[1;32m'; _c_warn=$'\e[1;33m'; _c_err=$'\e[1;31m'; _c_off=$'\e[0m'
else
  _c_info=''; _c_ok=''; _c_warn=''; _c_err=''; _c_off=''
fi
info() { printf '%s==>%s %s\n' "$_c_info" "$_c_off" "$*"; }
ok()   { printf '%s ✔ %s %s\n' "$_c_ok" "$_c_off" "$*"; }
warn() { printf '%s ⚠ %s %s\n' "$_c_warn" "$_c_off" "$*" >&2; }
die()  { printf '%s ✖ %s %s\n' "$_c_err" "$_c_off" "$*" >&2; exit 1; }

require_cmd() {
  local c
  for c in "$@"; do
    command -v "$c" >/dev/null 2>&1 || die "Commande requise introuvable : $c"
  done
}

require_docker() {
  require_cmd docker
  docker info >/dev/null 2>&1 || die "Docker inaccessible : lancer en root (sudo) ou ajouter l'utilisateur au groupe docker."
  docker compose version >/dev/null 2>&1 || die "Le plugin docker compose est absent (bin/install.sh l'installe)."
}

require_root() {
  [[ "$(id -u)" -eq 0 ]] || die "Ce script doit être lancé en root (sudo $0 …)."
}

confirm() {
  # confirm "question" : vrai si l'utilisateur répond oui (ou si ASSUME_YES=1).
  [[ "${ASSUME_YES:-0}" == "1" ]] && return 0
  local answer
  read -r -p "$1 [o/N] " answer
  [[ "$answer" =~ ^[oOyY]$ ]]
}

# ---------- fichiers d'environnement ----------
# load_env fichier : exporte toutes les clés KEY=VALUE du fichier (dotenv simple, guillemets retirés).
load_env() {
  local file="$1" line key value
  [[ -f "$file" ]] || die "Fichier d'environnement absent : $file"
  while IFS= read -r line || [[ -n "$line" ]]; do
    line="${line%$'\r'}"
    [[ -z "$line" || "$line" =~ ^[[:space:]]*# ]] && continue
    [[ "$line" =~ ^[[:space:]]*(export[[:space:]]+)?([A-Za-z_][A-Za-z0-9_]*)=(.*)$ ]] || continue
    key="${BASH_REMATCH[2]}"; value="${BASH_REMATCH[3]}"
    if [[ "$value" =~ ^\"(.*)\"$ || "$value" =~ ^\'(.*)\'$ ]]; then value="${BASH_REMATCH[1]}"; fi
    export "$key=$value"
  done < "$file"
}

# env_get fichier CLÉ : affiche la valeur d'une clé (vide si absente), sans exporter.
env_get() {
  local file="$1" key="$2" line
  [[ -f "$file" ]] || return 0
  line="$(grep -E "^[[:space:]]*(export[[:space:]]+)?${key}=" "$file" | tail -n 1 || true)"
  [[ -n "$line" ]] || return 0
  line="${line#*=}"
  if [[ "$line" =~ ^\"(.*)\"$ || "$line" =~ ^\'(.*)\'$ ]]; then line="${BASH_REMATCH[1]}"; fi
  printf '%s' "$line"
}

# env_set fichier CLÉ VALEUR : ajoute ou remplace une clé dans un fichier dotenv.
env_set() {
  local file="$1" key="$2" value="$3"
  touch "$file"
  if grep -qE "^[[:space:]]*(export[[:space:]]+)?${key}=" "$file"; then
    local tmp; tmp="$(mktemp)"
    # la valeur passe par l'environnement (pas par -v) : awk n'interprète pas ses antislashs (secrets repris d'ailleurs)
    ENV_SET_VALUE="$value" awk -v k="$key" 'BEGIN{v=ENVIRON["ENV_SET_VALUE"]; done=0} $0 ~ "^[[:space:]]*(export[[:space:]]+)?"k"=" && !done {print k"="v; done=1; next} {print}' "$file" > "$tmp"
    cat "$tmp" > "$file"; rm -f "$tmp"
  else
    printf '%s=%s\n' "$key" "$value" >> "$file"
  fi
}

load_platform_env() {
  [[ -f "$PLATFORM_ENV" ]] || die "env/platform.env absent : lancer d'abord bin/install.sh."
  load_env "$PLATFORM_ENV"
  : "${PUBLIC_HOST:?PUBLIC_HOST manquant dans env/platform.env}"
  export TLS_MODE="${TLS_MODE:-plain}"
  export PUBLIC_SCHEME="${PUBLIC_SCHEME:-https}"
  export PUBLIC_URL="${PUBLIC_SCHEME}://${PUBLIC_HOST}"
  export TOOLSO_DATA_DIR="${TOOLSO_DATA_DIR:-/var/lib/toolso-emailing}"
  export TZ="${TZ:-Europe/Paris}"
}

random_secret() { openssl rand -hex "${1:-32}"; }

# ---------- AWS (scripts de migration, lecture seule) ----------
# aws_cli args… : CLI AWS avec la région (AWS_REGION, défaut eu-west-1) et le profil (AWS_PROFILE) courants.
AWS_REGION="${AWS_REGION:-eu-west-1}"
aws_cli() { aws --region "$AWS_REGION" "$@"; }
require_aws() {
  require_cmd aws jq
  aws_cli sts get-caller-identity >/dev/null 2>&1 || die "Accès AWS refusé : configurer un profil (AWS_PROFILE=… ou aws configure) avec un droit de lecture."
}
# aws_secret_json nom : affiche la chaîne secrète (JSON) d'un secret Secrets Manager. À capturer dans une variable, jamais à afficher.
aws_secret_json() {
  aws_cli secretsmanager get-secret-value --secret-id "$1" --query SecretString --output text
}

# ---------- gabarits ----------
# render_template fichier CLÉ=VALEUR… : remplace chaque {{CLÉ}} par sa valeur et affiche le résultat.
render_template() {
  local file="$1"; shift
  [[ -f "$file" ]] || die "Gabarit introuvable : $file"
  local content pair key value
  content="$(cat "$file"; printf x)"; content="${content%x}"
  for pair in "$@"; do
    key="${pair%%=*}"; value="${pair#*=}"
    content="${content//\{\{$key\}\}/"$value"}"
  done
  if [[ "$content" =~ \{\{[A-Z_]+\}\} ]]; then
    die "Variable non remplacée dans $file : ${BASH_REMATCH[0]}"
  fi
  printf '%s' "$content"
}

# ---------- instances ----------
valid_uid() { [[ "$1" =~ $UID_PATTERN ]]; }
require_uid() {
  valid_uid "${1:-}" || die "Identifiant de base invalide « ${1:-} » : lettres minuscules, chiffres et _ (2 à 31 caractères, commence par une lettre)."
}
instance_dir() { printf '%s/%s' "$INSTANCES_DIR" "$1"; }
instance_exists() { [[ -f "$(instance_dir "$1")/.env" ]]; }
list_instances() {
  local d
  for d in "$INSTANCES_DIR"/*/; do
    [[ -f "$d/.env" ]] || continue
    basename "$d"
  done
}
require_instance() {
  require_uid "$1"
  instance_exists "$1" || die "Instance inconnue : $1 (pas de $(instance_dir "$1")/.env)."
}

# ---------- docker compose ----------
compose_platform() {
  docker compose --project-directory "$DEPLOY_DIR" --env-file "$PLATFORM_ENV" -f "$DEPLOY_DIR/docker-compose.yml" "$@"
}
compose_instance() {
  local uid="$1"; shift
  docker compose --project-directory "$(instance_dir "$uid")" -f "$(instance_dir "$uid")/docker-compose.yml" "$@"
}
container_running() { [[ "$(docker inspect -f '{{.State.Running}}' "$1" 2>/dev/null || echo false)" == "true" ]]; }

# psql_admin [args…] : psql superutilisateur dans le conteneur postgres (stdin transmis).
psql_admin() {
  docker exec -i postgres psql -v ON_ERROR_STOP=1 -U postgres -d postgres "$@"
}
wait_postgres() {
  local _i
  for _i in $(seq 1 60); do
    if docker exec postgres pg_isready -U postgres -d access >/dev/null 2>&1; then return 0; fi
    sleep 2
  done
  die "PostgreSQL ne répond pas après 120 s (bin/logs.sh platform postgres)."
}
wait_http_ok() {
  # wait_http_ok conteneur url [essais] : attend un GET 200 depuis l'intérieur du conteneur.
  local container="$1" url="$2" tries="${3:-30}" _i
  for _i in $(seq 1 "$tries"); do
    if docker exec "$container" node -e "fetch('$url').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))" >/dev/null 2>&1; then return 0; fi
    sleep 2
  done
  return 1
}

nginx_reload() {
  if container_running nginx; then
    docker exec nginx nginx -t >/dev/null || die "Configuration nginx invalide (docker exec nginx nginx -t)."
    docker exec nginx nginx -s reload
    ok "nginx rechargé."
  else
    warn "nginx n'est pas démarré : configuration regénérée, elle sera prise au prochain démarrage."
  fi
}
