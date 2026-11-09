#!/usr/bin/env bash
# Reprise d'une base emailing depuis AWS (RDS PostgreSQL 17 → PostgreSQL de l'instance) et, en option, de la base access.
#
#   sudo bin/migrate-from-aws.sh <uid>                      dump de la base RDS puis restauration dans emailing_<uid>, sync-model, redémarrage
#   sudo bin/migrate-from-aws.sh <uid> --dump-only          dump seulement (fichier dans BACKUP_DIR/aws-migration/)
#   sudo bin/migrate-from-aws.sh <uid> --restore-only <f>   restauration d'un dump déjà fait (aucun appel AWS)
#   sudo bin/migrate-from-aws.sh --access [<uid>]           reprise de pg_toolso_access dans la base access, puis apiEndpoint/enabled des bases
# Options : --no-start (laisser la stack arrêtée après restauration), --skip-checks (pas de comptage des lignes),
#           --dump-dir <dossier>, --jobs <n> (pg_restore parallèle, défaut 2), --yes (aucune confirmation).
#           Profil et région AWS : variables AWS_PROFILE / AWS_REGION (défaut eu-west-1).
# Prérequis : instance créée (bin/add-database.sh <uid> … [--skip-register]) ; CLI aws et jq sur l'hôte ; profil AWS avec
#   secretsmanager:GetSecretValue sur pg_toolso_emailing_<uid> (et pg_toolso_access) ; RDS joignable depuis ce serveur
#   (groupe de sécurité). Les identifiants RDS sont lus dans Secrets Manager et ne sont jamais affichés : ne pas lancer avec set -x.
source "$(dirname "$0")/lib.sh"
require_docker
load_platform_env

PG_IMAGE="${PG_IMAGE:-postgres:17}"
EMAILING_TABLES=(Contact ContactInscription ContactEvent ContactMessage Schedule Content ContentVersion Sender MailRouter Settings Permission ApiKey)
ACCESS_TABLES=(User Entreprise UserEntreprise EmailingDatabase SuperUser)

uid="" dump_only=0 restore_file="" do_access=0 no_start=0 skip_checks=0 dump_dir="" jobs=2
while [[ $# -gt 0 ]]; do
  case "$1" in
    --dump-only) dump_only=1; shift ;;
    --restore-only) restore_file="${2:-}"; shift 2 ;;
    --access) do_access=1; shift ;;
    --no-start) no_start=1; shift ;;
    --skip-checks) skip_checks=1; shift ;;
    --dump-dir) dump_dir="${2:-}"; shift 2 ;;
    --jobs) jobs="${2:-2}"; shift 2 ;;
    --yes) export ASSUME_YES=1; shift ;;
    -h|--help) sed -n '2,13p' "$0"; exit 0 ;;
    --*) die "Option inconnue : $1" ;;
    *) [[ -z "$uid" ]] || die "Un seul identifiant de base attendu."; uid="$1"; shift ;;
  esac
done
[[ -n "$uid" || "$do_access" == "1" ]] || die "Usage : $0 <uid> [--dump-only | --restore-only <fichier>] [--access] (voir --help)"
[[ -z "$uid" ]] || require_instance "$uid"
[[ "$jobs" =~ ^[0-9]+$ && "$jobs" -ge 1 ]] || die "--jobs attend un entier ≥ 1."
if [[ -n "$restore_file" ]]; then
  [[ -f "$restore_file" ]] || die "Dump introuvable : $restore_file"
  [[ -n "$uid" && "$do_access" == "1" ]] && die "--restore-only s'applique à une seule cible : <uid> ou --access."
  [[ "$dump_only" == "0" ]] || die "--dump-only et --restore-only sont exclusifs."
  restore_file="$(cd "$(dirname "$restore_file")" && pwd)/$(basename "$restore_file")"
else
  require_aws
fi
container_running postgres || die "PostgreSQL n'est pas démarré (bin/compose.sh platform up -d)."
load_env "$POSTGRES_ENV"
dump_dir="${dump_dir:-${BACKUP_DIR:-/var/backups/toolso-emailing}/aws-migration}"
install -d -m 0700 "$dump_dir"
dump_dir="$(cd "$dump_dir" && pwd)"
stamp="$(date +%Y-%m-%d_%H%M%S)"
script_start=$(date +%s)

elapsed() { local s=$(( $(date +%s) - $1 )); printf '%d min %02d s' $((s / 60)) $((s % 60)); }

# ---------- source (RDS) ----------
SRC_HOST="" SRC_PORT="" SRC_DB="" SRC_USER=""
load_source_secret() {
  # load_source_secret <nom du secret> : renseigne SRC_* et PGPASSWORD (exporté vers les conteneurs pg_dump/psql, jamais affiché).
  local json
  json="$(aws_secret_json "$1")" || die "Lecture du secret $1 impossible (droit secretsmanager:GetSecretValue ?)."
  SRC_HOST="$(jq -r '.host // empty' <<<"$json")"
  SRC_PORT="$(jq -r '.port // 5432' <<<"$json")"
  SRC_DB="$(jq -r '.database // .dbname // empty' <<<"$json")"
  SRC_USER="$(jq -r '.username // .user // empty' <<<"$json")"
  PGPASSWORD="$(jq -r '.password // empty' <<<"$json")"
  export PGPASSWORD
  unset json
  [[ -n "$SRC_HOST" && -n "$SRC_DB" && -n "$SRC_USER" && -n "$PGPASSWORD" ]] || die "Secret $1 incomplet (host, database, username, password attendus)."
  info "Source : $SRC_USER@$SRC_HOST:$SRC_PORT/$SRC_DB (SSL requis)"
}
# src_run <outil> args… : outil client de l'image postgres:17 contre la source (mot de passe transmis par l'environnement).
src_run() { docker run --rm -e PGPASSWORD -e PGSSLMODE="${PGSSLMODE:-require}" -e PGCONNECT_TIMEOUT=15 "$PG_IMAGE" "$@"; }
src_psql() { src_run psql -v ON_ERROR_STOP=1 -h "$SRC_HOST" -p "$SRC_PORT" -U "$SRC_USER" -d "$SRC_DB" -tAq "$@"; }

# ---------- cible (PostgreSQL de l'instance) ----------
TARGET_DB=""
target_psql() { psql_admin -d "$TARGET_DB" -tAq "$@"; }
# target_restore <dump> <args pg_restore…> : pg_restore parallèle depuis un conteneur jetable relié au réseau toolso
# (pg_restore -j exige un fichier, pas stdin). Le mot de passe superutilisateur vient de env/postgres.env, sans passer par la ligne de commande.
target_restore() {
  local dump="$1"; shift
  docker run --rm --network toolso --env-file "$POSTGRES_ENV" -v "$(dirname "$dump"):/dump:ro" "$PG_IMAGE" \
    sh -c 'PGPASSWORD="$POSTGRES_PASSWORD" exec pg_restore -h postgres -U "${POSTGRES_USER:-postgres}" "$@"' sh "$@" "/dump/$(basename "$dump")"
}

# count_rows <fonction psql> <table…> : affiche table=nombre, une ligne par table ('?' si la table manque).
count_rows() {
  local runner="$1" t n; shift
  for t in "$@"; do
    n="$("$runner" -c "SELECT count(*) FROM \"$t\"" 2>/dev/null)" || n='?'
    printf '%s=%s\n' "$t" "$n"
  done
}
# compare_counts <avant> <après> : tableau des différences.
compare_counts() {
  local t before after diff=0
  printf '   %-22s %14s %14s\n' table source instance
  while IFS='=' read -r t before; do
    after="$(grep -E "^$t=" "$2" | cut -d= -f2)"
    if [[ "$before" == "$after" ]]; then
      printf '   %-22s %14s %14s\n' "$t" "$before" "$after"
    else
      printf '   %-22s %14s %14s  ≠\n' "$t" "$before" "$after"; diff=1
    fi
  done < "$1"
  if [[ "$diff" == "1" ]]; then
    warn "Des nombres de lignes diffèrent : la source a bougé entre le comptage et le dump (gel incomplet ?) ou la restauration est partielle (voir le journal pg_restore)."
  else
    ok "Nombres de lignes identiques entre la source et l'instance."
  fi
}

# ---------- dump ----------
do_dump() {
  # do_dump <secret> <fichier> <fichier des comptages> <tables…>
  local secret="$1" file="$2" counts="$3" t0 version size; shift 3
  load_source_secret "$secret"
  version="$(src_psql -c 'SELECT version()')" || die "Connexion à $SRC_HOST impossible : groupe de sécurité RDS (IP de ce serveur autorisée ?), réseau, identifiants."
  ok "Source joignable : ${version%% on *}"
  size="$(src_psql -c 'SELECT pg_size_pretty(pg_database_size(current_database()))')"
  info "Taille de la base source : $size ; espace libre dans $dump_dir : $(df -h "$dump_dir" | awk 'NR==2 {print $4}') (le dump -Fc est compressé, compter ~20 à 40 % de la taille)."
  if [[ "$skip_checks" == "0" ]]; then
    info "Comptage des lignes de la source (peut prendre plusieurs minutes sur ContactEvent)"
    count_rows src_psql "$@" | tee "$counts"
  fi
  info "pg_dump -Fc → $file"
  t0=$(date +%s)
  if ! src_run pg_dump -h "$SRC_HOST" -p "$SRC_PORT" -U "$SRC_USER" -d "$SRC_DB" -Fc --no-owner --no-privileges > "$file"; then
    rm -f "$file"; die "pg_dump a échoué."
  fi
  chmod 600 "$file"
  [[ -s "$file" ]] || die "Dump vide : $file"
  ok "Dump terminé en $(elapsed "$t0") : $(du -h "$file" | cut -f1)."
  unset PGPASSWORD
}

# ---------- restauration ----------
restore_into() {
  # restore_into <base> <rôle> <dump> [emailing] : recrée la base et y restaure le dump (sans owner ni privilèges, objets au rôle
  # applicatif). Avec « emailing », crée d'abord les prérequis du SQL complémentaire de sync-model (rôle grafanareader, pg_trgm).
  local db="$1" role="$2" dump="$3" kind="${4:-}" log="$3.restore.log" t0 errors
  [[ "$(psql_admin -tAc "SELECT 1 FROM pg_roles WHERE rolname = '$role'")" == "1" ]] || die "Rôle $role absent."
  psql_admin -c "SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE datname = '$db' AND pid <> pg_backend_pid();" >/dev/null
  psql_admin -c "DROP DATABASE IF EXISTS $db;" >/dev/null
  psql_admin -c "CREATE DATABASE $db OWNER $role ENCODING 'UTF8';" >/dev/null
  if [[ "$kind" == "emailing" ]]; then
    psql_admin -c "DO \$\$ BEGIN IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'grafanareader') THEN CREATE ROLE grafanareader NOLOGIN; END IF; END \$\$;" >/dev/null
    psql_admin -d "$db" -c "CREATE EXTENSION IF NOT EXISTS pg_trgm;" >/dev/null
  fi
  info "pg_restore dans $db ($jobs processus ; journal : $log)"
  t0=$(date +%s)
  if target_restore "$dump" -d "$db" --no-owner --no-privileges --role="$role" -j "$jobs" 2> "$log"; then
    ok "Restauration terminée en $(elapsed "$t0")."
  else
    errors="$(grep -c 'pg_restore: error' "$log" || true)"
    if grep 'pg_restore: error' "$log" | grep -qv 'already exists'; then
      warn "pg_restore : $errors erreur(s), certaines autres que « already exists » (extrait) :"
      grep 'pg_restore: error' "$log" | grep -v 'already exists' | head -n 5 >&2
      confirm "Continuer malgré ces erreurs ?" || die "Abandon : base $db incomplète (journal $log)."
    else
      ok "Restauration terminée en $(elapsed "$t0") ($errors avertissement(s) « already exists » ignoré(s))."
    fi
  fi
  psql_admin -d "$db" -c "ALTER SCHEMA public OWNER TO $role; REASSIGN OWNED BY postgres TO $role;" >/dev/null 2>&1 || true
  info "ANALYZE $db"
  psql_admin -d "$db" -c "ANALYZE;" >/dev/null
}

migrate_emailing() {
  local dump="$1" db="emailing_$uid" role="emailing_$uid" after
  after="$dump_dir/emailing_${uid}_${stamp}.counts-instance.txt"
  warn "La base $db de l'instance va être supprimée puis recréée depuis $dump ; la stack toolso-$uid sera arrêtée."
  confirm "Continuer ?" || die "Abandon."
  info "Arrêt de la stack toolso-$uid"
  compose_instance "$uid" stop
  restore_into "$db" "$role" "$dump" emailing
  info "Schéma de la v2 (npm run sync-model : ActionQueue, Mirror, vues)"
  compose_instance "$uid" run --rm --no-deps api npm run sync-model
  TARGET_DB="$db"
  if [[ "$skip_checks" == "0" ]]; then
    info "Comptage des lignes dans l'instance"
    count_rows target_psql "${EMAILING_TABLES[@]}" > "$after"
    if [[ -f "$before_file" ]]; then compare_counts "$before_file" "$after"; else cat "$after"; fi
  fi
  info "Routeurs de mail (webhooks à rebrancher vers $PUBLIC_URL/api/$uid/webhooks/…) :"
  psql_admin -d "$db" -c "SELECT id, name, type, config->>'webhookEndpoint' AS \"webhookEndpoint\" FROM \"MailRouter\" ORDER BY id" || true
  info "Domaines de tracking (DNS à faire pointer vers ce serveur, TRACKING_HOSTS de l'instance) :"
  psql_admin -d "$db" -c "SELECT 'Settings' AS origine, value AS \"trackingDomain\" FROM \"Settings\" WHERE name = 'trackingDomain' UNION SELECT 'Sender', \"trackingDomain\" FROM \"Sender\" WHERE \"trackingDomain\" IS NOT NULL AND \"trackingDomain\" <> '' GROUP BY 1, 2" || true
  if [[ "$no_start" == "0" ]]; then
    info "Démarrage de la stack toolso-$uid"
    compose_instance "$uid" up -d
    if wait_http_ok "api_$uid" http://127.0.0.1:4001/health 30; then ok "api_$uid répond sur /health."; else warn "api_$uid ne répond pas encore (bin/logs.sh $uid api)."; fi
  else
    warn "Stack laissée arrêtée (--no-start) : bin/compose.sh $uid up -d pour démarrer les envois."
  fi
}

migrate_access() {
  local dump="$1" after args=() u
  after="$dump_dir/access_${stamp}.counts-instance.txt"
  warn "La base access de l'instance va être remplacée par celle d'AWS : les utilisateurs, entreprises et bases déclarés"
  warn "localement (dont le superutilisateur de bin/install.sh) disparaissent au profit de ceux d'AWS."
  confirm "Continuer ?" || die "Abandon."
  container_running access && compose_platform stop access
  restore_into access access "$dump"
  info "Schéma access (npm run sync-model)"
  compose_platform run --rm --no-deps access npm run sync-model
  TARGET_DB=access
  if [[ "$skip_checks" == "0" ]]; then
    count_rows target_psql "${ACCESS_TABLES[@]}" > "$after"
    if [[ -f "$before_file" ]]; then compare_counts "$before_file" "$after"; else cat "$after"; fi
  fi
  compose_platform up -d access
  wait_http_ok access http://127.0.0.1:4000/health 30 || warn "access ne répond pas encore (bin/logs.sh platform access)."
  for u in $(list_instances); do args+=(--uid "$u"); done
  if [[ ${#args[@]} -gt 0 ]]; then
    info "apiEndpoint des bases migrées → $PUBLIC_URL/api/<uid>, autres bases désactivées (enabled=false)"
    compose_platform exec -T access npm run set-database-endpoint -- "${args[@]}" --api-base "$PUBLIC_URL/api" --disable-others
  else
    warn "Aucune instance locale : apiEndpoint et enabled inchangés (npm run set-database-endpoint dans le conteneur access)."
  fi
}

# ---------- déroulement ----------
before_file=""
if [[ -n "$uid" ]]; then
  if [[ -n "$restore_file" ]]; then
    dump="$restore_file"
    before_file="${dump%.dump}.counts-source.txt"
  else
    dump="$dump_dir/emailing_${uid}_${stamp}.dump"
    before_file="$dump_dir/emailing_${uid}_${stamp}.counts-source.txt"
    do_dump "pg_toolso_emailing_$uid" "$dump" "$before_file" "${EMAILING_TABLES[@]}"
    [[ "$dump_only" == "0" ]] || ok "Dump prêt : $dump. Restaurer : $0 $uid --restore-only $dump"
  fi
  [[ "$dump_only" == "1" ]] || migrate_emailing "$dump"
fi

if [[ "$do_access" == "1" ]]; then
  if [[ -n "$restore_file" && -z "$uid" ]]; then
    dump="$restore_file"
    before_file="${dump%.dump}.counts-source.txt"
  else
    dump="$dump_dir/access_${stamp}.dump"
    before_file="$dump_dir/access_${stamp}.counts-source.txt"
    do_dump pg_toolso_access "$dump" "$before_file" "${ACCESS_TABLES[@]}"
    [[ "$dump_only" == "0" ]] || ok "Dump access prêt : $dump. Restaurer : $0 --access --restore-only $dump"
  fi
  [[ "$dump_only" == "1" ]] || migrate_access "$dump"
fi

ok "Terminé en $(elapsed "$script_start"). Dumps, comptages et journaux conservés dans $dump_dir (0700)."
