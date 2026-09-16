#!/usr/bin/env bash
# Pull latest code, rebuild, restart. Run on the server as the deploy user.
set -euo pipefail

APP_DIR=/var/www/coffee-cost-report
BRANCH="${1:-main}"
APP_NAME=coffee-cost-report

cd "$APP_DIR"

echo "==> Fetching $BRANCH"
git fetch --prune origin
git checkout "$BRANCH"
git reset --hard "origin/$BRANCH"

echo "==> Installing dependencies"
npm ci

echo "==> Building"
npm run build

echo "==> Restarting service (pm2)"
# startOrReload = ยังไม่เคยรันก็ start, เคยรันแล้วก็ reload ด้วย config ล่าสุด
pm2 startOrReload ecosystem.config.js --update-env
pm2 save

sleep 3
if pm2 describe "$APP_NAME" | grep -q "status.*online"; then
  echo "==> OK"
  pm2 list
else
  echo "==> FAILED — pm2 logs $APP_NAME --lines 50"
  exit 1
fi
