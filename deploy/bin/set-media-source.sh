#!/usr/bin/env bash
# Enregistre la source toolso-media d'une instance (voir docs/06-migration-depuis-media.md § 7) : variables lues par les
# jobs de transition de l'instance (import des campagnes media_campaigns_import, synchronisation des statuts…).
#
#   sudo bin/set-media-source.sh <uid> --media-instance <nom> --product <p>[,<p>…] [--ads-secret <s> [--ads-host <h>]]
#   sudo bin/set-media-source.sh <uid> --check        variables présentes (hôtes et produits, jamais les identifiants)
#   sudo bin/set-media-source.sh <uid> --unset        retire la source (les jobs de transition ne font plus rien)
#
# Écrit dans le .env de l'instance (mode 600) :
#   MEDIA_DATABASE_URL  base media (secret AWS Secrets Manager « media-<nom> », ou --source-url / variable déjà exportée)
#   MEDIA_PRODUCTS      uid(s) du ou des produits media de l'instance, séparés par des virgules
#   ADS_DATABASE_URL    base ads (DEM, campagnes) : --ads-secret <nom> (ex. toolso-ads-readonly), --ads-url, ou variable exportée ;
#                       --ads-host remplace l'hôte du secret (le proxy RDS n'est joignable que depuis le VPC AWS).
# Options : --ssl-mode <require|no-verify|disable> (défaut no-verify), --no-restart (ne recrée pas les conteneurs : les
#   variables ne seront vues qu'au prochain redémarrage), --yes. Région des secrets : MEDIA_AWS_REGION (défaut eu-west-3).
# Les URL (avec mot de passe) ne passent que par l'environnement et le fichier .env ; elles ne sont jamais affichées.
source "$(dirname "$0")/lib.sh"
require_root
load_platform_env

MEDIA_AWS_REGION="${MEDIA_AWS_REGION:-eu-west-3}"
uid="" media_instance="" products="" ads_secret="" ads_host="" ssl_mode="no-verify" restart=1 mode="set"
source_url="${MEDIA_DATABASE_URL:-}" ads_url="${ADS_DATABASE_URL:-}"
while [[ $# -gt 0 ]]; do
  case "$1" in
    --media-instance) media_instance="${2:-}"; shift 2 ;;
    --source-url) source_url="${2:-}"; shift 2 ;;
    --product) products="${products:+$products,}${2:-}"; shift 2 ;;
    --ads-secret) ads_secret="${2:-}"; shift 2 ;;
    --ads-host) ads_host="${2:-}"; shift 2 ;;
    --ads-url) ads_url="${2:-}"; shift 2 ;;
    --ssl-mode) ssl_mode="${2:-}"; shift 2 ;;
    --no-restart) restart=0; shift ;;
    --check) mode="check"; shift ;;
    --unset) mode="unset"; shift ;;
    --yes) export ASSUME_YES=1; shift ;;
    -h|--help) sed -n '2,17p' "$0"; exit 0 ;;
    --*) die "Option inconnue : $1" ;;
    *) [[ -z "$uid" ]] || die "Un seul identifiant de base attendu."; uid="$1"; shift ;;
  esac
done
[[ -n "$uid" ]] || die "Usage : $0 <uid> --media-instance <nom> --product <p> [--ads-secret <s> --ads-host <h>] | --check | --unset (voir --help)"
require_instance "$uid"
env_file="$(instance_dir "$uid")/.env"
KEYS=(MEDIA_DATABASE_URL MEDIA_PRODUCTS ADS_DATABASE_URL)

mask() { sed -E 's|://([^:/@]+)(:[^@]*)?@|://\1:***@|' <<<"$1"; }

if [[ "$mode" == "check" ]]; then
  for k in "${KEYS[@]}"; do
    v="$(env_get "$env_file" "$k")"
    if [[ -z "$v" ]]; then printf '  %-20s (absent)\n' "$k"
    elif [[ "$k" == *_URL ]]; then printf '  %-20s %s\n' "$k" "$(mask "$v")"
    else printf '  %-20s %s\n' "$k" "$v"; fi
  done
  exit 0
fi

recreate() {
  if [[ "$restart" == "1" ]]; then
    info "Recréation des conteneurs de l'instance $uid (nouvel environnement)"
    compose_instance "$uid" up -d >/dev/null
    ok "Conteneurs recréés."
  else
    warn "--no-restart : variables prises en compte au prochain redémarrage (bin/compose.sh $uid up -d)."
  fi
}

if [[ "$mode" == "unset" ]]; then
  tmp="$(mktemp)"
  grep -vE "^[[:space:]]*(export[[:space:]]+)?(MEDIA_DATABASE_URL|MEDIA_PRODUCTS|ADS_DATABASE_URL)=" "$env_file" > "$tmp" || true
  cat "$tmp" > "$env_file"; rm -f "$tmp"
  chmod 600 "$env_file"
  ok "Source media retirée de $env_file."
  recreate
  exit 0
fi

[[ -n "$products" ]] || die "--product <uid>[,<uid>…] requis (produits media de l'instance ; liste : bin/migrate-from-media.sh $uid --list-products …)."
[[ "$products" =~ ^[A-Za-z0-9_.-]+(,[A-Za-z0-9_.-]+)*$ ]] || die "--product : uid(s) séparés par des virgules attendus."
[[ "$ssl_mode" =~ ^(require|no-verify|disable)$ ]] || die "--ssl-mode attend require, no-verify ou disable."
[[ -z "$ads_host" || -n "$ads_secret" ]] || die "--ads-host s'utilise avec --ads-secret."

if [[ -n "$media_instance" ]]; then
  require_aws
  source_url="$(AWS_REGION="$MEDIA_AWS_REGION" pg_url_from_secret "media-$media_instance" 2> >(sed 's/^/   base media : /' >&2))" || die "Source media illisible (secret media-$media_instance)."
elif [[ -n "$source_url" ]]; then
  [[ "$source_url" =~ ^postgres(ql)?:// ]] || die "--source-url attend une URL postgres://…"
else
  die "Source media non précisée : --media-instance <nom> (ou --source-url / MEDIA_DATABASE_URL)."
fi
if [[ -n "$ads_secret" ]]; then
  require_aws
  ads_url="$(AWS_REGION="$MEDIA_AWS_REGION" pg_url_from_secret "$ads_secret" "$ads_host" 2> >(sed 's/^/   base ads : /' >&2))" || die "Base ads illisible (secret $ads_secret)."
elif [[ -n "$ads_url" ]]; then
  [[ "$ads_url" =~ ^postgres(ql)?:// ]] || die "--ads-url attend une URL postgres://…"
else
  warn "Pas de base ads (--ads-secret / --ads-url) : l'import des campagnes ne fera rien pour cette instance."
fi
# le .env sert aussi à l'interpolation de docker compose : un « $ » non encodé y serait interprété
for v in "$source_url" "$ads_url"; do [[ "$v" != *'$'* ]] || die "URL contenant « \$ » : l'encoder (%24) avant de l'enregistrer."; done

info "Instance $uid : produits media $products"
info "Base media : $(mask "${source_url%%\?*}")"
[[ -z "$ads_url" ]] || info "Base ads : $(mask "${ads_url%%\?*}")"
confirm "Enregistrer cette source dans $env_file ?" || die "Abandon."

env_set "$env_file" MEDIA_DATABASE_URL "${source_url%%\?*}?sslmode=$ssl_mode"
env_set "$env_file" MEDIA_PRODUCTS "$products"
if [[ -n "$ads_url" ]]; then
  env_set "$env_file" ADS_DATABASE_URL "${ads_url%%\?*}?sslmode=$ssl_mode"
fi
unset source_url ads_url
chmod 600 "$env_file"
ok "Source media enregistrée dans $env_file (mode 600)."
recreate
cat <<MSG

$(ok "Suite :")
   - simulation de l'import des campagnes : bin/compose.sh $uid run --rm --no-deps api node scripts/import-media-campaigns.js --dry-run
     (sans --dry-run : import réel, comme le fait le job media_campaigns_import du scheduler chaque heure) ;
   - mode d'envoi : MEDIA_CAMPAIGNS_SCHEDULES (défaut none : contenus créés, rattachés à aucune planification), voir docs/06 § 7.
MSG
