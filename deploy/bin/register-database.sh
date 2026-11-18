#!/usr/bin/env bash
# Déclare, met à jour ou désactive une base emailing dans l'access API de ce serveur (rôles all et control).
# Appelé par bin/add-database.sh d'un serveur de bases (par SSH, CONTROL_SSH), ou à la main :
#   sudo bin/register-database.sh --uid <uid> --name "<nom>" --api-endpoint https://<serveur de bases>/api/<uid> \
#        --entreprise "<entreprise>" [--admin <email>]        création ou mise à jour (idempotent)
#   sudo bin/register-database.sh --uid <uid> --api-endpoint <url>   change seulement l'adresse (déplacement d'une base)
#   sudo bin/register-database.sh --uid <uid> --disable              désactive la base (enabled = false)
#   sudo bin/register-database.sh --list                             liste les bases déclarées
# La base doit exister dans l'access pour --api-endpoint seul et --disable.
source "$(dirname "$0")/lib.sh"
require_docker
require_role all control
load_platform_env
container_running access || die "access n'est pas démarré (bin/compose.sh platform up -d access)."

uid="" name="" endpoint="" company="" admin="" disable=0 list=0
while [[ $# -gt 0 ]]; do
  case "$1" in
    --uid) uid="$2"; shift 2 ;;
    --name) name="$2"; shift 2 ;;
    --api-endpoint) endpoint="$2"; shift 2 ;;
    --entreprise) company="$2"; shift 2 ;;
    --admin) admin="$2"; shift 2 ;;
    --disable) disable=1; shift ;;
    --list) list=1; shift ;;
    -h|--help) sed -n '2,9p' "$0"; exit 0 ;;
    *) die "Option inconnue : $1" ;;
  esac
done

access_npm() { compose_platform exec -T access npm run --silent "$@"; }

if [[ "$list" == "1" ]]; then
  access_npm set-database-endpoint -- --list
  exit 0
fi

require_uid "$uid"
if [[ "$disable" == "1" ]]; then
  access_npm set-database-endpoint -- --uid "$uid" --disable
  ok "Base $uid désactivée dans access."
  exit 0
fi

[[ "$endpoint" =~ ^https?://[^/]+/api/${uid}/?$ ]] || die "--api-endpoint doit être de la forme https://<hôte>/api/$uid (reçu : « $endpoint »)."
if [[ -z "$name" && -z "$company" ]]; then
  access_npm set-database-endpoint -- --uid "$uid" --api-endpoint "$endpoint"
  ok "Base $uid : apiEndpoint = $endpoint."
  exit 0
fi
[[ -n "$name" && -n "$company" ]] || die "--name et --entreprise vont ensemble (ou aucun des deux pour ne changer que l'adresse)."
args=(--uid "$uid" --name "$name" --api-endpoint "$endpoint" --entreprise "$company")
[[ -n "$admin" ]] && args+=(--admin "$admin")
access_npm add-database -- "${args[@]}"
ok "Base $uid enregistrée dans access ($endpoint)."
