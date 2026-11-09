#!/usr/bin/env bash
# Enveloppe docker compose : bin/compose.sh platform <args…> | bin/compose.sh <uid> <args…>
#   bin/compose.sh platform ps
#   bin/compose.sh exemple restart worker
source "$(dirname "$0")/lib.sh"
target="${1:-}"; shift || true
[[ -n "$target" ]] || die "Usage : $0 platform|<uid> <commande docker compose…>"
if [[ "$target" == "platform" ]]; then
  compose_platform "$@"
else
  require_instance "$target"
  compose_instance "$target" "$@"
fi
