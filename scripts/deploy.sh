#!/usr/bin/env bash
# scripts/deploy.sh — build Astro site and rsync to Timeweb public_html/
#
# Usage:
#   ./scripts/deploy.sh                    # uses env vars TIMEWEB_HOST / TIMEWEB_USER
#   TIMEWEB_HOST=... TIMEWEB_USER=... ./scripts/deploy.sh
#
# Prerequisites:
#   - SSH key configured for $TIMEWEB_USER@$TIMEWEB_HOST
#   - rsync installed locally
#   - public_html/.env exists on remote with real secrets

set -euo pipefail

TIMEWEB_HOST="${TIMEWEB_HOST:-autolife-detail.ru}"
TIMEWEB_USER="${TIMEWEB_USER:?missing TIMEWEB_USER env var}"
REMOTE_PATH="${REMOTE_PATH:-/home/$TIMEWEB_USER/public_html}"

ROOT="$(cd "$(dirname "$0")/.." && pwd)"

echo "==> Building Astro site"
cd "$ROOT/site"
npm run build

echo "==> rsync site/dist/ → $TIMEWEB_USER@$TIMEWEB_HOST:$REMOTE_PATH/dist/"
rsync -avz --delete \
  --exclude='.DS_Store' \
  "$ROOT/site/dist/" \
  "$TIMEWEB_USER@$TIMEWEB_HOST:$REMOTE_PATH/dist/"

echo "==> rsync PHP files (skipping .env)"
rsync -avz \
  --include='*.php' \
  --include='lib/***' \
  --include='IMG/***' \
  --include='icons/***' \
  --include='.htaccess' \
  --include='.env.example' \
  --exclude='.env' \
  --exclude='*' \
  "$ROOT/public_html/" \
  "$TIMEWEB_USER@$TIMEWEB_HOST:$REMOTE_PATH/"

echo "==> Deploy complete"
echo "Verify: https://$TIMEWEB_HOST/"
