#!/usr/bin/env bash
# One compressed dump of the whole database, checked before it is trusted.
# The database holds the restaurant's only copy of its orders; a backup that
# was never read back is a hope, not a backup. So the dump is listed by
# pg_restore before it is kept, and an empty or unreadable one is discarded
# loudly instead of silently pushing out a good one.
#
# Keeps the newest 30. Run by cron nightly (install.sh) and by update.sh.
set -euo pipefail
source "$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)/lib.sh"
mkdir -p "$BACKUP_DIR"
chmod 700 "$BACKUP_DIR"

STAMP="$(date -u +%Y%m%d-%H%M%S)"
TMP="$BACKUP_DIR/.pizzahouse-$STAMP.tmp"
OUT="$BACKUP_DIR/pizzahouse-$STAMP.dump"

dc exec -T db pg_dump -U pizza -d pizzahouse -Fc > "$TMP" || { rm -f "$TMP"; die "pg_dump failed."; }
[ -s "$TMP" ] || { rm -f "$TMP"; die "The dump is empty."; }
dc exec -T db pg_restore -l < "$TMP" >/dev/null || { rm -f "$TMP"; die "The dump cannot be read back."; }

mv "$TMP" "$OUT"
chmod 600 "$OUT"
ok "backup: $OUT ($(du -h "$OUT" | cut -f1))"

# Retention: everything but the newest 30.
ls -1t "$BACKUP_DIR"/pizzahouse-*.dump 2>/dev/null | tail -n +31 | xargs -r rm -f
