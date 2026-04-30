#!/usr/bin/env bash
# Wrapper for Astro dev server — forces Node 24 regardless of inherited PATH.
# Used by .claude/launch.json so preview_start works from MCP (which otherwise
# inherits the system Node 20 default).

set -e

NODE_BIN="/Users/bill/.nvm/versions/node/v24.12.0/bin"
if [ ! -x "$NODE_BIN/node" ]; then
  echo "Node 24 not found at $NODE_BIN. Install via: nvm install 24" >&2
  exit 1
fi

export PATH="$NODE_BIN:$PATH"
cd "$(dirname "$0")/../site"
exec "$NODE_BIN/npm" run dev
