#!/usr/bin/env bash
# Wrapper for Astro preview server (production build) — forces Node 24.

set -e

NODE_BIN="/Users/bill/.nvm/versions/node/v24.12.0/bin"
if [ ! -x "$NODE_BIN/node" ]; then
  echo "Node 24 not found at $NODE_BIN. Install via: nvm install 24" >&2
  exit 1
fi

export PATH="$NODE_BIN:$PATH"
cd "$(dirname "$0")/../site"
exec "$NODE_BIN/npm" run preview
