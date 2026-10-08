#!/usr/bin/env bash
# Put the previous image back. The database is NOT rolled back: migrations go
# forward only, and the previous version was written to cope with the schema
# one step behind. To go back further, restore a backup (restore.sh).
set -euo pipefail
source "$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)/lib.sh"
need_root
docker image inspect pizzahouse-app:previous >/dev/null 2>&1 || die "There is no previous image to go back to."
docker tag pizzahouse-app:previous pizzahouse-app:latest
dc up -d --no-build app
wait_healthy 300
ok "Rolled back to the previous image."
