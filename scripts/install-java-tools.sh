#!/usr/bin/env bash
# Separate verified JDK homes; never accept an executable cache without its receipt.
set -euo pipefail
TOOLS="${GAKUSEI_JAVA_TOOLS_DIR:-${GAKUSEI_TOOLS_DIR:-$HOME/.cache/gakusei-tools}/java}"
mkdir -p "$TOOLS"
TOOLS=$(cd "$TOOLS" && pwd -P)
case "$(uname -s)/$(uname -m)" in
  Darwin/arm64) PLATFORM=mac-arm64; ARCH=aarch64_mac; SUFFIX=/Contents/Home
    SHA17=f9845abc8403f1d489402201064e7b9f2c57605d8717b85a95a15d94f882eeb7
    SHA25=61979887f7506a24a57439ff99adb8b3a7fc89977d9cfe3b8984f58a981b7b9d ;;
  Linux/x86_64) PLATFORM=linux-x64; ARCH=x64_linux; SUFFIX=
    SHA17=166774efcf0f722f2ee18eba0039de2d685b350ee14d7b69e6f83437dafd2af1
    SHA25=dbb698396d478e7fa2b1e50f4103324b2a99b90569ee27c33f2261f9215cf41e ;;
  *) echo 'Requires macOS arm64 or Linux x86_64' >&2; exit 1 ;;
esac
for MAJOR in 17 25; do
  if [[ $MAJOR == 17 ]]; then VERSION=17.0.16; BUILD=8; DIGEST=$SHA17
  else VERSION=25.0.4.1; BUILD=1; DIGEST=$SHA25; fi
  ARCHIVE="OpenJDK${MAJOR}U-jdk_${ARCH}_hotspot_${VERSION}_${BUILD}.tar.gz"
  URL="https://github.com/adoptium/temurin${MAJOR}-binaries/releases/download/jdk-${VERSION}%2B${BUILD}/$ARCHIVE"
  JAVA_DIR="$TOOLS/jdk-$VERSION+$BUILD$SUFFIX"
  RECEIPT="$JAVA_DIR/gakusei-jdk-receipt.json"
  if [[ ! -e "$TOOLS/jdk-$VERSION+$BUILD" ]]; then
    STAGING=$(mktemp -d "$TOOLS/extract.XXXXXXXX")
    trap 'rm -rf "$STAGING"' EXIT
    curl --fail --location --retry 2 --connect-timeout 15 --max-time 180 "$URL" -o "$STAGING/archive.tar.gz"
    python3 - "$STAGING/archive.tar.gz" "$DIGEST" <<'PY'
import hashlib, sys
assert hashlib.sha256(open(sys.argv[1], 'rb').read()).hexdigest() == sys.argv[2], 'JDK archive checksum mismatch'
PY
    tar -xzf "$STAGING/archive.tar.gz" -C "$STAGING"
    mv "$STAGING/jdk-$VERSION+$BUILD" "$TOOLS/"
    python3 - "$JAVA_DIR" "$URL" "$DIGEST" "$PLATFORM" "$MAJOR" "$VERSION+$BUILD" <<'PY'
import hashlib, json, pathlib, sys
home = pathlib.Path(sys.argv[1]).resolve()
data = dict(schema='gakusei.jdk-install.v1', home=str(home), archive_url=sys.argv[2],
            archive_sha256=sys.argv[3], platform=sys.argv[4], major=int(sys.argv[5]),
            full_version=sys.argv[6], vendor='Eclipse Adoptium',
            executables={name: hashlib.sha256((home/'bin'/name).read_bytes()).hexdigest()
                         for name in ('java', 'javac', 'jcmd')})
with (home/'gakusei-jdk-receipt.json').open('x') as out:
    json.dump(data, out, indent=2)
PY
    rm -rf "$STAGING"
    trap - EXIT
  fi
  python3 - "$JAVA_DIR" "$URL" "$DIGEST" "$PLATFORM" "$MAJOR" <<'PY'
import hashlib, json, pathlib, sys
home = pathlib.Path(sys.argv[1]).resolve()
receipt = json.loads((home/'gakusei-jdk-receipt.json').read_text())
assert receipt['schema'] == 'gakusei.jdk-install.v1'
assert receipt['home'] == str(home) and receipt['archive_url'] == sys.argv[2]
assert receipt['archive_sha256'] == sys.argv[3] and receipt['platform'] == sys.argv[4]
assert receipt['major'] == int(sys.argv[5])
for name in ('java', 'javac', 'jcmd'):
    assert receipt['executables'][name] == hashlib.sha256((home/'bin'/name).read_bytes()).hexdigest(), 'Tampered JDK executable'
PY
  printf 'export GAKUSEI_JAVA%s_HOME=%q\n' "$MAJOR" "$JAVA_DIR"
done
