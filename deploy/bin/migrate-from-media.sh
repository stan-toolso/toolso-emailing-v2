#!/usr/bin/env bash
# Reprise d'une base toolso-media (PostgreSQL : contacts, inscriptions, sources, historique, blacklist, messages d'un ou
# plusieurs produits) dans la base emailing d'une instance (voir docs/06-migration-depuis-media.md).
#
#   sudo bin/migrate-from-media.sh <uid> --list-products            [source]     produits de la base media
#   sudo bin/migrate-from-media.sh <uid> --product <p>[,<p>…] --inventory [source]   ce qui sera repris / non repris
#   sudo bin/migrate-from-media.sh <uid> --product <p>[,<p>…] --dry-run   [source]   simulation (rien n'est écrit)
#   sudo bin/migrate-from-media.sh <uid> --product <p>[,<p>…] [--dump] [source]      reprise des contacts
#   sudo bin/migrate-from-media.sh <uid> --product <p> --contents [--articles-only | --dems-only] [source] [ads]
#                                                                                      reprise des contenus (articles → Content
#                                                                                      newsletter, DEM → Content marketing)
# Source (une des deux formes) :
#   --source-url postgres://user:mdp@hôte:5432/base    (ou variable MEDIA_DATABASE_URL déjà exportée)
#   --media-instance <nom>   secret AWS Secrets Manager « media-<nom> » (un secret par base media, noms dans backend/build/update_model_all.js du dépôt media),
#                            région MEDIA_AWS_REGION (défaut eu-west-3, celle de toolso-media), profil AWS_PROFILE.
# Base ads (DEM, pour --contents) : --ads-url postgres://… (ou ADS_DATABASE_URL) ou --ads-secret <nom> (ex. toolso-ads,
#   même région) ; sans elle, --contents ne reprend que les articles.
# Options contenus : --all-articles (aussi brouillons / exclus de l'emailing), --include-disabled (publicités désactivées),
#   --since-days N (articles publiés depuis N jours).
# Options : --since-days N (envois repris en événements, défaut 90 ; 0 = seulement les événements de statut),
#           --dump (pg_dump -Fc de la base media dans BACKUP_DIR/media-migration/ avant la reprise, archive),
#           --skip-blacklist, --skip-messages, --batch-size N, --ssl-mode <require|no-verify|disable> (défaut no-verify :
#           connexion chiffrée sans vérification du certificat, comme PGSSLMODE=require), --yes.
# Prérequis : instance créée et démarrée (bin/add-database.sh <uid> …) ; la base media joignable depuis les conteneurs de ce
#   serveur (groupe de sécurité RDS) ; CLI aws et jq pour --media-instance. Un contact déjà présent (même e-mail) dans la base
#   de l'instance est ignoré : la reprise est relançable. Les identifiants ne sont jamais affichés ni passés en argument.
source "$(dirname "$0")/lib.sh"
require_docker
load_platform_env

PG_IMAGE="${PG_IMAGE:-postgres:17}"
MEDIA_AWS_REGION="${MEDIA_AWS_REGION:-eu-west-3}"

uid="" products="" source_url="${MEDIA_DATABASE_URL:-}" media_instance="" since_days="" batch_size="" ssl_mode="no-verify"
ads_url="${ADS_DATABASE_URL:-}" ads_secret="" contents=0 articles_only=0 dems_only=0 all_articles=0 include_disabled=0
mode="migrate" do_dump=0 skip_blacklist=0 skip_messages=0
while [[ $# -gt 0 ]]; do
  case "$1" in
    --product) products="${products:+$products,}${2:-}"; shift 2 ;;
    --source-url) source_url="${2:-}"; shift 2 ;;
    --media-instance) media_instance="${2:-}"; shift 2 ;;
    --since-days) since_days="${2:-}"; shift 2 ;;
    --batch-size) batch_size="${2:-}"; shift 2 ;;
    --ssl-mode) ssl_mode="${2:-}"; shift 2 ;;
    --ads-url) ads_url="${2:-}"; shift 2 ;;
    --ads-secret) ads_secret="${2:-}"; shift 2 ;;
    --contents) contents=1; shift ;;
    --articles-only) articles_only=1; shift ;;
    --dems-only) dems_only=1; shift ;;
    --all-articles) all_articles=1; shift ;;
    --include-disabled) include_disabled=1; shift ;;
    --list-products) mode="list"; shift ;;
    --inventory) mode="inventory"; shift ;;
    --dry-run) mode="dry-run"; shift ;;
    --dump) do_dump=1; shift ;;
    --skip-blacklist) skip_blacklist=1; shift ;;
    --skip-messages) skip_messages=1; shift ;;
    --yes) export ASSUME_YES=1; shift ;;
    -h|--help) sed -n '2,28p' "$0"; exit 0 ;;
    --*) die "Option inconnue : $1" ;;
    *) [[ -z "$uid" ]] || die "Un seul identifiant de base attendu."; uid="$1"; shift ;;
  esac
done
[[ -n "$uid" ]] || die "Usage : $0 <uid> --product <p>[,<p>…] [--source-url <url> | --media-instance <nom>] (voir --help)"
require_instance "$uid"
[[ "$ssl_mode" =~ ^(require|no-verify|disable)$ ]] || die "--ssl-mode attend require, no-verify ou disable."
[[ -z "$since_days" || "$since_days" =~ ^[0-9]+$ ]] || die "--since-days attend un entier ≥ 0."
[[ -z "$batch_size" || "$batch_size" =~ ^[1-9][0-9]*$ ]] || die "--batch-size attend un entier ≥ 1."
[[ "$mode" == "list" || -n "$products" ]] || die "Préciser le ou les produits media à reprendre : --product <uid>[,<uid>…] (liste : --list-products)."
container_running postgres || die "PostgreSQL n'est pas démarré (bin/compose.sh platform up -d)."
docker image inspect toolso-emailing-api:latest >/dev/null 2>&1 || die "Image toolso-emailing-api absente : bin/add-database.sh $uid … la construit."

# ---------- source ----------
# L'URL complète (avec le mot de passe) ne circule que par l'environnement : MEDIA_DATABASE_URL pour le conteneur api,
# MEDIA_LIBPQ_URL pour pg_dump. Jamais sur une ligne de commande, jamais affichée.
if [[ -n "$media_instance" ]]; then
  [[ -z "$source_url" ]] || die "--media-instance et --source-url sont exclusifs."
  require_aws
  json="$(AWS_REGION="$MEDIA_AWS_REGION" aws_secret_json "media-$media_instance")" || die "Lecture du secret media-$media_instance impossible (région $MEDIA_AWS_REGION, droit secretsmanager:GetSecretValue ?)."
  src_host="$(jq -r '.host // empty' <<<"$json")"
  src_port="$(jq -r '.port // 5432' <<<"$json")"
  src_db="$(jq -r '.database // .dbname // empty' <<<"$json")"
  src_user="$(jq -r '.username // .user // empty | @uri' <<<"$json")"
  src_pass="$(jq -r '.password // empty | @uri' <<<"$json")"
  unset json
  [[ -n "$src_host" && -n "$src_db" && -n "$src_user" && -n "$src_pass" ]] || die "Secret media-$media_instance incomplet (host, database, username, password attendus)."
  source_url="postgres://$src_user:$src_pass@$src_host:$src_port/$src_db"
  unset src_pass
  info "Source : secret media-$media_instance → $src_host:$src_port/$src_db"
elif [[ -n "$source_url" ]]; then
  [[ "$source_url" =~ ^postgres(ql)?:// ]] || die "--source-url attend une URL postgres://…"
  info "Source : $(sed -E 's|://([^:/@]+)(:[^@]*)?@|://\1:***@|' <<<"$source_url")"
else
  die "Source media non précisée : --source-url <url> (ou MEDIA_DATABASE_URL) ou --media-instance <nom>."
fi
if [[ "$contents" == "1" && "$articles_only" == "0" ]]; then
  if [[ -n "$ads_secret" ]]; then
    [[ -z "$ads_url" ]] || die "--ads-secret et --ads-url sont exclusifs."
    require_aws
    json="$(AWS_REGION="$MEDIA_AWS_REGION" aws_secret_json "$ads_secret")" || die "Lecture du secret $ads_secret impossible (région $MEDIA_AWS_REGION)."
    ads_host="$(jq -r '.host // empty' <<<"$json")"; ads_port="$(jq -r '.port // 5432' <<<"$json")"
    ads_db="$(jq -r '.database // .dbname // empty' <<<"$json")"; ads_user="$(jq -r '.username // .user // empty | @uri' <<<"$json")"
    ads_pass="$(jq -r '.password // empty | @uri' <<<"$json")"
    unset json
    [[ -n "$ads_host" && -n "$ads_db" && -n "$ads_user" && -n "$ads_pass" ]] || die "Secret $ads_secret incomplet."
    ads_url="postgres://$ads_user:$ads_pass@$ads_host:$ads_port/$ads_db"
    unset ads_pass
    info "Base ads : secret $ads_secret → $ads_host:$ads_port/$ads_db"
  elif [[ -n "$ads_url" ]]; then
    [[ "$ads_url" =~ ^postgres(ql)?:// ]] || die "--ads-url attend une URL postgres://…"
    info "Base ads : $(sed -E 's|://([^:/@]+)(:[^@]*)?@|://\1:***@|' <<<"$ads_url")"
  elif [[ "$dems_only" == "1" ]]; then
    die "Les DEM sont dans la base ads : --ads-secret toolso-ads ou --ads-url <url>."
  else
    warn "Pas de base ads (--ads-secret / --ads-url) : seuls les articles seront repris."
  fi
  if [[ -n "$ads_url" ]]; then
    export ADS_DATABASE_URL="${ads_url%%\?*}?sslmode=$ssl_mode"
  fi
  unset ads_url
fi
base_url="${source_url%%\?*}"
libpq_ssl="$ssl_mode"; [[ "$libpq_ssl" == "no-verify" ]] && libpq_ssl="require"
export MEDIA_DATABASE_URL="$base_url?sslmode=$ssl_mode"
export MEDIA_LIBPQ_URL="$base_url?sslmode=$libpq_ssl"
unset source_url base_url

# ---------- arguments du script node ----------
args=()
[[ -n "$products" ]] && args+=(--product "$products")
[[ -n "$since_days" ]] && args+=(--since-days "$since_days")
[[ -n "$batch_size" ]] && args+=(--batch-size "$batch_size")
[[ "$skip_blacklist" == "1" ]] && args+=(--skip-blacklist)
[[ "$skip_messages" == "1" ]] && args+=(--skip-messages)
case "$mode" in
  list) args+=(--list-products) ;;
  inventory) args+=(--inventory) ;;
  dry-run) args+=(--dry-run) ;;
esac

run_node() {
  # conteneur api jetable de l'instance (DATABASE_URL, RESOURCE_UID, TZ de son .env) ; MEDIA_DATABASE_URL vient de cet environnement
  compose_instance "$uid" run --rm --no-deps -e MEDIA_DATABASE_URL api node scripts/migrate-from-media.js "$@"
}
run_node_contents() {
  compose_instance "$uid" run --rm --no-deps -e MEDIA_DATABASE_URL -e ADS_DATABASE_URL api node scripts/migrate-contents-from-media.js "$@"
}

if [[ "$contents" == "1" ]]; then
  [[ "$mode" == "migrate" || "$mode" == "dry-run" ]] || die "--contents s'utilise avec --dry-run ou sans mode (reprise)."
  cargs=(--product "$products")
  [[ "$articles_only" == "1" ]] && cargs+=(--articles-only)
  [[ "$dems_only" == "1" ]] && cargs+=(--dems-only)
  [[ "$all_articles" == "1" ]] && cargs+=(--all-articles)
  [[ "$include_disabled" == "1" ]] && cargs+=(--include-disabled)
  [[ -n "$since_days" ]] && cargs+=(--since-days "$since_days")
  if [[ "$mode" == "dry-run" ]]; then
    run_node_contents "${cargs[@]}" --dry-run
    exit $?
  fi
  warn "Les articles et DEM des produits « $products » vont être ajoutés aux contenus de emailing_$uid (inactifs ; ceux déjà repris sont ignorés)."
  confirm "Continuer ?" || die "Abandon."
  log_dir="${BACKUP_DIR:-/var/backups/toolso-emailing}/media-migration"
  install -d -m 0700 "$log_dir"
  log_file="$log_dir/contents_${uid}_$(date +%Y-%m-%d_%H%M%S).log"
  info "Reprise des contenus dans emailing_$uid (journal : $log_file)"
  if run_node_contents "${cargs[@]}" 2>&1 | tee "$log_file"; then
    ok "Contenus repris. Dans l'UI : vérifier le gabarit « Article – <produit> » (Gabarits), activer les contenus et les rattacher à des planifications."
    exit 0
  fi
  die "La reprise des contenus a échoué (voir $log_file)."
fi

if [[ "$mode" != "migrate" ]]; then
  run_node "${args[@]}"
  exit $?
fi

# ---------- reprise ----------
warn "Les contacts des produits « $products » vont être ajoutés à la base emailing_$uid (les e-mails déjà présents sont ignorés)."
confirm "Continuer ?" || die "Abandon."

if [[ "$do_dump" == "1" ]]; then
  dump_dir="${BACKUP_DIR:-/var/backups/toolso-emailing}/media-migration"
  install -d -m 0700 "$dump_dir"
  dump_file="$dump_dir/media_${media_instance:-source}_$(date +%Y-%m-%d_%H%M%S).dump"
  info "pg_dump -Fc de la base media → $dump_file (archive, non restaurée par ce script)"
  t0=$(date +%s)
  if docker run --rm -e MEDIA_LIBPQ_URL -e PGCONNECT_TIMEOUT=15 "$PG_IMAGE" sh -c 'exec pg_dump "$MEDIA_LIBPQ_URL" -Fc --no-owner --no-privileges' > "$dump_file"; then
    chmod 600 "$dump_file"
    ok "Dump terminé en $(( $(date +%s) - t0 )) s : $(du -h "$dump_file" | cut -f1)."
  else
    rm -f "$dump_file"
    die "pg_dump de la base media a échoué (réseau, identifiants, groupe de sécurité ?)."
  fi
fi

log_dir="${BACKUP_DIR:-/var/backups/toolso-emailing}/media-migration"
install -d -m 0700 "$log_dir"
log_file="$log_dir/migrate_${uid}_$(date +%Y-%m-%d_%H%M%S).log"
info "Reprise dans emailing_$uid (journal : $log_file)"
t0=$(date +%s)
if run_node "${args[@]}" 2>&1 | tee "$log_file"; then
  ok "Reprise terminée en $(( $(date +%s) - t0 )) s."
else
  die "La reprise a échoué (voir $log_file). Relançable : les contacts déjà repris seront ignorés."
fi

cat <<MSG

$(ok "Suite :")
   - le job scan_contact_to_update_status (scheduler) recalcule le statut et le score des contacts repris dans les heures qui suivent
     (à la main : bin/compose.sh $uid run --rm --no-deps api node scripts/run-job.js scan_contact_to_update_status) ;
   - recréer dans l'UI les expéditeurs et routeurs (identifiants ESP), puis les planifications ;
   - rebrancher les formulaires / l'API d'inscription sur $PUBLIC_URL/api/$uid (clés API des sources reprises telles quelles) ;
   - vérifier : bin/psql.sh $uid -c 'SELECT status, count(*) FROM "Contact" GROUP BY 1'
MSG
