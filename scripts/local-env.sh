# Source from the repository root: . scripts/local-env.sh
GAKUSEI_TOOLS_DIR="${GAKUSEI_TOOLS_DIR:-$HOME/.cache/gakusei-tools}"
GAKUSEI_JAVA_EXPORTS=$(bash scripts/install-java-tools.sh) || return 1
eval "$GAKUSEI_JAVA_EXPORTS"
unset GAKUSEI_JAVA_EXPORTS
export JAVA_HOME="$GAKUSEI_JAVA25_HOME"
export PATH="$GAKUSEI_TOOLS_DIR/node-v24.21.0-darwin-arm64/bin:$JAVA_HOME/bin:$PATH"
