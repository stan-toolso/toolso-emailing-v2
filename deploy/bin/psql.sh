#!/usr/bin/env bash
# Console psql : bin/psql.sh <uid|access|postgres> [options psql…]   (ex. bin/psql.sh exemple -c 'select count(*) from "ActionQueue"')
source "$(dirname "$0")/lib.sh"
target="${1:-}"; shift || true
[[ -n "$target" ]] || die "Usage : $0 <uid>|access|postgres [options psql]"
case "$target" in
  access|postgres) db="$target" ;;
  *) require_uid "$target"; db="emailing_$target" ;;
esac
tty_flag=""
[[ -t 0 && -t 1 ]] && tty_flag="-t"
# shellcheck disable=SC2086
docker exec -i $tty_flag postgres psql -U postgres -d "$db" "$@"
