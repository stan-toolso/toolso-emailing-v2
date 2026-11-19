#!/usr/bin/env bash
# Supervision d'un serveur du parc, prévue pour le cron (toutes les 5 minutes) : contrôle l'état du serveur et envoie
# un mail à MONITOR_EMAIL (défaut ADMIN_EMAIL) par le SMTP de la plateforme (SMTP_URL, MAIL_FROM) quand un problème
# apparaît, quand il disparaît, et une fois par jour tant qu'il dure (MONITOR_REMIND_HOURS, 24).
#
#   sudo bin/monitor.sh            # contrôle, mail si l'état change
#   sudo bin/monitor.sh --report   # affiche les contrôles, sans mail
#   sudo bin/monitor.sh --test-mail
#
# Contrôles : conteneurs Docker (arrêtés, en redémarrage, « unhealthy ») ; URL publiques (interface et access sur le
# serveur de contrôle, /api/<uid>/health de chaque base sur un serveur de bases) ; PostgreSQL ; disque des données
# (MONITOR_MAX_DISK_PCT, 85) ; mémoire disponible (MONITOR_MIN_MEM_PCT, 5) ; RAID logiciel ; certificats Let's Encrypt
# (MONITOR_CERT_DAYS, 14 jours) ; sauvegarde de moins de 26 h et copie distante faite.
# État : /var/lib/toolso-emailing/monitor.state ; journal conseillé : /var/log/toolso-emailing-monitor.log.
source "$(dirname "$0")/lib.sh"
require_root
load_platform_env

mode=cron
case "${1:-}" in
  --report) mode=report ;;
  --test-mail) mode=test ;;
  -h|--help) sed -n '2,14p' "$0"; exit 0 ;;
  "") ;;
  *) die "Option inconnue : $1" ;;
esac

state_dir="${TOOLSO_DATA_DIR:-/var/lib/toolso-emailing}"
state_file="$state_dir/monitor.state"
to="${MONITOR_EMAIL:-${ADMIN_EMAIL:-}}"
max_disk="${MONITOR_MAX_DISK_PCT:-85}" min_mem="${MONITOR_MIN_MEM_PCT:-5}" cert_days="${MONITOR_CERT_DAYS:-14}"
remind_hours="${MONITOR_REMIND_HOURS:-24}"
host="$(hostname -s)"

send_mail() {
  # send_mail <sujet> <corps> : SMTP de la plateforme (curl, STARTTLS exigé), identifiants lus dans SMTP_URL.
  local subject="$1" body="$2" url="${SMTP_URL:-}" from addr
  [[ -n "$to" ]] || { warn "MONITOR_EMAIL / ADMIN_EMAIL vide : mail non envoyé."; return 1; }
  [[ "$url" =~ ^smtps?:// && "$url" != *".invalid"* ]] || { warn "SMTP_URL non configuré : mail non envoyé."; return 1; }
  local cfg; cfg="$(mktemp)"; chmod 600 "$cfg"
  # Adresse du serveur sur la sortie ; identifiants écrits (échappés) dans le fichier de configuration de curl.
  local target
  target="$(python3 - "$url" "$cfg" <<'PY'
import sys, urllib.parse as u
p = u.urlsplit(sys.argv[1])
esc = lambda s: s.replace("\\", "\\\\").replace('"', '\\"')
with open(sys.argv[2], "w") as f:
    f.write('user = "%s:%s"\n' % (esc(u.unquote(p.username or "")), esc(u.unquote(p.password or ""))))
print("%s://%s:%s" % (p.scheme, p.hostname, p.port or (465 if p.scheme == "smtps" else 587)))
PY
)" || { rm -f "$cfg"; return 1; }
  from="${MAIL_FROM:-no-reply@$host}"; addr="$(sed -E 's/.*<([^>]+)>.*/\1/' <<<"$from")"
  {
    printf 'From: %s\r\nTo: %s\r\nSubject: =?UTF-8?B?%s?=\r\nDate: %s\r\nMIME-Version: 1.0\r\nContent-Type: text/plain; charset=UTF-8\r\nContent-Transfer-Encoding: 8bit\r\n\r\n' \
      "$from" "$to" "$(printf '%s' "$subject" | base64 -w0)" "$(date -R)"
    printf '%s\n' "$body"
  } > "$cfg.msg"
  local rc=0
  curl -sS --max-time 30 --url "$target" --ssl-reqd --mail-from "$addr" --mail-rcpt "$to" \
    --config "$cfg" --upload-file "$cfg.msg" || rc=$?
  rm -f "$cfg" "$cfg.msg"
  return $rc
}

problems=()
problem() { problems+=("$1"); }
okline() { [[ "$mode" == "report" ]] && printf '  ok   %s\n' "$1"; return 0; }

# --- Conteneurs ---
while IFS='|' read -r name state health restarting; do
  [[ -n "$name" ]] || continue
  if [[ "$state" != "running" || "$restarting" == "true" ]]; then problem "conteneur $name : $state"
  elif [[ "$health" == "unhealthy" ]]; then problem "conteneur $name : unhealthy"
  else okline "conteneur $name ($state${health:+, $health})"; fi
done < <(docker ps -a --format '{{.Names}}' | xargs -r docker inspect -f '{{.Name}}|{{.State.Status}}|{{if .State.Health}}{{.State.Health.Status}}{{end}}|{{.State.Restarting}}' | sed 's|^/||')

# --- PostgreSQL ---
if docker exec postgres pg_isready -U postgres -q 2>/dev/null; then okline "PostgreSQL répond"; else problem "PostgreSQL ne répond pas"; fi

# --- URL publiques ---
check_url() {
  local url="$1" code
  code="$(curl -s -o /dev/null -m 15 -w '%{http_code}' "$url" || true)"
  if [[ "$code" == "200" ]]; then okline "$url"; else problem "$url : HTTP ${code:-000}"; fi
}
if role_has_access; then
  check_url "${PUBLIC_URL}/"
  check_url "${PUBLIC_URL}/access/health"
fi
if role_has_instances; then
  for uid in $(list_instances); do check_url "${PUBLIC_SCHEME}://${PUBLIC_HOST}/api/$uid/health"; done
fi

# --- Disque, mémoire, RAID ---
disk_pct="$(df -P "$state_dir" | awk 'NR==2 { gsub("%", "", $5); print $5 }')"
if [[ "$disk_pct" -gt "$max_disk" ]]; then problem "disque $state_dir à ${disk_pct} % (seuil ${max_disk} %)"; else okline "disque ${disk_pct} %"; fi
mem_pct=$(( $(awk '/^MemAvailable:/ {print $2}' /proc/meminfo) * 100 / $(awk '/^MemTotal:/ {print $2}' /proc/meminfo) ))
if [[ "$mem_pct" -lt "$min_mem" ]]; then problem "mémoire disponible ${mem_pct} % (seuil ${min_mem} %)"; else okline "mémoire disponible ${mem_pct} %"; fi
if [[ -r /proc/mdstat ]]; then
  while read -r md status; do
    if [[ "$status" == *_* ]]; then problem "RAID $md dégradé ($status)"; else okline "RAID $md $status"; fi
  done < <(awk '/^md/ {md=$1} /\[[U_]+\]/ {match($0, /\[[U_]+\]/); print md, substr($0, RSTART, RLENGTH)}' /proc/mdstat)
fi

# --- Certificats ---
for cert in "$TOOLSO_DATA_DIR"/letsencrypt/live/*/cert.pem; do
  [[ -f "$cert" ]] || continue
  name="$(basename "$(dirname "$cert")")"
  if openssl x509 -checkend $(( cert_days * 86400 )) -noout -in "$cert" >/dev/null; then
    okline "certificat $name ($(openssl x509 -enddate -noout -in "$cert" | cut -d= -f2))"
  else
    problem "certificat $name expire le $(openssl x509 -enddate -noout -in "$cert" | cut -d= -f2)"
  fi
done

# --- Sauvegarde ---
backup_dir="${BACKUP_DIR:-/var/backups/toolso-emailing}"
last="$(find "$backup_dir" -mindepth 1 -maxdepth 1 -type d -name '20*' ! -name '*_*_*' -printf '%T@ %p\n' 2>/dev/null | sort -n | tail -n 1 | cut -d' ' -f2-)"
if [[ -z "$last" ]]; then problem "aucune sauvegarde dans $backup_dir"
elif [[ $(( $(date +%s) - $(stat -c %Y "$last") )) -gt $(( 26 * 3600 )) ]]; then problem "dernière sauvegarde de plus de 26 h ($(basename "$last"))"
else okline "sauvegarde $(basename "$last")"; fi
log=/var/log/toolso-emailing-backup.log
if [[ -n "${BACKUP_RCLONE_REMOTE:-}" && -f "$log" ]]; then
  # Dernier passage de backup.sh dans le journal : copie distante terminée ?
  last_run="$(tac "$log" | sed -E 's/\x1b\[[0-9;]*m//g' | awk '/==> Sauvegarde dans/ {exit} {print}' || true)"
  if [[ "$last_run" == *"Copie distante terminée"* ]]; then
    okline "copie distante de la dernière sauvegarde"
  else
    problem "copie distante de la dernière sauvegarde non confirmée ($log)"
  fi
fi

# --- Rapport, ou mail sur changement d'état ---
if [[ "$mode" == "report" ]]; then
  for p in "${problems[@]}"; do printf '  KO   %s\n' "$p"; done
  [[ ${#problems[@]} -eq 0 ]] && ok "$host : tout va bien." || warn "$host : ${#problems[@]} problème(s)."
  exit 0
fi
if [[ "$mode" == "test" ]]; then
  send_mail "[toolso-emailing] $host : mail de test de la supervision" \
    "Mail de test envoyé par deploy/bin/monitor.sh sur $host ($PUBLIC_HOST). Problèmes en cours : ${#problems[@]}." \
    && ok "Mail de test envoyé à $to."
  exit 0
fi

current="$(printf '%s\n' "${problems[@]}" | sed '/^$/d' | sort)"
previous="" last_sent=0
if [[ -f "$state_file" ]]; then
  last_sent="$(head -n 1 "$state_file")"; previous="$(tail -n +2 "$state_file")"
fi
now="$(date +%s)" subject="" body=""
if [[ "$current" != "$previous" ]]; then
  if [[ -z "$current" ]]; then
    subject="[toolso-emailing] $host : retour à la normale"
    body="Plus aucun problème détecté sur $host ($PUBLIC_HOST).

Problèmes résolus :
$(sed 's/^/  - /' <<<"$previous")"
  else
    subject="[toolso-emailing] $host : $(wc -l <<<"$current") problème(s)"
    new="$(comm -13 <(printf '%s\n' "$previous" | sed '/^$/d') <(printf '%s\n' "$current"))"
    gone="$(comm -23 <(printf '%s\n' "$previous" | sed '/^$/d') <(printf '%s\n' "$current"))"
    body="Problèmes en cours sur $host ($PUBLIC_HOST) :
$(sed 's/^/  - /' <<<"$current")
${new:+
Nouveaux :
$(sed 's/^/  - /' <<<"$new")}${gone:+

Résolus :
$(sed 's/^/  - /' <<<"$gone")}"
  fi
elif [[ -n "$current" && $(( now - last_sent )) -ge $(( remind_hours * 3600 )) ]]; then
  subject="[toolso-emailing] $host : $(wc -l <<<"$current") problème(s) toujours en cours"
  body="Rappel : problèmes toujours en cours sur $host ($PUBLIC_HOST) :
$(sed 's/^/  - /' <<<"$current")"
fi

if [[ -n "$subject" ]]; then
  body="$body

Détail : sudo $DEPLOY_DIR/bin/monitor.sh --report ; journaux : bin/logs.sh, /var/log/toolso-emailing-*.log"
  if send_mail "$subject" "$body"; then
    printf '%s\n%s\n' "$now" "$current" > "$state_file"
    echo "$(date -Iseconds) mail envoyé : $subject"
  else
    echo "$(date -Iseconds) ÉCHEC de l'envoi : $subject" >&2
  fi
elif [[ "$current" != "$previous" ]]; then
  printf '%s\n%s\n' "$last_sent" "$current" > "$state_file"
fi
