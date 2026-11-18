#!/usr/bin/env bash
# Test sans Docker des rôles de serveur (all, control, data) : configuration nginx générée, .env d'instance,
# profil docker compose, enregistrement d'une base sur le serveur de contrôle.
#   bash deploy/test/roles.test.sh
# Travaille sur une copie de deploy/ dans un dossier temporaire ; docker et ssh sont remplacés par des fonctions.
set -euo pipefail
SRC="$(cd "$(dirname "$0")/.." && pwd)"
WORK="$(mktemp -d)"
trap 'rm -rf "$WORK"' EXIT
fails=0
pass() { printf '  ok   %s\n' "$1"; }
fail() { printf '  FAIL %s\n' "$1"; fails=$((fails + 1)); }
assert_contains() { if grep -qF -- "$2" "$1"; then pass "$3"; else fail "$3 (« $2 » absent de $1)"; fi; }
assert_not_contains() { if grep -qF -- "$2" "$1"; then fail "$3 (« $2 » présent dans $1)"; else pass "$3"; fi; }

setup() {
  # setup rôle : copie fraîche de deploy/ avec platform.env et une instance « demo »
  local role="$1" d="$WORK/$1"
  rm -rf "$d"; mkdir -p "$d"
  cp -a "$SRC/." "$d/deploy"
  rm -f "$d/deploy/env/"*.env "$d/deploy/nginx/conf.d/10-main.conf"
  sed -e "s|^SERVER_ROLE=.*|SERVER_ROLE=$role|" -e "s|^TOOLSO_DATA_DIR=.*|TOOLSO_DATA_DIR=$d/data|" \
      "$d/deploy/env/platform.env.example" > "$d/deploy/env/platform.env"
  if [[ "$role" == "data" ]]; then
    sed -i -e "s|^PUBLIC_HOST=.*|PUBLIC_HOST=db1.exemple.com|" -e "s|^CONTROL_URL=.*|CONTROL_URL=https://emailing.exemple.com/|" \
      "$d/deploy/env/platform.env"
  fi
  if [[ "$role" != "control" ]]; then
    mkdir -p "$d/deploy/instances/demo"
    printf 'RESOURCE_UID=demo\nTRACKING_HOSTS=lk.demo.exemple.com\n' > "$d/deploy/instances/demo/.env"
  fi
  printf '%s' "$d/deploy"
}

for role in all control data; do
  echo "== rôle $role"
  dir="$(setup "$role")"
  bash "$dir/bin/render-nginx.sh" --no-reload > "$WORK/render-$role.log" 2>&1 || { fail "render-nginx ($role)"; cat "$WORK/render-$role.log"; continue; }
  main="$dir/nginx/conf.d/10-main.conf"
  [[ -f "$main" ]] && pass "10-main.conf généré" || fail "10-main.conf absent"
  case "$role" in
    all)
      assert_contains "$main" "location = /access/graphql" "interface et access servis"
      assert_contains "$dir/nginx/conf.d/instances/demo.conf" "location /api/demo/" "fragment /api/demo/"
      assert_contains "$dir/nginx/conf.d/tracking/demo.conf" "lk.demo.exemple.com" "domaine de tracking servi"
      ;;
    control)
      assert_contains "$main" "location = /access/graphql" "access servi"
      if compgen -G "$dir/nginx/conf.d/instances/*.conf" >/dev/null; then fail "fragments d'instance sur le serveur de contrôle"; else pass "aucune instance"; fi
      ;;
    data)
      assert_not_contains "$main" "/access/graphql" "pas d'access sur un serveur de bases"
      assert_not_contains "$main" "try_files \$uri \$uri/ /index.html" "pas d'interface sur un serveur de bases"
      assert_contains "$main" "frame-ancestors 'self' https://emailing.exemple.com" "aperçu des contenus autorisé dans l'interface (iframe)"
      assert_not_contains "$main" "add_header X-Frame-Options" "pas de X-Frame-Options SAMEORIGIN sur l'api"
      assert_not_contains "$main" "security-headers.conf" "en-têtes de l'interface non inclus"
      assert_contains "$main" "include /etc/nginx/conf.d/instances/*.conf;" "fragments d'instance inclus"
      assert_contains "$dir/nginx/conf.d/tracking/demo.conf" "lk.demo.exemple.com" "domaine de tracking servi"
      ;;
  esac

  # Fonctions de lib.sh : rôle, profil compose, .env d'instance, enregistrement.
  (
    # shellcheck source=/dev/null
    source "$dir/bin/lib.sh"
    docker() { printf '%s\n' "$*" > "$WORK/docker-$role.args"; }
    container_running() { return 0; }
    ssh() { printf '%s\n' "$*" > "$WORK/ssh-$role.args"; }
    load_platform_env
    compose_platform ps
    render_template "$DEPLOY_DIR/templates/instance.env" \
      "UID=demo" "DATE=now" "DB_PASSWORD=pw" "JWT_SECRET=secret" \
      "UI_URL=$UI_URL" "API_BASE_URL=$PUBLIC_URL" "ACCESS_API_URL=$INSTANCE_ACCESS_API_URL" "TRACKING_HOSTS=lk.demo.exemple.com" \
      "SMTP_URL=" "MAIL_FROM=x" "SUPPORT_EMAIL=x" "TZ=Europe/Paris" > "$WORK/instance-$role.env"
    rc=0
    register_database --uid demo --name "Base démo" --api-endpoint "$PUBLIC_URL/api/demo" --entreprise "Entreprise A" > "$WORK/register-$role.out" 2>&1 || rc=$?
    echo "$rc" > "$WORK/register-$role.rc"
    export CONTROL_SSH=root@emailing.exemple.com
    register_database --uid demo --name "Base démo" --api-endpoint "$PUBLIC_URL/api/demo" --entreprise "Entreprise A" >/dev/null 2>&1 || true
  )
  env_out="$WORK/instance-$role.env"
  case "$role" in
    all)
      assert_contains "$WORK/docker-$role.args" "--profile ui" "profil compose ui"
      assert_contains "$env_out" "PUBLIC_URL=https://emailing.exemple.com" "interface locale"
      assert_contains "$env_out" "ACCESS_API_URL=http://access:4000/graphql" "access local"
      assert_contains "$env_out" "API_PUBLIC_URL=https://emailing.exemple.com/api/demo" "api locale"
      assert_contains "$WORK/docker-$role.args" "exec -T access npm run add-database -- --uid demo" "enregistrement dans l'access local"
      ;;
    control)
      assert_contains "$WORK/docker-$role.args" "--profile ui" "profil compose ui"
      ;;
    data)
      assert_contains "$WORK/docker-$role.args" "--profile edge" "profil compose edge (nginx sans interface)"
      assert_contains "$env_out" "PUBLIC_URL=https://emailing.exemple.com" "liens des mails vers l'interface du serveur de contrôle"
      assert_contains "$env_out" "ACCESS_API_URL=https://emailing.exemple.com/access/graphql" "access du serveur de contrôle"
      assert_contains "$env_out" "API_PUBLIC_URL=https://db1.exemple.com/api/demo" "api servie par le serveur de bases"
      assert_contains "$env_out" "FILES_PUBLIC_URL=https://db1.exemple.com/files/demo" "fichiers servis par le serveur de bases"
      [[ "$(cat "$WORK/register-$role.rc")" == "2" ]] && pass "sans CONTROL_SSH : commande affichée (code 2)" || fail "code de retour sans CONTROL_SSH : $(cat "$WORK/register-$role.rc")"
      assert_contains "$WORK/register-$role.out" "register-database.sh --uid demo --name Base\\ démo" "commande d'enregistrement affichée"
      assert_contains "$WORK/ssh-$role.args" "root@emailing.exemple.com" "enregistrement par SSH vers le serveur de contrôle"
      assert_contains "$WORK/ssh-$role.args" "register-database.sh --uid demo --name Base\\ démo --api-endpoint https://db1.exemple.com/api/demo" "arguments protégés pour le shell distant"
      ;;
  esac
done

if [[ "$fails" -gt 0 ]]; then
  echo "$fails échec(s)."
  exit 1
fi
echo "Tous les tests passent."
