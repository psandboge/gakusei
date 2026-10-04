#!/bin/sh
set -eu
[ "$(uname -s)" = Darwin ] && [ "$(uname -m)" = arm64 ] || { echo 'This installer requires macOS arm64.' >&2; exit 1; }
TOOLS_DIR="${GAKUSEI_TOOLS_DIR:-$HOME/.cache/gakusei-tools}"
mkdir -p "$TOOLS_DIR"
fetch() {
  dest="$TOOLS_DIR/$1"
  curl --fail --location --retry 2 "$2" --output "$dest"
  printf '%s  %s\n' "$3" "$dest" | shasum -a 256 -c -
  tar -xzf "$dest" -C "$TOOLS_DIR"
}
if [ ! -x "$TOOLS_DIR/node-v24.21.0-darwin-arm64/bin/node" ]; then
  fetch node.tar.gz https://nodejs.org/dist/v24.21.0/node-v24.21.0-darwin-arm64.tar.gz bed7eea5325e1108f32ce5228ddd6a5f0f08a499ee42aa7442aea583702f6057
fi
if [ ! -x "$TOOLS_DIR/jdk-17.0.16+8/Contents/Home/bin/java" ]; then
  fetch jdk.tar.gz 'https://github.com/adoptium/temurin17-binaries/releases/download/jdk-17.0.16%2B8/OpenJDK17U-jdk_aarch64_mac_hotspot_17.0.16_8.tar.gz' f9845abc8403f1d489402201064e7b9f2c57605d8717b85a95a15d94f882eeb7
fi
printf '\nTools installed in %s. Source scripts/local-env.sh in each terminal.\n' "$TOOLS_DIR"
