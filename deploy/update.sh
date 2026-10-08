#!/usr/bin/env bash
# Deploy the latest code: back up, pull, rebuild, restart, check, and say how
# to go back if it is wrong.
#
#   sudo bash deploy/update.sh          # follows the branch this checkout is on
set -euo pipefail
source "$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)/lib.sh"
need_root
[ -f "$DEPLOY_DIR/.env" ] || die "No deploy/.env — run install.sh first."

say "Backing up the database first"
bash "$DEPLOY_DIR/backup.sh"

say "Fetching the code"
cd "$REPO_DIR"
git fetch --quiet origin
BRANCH="$(git rev-parse --abbrev-ref HEAD)"
BEFORE="$(git rev-parse --short HEAD)"
git merge --ff-only "origin/$BRANCH" || die "Local changes block a fast-forward. Resolve them in $REPO_DIR, then re-run."
AFTER="$(git rev-parse --short HEAD)"
ok "$BRANCH: $BEFORE -> $AFTER"

say "Keeping the running image as :previous, then rebuilding"
docker tag pizzahouse-app:latest pizzahouse-app:previous 2>/dev/null || true
dc build
dc up -d
if ! wait_healthy 420; then exit 1; fi
ok "healthy"

dc exec -T app node scripts/smoke.mjs "http://127.0.0.1:3000" || warn "smoke check reported a problem"
echo
echo "Updated to $AFTER. If it is wrong:  sudo bash $DEPLOY_DIR/rollback.sh"
echo "(Rolling back restores the old code, not the database; migrations only go forward.)"
