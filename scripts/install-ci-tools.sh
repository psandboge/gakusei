#!/usr/bin/env bash
set -euo pipefail
[[ $(uname -s) == Linux && $(uname -m) == x86_64 ]] || { echo 'Requires Linux x86_64' >&2; exit 1; }
# A fresh per-job directory prevents an unverified cached executable replacing the pin.
TOOLS=$(mktemp -d "${RUNNER_TEMP:-/tmp}/gakusei-node.XXXXXXXX")
ARCHIVE=node-v24.21.0-linux-x64.tar.xz
curl --fail --location --retry 2 --connect-timeout 15 --max-time 180 \
  "https://nodejs.org/dist/v24.21.0/$ARCHIVE" -o "$TOOLS/$ARCHIVE"
printf '%s  %s\n' fd8e59d5a511510f6a298afb548f18c7d2b1be404d8b4a27d94fbe49f56cb2d6 "$TOOLS/$ARCHIVE" | sha256sum -c -
tar -xJf "$TOOLS/$ARCHIVE" -C "$TOOLS"
export PATH="$TOOLS/node-v24.21.0-linux-x64/bin:$PATH"
[[ $(node --version) == v24.21.0 ]]
if [[ $(npm --version) != 11.19.0 ]]; then npm install --global npm@11.19.0; fi
[[ $(npm --version) == 11.19.0 ]]
if [[ -n ${GITHUB_PATH:-} ]]; then
  printf '%s\n' "$TOOLS/node-v24.21.0-linux-x64/bin" >> "$GITHUB_PATH"
fi
printf 'export PATH=%q:$PATH\n' "$TOOLS/node-v24.21.0-linux-x64/bin"

export GAKUSEI_JAVA_TOOLS_DIR="$TOOLS/java"
JAVA_EXPORTS=$(bash "$(dirname "$0")/install-java-tools.sh")
eval "$JAVA_EXPORTS"
export JAVA_HOME="$GAKUSEI_JAVA25_HOME"
if [[ -n ${GITHUB_ENV:-} ]]; then
  printf 'GAKUSEI_JAVA17_HOME=%s\nGAKUSEI_JAVA25_HOME=%s\nJAVA_HOME=%s\n' "$GAKUSEI_JAVA17_HOME" "$GAKUSEI_JAVA25_HOME" "$JAVA_HOME" >> "$GITHUB_ENV"
  printf '%s\n' "$JAVA_HOME/bin" >> "$GITHUB_PATH"
fi
printf 'export GAKUSEI_JAVA17_HOME=%q GAKUSEI_JAVA25_HOME=%q JAVA_HOME=%q\n' "$GAKUSEI_JAVA17_HOME" "$GAKUSEI_JAVA25_HOME" "$JAVA_HOME"
