#!/usr/bin/env bash
# Reprise des miroirs d'une base (table DynamoDB toolso-emailing-mirrors, corps dans S3 toolso-emailing-mirror-body) vers la
# table Mirror de l'instance : page « voir en ligne » et rattachement des clics / ouvertures / désabonnements au message d'origine.
#
#   sudo bin/migrate-mirrors.sh <uid> [--days N] [--with-bodies] [--segments N] [--export-only | --import-only]
#                                     [--export-dir <dossier>] [--include-expired] [--keep-export] [--yes]
# --days N        seulement les mails envoyés depuis N jours (défaut 30 : tous les miroirs non expirés ; TTL DynamoDB = 30 j)
# --with-bodies   télécharge aussi les corps stockés dans S3 (un objet par miroir ; long). Inutile en général : les mails déjà
#                 envoyés pointent vers l'ancienne page miroir AWS, seul le rattachement mirrorId → messageId sert à l'instance.
# --segments N    scans DynamoDB parallèles (défaut 4). Le scan lit toute la table (≈ 9 Go, 33 M d'items toutes bases) :
#                 compter 15 à 60 min et ~1 M d'unités de lecture (~0,30 $) par passage, quel que soit le uid filtré.
# Alternative : ne rien migrer. Les miroirs expirent en 30 jours ; seuls les événements de tracking des mails envoyés avant la
# bascule perdent leur rattachement au message (ils restent comptés sur le contact).
# Idempotent : l'import est un upsert ; l'export écrase le dossier précédent (sauf --import-only).
source "$(dirname "$0")/lib.sh"
require_docker
load_platform_env

TABLE="${MIRRORS_TABLE:-toolso-emailing-mirrors}"
BUCKET="${MIRRORS_BUCKET:-toolso-emailing-mirror-body}"
ITEMS_PER_FILE="${ITEMS_PER_FILE:-20000}"
PARALLEL_DOWNLOADS="${PARALLEL_DOWNLOADS:-8}"

uid="" days=30 with_bodies=0 segments=4 export_only=0 import_only=0 export_dir="" include_expired=0 keep_export=0
while [[ $# -gt 0 ]]; do
  case "$1" in
    --days) days="${2:-30}"; shift 2 ;;
    --with-bodies) with_bodies=1; shift ;;
    --segments) segments="${2:-4}"; shift 2 ;;
    --export-only) export_only=1; shift ;;
    --import-only) import_only=1; shift ;;
    --export-dir) export_dir="${2:-}"; shift 2 ;;
    --include-expired) include_expired=1; shift ;;
    --keep-export) keep_export=1; shift ;;
    --yes) export ASSUME_YES=1; shift ;;
    -h|--help) sed -n '2,16p' "$0"; exit 0 ;;
    --*) die "Option inconnue : $1" ;;
    *) [[ -z "$uid" ]] || die "Un seul identifiant de base attendu."; uid="$1"; shift ;;
  esac
done
[[ -n "$uid" ]] || die "Usage : $0 <uid> [options] (voir --help)"
require_instance "$uid"
[[ "$days" =~ ^[0-9]+$ && "$days" -ge 1 && "$days" -le 30 ]] || die "--days attend un entier entre 1 et 30."
[[ "$segments" =~ ^[0-9]+$ && "$segments" -ge 1 && "$segments" -le 32 ]] || die "--segments attend un entier entre 1 et 32."
[[ "$export_only" == "1" && "$import_only" == "1" ]] && die "--export-only et --import-only sont exclusifs."
[[ "$import_only" == "1" ]] || require_aws

# Le dossier d'export vit sous les fichiers de l'instance (propriété de l'utilisateur node, uid 1000, comme le conteneur api
# qui le lira) et n'est pas exposé par nginx (seul exports/ l'est).
export_dir="${export_dir:-$TOOLSO_DATA_DIR/files/$uid/migration/mirrors}"
pages_dir="$export_dir/pages"
bodies_dir="$export_dir/bodies"
script_start=$(date +%s)
elapsed() { local s=$(( $(date +%s) - $1 )); printf '%d min %02d s' $((s / 60)) $((s % 60)); }

# ---------- 1. Export DynamoDB (scan parallèle filtré, paginé) ----------
scan_segment() {
  # scan_segment <segment> : écrit page-<segment>-<n>.json jusqu'à épuisement (NextToken), ou .failed-<segment> en cas d'erreur.
  local seg="$1" n=0 token="" out count
  while :; do
    n=$((n + 1))
    out="$pages_dir/page-$seg-$(printf '%05d' "$n").json"
    local args=(dynamodb scan --table-name "$TABLE" --segment "$seg" --total-segments "$segments"
      --filter-expression 'ResourceUid = :uid AND ExpDate > :minExp'
      --expression-attribute-values "{\":uid\":{\"S\":\"$uid\"},\":minExp\":{\"N\":\"$min_exp\"}}"
      --page-size 1000 --max-items "$ITEMS_PER_FILE" --output json)
    [[ -n "$token" ]] && args+=(--starting-token "$token")
    if ! aws_cli "${args[@]}" > "$out.tmp" 2> "$pages_dir/.stderr-$seg"; then
      mv "$pages_dir/.stderr-$seg" "$pages_dir/.failed-$seg"; rm -f "$out.tmp"; return 1
    fi
    mv "$out.tmp" "$out"
    count="$(jq '.Count // 0' "$out")"
    token="$(jq -r '.NextToken // empty' "$out")"
    printf '   segment %s : fichier %s, %s miroir(s)\n' "$seg" "$n" "$count"
    [[ -n "$token" ]] || break
  done
  rm -f "$pages_dir/.stderr-$seg"
}

if [[ "$import_only" == "0" ]]; then
  if [[ -d "$pages_dir" ]] && compgen -G "$pages_dir/page-*.json" >/dev/null; then
    warn "Un export existe déjà dans $pages_dir : il sera remplacé (ou relancer avec --import-only)."
    confirm "Refaire l'export ?" || die "Abandon."
    rm -rf "$pages_dir"
  fi
  install -d -m 0755 "$export_dir" "$pages_dir"
  # ExpDate = date d'envoi + 30 j : les mails envoyés depuis N jours ont ExpDate > maintenant + (30 − N) j
  min_exp=$(( $(date +%s) + (30 - days) * 24 * 3600 ))
  info "Export DynamoDB $TABLE pour ResourceUid=$uid (mails des $days derniers jours), $segments segments parallèles → $pages_dir"
  t0=$(date +%s)
  pids=()
  for seg in $(seq 0 $((segments - 1))); do
    scan_segment "$seg" &
    pids+=($!)
  done
  for pid in "${pids[@]}"; do wait "$pid" || true; done
  if compgen -G "$pages_dir/.failed-*" >/dev/null; then
    cat "$pages_dir"/.failed-* >&2
    die "Au moins un segment du scan a échoué (voir ci-dessus) ; relancer l'export."
  fi
  exported="$(jq -s 'map(.Count // 0) | add // 0' "$pages_dir"/page-*.json)"
  ok "Export terminé en $(elapsed "$t0") : $exported miroirs dans $(find "$pages_dir" -name 'page-*.json' | wc -l) fichiers ($(du -sh "$pages_dir" | cut -f1))."

  # ---------- 2. Corps stockés dans S3 (optionnel) ----------
  if [[ "$with_bodies" == "1" ]]; then
    install -d -m 0755 "$bodies_dir"
    jq -r '.Items[]? | select(.CompressedBody == null) | .mirrorId.S' "$pages_dir"/page-*.json | sort -u > "$export_dir/bodies.keys"
    : > "$export_dir/bodies.missing"; : > "$export_dir/bodies.failed"
    total="$(wc -l < "$export_dir/bodies.keys")"
    info "$total miroirs sans corps dans l'item : recherche dans s3://$BUCKET ($PARALLEL_DOWNLOADS téléchargements parallèles)"
    fetch_body() {
      # fetch_body <mirrorId> : objet S3 → bodies/<mirrorId> ; absent (mail sans lien miroir) → bodies.missing ; autre erreur → bodies.failed
      local key="$1"
      local err="$bodies_dir/$key.err"
      [[ -s "$bodies_dir/$key" ]] && return 0
      if aws --region "$AWS_REGION" s3api get-object --bucket "$BUCKET" --key "$key" "$bodies_dir/$key.tmp" >/dev/null 2> "$err"; then
        mv "$bodies_dir/$key.tmp" "$bodies_dir/$key"; rm -f "$err"
      elif grep -q 'NoSuchKey\|Not Found\|404' "$err"; then
        rm -f "$bodies_dir/$key.tmp" "$err"; echo "$key" >> "$export_dir/bodies.missing"
      else
        rm -f "$bodies_dir/$key.tmp"; echo "$key" >> "$export_dir/bodies.failed"
      fi
    }
    export -f fetch_body
    export bodies_dir export_dir BUCKET AWS_REGION
    t0=$(date +%s)
    # shellcheck disable=SC2016  # « $1 » est évalué par le bash lancé par xargs
    xargs -a "$export_dir/bodies.keys" -r -P "$PARALLEL_DOWNLOADS" -I{} bash -c 'fetch_body "$1"' _ {}
    ok "Corps : $(find "$bodies_dir" -type f ! -name '*.err' | wc -l) téléchargés, $(wc -l < "$export_dir/bodies.missing") absents de S3 (normal : mail sans lien miroir), $(wc -l < "$export_dir/bodies.failed") en erreur ($(elapsed "$t0"))."
    [[ -s "$export_dir/bodies.failed" ]] && warn "Relancer le script pour réessayer les corps en erreur ($export_dir/bodies.failed)."
  fi
  chown -R 1000:1000 "$export_dir" 2>/dev/null || warn "chown du dossier d'export impossible (lancer en root) : le conteneur api (uid 1000) doit pouvoir le lire."
  if [[ "$export_only" == "1" ]]; then
    ok "Export prêt dans $export_dir. Importer : $0 $uid --import-only${with_bodies:+ --with-bodies}"
    exit 0
  fi
fi

# ---------- 3. Import dans la table Mirror ----------
if ! compgen -G "$pages_dir/page-*.json" >/dev/null; then
  die "Aucun export dans $pages_dir (lancer sans --import-only)."
fi
chown -R 1000:1000 "$export_dir" 2>/dev/null || true
import_args=(--dir /migration/pages)
[[ -d "$bodies_dir" ]] && import_args+=(--bodies-dir /migration/bodies)
[[ "$include_expired" == "1" ]] && import_args+=(--include-expired)
info "Import dans la table Mirror de emailing_$uid (conteneur api, node scripts/import-mirrors.js ${import_args[*]})"
t0=$(date +%s)
compose_instance "$uid" run --rm --no-deps -v "$export_dir:/migration:ro" api node scripts/import-mirrors.js "${import_args[@]}"
ok "Import terminé en $(elapsed "$t0")."
if [[ "$keep_export" == "0" ]]; then
  rm -rf "$export_dir"
  ok "Export supprimé ($export_dir) ; --keep-export pour le conserver."
fi
ok "Miroirs de $uid migrés en $(elapsed "$script_start")."
