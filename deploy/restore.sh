#!/usr/bin/env bash
# Replace the live database with a backup.
#
#   sudo bash deploy/restore.sh deploy/backups/pizzahouse-20261010-031001.dump
#
# This DELETES what is in the database now. It takes a safety dump of the
# current state first, so even a mistaken restore can be undone.
set -euo pipefail
source "$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)/lib.sh"
need_root
FILE="${1:-}"
[ -n "$FILE" ] && [ -f "$FILE" ] || die "Usage: restore.sh <backup file>   (see $BACKUP_DIR)"

echo "This replaces the live database with:  $FILE"
read -r -p "Type RESTORE to continue: " answer
[ "$answer" = "RESTORE" ] || die "Cancelled."

say "Safety dump of the current state"
bash "$DEPLOY_DIR/backup.sh"

say "Stopping the app and the scheduler"
dc stop app scheduler

say "Restoring"
dc exec -T db pg_restore -U pizza -d pizzahouse --clean --if-exists --no-owner < "$FILE"

say "Starting"
dc up -d
wait_healthy 300
ok "restored from $FILE"
