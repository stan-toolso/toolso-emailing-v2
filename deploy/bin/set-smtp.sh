#!/usr/bin/env bash
# Règle le SMTP des mails de la plateforme (invitations, mot de passe oublié, BAT, alertes, exports) sur ce serveur :
# SMTP_URL et MAIL_FROM dans env/platform.env (valeurs reprises par les bases créées ensuite), env/access.env (serveur
# avec access) et le .env de chaque base, puis recrée les conteneurs concernés.
#
#   sudo bin/set-smtp.sh --host email-smtp.eu-west-1.amazonaws.com --from "Toolso Emailing <no-reply@exemple.com>"
#
# L'utilisateur et le mot de passe SMTP sont demandés au clavier (le mot de passe ne s'affiche pas) ; ils peuvent aussi
# venir de SMTP_USER / SMTP_PASSWORD. Ils sont encodés pour l'URL et jamais affichés.
# Options : --port (défaut 587, STARTTLS), --no-restart (ne recrée pas les conteneurs), --check (affiche l'hôte et
# l'expéditeur configurés, sans les identifiants).
source "$(dirname "$0")/lib.sh"
require_root

smtp_host="" smtp_port=587 mail_from="" restart=1 check=0
while [[ $# -gt 0 ]]; do
  case "$1" in
    --host) smtp_host="$2"; shift 2 ;;
    --port) smtp_port="$2"; shift 2 ;;
    --from) mail_from="$2"; shift 2 ;;
    --no-restart) restart=0; shift ;;
    --check) check=1; shift ;;
    -h|--help) sed -n '2,11p' "$0"; exit 0 ;;
    *) die "Option inconnue : $1" ;;
  esac
done
load_platform_env

# Fichiers qui portent SMTP_URL / MAIL_FROM sur ce serveur.
files=("$PLATFORM_ENV")
role_has_access && files+=("$ACCESS_ENV")
for uid in $(list_instances); do files+=("$(instance_dir "$uid")/.env"); done

if [[ "$check" == "1" ]]; then
  for f in "${files[@]}"; do
    url="$(env_get "$f" SMTP_URL)"
    printf '  %-60s %s  %s\n' "$f" "$(sed -E 's|^(smtps?://)[^@]*@|\1***@|' <<<"$url")" "$(env_get "$f" MAIL_FROM)"
  done
  exit 0
fi

[[ -n "$smtp_host" ]] || die "--host requis (ex. email-smtp.eu-west-1.amazonaws.com)."
[[ -n "$mail_from" ]] || die "--from requis (ex. \"Toolso Emailing <no-reply@exemple.com>\")."
[[ "$mail_from" != *'"'* ]] || die "--from ne doit pas contenir de guillemet."
user="${SMTP_USER:-}" password="${SMTP_PASSWORD:-}"
[[ -n "$user" ]] || read -r -p "Utilisateur SMTP : " user
[[ -n "$password" ]] || { read -r -s -p "Mot de passe SMTP (n'apparaît pas) : " password; echo; }
[[ -n "$user" && -n "$password" ]] || die "Utilisateur et mot de passe SMTP requis."

require_cmd python3
url="$(SMTP_USER="$user" SMTP_PASSWORD="$password" python3 -c '
import os, sys, urllib.parse as u
q = lambda s: u.quote(s, safe="")
print("smtp://%s:%s@%s:%s" % (q(os.environ["SMTP_USER"]), q(os.environ["SMTP_PASSWORD"]), sys.argv[1], sys.argv[2]))
' "$smtp_host" "$smtp_port")"
unset password

for f in "${files[@]}"; do
  env_set "$f" SMTP_URL "$url"
  env_set "$f" MAIL_FROM "\"$mail_from\""
  ok "$f : SMTP_URL ($smtp_host:$smtp_port) et MAIL_FROM mis à jour."
done
unset url

if [[ "$restart" == "1" ]]; then
  if role_has_access && container_running access; then
    compose_platform up -d --force-recreate access >/dev/null && ok "access recréé."
  fi
  for uid in $(list_instances); do
    compose_instance "$uid" up -d --force-recreate >/dev/null && ok "Base $uid recréée."
  done
fi
