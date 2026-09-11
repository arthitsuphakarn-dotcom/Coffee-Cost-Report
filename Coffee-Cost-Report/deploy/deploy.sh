#!/usr/bin/env bash
# Pull latest code, rebuild, restart. Run on the server as the deploy user.
set -euo pipefail

APP_DIR=/var/www/coffee-cost-report
BRANCH="${1:-main}"

cd "$APP_DIR"

echo "==> Fetching $BRANCH"
git fetch --prune origin
git checkout "$BRANCH"
git reset --hard "origin/$BRANCH"

echo "==> Installing dependencies"
npm ci

echo "==> Building"
npm run build

echo "==> Restarting service"
sudo systemctl restart coffee-cost-report
sleep 3
systemctl is-active --quiet coffee-cost-report && echo "==> OK" || {
  echo "==> FAILED — journalctl -u coffee-cost-report -n 50"
  exit 1
}
