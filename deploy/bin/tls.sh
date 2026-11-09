#!/usr/bin/env bash
# Certificats Let's Encrypt (webroot, via le service certbot de la stack plateforme).
#   bin/tls.sh issue                   certificat « main » pour PUBLIC_HOST, puis passage en TLS_MODE=tls
#   bin/tls.sh issue-tracking <uid>    certificat « tracking-<uid> » pour les TRACKING_HOSTS de l'instance
#   bin/tls.sh renew                   renouvellement de tous les certificats (cron) + reload nginx si besoin
#   bin/tls.sh status                  liste les certificats
#   bin/tls.sh disable                 repasse en TLS_MODE=plain (ex. derrière un autre proxy)
# Options : --staging (serveur de test Let's Encrypt), --dry-run (renew).
# Prérequis : DNS des domaines pointant sur ce serveur, port 80 ouvert, stack plateforme démarrée.
source "$(dirname "$0")/lib.sh"
load_platform_env

action="${1:-}"; shift || true
extra=()
uid=""
for arg in "$@"; do
  case "$arg" in
    --staging) extra+=(--staging) ;;
    --dry-run) extra+=(--dry-run) ;;
    *) uid="$arg" ;;
  esac
done

certbot_run() {
  compose_platform --profile tls run --rm certbot "$@"
}

issue_cert() {
  # issue_cert nom domaine…
  local name="$1"; shift
  local args=(certonly --webroot -w /var/www/certbot --non-interactive --agree-tos --keep-until-expiring
              --email "$ADMIN_EMAIL" --cert-name "$name" "${extra[@]}")
  local d
  for d in "$@"; do args+=(-d "$d"); done
  container_running nginx || die "nginx doit être démarré pour servir le défi ACME (bin/compose.sh platform up -d)."
  info "Demande du certificat « $name » pour : $*"
  certbot_run "${args[@]}"
}

case "$action" in
  issue)
    : "${ADMIN_EMAIL:?ADMIN_EMAIL manquant dans env/platform.env}"
    issue_cert main "$PUBLIC_HOST"
    env_set "$PLATFORM_ENV" TLS_MODE tls
    env_set "$PLATFORM_ENV" PUBLIC_SCHEME https
    ok "Certificat obtenu, TLS_MODE=tls."
    "$DEPLOY_DIR/bin/render-nginx.sh"
    ;;
  issue-tracking)
    require_instance "$uid"
    hosts="$(env_get "$(instance_dir "$uid")/.env" TRACKING_HOSTS | tr ',' ' ' | xargs || true)"
    [[ -n "$hosts" ]] || die "L'instance $uid n'a pas de TRACKING_HOSTS."
    [[ "$TLS_MODE" == "tls" ]] || warn "TLS_MODE=plain : le certificat sera obtenu mais utilisé seulement après bin/tls.sh issue."
    # shellcheck disable=SC2086
    issue_cert "tracking-$uid" $hosts
    "$DEPLOY_DIR/bin/render-nginx.sh"
    ;;
  renew)
    marker="$(mktemp)"
    certbot_run renew --webroot -w /var/www/certbot --non-interactive --quiet "${extra[@]}" || warn "certbot renew a échoué (voir la sortie ci-dessus)."
    renewed="$(find "$TOOLSO_DATA_DIR/letsencrypt/live" -name 'fullchain.pem' -newer "$marker" 2>/dev/null | wc -l)"
    rm -f "$marker"
    if [[ "$renewed" -gt 0 ]]; then
      info "$renewed certificat(s) renouvelé(s), rechargement de nginx."
      nginx_reload
    else
      ok "Aucun certificat à renouveler."
    fi
    ;;
  status)
    certbot_run certificates
    ;;
  disable)
    env_set "$PLATFORM_ENV" TLS_MODE plain
    ok "TLS_MODE=plain (PUBLIC_SCHEME inchangé : $PUBLIC_SCHEME)."
    "$DEPLOY_DIR/bin/render-nginx.sh"
    ;;
  *)
    die "Usage : $0 issue | issue-tracking <uid> | renew | status | disable [--staging] [--dry-run]"
    ;;
esac
