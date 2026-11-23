#!/usr/bin/env bash
# Synchronisation inverse instance v2 → toolso-media, pour le retour arrière d'un produit basculé (docs/06 § 9) : reporte dans
# la base media les désabonnements, plaintes et hard bounces survenus dans la v2 depuis la bascule, et liste les contacts
# inscrits dans la v2 depuis (à réimporter dans media par son API).
#
#   sudo bin/sync-statuses-to-media.sh <uid> --since <AAAA-MM-JJ[THH:MM]> [--product <p>[,<p>…]]            simulation (défaut)
#   sudo bin/sync-statuses-to-media.sh <uid> --since <date> --inscriptions-csv                     CSV des inscriptions v2 à réimporter
#   sudo bin/sync-statuses-to-media.sh <uid> --since <date> --apply --write-secret <nom>            écriture dans media
#
#   --since       date (et heure) de bascule du produit, fuseau de l'instance : seuls les événements v2 postérieurs comptent
#   --product     produit(s) media ; défaut MEDIA_PRODUCTS du .env de l'instance (bin/set-media-source.sh)
# Lecture (simulation, --inscriptions-csv) : MEDIA_DATABASE_URL du .env de l'instance, ou --media-instance <nom> / --source-url
#   <url> ; connexion en lecture seule.
# Écriture (--apply) : jamais avec la source de lecture. Compte media limité (UPDATE contact, INSERT contact_history,
#   DELETE email), par --write-secret <nom> (secret AWS Secrets Manager : host, port, database, username, password ; région
#   MEDIA_AWS_REGION, défaut eu-west-3) ou variable MEDIA_WRITE_DATABASE_URL déjà exportée. Simulation conseillée juste avant.
# Options : --batch-size N, --ssl-mode <require|no-verify|disable> (défaut no-verify), --yes.
# Journaux et CSV dans BACKUP_DIR/media-migration/ (mode 600 : le CSV contient des e-mails).
source "$(dirname "$0")/lib.sh"
require_root
require_docker
load_platform_env

MEDIA_AWS_REGION="${MEDIA_AWS_REGION:-eu-west-3}"
uid="" products="" since="" apply=0 csv=0 write_secret="" source_url="" media_instance="" batch_size="" ssl_mode="no-verify"
write_url="${MEDIA_WRITE_DATABASE_URL:-}"
while [[ $# -gt 0 ]]; do
  case "$1" in
    --product) products="${products:+$products,}${2:-}"; shift 2 ;;
    --since) since="${2:-}"; shift 2 ;;
    --apply) apply=1; shift ;;
    --inscriptions-csv) csv=1; shift ;;
    --write-secret) write_secret="${2:-}"; shift 2 ;;
    --source-url) source_url="${2:-}"; shift 2 ;;
    --media-instance) media_instance="${2:-}"; shift 2 ;;
    --batch-size) batch_size="${2:-}"; shift 2 ;;
    --ssl-mode) ssl_mode="${2:-}"; shift 2 ;;
    --yes) export ASSUME_YES=1; shift ;;
    -h|--help) sed -n '2,21p' "$0"; exit 0 ;;
    --*) die "Option inconnue : $1" ;;
    *) [[ -z "$uid" ]] || die "Un seul identifiant de base attendu."; uid="$1"; shift ;;
  esac
done
[[ -n "$uid" ]] || die "Usage : $0 <uid> --since <AAAA-MM-JJ[THH:MM]> [--apply --write-secret <nom>] (voir --help)"
require_instance "$uid"
[[ "$since" =~ ^[0-9]{4}-[0-9]{2}-[0-9]{2}([T\ ][0-9]{2}:[0-9]{2})?$ ]] || die "--since attend la date de bascule AAAA-MM-JJ ou AAAA-MM-JJTHH:MM."
[[ "$ssl_mode" =~ ^(require|no-verify|disable)$ ]] || die "--ssl-mode attend require, no-verify ou disable."
[[ -z "$batch_size" || "$batch_size" =~ ^[1-9][0-9]*$ ]] || die "--batch-size attend un entier ≥ 1."
[[ "$apply" == "0" || "$csv" == "0" ]] || die "--inscriptions-csv est une lecture : sans --apply."
instance_env="$(instance_dir "$uid")/.env"
[[ -n "$products" ]] || products="$(env_get "$instance_env" MEDIA_PRODUCTS)"
[[ -n "$products" ]] || die "Produits media non précisés : --product <uid> ou MEDIA_PRODUCTS dans $instance_env."
container_running postgres || die "PostgreSQL n'est pas démarré (bin/compose.sh platform up -d)."

# URL postgres:// depuis un secret AWS (host, port, database, username, password), jamais affichée
url_from_secret() {
  local json host port db user pass
  require_aws
  json="$(AWS_REGION="$MEDIA_AWS_REGION" aws_secret_json "$1")" || die "Lecture du secret $1 impossible (région $MEDIA_AWS_REGION)."
  host="$(jq -r '.host // empty' <<<"$json")"; port="$(jq -r '.port // 5432' <<<"$json")"
  db="$(jq -r '.database // .dbname // empty' <<<"$json")"; user="$(jq -r '.username // .user // empty | @uri' <<<"$json")"
  pass="$(jq -r '.password // empty | @uri' <<<"$json")"
  [[ -n "$host" && -n "$db" && -n "$user" && -n "$pass" ]] || die "Secret $1 incomplet (host, database, username, password attendus)."
  printf 'postgres://%s:%s@%s:%s/%s' "$user" "$pass" "$host" "$port" "$db"
}

# ---------- connexion media (variable MEDIA_DATABASE_URL du conteneur) ----------
eargs=()
if [[ "$apply" == "1" ]]; then
  [[ -z "$source_url" && -z "$media_instance" ]] || die "--apply n'utilise pas la source de lecture : --write-secret <nom> (compte media limité) seulement."
  if [[ -n "$write_secret" ]]; then
    write_url="$(url_from_secret "$write_secret")"
    info "Écriture dans media : secret $write_secret"
  elif [[ -n "$write_url" ]]; then
    info "Écriture dans media : MEDIA_WRITE_DATABASE_URL"
  else
    die "--apply écrit dans la base media de production : --write-secret <nom> (compte media limité) ou MEDIA_WRITE_DATABASE_URL."
  fi
  # garde-fou : pas de compte administrateur (le secret de lecture media-<nom> est le compte maître de l'Aurora)
  [[ "$write_url" =~ ^postgres(ql)?://([^:@/]+) ]] || die "URL d'écriture invalide."
  [[ "${BASH_REMATCH[2]}" != "postgres" ]] || die "Compte d'écriture « postgres » (administrateur) refusé : créer un compte media limité (docs/06 § 9)."
  export MEDIA_DATABASE_URL="${write_url%%\?*}?sslmode=$ssl_mode"
  unset write_url
  eargs+=(-e MEDIA_DATABASE_URL)
elif [[ -n "$media_instance" ]]; then
  [[ -z "$source_url" ]] || die "--media-instance et --source-url sont exclusifs."
  source_url="$(url_from_secret "media-$media_instance")"
  export MEDIA_DATABASE_URL="${source_url%%\?*}?sslmode=$ssl_mode"
  unset source_url
  eargs+=(-e MEDIA_DATABASE_URL)
elif [[ -n "$source_url" ]]; then
  [[ "$source_url" =~ ^postgres(ql)?:// ]] || die "--source-url attend une URL postgres://…"
  export MEDIA_DATABASE_URL="${source_url%%\?*}?sslmode=$ssl_mode"
  unset source_url
  eargs+=(-e MEDIA_DATABASE_URL)
else
  [[ -n "$(env_get "$instance_env" MEDIA_DATABASE_URL)" ]] || die "Source media non précisée : MEDIA_DATABASE_URL absent de $instance_env (bin/set-media-source.sh) ; ou --media-instance <nom>."
  info "Source : MEDIA_DATABASE_URL du .env de l'instance $uid (lecture seule)"
fi

# ---------- code : image de l'instance, ou fichiers du dépôt si l'image est antérieure à ce script ----------
margs=()
if ! docker run --rm --entrypoint test toolso-emailing-api:latest -f /app/scripts/sync-statuses-to-media.js 2>/dev/null; then
  for f in scripts/sync-statuses-to-media.js src/migration/mediaReverseSync.js; do
    [[ -f "$REPO_DIR/apps/api/$f" ]] || die "$f absent de l'image et du dépôt ($REPO_DIR) : mettre à jour le dépôt (bin/upgrade.sh)."
    margs+=(-v "$REPO_DIR/apps/api/$f:/app/$f:ro")
  done
  info "Image antérieure à la synchronisation inverse : fichiers montés depuis $REPO_DIR"
fi

nargs=(--product "$products" --since "$since")
[[ -n "$batch_size" ]] && nargs+=(--batch-size "$batch_size")
log_dir="${BACKUP_DIR:-/var/backups/toolso-emailing}/media-migration"
install -d -m 0700 "$log_dir"
stamp="$(date +%Y-%m-%d_%H%M%S)"
run_node() { compose_instance "$uid" run --rm --no-deps -T "${eargs[@]}" "${margs[@]}" api node scripts/sync-statuses-to-media.js "$@"; }

if [[ "$csv" == "1" ]]; then
  out="$log_dir/inscriptions_v2_${uid}_${stamp}.csv"
  ( umask 077; run_node "${nargs[@]}" --inscriptions-csv > "$out" ) || die "Export des inscriptions échoué."
  ok "$(( $(wc -l < "$out") - 1 )) contacts inscrits dans la v2 depuis le $since : $out (à réimporter dans media par son API)."
  exit 0
fi

if [[ "$apply" == "1" ]]; then
  warn "Écriture dans la base media de PRODUCTION : statuts des contacts des produits « $products » (depuis le $since, instance $uid)."
  confirm "Continuer ?" || die "Abandon."
  nargs+=(--apply)
  log_file="$log_dir/reverse_sync_${uid}_${stamp}.log"
else
  info "Simulation (aucune écriture dans media) ; --apply pour écrire."
  log_file="$log_dir/reverse_sync_${uid}_${stamp}_dry-run.log"
fi
if ( umask 077; run_node "${nargs[@]}" 2>&1 | tee "$log_file" ); then
  ok "Terminé (journal : $log_file)."
  exit 0
fi
die "La synchronisation inverse a échoué (voir $log_file). Relançable : un contact déjà reporté n'est pas modifié deux fois."
