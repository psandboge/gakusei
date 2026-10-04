# Source from the repository root: . scripts/local-env.sh
GAKUSEI_TOOLS_DIR="${GAKUSEI_TOOLS_DIR:-$HOME/.cache/gakusei-tools}"
export JAVA_HOME="$GAKUSEI_TOOLS_DIR/jdk-17.0.16+8/Contents/Home"
export PATH="$GAKUSEI_TOOLS_DIR/node-v24.21.0-darwin-arm64/bin:$JAVA_HOME/bin:$PATH"
