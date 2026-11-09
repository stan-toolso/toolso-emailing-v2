#!/usr/bin/env bash
# Regénère toute la configuration nginx dérivée de l'état des instances et du mode TLS :
#   conf.d/05-mode.conf, snippets/listen-main.conf, conf.d/instances/<uid>.conf, conf.d/tracking/<uid>.conf
# puis recharge nginx (sauf --no-reload). Idempotent ; appelé par install, add-database, remove-database, tls.
source "$(dirname "$0")/lib.sh"
load_platform_env

reload=1
[[ "${1:-}" == "--no-reload" ]] && reload=0

NGINX_DIR="$DEPLOY_DIR/nginx"
TPL="$DEPLOY_DIR/templates/nginx"
LE_DIR="$TOOLSO_DATA_DIR/letsencrypt/live"

mode="$TLS_MODE"
if [[ "$mode" == "tls" && ! -f "$LE_DIR/main/fullchain.pem" ]]; then
  warn "TLS_MODE=tls mais aucun certificat dans $LE_DIR/main : nginx reste en mode sans TLS (bin/tls.sh issue)."
  mode=plain
fi
[[ "$mode" == "tls" || "$mode" == "plain" ]] || die "TLS_MODE doit valoir tls ou plain (actuel : $TLS_MODE)."

info "Configuration nginx : mode $mode, hôte $PUBLIC_HOST"
cp "$TPL/mode-$mode.conf" "$NGINX_DIR/conf.d/05-mode.conf"
cp "$TPL/listen-main-$mode.conf" "$NGINX_DIR/snippets/listen-main.conf"

# Fragments d'instance : on repart de zéro pour refléter exactement deploy/instances/.
find "$NGINX_DIR/conf.d/instances" "$NGINX_DIR/conf.d/tracking" -name '*.conf' -type f -delete

for uid in $(list_instances); do
  render_template "$TPL/instance.conf" "UID=$uid" > "$NGINX_DIR/conf.d/instances/$uid.conf"
  hosts="$(env_get "$(instance_dir "$uid")/.env" TRACKING_HOSTS | tr ',' ' ' | xargs || true)"
  if [[ -z "$hosts" ]]; then
    ok "instance $uid : /api/$uid/, /files/$uid/ (pas de domaine de tracking)"
    continue
  fi
  if [[ "$mode" == "plain" ]]; then
    render_template "$TPL/tracking-plain.conf" "UID=$uid" "TRACKING_HOSTS_SPACED=$hosts" > "$NGINX_DIR/conf.d/tracking/$uid.conf"
    ok "instance $uid : /api/$uid/, /files/$uid/, tracking HTTP : $hosts"
  elif [[ -f "$LE_DIR/tracking-$uid/fullchain.pem" ]]; then
    render_template "$TPL/tracking-tls.conf" "UID=$uid" "TRACKING_HOSTS_SPACED=$hosts" > "$NGINX_DIR/conf.d/tracking/$uid.conf"
    ok "instance $uid : /api/$uid/, /files/$uid/, tracking HTTPS : $hosts"
  else
    render_template "$TPL/tracking-pending.conf" "UID=$uid" "TRACKING_HOSTS_SPACED=$hosts" > "$NGINX_DIR/conf.d/tracking/$uid.conf"
    warn "instance $uid : certificat tracking-$uid absent, domaines $hosts non servis en HTTPS (bin/tls.sh issue-tracking $uid)."
  fi
done

[[ "$reload" == "1" ]] && nginx_reload
exit 0
