#!/usr/bin/env bash
# Sauvegarde : pg_dump (format custom) de la base access et de chaque base emailing_<uid>,
# rôles PostgreSQL (globals), archive des fichiers de chaque instance, archive de la configuration
# (deploy/env, deploy/instances/*/.env + compose). Rotation par âge, copie rclone optionnelle.
#   sudo bin/backup.sh [--db-only | --files-only] [--only <uid>] [--dest <dossier>] [--keep-days <n>]
# --only <uid> : une seule instance (base + fichiers + configuration), sans rotation ni copie distante
#   (déplacement d'une base vers un autre serveur, docs/09-parc-de-serveurs.md).
# Serveur de bases (SERVER_ROLE=data) : pas de base access ; serveur de contrôle : base access seule.
# Variables (env/platform.env) : BACKUP_DIR (défaut /var/backups/toolso-emailing), BACKUP_KEEP_DAYS (14),
# BACKUP_RCLONE_REMOTE (ex. s3:bucket/toolso-emailing ; vide = pas de copie distante).
# Un verrou (flock) empêche deux sauvegardes simultanées. Journal conseillé : /var/log/toolso-emailing-backup.log.
source "$(dirname "$0")/lib.sh"
require_docker
load_platform_env

mode=all dest_root="${BACKUP_DIR:-/var/backups/toolso-emailing}" keep_days="${BACKUP_KEEP_DAYS:-14}" only=""
while [[ $# -gt 0 ]]; do
  case "$1" in
    --db-only) mode=db; shift ;;
    --files-only) mode=files; shift ;;
    --dest) dest_root="$2"; shift 2 ;;
    --keep-days) keep_days="$2"; shift 2 ;;
    --only) only="$2"; shift 2 ;;
    -h|--help) sed -n '2,12p' "$0"; exit 0 ;;
    *) die "Option inconnue : $1" ;;
  esac
done
[[ "$keep_days" =~ ^[0-9]+$ ]] || die "--keep-days attend un entier."
if [[ -n "$only" ]]; then
  require_instance "$only"
  instances="$only"
  databases="emailing_$only"
else
  instances="$(list_instances)"
  databases="$(printf '%s\n' "$instances" | sed '/^$/d; s/^/emailing_/')"
  role_has_access && databases="access${databases:+ $databases}"
fi

install -d -m 0750 "$dest_root"
exec 9>"$dest_root/.lock"
flock -n 9 || die "Une sauvegarde est déjà en cours ($dest_root/.lock)."

stamp="$(date +%Y-%m-%d_%H%M%S)${only:+_$only}"
dest="$dest_root/$stamp"
install -d -m 0700 "$dest"
info "Sauvegarde dans $dest"
start=$(date +%s)

if [[ "$mode" != "files" ]]; then
  container_running postgres || die "PostgreSQL n'est pas démarré."
  docker exec postgres pg_dumpall -U postgres --globals-only > "$dest/globals.sql"
  ok "Rôles PostgreSQL (globals.sql)."
  # shellcheck disable=SC2086  # listes séparées par des blancs
  for db in $databases; do
    if [[ "$(psql_admin -tAc "SELECT 1 FROM pg_database WHERE datname = '$db'")" != "1" ]]; then
      warn "Base $db absente, ignorée."; continue
    fi
    docker exec postgres pg_dump -U postgres -Fc --no-owner --no-privileges "$db" > "$dest/$db.dump"
    ok "Base $db ($(du -h "$dest/$db.dump" | cut -f1))."
  done
fi

if [[ "$mode" != "db" ]]; then
  for uid in $instances; do
    src="$TOOLSO_DATA_DIR/files/$uid"
    [[ -d "$src" ]] || { warn "Dossier $src absent, ignoré."; continue; }
    tar -C "$TOOLSO_DATA_DIR/files" -czf "$dest/files_$uid.tar.gz" "$uid"
    ok "Fichiers $uid ($(du -h "$dest/files_$uid.tar.gz" | cut -f1))."
  done
fi

# Configuration (secrets inclus : le dossier de sauvegarde est en 0700).
config_paths=()
for p in env instances nginx/conf.d/instances nginx/conf.d/tracking nginx/conf.d/05-mode.conf nginx/snippets/listen-main.conf; do
  [[ -e "$DEPLOY_DIR/$p" ]] && config_paths+=("$p")
done
tar -C "$DEPLOY_DIR" --exclude='instances/.removed' -czf "$dest/config.tar.gz" "${config_paths[@]}"
chmod 600 "$dest"/*
ok "Configuration (config.tar.gz)."

if [[ -n "$only" ]]; then
  ok "Sauvegarde de l'instance $only terminée en $(( $(date +%s) - start )) s : $dest ($(du -sh "$dest" | cut -f1))."
  exit 0
fi

# Rotation.
if [[ "$keep_days" -gt 0 ]]; then
  removed=0
  while IFS= read -r old; do
    rm -rf "$old"; removed=$((removed + 1))
  done < <(find "$dest_root" -mindepth 1 -maxdepth 1 -type d -name '20*' -mtime "+$keep_days")
  [[ "$removed" -gt 0 ]] && ok "$removed sauvegarde(s) de plus de $keep_days jours supprimée(s)."
fi

# Copie distante optionnelle.
if [[ -n "${BACKUP_RCLONE_REMOTE:-}" ]]; then
  require_cmd rclone
  info "Copie vers $BACKUP_RCLONE_REMOTE/$stamp"
  rclone copy --quiet "$dest" "$BACKUP_RCLONE_REMOTE/$stamp"
  if [[ "$keep_days" -gt 0 ]]; then
    rclone delete --quiet --min-age "${keep_days}d" "$BACKUP_RCLONE_REMOTE" || warn "Rotation distante échouée."
    rclone rmdirs --quiet --leave-root "$BACKUP_RCLONE_REMOTE" || true
  fi
  ok "Copie distante terminée."
fi

ok "Sauvegarde terminée en $(( $(date +%s) - start )) s : $(du -sh "$dest" | cut -f1)."
