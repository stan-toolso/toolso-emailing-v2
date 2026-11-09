#!/usr/bin/env bash
# Rejoue dans la file d'actions de l'instance (table ActionQueue) les messages restés dans la file SQS actions_<uid> d'AWS :
# événements reçus par les webhooks et le tracking AWS après le gel de la base (consommateur <uid>_action désactivé) et avant
# le rebranchement des webhooks / du DNS. Les messages SQS sont des actions { type, payload } identiques à celles de la v2.
#
#   sudo bin/replay-sqs-actions.sh <uid> [--max N] [--keep] [--yes]
# --max N : s'arrêter après N messages (défaut : vider la file) ; --keep : ne pas supprimer les messages de SQS après insertion.
# Prérequis : la correspondance SQS → Lambda <uid>_action est désactivée (sinon AWS consomme les messages) ; profil AWS avec
# sqs:ReceiveMessage et sqs:DeleteMessage sur la file. Les messages lus restent invisibles 30 min : terminer l'insertion dans ce délai.
source "$(dirname "$0")/lib.sh"
require_docker
load_platform_env

uid="" max=0 keep=0
while [[ $# -gt 0 ]]; do
  case "$1" in
    --max) max="${2:-0}"; shift 2 ;;
    --keep) keep=1; shift ;;
    --yes) export ASSUME_YES=1; shift ;;
    -h|--help) sed -n '2,10p' "$0"; exit 0 ;;
    --*) die "Option inconnue : $1" ;;
    *) [[ -z "$uid" ]] || die "Un seul identifiant de base attendu."; uid="$1"; shift ;;
  esac
done
[[ -n "$uid" ]] || die "Usage : $0 <uid> [--max N] [--keep]"
require_instance "$uid"
[[ "$max" =~ ^[0-9]+$ ]] || die "--max attend un entier."
require_aws

queue_url="$(aws_cli sqs get-queue-url --queue-name "actions_$uid" --query QueueUrl --output text)" || die "File SQS actions_$uid introuvable."
approx="$(aws_cli sqs get-queue-attributes --queue-url "$queue_url" --attribute-names ApproximateNumberOfMessages --query 'Attributes.ApproximateNumberOfMessages' --output text)"
info "File $queue_url : environ $approx message(s) visibles."
[[ "$approx" != "0" ]] || { ok "Rien à rejouer."; exit 0; }

out_dir="$TOOLSO_DATA_DIR/files/$uid/migration/sqs"
install -d -m 0755 "$out_dir"
stamp="$(date +%Y-%m-%d_%H%M%S)"
messages="$out_dir/actions-$stamp.ndjson"
receipts="$out_dir/receipts-$stamp.txt"
: > "$messages"; : > "$receipts"

# ---------- 1. Lecture ----------
count=0 empty=0
while (( empty < 3 )) && (( max == 0 || count < max )); do
  resp="$(aws_cli sqs receive-message --queue-url "$queue_url" --max-number-of-messages 10 --visibility-timeout 1800 --wait-time-seconds 3 --output json)" || die "receive-message a échoué."
  n="$(jq '.Messages | length' <<<"${resp:-{\}}")"
  if [[ "$n" == "0" || "$n" == "null" ]]; then empty=$((empty + 1)); continue; fi
  empty=0; count=$((count + n))
  jq -c '.Messages[]' <<<"$resp" >> "$messages"
  jq -r '.Messages[].ReceiptHandle' <<<"$resp" >> "$receipts"
  printf '\r   %s message(s) lus' "$count"
done
printf '\n'
[[ "$count" -gt 0 ]] || { ok "Aucun message reçu."; exit 0; }
ok "$count message(s) enregistrés dans $messages."
chown -R 1000:1000 "$out_dir" 2>/dev/null || warn "chown impossible (lancer en root) : le conteneur api (uid 1000) doit pouvoir lire $out_dir."

# ---------- 2. Insertion dans ActionQueue ----------
info "Insertion dans la file d'actions de emailing_$uid (conteneur api, scripts/enqueue-actions.js)"
compose_instance "$uid" run --rm --no-deps -v "$out_dir:/migration:ro" api node scripts/enqueue-actions.js --file "/migration/$(basename "$messages")"

# ---------- 3. Suppression dans SQS ----------
if [[ "$keep" == "1" ]]; then
  warn "--keep : les messages restent dans SQS et redeviendront visibles dans 30 min."
  exit 0
fi
confirm "Supprimer les $count message(s) de la file SQS (ils sont maintenant dans l'instance) ?" || { warn "Messages conservés dans SQS."; exit 0; }
deleted=0
while mapfile -t -n 10 batch && [[ ${#batch[@]} -gt 0 ]]; do
  entries="$(printf '%s\n' "${batch[@]}" | jq -R -s 'split("\n") | map(select(length > 0)) | to_entries | map({Id: (.key | tostring), ReceiptHandle: .value})')"
  aws_cli sqs delete-message-batch --queue-url "$queue_url" --entries "$entries" --output json > /dev/null || warn "Un lot de suppression a échoué (les messages réapparaîtront dans SQS)."
  deleted=$((deleted + ${#batch[@]}))
done < "$receipts"
ok "$deleted message(s) supprimés de SQS. Fichiers conservés dans $out_dir."
