#!/usr/bin/env bash
# Mise à jour de la plateforme et de toutes les instances :
#   git pull (sauf --no-pull), build des images, puis pour chaque instance : arrêt des workers et
#   du scheduler, sync-model, redémarrage api puis workers/scheduler ; enfin access (sync-model,
#   redémarrage) et nginx (nouvelle image UI, configuration regénérée).
#   sudo bin/upgrade.sh [--no-pull] [--only <uid>] [--no-build]
source "$(dirname "$0")/lib.sh"
require_docker
load_platform_env

pull=1 build=1 only=""
while [[ $# -gt 0 ]]; do
  case "$1" in
    --no-pull) pull=0; shift ;;
    --no-build) build=0; shift ;;
    --only) only="$2"; shift 2 ;;
    -h|--help) sed -n '2,6p' "$0"; exit 0 ;;
    *) die "Option inconnue : $1" ;;
  esac
done

if [[ "$pull" == "1" ]]; then
  require_cmd git
  info "git pull --ff-only ($REPO_DIR)"
  git -C "$REPO_DIR" pull --ff-only
fi
if [[ "$build" == "1" ]]; then
  info "Construction des images"
  compose_platform --profile build build --pull
fi

upgrade_instance() {
  local uid="$1"
  info "Instance $uid : arrêt des workers et du scheduler"
  compose_instance "$uid" stop worker worker_huge scheduler
  info "Instance $uid : sync-model"
  compose_instance "$uid" run --rm --no-deps api npm run sync-model
  info "Instance $uid : redémarrage api, puis workers et scheduler"
  compose_instance "$uid" up -d --remove-orphans api
  wait_http_ok "api_$uid" http://127.0.0.1:4001/health 30 || warn "api_$uid ne répond pas encore sur /health."
  compose_instance "$uid" up -d --remove-orphans worker worker_huge scheduler
  ok "Instance $uid à jour."
}

if [[ -n "$only" ]]; then
  require_instance "$only"
  upgrade_instance "$only"
  exit 0
fi

for uid in $(list_instances); do
  # Le compose d'instance suit le gabarit : on le regénère.
  render_template "$DEPLOY_DIR/templates/instance.compose.yml" "UID=$uid" "DATA_DIR=$TOOLSO_DATA_DIR" > "$(instance_dir "$uid")/docker-compose.yml"
  upgrade_instance "$uid"
done

info "access : sync-model puis redémarrage"
compose_platform run --rm --no-deps access npm run sync-model
compose_platform up -d access
wait_http_ok access http://127.0.0.1:4000/health 30 || warn "access ne répond pas encore sur /health."

info "nginx : nouvelle image UI et configuration"
compose_platform up -d nginx
"$DEPLOY_DIR/bin/render-nginx.sh" --no-reload
nginx_reload

docker image prune -f >/dev/null && ok "Anciennes images supprimées."
ok "Mise à jour terminée."
