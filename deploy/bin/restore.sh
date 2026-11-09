#!/usr/bin/env bash
# Restauration depuis un dossier produit par bin/backup.sh.
#   sudo bin/restore.sh <dossier-sauvegarde> --db <uid|access>     restaure une base (la stack est arrêtée puis relancée)
#   sudo bin/restore.sh <dossier-sauvegarde> --files <uid>         restaure les fichiers d'une instance
#   sudo bin/restore.sh <dossier-sauvegarde> --config              restaure deploy/env et deploy/instances (serveur neuf)
#   sudo bin/restore.sh <dossier-sauvegarde> --all                 config, puis toutes les bases et tous les fichiers
# Options : --yes (aucune confirmation). Les bases sont recréées (DROP + CREATE) avant pg_restore.
# Sur un serveur neuf : bin/install.sh, puis --config, puis bin/add-database.sh <uid> … pour chaque instance
# (recrée rôles et stacks), puis --db / --files.
source "$(dirname "$0")/lib.sh"
require_docker

src="${1:-}"; shift || true
[[ -d "$src" ]] || die "Usage : $0 <dossier-sauvegarde> --db <uid|access> | --files <uid> | --config | --all [--yes]"
src="$(cd "$src" && pwd)"

dbs=() files=() do_config=0 do_all=0
while [[ $# -gt 0 ]]; do
  case "$1" in
    --db) dbs+=("$2"); shift 2 ;;
    --files) files+=("$2"); shift 2 ;;
    --config) do_config=1; shift ;;
    --all) do_all=1; shift ;;
    --yes) export ASSUME_YES=1; shift ;;
    *) die "Option inconnue : $1" ;;
  esac
done

if [[ "$do_all" == "1" ]]; then
  do_config=1
  for f in "$src"/*.dump; do
    [[ -e "$f" ]] || continue
    name="$(basename "$f" .dump)"
    [[ "$name" == "access" ]] && dbs+=(access) || dbs+=("${name#emailing_}")
  done
  for f in "$src"/files_*.tar.gz; do
    [[ -e "$f" ]] || continue
    n="$(basename "$f" .tar.gz)"; files+=("${n#files_}")
  done
fi
[[ "$do_config" == "1" || ${#dbs[@]} -gt 0 || ${#files[@]} -gt 0 ]] || die "Rien à restaurer : préciser --db, --files, --config ou --all."

if [[ "$do_config" == "1" ]]; then
  [[ -f "$src/config.tar.gz" ]] || die "config.tar.gz absent de $src."
  warn "La configuration actuelle de $DEPLOY_DIR/env et $DEPLOY_DIR/instances sera remplacée."
  confirm "Restaurer la configuration ?" || die "Abandon."
  tar -C "$DEPLOY_DIR" -xzf "$src/config.tar.gz"
  chmod 700 "$DEPLOY_DIR/env"; chmod 600 "$DEPLOY_DIR"/env/*.env
  ok "Configuration restaurée (relancer bin/render-nginx.sh après démarrage de nginx)."
fi

load_platform_env

restore_db() {
  local target="$1" db role dump
  if [[ "$target" == "access" ]]; then
    db=access; role=access
  else
    require_uid "$target"; db="emailing_$target"; role="emailing_$target"
  fi
  dump="$src/$db.dump"
  [[ -f "$dump" ]] || die "Sauvegarde $dump introuvable."
  container_running postgres || die "PostgreSQL n'est pas démarré."
  warn "La base $db sera supprimée puis recréée depuis $dump."
  confirm "Restaurer $db ?" || die "Abandon."

  if [[ "$target" == "access" ]]; then
    container_running access && compose_platform stop access
  elif instance_exists "$target"; then
    compose_instance "$target" stop
  fi
  if [[ "$(psql_admin -tAc "SELECT 1 FROM pg_roles WHERE rolname = '$role'")" != "1" ]]; then
    die "Rôle $role absent : recréer l'instance avec bin/add-database.sh $target … (ou bin/install.sh pour access) avant de restaurer."
  fi
  psql_admin -c "SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE datname = '$db' AND pid <> pg_backend_pid();" >/dev/null
  psql_admin -c "DROP DATABASE IF EXISTS $db;" >/dev/null
  psql_admin -c "CREATE DATABASE $db OWNER $role ENCODING 'UTF8';" >/dev/null
  docker exec -i postgres pg_restore -U postgres -d "$db" --no-owner --no-privileges --role="$role" --exit-on-error < "$dump"
  psql_admin -d "$db" -c "ALTER SCHEMA public OWNER TO $role; REASSIGN OWNED BY postgres TO $role;" >/dev/null 2>&1 || true
  ok "Base $db restaurée."

  if [[ "$target" == "access" ]]; then
    compose_platform up -d access
  elif instance_exists "$target"; then
    compose_instance "$target" up -d
  fi
}

restore_files() {
  local uid="$1" archive
  require_uid "$uid"
  archive="$src/files_$uid.tar.gz"
  [[ -f "$archive" ]] || die "Archive $archive introuvable."
  warn "Les fichiers de $TOOLSO_DATA_DIR/files/$uid seront remplacés."
  confirm "Restaurer les fichiers de $uid ?" || die "Abandon."
  install -d -m 0775 "$TOOLSO_DATA_DIR/files"
  rm -rf "${TOOLSO_DATA_DIR:?}/files/$uid"
  tar -C "$TOOLSO_DATA_DIR/files" -xzf "$archive"
  chown -R 1000:1000 "$TOOLSO_DATA_DIR/files/$uid"
  ok "Fichiers de $uid restaurés."
}

for d in "${dbs[@]}"; do restore_db "$d"; done
for u in "${files[@]}"; do restore_files "$u"; done
ok "Restauration terminée."
