#!/usr/bin/env bash
# Reprend le secret JWT de la plateforme AWS (Secrets Manager « jwt_secret », champ SECRET) dans env/access.env et dans le .env
# de chaque instance, sans jamais l'afficher. Indispensable avant de migrer une base : ce secret signe les jetons de connexion,
# chiffre les identifiants des routeurs de mail (MailRouter.credentials) et certains réglages, et sert de clé aux liens de tracking
# déjà envoyés. À lancer juste après bin/install.sh, avant toute configuration dans l'UI (ce qui aurait été chiffré avec le
# secret aléatoire d'install.sh deviendrait illisible).
#
#   sudo bin/jwt-secret-from-aws.sh [--check] [--secret-id jwt_secret]
# --check : compare seulement (rien n'est écrit). Profil et région AWS : AWS_PROFILE / AWS_REGION (défaut eu-west-1).
# Après mise à jour, recréer les conteneurs : bin/compose.sh platform up -d access ; bin/compose.sh <uid> up -d (chaque base).
source "$(dirname "$0")/lib.sh"

check=0 secret_id="jwt_secret"
while [[ $# -gt 0 ]]; do
  case "$1" in
    --check) check=1; shift ;;
    --secret-id) secret_id="${2:-jwt_secret}"; shift 2 ;;
    -h|--help) sed -n '2,11p' "$0"; exit 0 ;;
    *) die "Option inconnue : $1" ;;
  esac
done
[[ -f "$ACCESS_ENV" ]] || die "env/access.env absent : lancer d'abord bin/install.sh."
require_aws

json="$(aws_secret_json "$secret_id")" || die "Lecture du secret $secret_id impossible (droit secretsmanager:GetSecretValue ?)."
value="$(jq -r '.SECRET // empty' <<<"$json")"
unset json
[[ -n "$value" ]] || die "Le secret $secret_id ne contient pas de champ SECRET."
if [[ ! "$value" =~ ^[A-Za-z0-9._~+/=-]+$ ]]; then
  warn "Le secret contient des caractères spéciaux (espace, #, guillemets, antislash…) : après application, vérifier sa longueur"
  warn "dans un conteneur : bin/compose.sh platform exec access node -e 'console.log(process.env.JWT_SECRET.length)' (attendu : ${#value})."
fi

changed=0
apply_to() {
  # apply_to <fichier .env>
  local file="$1" current
  current="$(env_get "$file" JWT_SECRET)"
  if [[ "$current" == "$value" ]]; then
    ok "$file : JWT_SECRET déjà égal au secret AWS."
  elif [[ "$check" == "1" ]]; then
    warn "$file : JWT_SECRET différent du secret AWS."
    changed=1
  else
    env_set "$file" JWT_SECRET "$value"
    chmod 600 "$file"
    ok "$file : JWT_SECRET remplacé par le secret AWS."
    changed=1
  fi
}

apply_to "$ACCESS_ENV"
for u in $(list_instances); do
  apply_to "$(instance_dir "$u")/.env"
done
info "Secret AWS : ${#value} caractères (valeur non affichée)."
if [[ "$changed" == "1" && "$check" == "0" ]]; then
  info "Appliquer aux conteneurs : bin/compose.sh platform up -d access ; puis, pour chaque base, bin/compose.sh <uid> up -d."
  info "Les bases créées ensuite par bin/add-database.sh reprennent automatiquement le JWT_SECRET de env/access.env."
elif [[ "$changed" == "1" ]]; then
  exit 2
fi
