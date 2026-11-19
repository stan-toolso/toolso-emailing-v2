#!/usr/bin/env bash
# Configure la copie distante des sauvegardes (bin/backup.sh) vers un bucket S3 (Scaleway Object Storage par défaut) :
# installe rclone si besoin, écrit le remote « backup » dans /root/.config/rclone/rclone.conf (droits 600), fixe
# BACKUP_RCLONE_REMOTE=backup:<bucket>/<préfixe> dans env/platform.env et vérifie l'accès (écriture puis lecture d'un
# fichier témoin).
#
#   sudo bin/set-backup-remote.sh --bucket toolso-emailing-v2-backups [--region nl-ams] [--prefix "$(hostname)"]
#
# La clé d'accès (ID SCW… et clé secrète) est demandée au clavier (la clé secrète ne s'affiche pas) ; elle peut aussi
# venir de BACKUP_ACCESS_KEY / BACKUP_SECRET_KEY. Elle n'est écrite que dans rclone.conf et jamais affichée.
# Options : --endpoint (défaut https://s3.<région>.scw.cloud), --provider (défaut Scaleway), --check (accès seul).
source "$(dirname "$0")/lib.sh"
require_root

bucket="" region="nl-ams" prefix="$(hostname -s)" endpoint="" provider="Scaleway" check=0
while [[ $# -gt 0 ]]; do
  case "$1" in
    --bucket) bucket="$2"; shift 2 ;;
    --region) region="$2"; shift 2 ;;
    --prefix) prefix="$2"; shift 2 ;;
    --endpoint) endpoint="$2"; shift 2 ;;
    --provider) provider="$2"; shift 2 ;;
    --check) check=1; shift ;;
    -h|--help) sed -n '2,12p' "$0"; exit 0 ;;
    *) die "Option inconnue : $1" ;;
  esac
done
load_platform_env
conf=/root/.config/rclone/rclone.conf

check_remote() {
  local remote="$1" probe=".acces-$(hostname -s)-$$"
  printf 'ok %s\n' "$(date -Iseconds)" | rclone rcat "$remote/$probe" || die "Écriture impossible dans $remote (clé, droits ou bucket ?)."
  [[ "$(rclone cat "$remote/$probe")" == ok* ]] || die "Relecture impossible dans $remote."
  rclone deletefile "$remote/$probe" || warn "Fichier témoin $remote/$probe non supprimé."
  ok "Accès en écriture et lecture à $remote vérifié."
}

if [[ "$check" == "1" ]]; then
  [[ -n "${BACKUP_RCLONE_REMOTE:-}" ]] || die "BACKUP_RCLONE_REMOTE vide dans env/platform.env."
  check_remote "$BACKUP_RCLONE_REMOTE"
  rclone lsf --dirs-only "$BACKUP_RCLONE_REMOTE" | tail -n 5 | sed 's/^/   /'
  exit 0
fi

[[ -n "$bucket" ]] || die "--bucket requis."
[[ "$prefix" =~ ^[A-Za-z0-9._-]+$ ]] || die "--prefix : lettres, chiffres, . _ - seulement."
endpoint="${endpoint:-https://s3.$region.scw.cloud}"

if ! command -v rclone >/dev/null; then
  info "Installation de rclone"
  DEBIAN_FRONTEND=noninteractive apt-get install -y -qq rclone >/dev/null
fi

access="${BACKUP_ACCESS_KEY:-}" secret="${BACKUP_SECRET_KEY:-}"
[[ -n "$access" ]] || read -r -p "ID de la clé d'accès (SCW…) : " access
[[ -n "$secret" ]] || { read -r -s -p "Clé secrète (n'apparaît pas) : " secret; echo; }
[[ -n "$access" && -n "$secret" ]] || die "Clé d'accès et clé secrète requises."

install -d -m 0700 "$(dirname "$conf")"
touch "$conf"; chmod 600 "$conf"
# Section [backup] réécrite, les autres remotes éventuels sont conservés.
ACCESS="$access" SECRET="$secret" python3 - "$conf" "$provider" "$region" "$endpoint" <<'PY' || die "Écriture de $conf impossible."
import configparser, os, sys
path, provider, region, endpoint = sys.argv[1:5]
c = configparser.RawConfigParser()
c.read(path)
c.remove_section("backup")
c.add_section("backup")
for k, v in (("type", "s3"), ("provider", provider), ("access_key_id", os.environ["ACCESS"]),
             ("secret_access_key", os.environ["SECRET"]), ("region", region), ("endpoint", endpoint),
             ("acl", "private"), ("no_check_bucket", "true")):
    c.set("backup", k, v)
with open(path, "w") as f:
    c.write(f)
PY
unset secret
ok "$conf : remote « backup » ($provider, $endpoint)."

remote="backup:$bucket/$prefix"
check_remote "$remote"
env_set "$PLATFORM_ENV" BACKUP_RCLONE_REMOTE "$remote"
ok "env/platform.env : BACKUP_RCLONE_REMOTE=$remote (copie après chaque sauvegarde, rotation BACKUP_KEEP_DAYS=${BACKUP_KEEP_DAYS:-14} j)."
