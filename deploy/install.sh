#!/usr/bin/env bash
# First install, and safe to re-run: sets up a fresh Ubuntu/Debian server so
# that https://$DOMAIN serves Pizza House.
#
#   git clone <repo> /opt/pizza-house && cd /opt/pizza-house
#   sudo ADMIN_EMAIL=you@example.com bash deploy/install.sh
#
# Options (environment variables):
#   DOMAIN        public address            default pizza-house66.novixa.dev
#   ADMIN_EMAIL   the owner's login + the address Let's Encrypt writes to (required)
#   ADMIN_NAME    owner's display name      default "Owner"
#   OPEN_ORDERING=1   take orders immediately (default: start PAUSED — see below)
#   SKIP_DNS_CHECK=1  skip the "does the domain point here" check
#   SKIP_FIREWALL=1   leave ufw alone
#
# Ordering starts PAUSED on a first install. The menu in a fresh database is
# the 16-item stand-in from the prototype, not the restaurant's ~184-item menu,
# and its prices differ from theirs. A customer ordering from it would be
# charged wrong prices by a restaurant that never agreed to them. Review the
# menu (docs/MENU-IMPORT.md), then press "resume" in the admin header.
set -euo pipefail
source "$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)/lib.sh"
need_root

DOMAIN="${DOMAIN:-pizza-house66.novixa.dev}"
ADMIN_NAME="${ADMIN_NAME:-Owner}"
ADMIN_EMAIL="${ADMIN_EMAIL:-$(env_value ACME_EMAIL)}"
[ -n "$ADMIN_EMAIL" ] || die "Set ADMIN_EMAIL, e.g. sudo ADMIN_EMAIL=you@example.com bash deploy/install.sh"
case "$ADMIN_EMAIL" in *@*.*) ;; *) die "ADMIN_EMAIL does not look like an email address: $ADMIN_EMAIL";; esac

command -v apt-get >/dev/null || die "This installer supports Debian/Ubuntu (apt)."

# --- 1. Docker --------------------------------------------------------------
say "Docker"
if ! command -v docker >/dev/null; then
  curl -fsSL https://get.docker.com | sh
fi
docker compose version >/dev/null 2>&1 || die "Docker Compose v2 is missing (docker compose version failed)."
systemctl enable --now docker >/dev/null 2>&1 || true
ok "$(docker --version)"

# --- 2. The domain must already point here ---------------------------------
say "DNS for $DOMAIN"
SERVER_IP="$(curl -4fsS --max-time 8 https://api.ipify.org 2>/dev/null || true)"
DOMAIN_IP="$(getent ahostsv4 "$DOMAIN" 2>/dev/null | awk 'NR==1{print $1}')"
if [ "${SKIP_DNS_CHECK:-0}" = "1" ]; then
  warn "DNS check skipped."
elif [ -z "$DOMAIN_IP" ]; then
  die "$DOMAIN does not resolve yet. Add an A record pointing at ${SERVER_IP:-the server IP}, wait a few minutes, and run this again. (Starting now would burn Let's Encrypt attempts on a name that cannot validate.)"
elif [ -n "$SERVER_IP" ] && [ "$DOMAIN_IP" != "$SERVER_IP" ]; then
  die "$DOMAIN points at $DOMAIN_IP but this server is $SERVER_IP. Fix the A record, or pass SKIP_DNS_CHECK=1 if a proxy sits in between."
else
  ok "$DOMAIN -> $DOMAIN_IP"
fi

# --- 3. Memory: the build needs headroom ------------------------------------
say "Memory"
MEM_MB="$(awk '/MemTotal/ {print int($2/1024)}' /proc/meminfo)"
if [ "$MEM_MB" -lt 3500 ] && [ "$(swapon --show --noheadings | wc -l)" -eq 0 ]; then
  fallocate -l 2G /swapfile && chmod 600 /swapfile && mkswap /swapfile >/dev/null && swapon /swapfile
  grep -q '^/swapfile' /etc/fstab || echo '/swapfile none swap sw 0 0' >> /etc/fstab
  ok "added 2G swap (RAM is ${MEM_MB}MB)"
else
  ok "${MEM_MB}MB RAM"
fi

# --- 4. Firewall ------------------------------------------------------------
say "Firewall"
if [ "${SKIP_FIREWALL:-0}" = "1" ]; then
  warn "firewall left alone."
else
  command -v ufw >/dev/null || apt-get install -y -qq ufw >/dev/null
  SSH_PORT="$(ss -tlnp 2>/dev/null | awk '/sshd/ {n=split($4,a,":"); print a[n]; exit}')"
  SSH_PORT="${SSH_PORT:-22}"
  ufw allow "${SSH_PORT}/tcp" >/dev/null
  ufw allow 80/tcp >/dev/null
  ufw allow 443/tcp >/dev/null
  ufw allow 443/udp >/dev/null
  ufw --force enable >/dev/null
  ok "ufw: ssh(${SSH_PORT}), 80, 443 only"
fi

# --- 5. Secrets: generated once, never overwritten --------------------------
say "Configuration"
mkdir -p "$STATE_DIR" "$BACKUP_DIR"
if [ ! -f "$DEPLOY_DIR/.env" ]; then
  umask 077
  cat > "$DEPLOY_DIR/.env" <<ENV
DOMAIN=$DOMAIN
ACME_EMAIL=$ADMIN_EMAIL
DB_PASSWORD=$(openssl rand -hex 24)
AUTH_SECRET=$(openssl rand -hex 32)
CRON_SECRET=$(openssl rand -hex 32)
ENV
  ok "created deploy/.env (mode 600) with fresh secrets"
else
  # Keep the secrets, but let the domain be changed by re-running.
  sed -i "s|^DOMAIN=.*|DOMAIN=$DOMAIN|" "$DEPLOY_DIR/.env"
  ok "kept the existing deploy/.env"
fi
chmod 600 "$DEPLOY_DIR/.env"

# --- 6. Build and start -----------------------------------------------------
say "Building the app (a few minutes the first time)"
dc build
say "Starting"
dc up -d
wait_healthy 420
ok "app is healthy"

# --- 7. First install only: the owner, and ordering paused -----------------
FIRST=0
[ -f "$STATE_DIR/installed" ] || FIRST=1
OWNER_PASSWORD=""
if [ "$FIRST" = "1" ]; then
  say "Creating the owner account"
  OWNER_PASSWORD="$(openssl rand -base64 18 | tr -d '/+=' | cut -c1-16)"
  dc exec -T -e STAFF_PASSWORD="$OWNER_PASSWORD" app \
    npm run staff:create -- --email "$ADMIN_EMAIL" --name "$ADMIN_NAME" --role OWNER >/dev/null
  ok "owner: $ADMIN_EMAIL"

  if [ "${OPEN_ORDERING:-0}" = "1" ]; then
    warn "OPEN_ORDERING=1 — taking orders from the stand-in menu. Check the prices first."
  else
    dc exec -T db psql -U pizza -d pizzahouse -q \
      -c 'UPDATE "Restaurant" SET "onlineOrderingPaused" = true;' >/dev/null
    ok "ordering is PAUSED until the menu is confirmed"
  fi
fi

# --- 8. Nightly backups -----------------------------------------------------
say "Backups"
cat > /etc/cron.d/pizza-house-backup <<CRON
# Pizza House database dump, nightly at 03:10; keeps the newest 30.
10 3 * * * root bash $DEPLOY_DIR/backup.sh >> /var/log/pizza-house-backup.log 2>&1
CRON
chmod 644 /etc/cron.d/pizza-house-backup
ok "cron: 03:10 daily -> $BACKUP_DIR"

# --- 9. Is it actually serving? --------------------------------------------
say "Checking https://$DOMAIN (the certificate can take a minute)"
SERVED=0
for _ in $(seq 1 24); do
  if curl -fsS --max-time 10 -o /dev/null "https://$DOMAIN/"; then SERVED=1; break; fi
  sleep 5
done
if [ "$SERVED" = "1" ]; then
  ok "https://$DOMAIN answers"
  dc exec -T app node scripts/smoke.mjs "https://$DOMAIN" || warn "smoke check reported a problem (see above)"
else
  warn "https://$DOMAIN did not answer yet. Check:  cd $DEPLOY_DIR && docker compose logs caddy"
fi

touch "$STATE_DIR/installed"

say "Done"
echo "    Site:   https://$DOMAIN"
echo "    Admin:  https://$DOMAIN/admin"
if [ "$FIRST" = "1" ]; then
  echo
  echo "    Owner login (shown ONCE — save it, then change it in the admin):"
  echo "      email:    $ADMIN_EMAIL"
  echo "      password: $OWNER_PASSWORD"
  echo
  if [ "${OPEN_ORDERING:-0}" != "1" ]; then
    echo "    Ordering is PAUSED. Load the real menu, then press resume in the admin header."
  fi
fi
echo "    Update later:  sudo bash $DEPLOY_DIR/update.sh"
echo "    Backups:       $BACKUP_DIR  (also copy them OFF this server)"
