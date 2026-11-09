#!/usr/bin/env bash
# Retire une instance : arrêt de sa stack, suppression des fragments nginx, archivage de sa
# configuration dans deploy/instances/.removed/. La base PostgreSQL et les fichiers sont
# conservés, sauf --purge (suppression définitive base + rôle + fichiers + certificat tracking).
#   sudo bin/remove-database.sh <uid> [--purge] [--yes]
# L'enregistrement dans l'access API n'est pas retiré automatiquement (à faire dans l'UI).
source "$(dirname "$0")/lib.sh"
require_docker
load_platform_env

uid="" purge=0
for arg in "$@"; do
  case "$arg" in
    --purge) purge=1 ;;
    --yes) export ASSUME_YES=1 ;;
    -h|--help) sed -n '2,7p' "$0"; exit 0 ;;
    *) uid="$arg" ;;
  esac
done
require_uid "$uid"
dir="$(instance_dir "$uid")"
db="emailing_$uid"; role="emailing_$uid"

if [[ "$purge" == "1" ]]; then
  warn "PURGE : la base $db, le rôle $role, $TOOLSO_DATA_DIR/files/$uid et le certificat tracking-$uid seront supprimés définitivement."
  confirm "Confirmer la purge de l'instance $uid ?" || die "Abandon."
else
  confirm "Arrêter l'instance $uid (base et fichiers conservés) ?" || die "Abandon."
fi

if [[ -f "$dir/docker-compose.yml" ]]; then
  info "Arrêt de la stack toolso-$uid"
  compose_instance "$uid" down --remove-orphans
else
  # Stack sans dossier (ou dossier déjà archivé) : arrêt par nom de conteneur.
  for c in "api_$uid" "worker_$uid" "worker_huge_$uid" "scheduler_$uid"; do
    docker rm -f "$c" >/dev/null 2>&1 || true
  done
fi

if [[ -d "$dir" ]]; then
  if [[ "$purge" == "1" ]]; then
    rm -rf "$dir"
    ok "Configuration $dir supprimée."
  else
    archive="$INSTANCES_DIR/.removed/$uid-$(date +%Y%m%d-%H%M%S)"
    install -d -m 0700 "$INSTANCES_DIR/.removed"
    mv "$dir" "$archive"
    ok "Configuration archivée dans $archive (contient le mot de passe de la base)."
  fi
fi

if [[ "$purge" == "1" ]]; then
  if container_running postgres; then
    info "Suppression de la base $db et du rôle $role"
    psql_admin -c "SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE datname = '$db';" >/dev/null
    psql_admin -c "DROP DATABASE IF EXISTS $db;" >/dev/null
    psql_admin -c "DROP ROLE IF EXISTS $role;" >/dev/null
    ok "Base et rôle supprimés."
  else
    warn "PostgreSQL arrêté : base $db et rôle $role non supprimés."
  fi
  rm -rf "${TOOLSO_DATA_DIR:?}/files/$uid"
  ok "Fichiers supprimés."
  if [[ -d "$TOOLSO_DATA_DIR/letsencrypt/live/tracking-$uid" ]]; then
    compose_platform --profile tls run --rm certbot delete --non-interactive --cert-name "tracking-$uid" || warn "Suppression du certificat tracking-$uid échouée."
  fi
else
  ok "Base $db et fichiers $TOOLSO_DATA_DIR/files/$uid conservés (restauration : remettre le dossier archivé dans deploy/instances/$uid puis bin/add-database.sh)."
fi

"$DEPLOY_DIR/bin/render-nginx.sh"
ok "Instance $uid retirée."
