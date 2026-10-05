#!/usr/bin/env bash
# Fresh independent database with the same ownership and environment safeguards.
set -euo pipefail
cd "$(dirname "$0")/.."
exec python3 scripts/verify-browser-state.py backend "$@"
