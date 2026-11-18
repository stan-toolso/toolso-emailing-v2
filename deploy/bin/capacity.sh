#!/usr/bin/env bash
# Capacité d'un serveur de bases : dit si l'on peut encore y installer une base, ou s'il faut un nouveau serveur.
#   sudo bin/capacity.sh            rapport lisible, code de sortie 1 si un seuil est dépassé (serveur « plein »)
#   sudo bin/capacity.sh --quiet    n'affiche que les seuils dépassés (cron : un mail part si la sortie n'est pas vide)
# Mesures : disque des données, mémoire disponible, charge (moyenne 15 min par cœur), nombre d'instances,
# connexions PostgreSQL, taux de lecture en cache de PostgreSQL, taille des bases.
# Seuils (env/platform.env) : CAPACITY_MAX_DISK_PCT (60), CAPACITY_MAX_INSTANCES (25), CAPACITY_MAX_CONN_PCT (80),
# CAPACITY_MIN_CACHE_HIT_PCT (99), CAPACITY_MAX_LOAD_PER_CORE (0.7), CAPACITY_MIN_MEM_AVAILABLE_PCT (15).
# La charge est un instantané : pour la charge aux heures d'envoi, lancer le script juste après un créneau
# (le cron installé par bin/install.sh le fait chaque jour à 10 h 15).
source "$(dirname "$0")/lib.sh"
require_docker
load_platform_env

quiet=0
case "${1:-}" in
  --quiet) quiet=1 ;;
  -h|--help) sed -n '2,10p' "$0"; exit 0 ;;
  "") ;;
  *) die "Option inconnue : $1" ;;
esac

max_disk="${CAPACITY_MAX_DISK_PCT:-60}"
max_instances="${CAPACITY_MAX_INSTANCES:-25}"
max_conn="${CAPACITY_MAX_CONN_PCT:-80}"
min_cache="${CAPACITY_MIN_CACHE_HIT_PCT:-99}"
max_load="${CAPACITY_MAX_LOAD_PER_CORE:-0.7}"
min_mem="${CAPACITY_MIN_MEM_AVAILABLE_PCT:-15}"

exceeded=()
line() { [[ "$quiet" == "1" ]] || printf '  %-34s %s\n' "$1" "$2"; }
check() {
  # check libellé valeur affichée dépassé(0|1) seuil
  local mark="ok"
  if [[ "$3" == "1" ]]; then mark="PLEIN (seuil $4)"; exceeded+=("$1 : $2 (seuil $4)"); fi
  line "$1" "$2  [$mark]"
}
gt() { awk -v a="$1" -v b="$2" 'BEGIN { exit !(a > b) }'; }
lt() { awk -v a="$1" -v b="$2" 'BEGIN { exit !(a < b) }'; }

[[ "$quiet" == "1" ]] || info "Capacité de $(hostname) (rôle $SERVER_ROLE, $PUBLIC_HOST)"

# Disque des données (PostgreSQL et fichiers).
disk_pct="$(df -P "$TOOLSO_DATA_DIR" | awk 'NR==2 { gsub("%", "", $5); print $5 }')"
disk_free="$(df -Ph "$TOOLSO_DATA_DIR" | awk 'NR==2 { print $4 }')"
check "Disque ($TOOLSO_DATA_DIR)" "${disk_pct} % utilisés, $disk_free libres" "$(gt "$disk_pct" "$max_disk" && echo 1 || echo 0)" "${max_disk} %"

# Mémoire disponible.
mem_total="$(awk '/^MemTotal:/ { print $2 }' /proc/meminfo)"
mem_avail="$(awk '/^MemAvailable:/ { print $2 }' /proc/meminfo)"
mem_pct=$(( mem_avail * 100 / mem_total ))
check "Mémoire disponible" "${mem_pct} % de $(( mem_total / 1024 / 1024 )) Go" "$(lt "$mem_pct" "$min_mem" && echo 1 || echo 0)" "≥ ${min_mem} %"

# Charge moyenne sur 15 minutes rapportée au nombre de cœurs.
cores="$(nproc)"
load15="$(awk '{ print $3 }' /proc/loadavg)"
load_per_core="$(awk -v l="$load15" -v c="$cores" 'BEGIN { printf "%.2f", l / c }')"
check "Charge 15 min par cœur" "$load_per_core ($load15 sur $cores cœurs)" "$(gt "$load_per_core" "$max_load" && echo 1 || echo 0)" "$max_load"

# Instances.
count="$(list_instances | wc -l)"
if role_has_instances; then
  check "Instances" "$count" "$( [[ "$count" -ge "$max_instances" ]] && echo 1 || echo 0)" "< $max_instances"
fi

# PostgreSQL.
if container_running postgres; then
  max_conns="$(psql_admin -tAc "SHOW max_connections")"
  used_conns="$(psql_admin -tAc "SELECT count(*) FROM pg_stat_activity")"
  conn_pct=$(( used_conns * 100 / max_conns ))
  check "Connexions PostgreSQL" "$used_conns / $max_conns (${conn_pct} %)" "$( [[ "$conn_pct" -ge "$max_conn" ]] && echo 1 || echo 0)" "< ${max_conn} %"
  # Taux de lecture en cache (depuis le dernier redémarrage ou reset des statistiques) : sous 99 %, la RAM ne suffit plus.
  cache_hit="$(psql_admin -tAc "SELECT COALESCE(round(100.0 * sum(blks_hit) / NULLIF(sum(blks_hit) + sum(blks_read), 0), 2), 100) FROM pg_stat_database")"
  check "Lectures servies par le cache PG" "${cache_hit} %" "$(lt "$cache_hit" "$min_cache" && echo 1 || echo 0)" "≥ ${min_cache} %"
  total_size="$(psql_admin -tAc "SELECT pg_size_pretty(sum(pg_database_size(datname))) FROM pg_database WHERE datname NOT IN ('template0', 'template1')")"
  line "Taille totale des bases" "$total_size"
  if [[ "$quiet" == "0" ]]; then
    psql_admin -tAc "SELECT datname || '|' || pg_size_pretty(pg_database_size(datname)) FROM pg_database WHERE datname LIKE 'emailing\_%' ORDER BY pg_database_size(datname) DESC LIMIT 10" \
      | while IFS='|' read -r d sz; do printf '      %-30s %s\n' "$d" "$sz"; done
  fi
else
  warn "PostgreSQL n'est pas démarré : mesures de la base ignorées."
fi

if [[ ${#exceeded[@]} -gt 0 ]]; then
  if [[ "$quiet" == "1" ]]; then
    printf 'Serveur %s (%s) : seuil(s) de capacité dépassé(s), ne plus y ajouter de base :\n' "$(hostname)" "$PUBLIC_HOST"
    printf '  - %s\n' "${exceeded[@]}"
  else
    warn "Serveur plein : ne plus y installer de base, commander un nouveau serveur de bases (docs/09-parc-de-serveurs.md)."
  fi
  exit 1
fi
[[ "$quiet" == "1" ]] || ok "Capacité disponible : une nouvelle base peut être installée sur ce serveur."
exit 0
