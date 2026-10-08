# Shared helpers for the deploy scripts. Sourced, never run.

DEPLOY_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_DIR="$(dirname "$DEPLOY_DIR")"
STATE_DIR="$DEPLOY_DIR/.state"
BACKUP_DIR="$DEPLOY_DIR/backups"

say()  { printf '\n\033[1m==> %s\033[0m\n' "$*"; }
ok()   { printf '    \033[32mok\033[0m  %s\n' "$*"; }
warn() { printf '    \033[33mwarn\033[0m %s\n' "$*" >&2; }
die()  { printf '\n\033[31mFAILED:\033[0m %s\n' "$*" >&2; exit 1; }

dc() { (cd "$DEPLOY_DIR" && docker compose "$@"); }

need_root() { [ "$(id -u)" -eq 0 ] || die "Run as root (sudo bash deploy/$(basename "$0"))."; }

# Value of KEY from deploy/.env, or empty.
env_value() { grep -E "^$1=" "$DEPLOY_DIR/.env" 2>/dev/null | head -1 | cut -d= -f2- || true; }

# Waits for the app container to report healthy; dumps its log on failure.
wait_healthy() {
  local limit="${1:-300}" waited=0 status
  while [ "$waited" -lt "$limit" ]; do
    status="$(docker inspect --format '{{.State.Health.Status}}' pizzahouse-app-1 2>/dev/null || echo missing)"
    [ "$status" = "healthy" ] && return 0
    sleep 5; waited=$((waited + 5))
  done
  dc logs --tail 80 app >&2 || true
  die "The app did not become healthy within ${limit}s (status: $status)."
}
