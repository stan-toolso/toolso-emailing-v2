#!/usr/bin/env bash
# Journaux : bin/logs.sh platform [postgres|access|nginx]  ·  bin/logs.sh <uid> [api|worker|worker_huge|scheduler]
# Options docker compose logs transmises (ex. --tail 50, --since 1h) ; -f par défaut.
source "$(dirname "$0")/lib.sh"
target="${1:-}"; shift || true
[[ -n "$target" ]] || die "Usage : $0 platform|<uid> [service] [options docker compose logs]"
args=(logs -f --tail "${TAIL:-200}")
if [[ "$target" == "platform" ]]; then
  compose_platform "${args[@]}" "$@"
else
  require_instance "$target"
  compose_instance "$target" "${args[@]}" "$@"
fi
