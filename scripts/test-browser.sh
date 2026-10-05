#!/usr/bin/env bash
# Requires a production jar; owns services, never reuses an existing server.
set -euo pipefail
cd "$(dirname "$0")/.."
exec python3 scripts/verify-browser-state.py run "$@"
