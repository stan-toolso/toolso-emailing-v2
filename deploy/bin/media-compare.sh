#!/usr/bin/env bash
# Tableau comparatif hebdomadaire base migrée / base témoin pendant la bascule de produits toolso-media vers des instances v2
# (voir docs/06-migration-depuis-media.md § 7). Lecture seule, des deux côtés.
#
#   sudo bin/media-compare.sh --media-instance <nom> --migrated <uid>=<produit>[@AAAA-MM-JJ] … --witness <produit> …
#                             [--weeks 8] [--format csv|json|table] [--revenue <fichier.csv>] [--output <fichier>]
#
#   --migrated <uid>=<produit>[@date]  produit media basculé dans l'instance v2 <uid> (plusieurs fois possible) ; date de
#                                      bascule facultative : par défaut, premier envoi v2 de l'instance (aucun = pas encore
#                                      basculé, tout est lu dans media)
#   --witness <produit>                produit témoin resté sur media (uid ou id media, plusieurs fois possible)
#   --source-url <url> | --media-instance <nom>   base media, comme bin/migrate-from-media.sh (MEDIA_DATABASE_URL accepté)
#   --weeks N            semaines complètes ou en cours à afficher (défaut 8), lundi → dimanche, fuseau TZ (défaut Europe/Paris)
#   --revenue <csv>      CA fourni par le client : lignes « produit,semaine (lundi AAAA-MM-JJ),montant » ; sinon colonne vide
#   --format             csv (défaut), json, ou table (lisible en console)
#
# Mesures par semaine d'envoi (cohorte : un clic du lundi suivant sur un mail du dimanche compte pour la semaine du mail) :
#   envois (hors BAT), délivrés, ouvertures (uniques), clics (uniques), désabonnements, plaintes, hard bounces (+ contact
#   bounces), soft bounces ; taux rapportés aux envois ; CA et CA pour 1 000 envois si --revenue.
# Source par ligne : « media » (témoins, et produits migrés avant la bascule), « v2 » (après), « media+v2 » (semaine de la
#   bascule, les deux additionnés). Côté v2, seuls les envois à partir de la date de bascule (tests antérieurs exclus) : table ContactContent (un envoi par ligne, mêmes drapeaux que media.email) ;
#   la reprise n'y écrit rien, donc aucun double compte avec l'historique repris.
source "$(dirname "$0")/lib.sh"
require_docker
load_platform_env

PG_IMAGE="${PG_IMAGE:-postgres:17}"
MEDIA_AWS_REGION="${MEDIA_AWS_REGION:-eu-west-3}"
TZ_NAME="${TZ:-Europe/Paris}"

source_url="${MEDIA_DATABASE_URL:-}" media_instance="" weeks=8 format=csv revenue_file="" output=""
migrated=() witnesses=()
while [[ $# -gt 0 ]]; do
  case "$1" in
    --migrated) migrated+=("${2:-}"); shift 2 ;;
    --witness) witnesses+=("${2:-}"); shift 2 ;;
    --source-url) source_url="${2:-}"; shift 2 ;;
    --media-instance) media_instance="${2:-}"; shift 2 ;;
    --weeks) weeks="${2:-}"; shift 2 ;;
    --format) format="${2:-}"; shift 2 ;;
    --revenue) revenue_file="${2:-}"; shift 2 ;;
    --output) output="${2:-}"; shift 2 ;;
    -h|--help) sed -n '2,25p' "$0"; exit 0 ;;
    *) die "Option inconnue : $1 (voir --help)" ;;
  esac
done
[[ ${#migrated[@]} -gt 0 || ${#witnesses[@]} -gt 0 ]] || die "Préciser au moins un --migrated <uid>=<produit> ou un --witness <produit>."
[[ "$weeks" =~ ^[1-9][0-9]*$ ]] || die "--weeks attend un entier ≥ 1."
[[ "$format" =~ ^(csv|json|table)$ ]] || die "--format attend csv, json ou table."
[[ -z "$revenue_file" || -r "$revenue_file" ]] || die "Fichier de CA illisible : $revenue_file"
require_cmd jq
container_running postgres || die "PostgreSQL n'est pas démarré (bin/compose.sh platform up -d)."

# ---------- source media (URL uniquement dans l'environnement, jamais affichée) ----------
if [[ -n "$media_instance" ]]; then
  [[ -z "$source_url" ]] || die "--media-instance et --source-url sont exclusifs."
  require_aws
  json="$(AWS_REGION="$MEDIA_AWS_REGION" aws_secret_json "media-$media_instance")" || die "Lecture du secret media-$media_instance impossible."
  src_host="$(jq -r '.host // empty' <<<"$json")"; src_port="$(jq -r '.port // 5432' <<<"$json")"
  src_db="$(jq -r '.database // .dbname // empty' <<<"$json")"; src_user="$(jq -r '.username // .user // empty | @uri' <<<"$json")"
  src_pass="$(jq -r '.password // empty | @uri' <<<"$json")"
  unset json
  [[ -n "$src_host" && -n "$src_db" && -n "$src_user" && -n "$src_pass" ]] || die "Secret media-$media_instance incomplet."
  source_url="postgres://$src_user:$src_pass@$src_host:$src_port/$src_db"
  unset src_pass
elif [[ -z "$source_url" ]]; then
  die "Source media non précisée : --media-instance <nom> ou --source-url <url> (ou MEDIA_DATABASE_URL)."
fi
export MEDIA_LIBPQ_URL="${source_url%%\?*}?sslmode=require"
unset source_url

media_psql() {
  # lecture seule : transaction en lecture seule imposée par PGOPTIONS
  docker run --rm -i -e MEDIA_LIBPQ_URL -e PGCONNECT_TIMEOUT=15 -e PGOPTIONS='-c default_transaction_read_only=on -c statement_timeout=600000' \
    "$PG_IMAGE" sh -c 'exec psql "$MEDIA_LIBPQ_URL" -X -q -v ON_ERROR_STOP=1 -t -A -F "|" "$@"' psql "$@"
}
v2_psql() {
  local uid="$1"; shift
  docker exec -i -e PGOPTIONS='-c default_transaction_read_only=on' postgres psql -U postgres -d "emailing_$uid" -X -q -v ON_ERROR_STOP=1 -t -A -F '|' "$@"
}
sql_lit() { printf "'%s'" "${1//\'/\'\'}"; }

# ---------- paramètres ----------
declare -A cutover=() product_of=()
uids=() products=()
for m in "${migrated[@]}"; do
  [[ "$m" =~ ^([a-z0-9][a-z0-9_-]*)=([^@]+)(@([0-9]{4}-[0-9]{2}-[0-9]{2}))?$ ]] || die "--migrated attend <uid>=<produit>[@AAAA-MM-JJ] : $m"
  uid="${BASH_REMATCH[1]}"; product="${BASH_REMATCH[2]}"; cutover[$uid]="${BASH_REMATCH[4]:-}"
  require_instance "$uid"
  uids+=("$uid"); products+=("$product"); product_of[$uid]="$product"
done
products+=("${witnesses[@]}")
since_sql="date_trunc('week', now() AT TIME ZONE $(sql_lit "$TZ_NAME")) - interval '$((weeks - 1)) weeks'"

# produits media : uid/id → id, uid, nom
plist=""
for p in "${products[@]}"; do plist+="${plist:+,}$(sql_lit "$p")"; done
products_csv="$(media_psql -c "SELECT id, uid, name FROM product WHERE uid IN ($plist) OR id::text IN ($plist) ORDER BY id")" \
  || die "Lecture des produits media impossible (réseau, identifiants, groupe de sécurité ?)."
products_json="$(jq -Rn '[inputs | select(length>0) | split("|") | {id: (.[0]|tonumber), uid: .[1], name: (.[2:]|join("|"))}]' <<<"$products_csv")"
for p in "${products[@]}"; do
  jq -e --arg p "$p" 'any(.[]; .uid == $p or (.id|tostring) == $p)' <<<"$products_json" >/dev/null || die "Produit media inconnu : $p"
done
ids="$(jq -r '[.[].id] | join(",")' <<<"$products_json")"

# ---------- media : envois par produit et semaine ----------
media_csv="$(media_psql -c "
SELECT e.product_id,
       to_char(date_trunc('week', e.sent_at AT TIME ZONE $(sql_lit "$TZ_NAME")), 'YYYY-MM-DD') AS week,
       count(*) AS sends,
       count(*) FILTER (WHERE e.delivered) AS delivered,
       count(*) FILTER (WHERE e.opened) AS opens,
       count(*) FILTER (WHERE e.clicked) AS clicks,
       count(*) FILTER (WHERE e.unsubcribed) AS unsubs,
       count(*) FILTER (WHERE e.complainted) AS complaints,
       count(*) FILTER (WHERE e.hard_bounced OR e.contact_bounced) AS hard_bounces,
       count(*) FILTER (WHERE e.soft_bounced) AS soft_bounces
  FROM email e
 WHERE e.product_id IN ($ids) AND e.sent AND NOT coalesce(e.is_bat, false)
   AND e.sent_at >= ($since_sql) AT TIME ZONE $(sql_lit "$TZ_NAME")
 GROUP BY 1, 2")" || die "Lecture des envois media impossible."

# ---------- v2 : envois par instance et semaine (ContactContent) ----------
v2_rows="[]"
for uid in "${uids[@]}"; do
  if [[ -z "${cutover[$uid]}" ]]; then
    first="$(v2_psql "$uid" -c "SELECT to_char(min(\"createdAt\") AT TIME ZONE $(sql_lit "$TZ_NAME"), 'YYYY-MM-DD') FROM \"ContactContent\" WHERE \"messageId\" IS NOT NULL" | tail -n 1)"
    cutover[$uid]="$first"
  fi
  csv="$(v2_psql "$uid" -c "
SELECT to_char(date_trunc('week', c.\"createdAt\" AT TIME ZONE $(sql_lit "$TZ_NAME")), 'YYYY-MM-DD') AS week,
       count(*) AS sends,
       count(*) FILTER (WHERE c.delivered) AS delivered,
       count(*) FILTER (WHERE c.opened) AS opens,
       count(*) FILTER (WHERE c.clicked) AS clicks,
       count(*) FILTER (WHERE c.unsubcribed) AS unsubs,
       count(*) FILTER (WHERE c.complainted) AS complaints,
       count(*) FILTER (WHERE c.hard_bounced OR c.contact_bounced) AS hard_bounces,
       count(*) FILTER (WHERE c.soft_bounced) AS soft_bounces
  FROM \"ContactContent\" c
 WHERE c.\"messageId\" IS NOT NULL
   AND c.\"createdAt\" >= ($since_sql) AT TIME ZONE $(sql_lit "$TZ_NAME")
   ${cutover[$uid]:+AND c.\"createdAt\" >= $(sql_lit "${cutover[$uid]}")::timestamp AT TIME ZONE $(sql_lit "$TZ_NAME")}
 GROUP BY 1")" || die "Lecture de l'instance $uid impossible."
  v2_rows="$(jq --arg uid "$uid" --arg product "${product_of[$uid]}" --arg cutover "${cutover[$uid]}" --arg csv "$csv" \
    '. + ($csv | split("\n") | map(select(length>0) | split("|")) | map({instance: $uid, product: $product, cutover: $cutover, week: .[0],
       sends: (.[1]|tonumber), delivered: (.[2]|tonumber), opens: (.[3]|tonumber), clicks: (.[4]|tonumber), unsubs: (.[5]|tonumber),
       complaints: (.[6]|tonumber), hard_bounces: (.[7]|tonumber), soft_bounces: (.[8]|tonumber)}))' <<<"$v2_rows")"
done

# ---------- CA fourni par le client ----------
revenue_json="[]"
if [[ -n "$revenue_file" ]]; then
  revenue_json="$(grep -v '^[[:space:]]*$' "$revenue_file" | tr -d '\r' | jq -Rn '[inputs | split(",") | select(.[2] != null and (.[2]|test("^ *-?[0-9]+([.][0-9]+)? *$"))) | {product: (.[0]|gsub(" ";"")), week: (.[1]|gsub(" ";"")), revenue: (.[2]|gsub(" ";"")|tonumber)}]')"
fi

# ---------- fusion ----------
# lundis des N dernières semaines, calculés par PostgreSQL local (même fuseau que les requêtes)
mondays="$(docker exec -i postgres psql -U postgres -X -q -t -A -c "SELECT to_char(d, 'YYYY-MM-DD') FROM generate_series(($since_sql), date_trunc('week', now() AT TIME ZONE $(sql_lit "$TZ_NAME")), interval '1 week') d ORDER BY d")"
mondays_json="$(jq -Rn '[inputs | select(length>0)]' <<<"$mondays")"
migrated_json="$(for uid in "${uids[@]}"; do jq -n --arg uid "$uid" --arg p "${product_of[$uid]}" --arg c "${cutover[$uid]}" '{instance: $uid, product: $p, cutover: $c}'; done | jq -s .)"
witness_json="$(printf '%s\n' "${witnesses[@]}" | jq -Rn '[inputs | select(length>0)]')"

report="$(jq -n \
  --argjson products "$products_json" --argjson mondays "$mondays_json" --argjson migrated "$migrated_json" \
  --argjson witnesses "$witness_json" --argjson v2 "$v2_rows" --argjson revenue "$revenue_json" \
  --arg media_csv "$media_csv" --arg generated "$(date -Iseconds)" --arg tz "$TZ_NAME" '
  def num: tonumber;
  def prod($k): ($products | map(select(.uid == $k or (.id|tostring) == $k)) | first);
  def zero: {sends:0, delivered:0, opens:0, clicks:0, unsubs:0, complaints:0, hard_bounces:0, soft_bounces:0};
  def add($a; $b): reduce (zero|keys[]) as $k ({}; .[$k] = (($a[$k] // 0) + ($b[$k] // 0)));
  def rate($n; $d): if $d > 0 then (($n / $d * 10000) | round / 100) else null end;
  ($media_csv | split("\n") | map(select(length>0) | split("|")) | map({product_id: (.[0]|num), week: .[1], sends: (.[2]|num), delivered: (.[3]|num),
     opens: (.[4]|num), clicks: (.[5]|num), unsubs: (.[6]|num), complaints: (.[7]|num), hard_bounces: (.[8]|num), soft_bounces: (.[9]|num)})) as $media
  | ([ $migrated[] | . as $m | prod($m.product) as $p | {role: "migrated", instance: $m.instance, cutover: (if $m.cutover == "" then null else $m.cutover end), p: $p} ]
     + [ $witnesses[] | prod(.) as $p | {role: "witness", instance: null, cutover: null, p: $p} ]) as $lines
  | [ $lines[] as $l | $mondays[] as $w
      | ($media | map(select(.product_id == $l.p.id and .week == $w)) | first // zero) as $mr
      | (if $l.role == "migrated" then ($v2 | map(select(.instance == $l.instance and .week == $w)) | first // zero) else zero end) as $vr
      | (if ($mr.sends > 0) and ($vr.sends > 0) then "media+v2" elif $vr.sends > 0 then "v2" elif $mr.sends > 0 then "media" else "-" end) as $src
      | add($mr; $vr) as $t
      | ($revenue | map(select((.product == $l.p.uid or .product == ($l.p.id|tostring)) and .week == $w)) | first | .revenue // null) as $rev
      | {week: $w, product: $l.p.uid, product_name: $l.p.name, role: $l.role, instance: $l.instance, cutover: $l.cutover, source: $src}
        + $t
        + {open_rate: rate($t.opens; $t.sends), click_rate: rate($t.clicks; $t.sends), click_to_open: rate($t.clicks; $t.opens),
           unsub_rate: rate($t.unsubs; $t.sends), complaint_rate: rate($t.complaints; $t.sends), hard_bounce_rate: rate($t.hard_bounces; $t.sends),
           revenue: $rev, revenue_per_1000: (if $rev != null and $t.sends > 0 then (($rev / $t.sends * 1000 * 100) | round / 100) else null end)} ]
  | {generated_at: $generated, timezone: $tz, weeks: $mondays, migrated: $migrated, witnesses: $witnesses, rows: .}')"

columns='week product role instance source sends delivered opens clicks unsubs complaints hard_bounces soft_bounces open_rate click_rate click_to_open unsub_rate complaint_rate hard_bounce_rate revenue revenue_per_1000'
render() {
  case "$format" in
    json) jq . <<<"$report" ;;
    csv)
      jq -r --arg cols "$columns" '($cols | split(" ")) as $c | ($c | join(",")), (.rows[] | [ .[$c[]] ] | map(. // "" | tostring) | join(","))' <<<"$report" ;;
    table)
      jq -r --arg cols "$columns" '($cols | split(" ")) as $c | ($c | join("\t")), (.rows[] | [ .[$c[]] ] | map(. // "" | tostring) | join("\t"))' <<<"$report" | column -t -s $'\t' ;;
  esac
}
if [[ -n "$output" ]]; then
  render > "$output"
  info "Tableau écrit dans $output"
else
  render
fi
