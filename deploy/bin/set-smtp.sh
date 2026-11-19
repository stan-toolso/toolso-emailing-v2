#!/usr/bin/env bash
# Règle le SMTP des mails de la plateforme (invitations, mot de passe oublié, BAT, alertes, exports) sur ce serveur :
# SMTP_URL et MAIL_FROM dans env/platform.env (valeurs reprises par les bases créées ensuite), env/access.env (serveur
# avec access) et le .env de chaque base, puis recrée les conteneurs concernés.
#
#   sudo bin/set-smtp.sh --host smtp.exemple.com --from "Toolso Emailing <no-reply@exemple.com>"
#   sudo bin/set-smtp.sh --ses-region eu-west-1 --from "Toolso Emailing <no-reply@exemple.com>"
#
# L'utilisateur et le mot de passe SMTP sont demandés au clavier (le mot de passe ne s'affiche pas) ; ils peuvent aussi
# venir de SMTP_USER / SMTP_PASSWORD. Ils sont encodés pour l'URL et jamais affichés.
# Avec --ses-region : hôte email-smtp.<région>.amazonaws.com ; on saisit la clé d'accès IAM (ID et clé secrète) d'un
# utilisateur autorisé à ses:SendRawEmail, et le mot de passe SMTP en est dérivé ici (algorithme SigV4 d'AWS).
# Options : --port (défaut 587, STARTTLS), --no-restart (ne recrée pas les conteneurs), --check (affiche l'hôte et
# l'expéditeur configurés, sans les identifiants).
source "$(dirname "$0")/lib.sh"
require_root

smtp_host="" smtp_port=587 mail_from="" restart=1 check=0 ses_region=""
while [[ $# -gt 0 ]]; do
  case "$1" in
    --host) smtp_host="$2"; shift 2 ;;
    --port) smtp_port="$2"; shift 2 ;;
    --from) mail_from="$2"; shift 2 ;;
    --ses-region) ses_region="$2"; shift 2 ;;
    --no-restart) restart=0; shift ;;
    --check) check=1; shift ;;
    -h|--help) sed -n '2,14p' "$0"; exit 0 ;;
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

[[ -n "$ses_region" ]] && smtp_host="${smtp_host:-email-smtp.$ses_region.amazonaws.com}"
[[ -n "$smtp_host" ]] || die "--host (ex. smtp.exemple.com) ou --ses-region (ex. eu-west-1) requis."
[[ -n "$mail_from" ]] || die "--from requis (ex. \"Toolso Emailing <no-reply@exemple.com>\")."
[[ "$mail_from" != *'"'* ]] || die "--from ne doit pas contenir de guillemet."
require_cmd python3
user="${SMTP_USER:-}" password="${SMTP_PASSWORD:-}"
if [[ -n "$ses_region" && -z "$password" ]]; then
  [[ -n "$user" ]] || read -r -p "ID de la clé d'accès IAM (AKIA…) : " user
  read -r -s -p "Clé d'accès secrète IAM (n'apparaît pas) : " aws_secret; echo
  [[ -n "$aws_secret" ]] || die "Clé d'accès secrète requise."
  # Mot de passe SMTP SES = dérivation SigV4 de la clé secrète (documentation AWS « Obtaining SES SMTP credentials »).
  password="$(AWS_SECRET="$aws_secret" python3 -c '
import base64, hashlib, hmac, os, sys
sign = lambda k, m: hmac.new(k, m.encode(), hashlib.sha256).digest()
k = sign(("AWS4" + os.environ["AWS_SECRET"]).encode(), "11111111")
for m in (sys.argv[1], "ses", "aws4_request", "SendRawEmail"):
    k = sign(k, m)
print(base64.b64encode(bytes([0x04]) + k).decode())
' "$ses_region")"
  unset aws_secret
fi
[[ -n "$user" ]] || read -r -p "Utilisateur SMTP : " user
[[ -n "$password" ]] || { read -r -s -p "Mot de passe SMTP (n'apparaît pas) : " password; echo; }
[[ -n "$user" && -n "$password" ]] || die "Utilisateur et mot de passe SMTP requis."
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
