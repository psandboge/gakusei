#!/bin/sh
set -eu
GRAMMAR_DIR="$1/com/github/psandboge/japanese-grammar-utils/1.0.0"
# JitPack build.log identifies upstream commit 5b7743099eaa7e0c38d2064ec9d25fa7a03d49b8.
# Dependency resolution happens before validate; reject changed artifacts even in a warm cache.
printf '%s  %s\n' b9e7d313c36d62134bf3b974e8598c4325060c7802e4d023247e1ba289ee80be "$GRAMMAR_DIR/japanese-grammar-utils-1.0.0.jar" c68934160c3be8cb51b48f2a6e7e89ab1d19f6c8d320a18aa9fae76ef212e675 "$GRAMMAR_DIR/japanese-grammar-utils-1.0.0.pom" | shasum -a 256 -c -
