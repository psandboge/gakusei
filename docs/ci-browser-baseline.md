# CI and browser regression baseline

The PR and `develop` push workflow runs on Ubuntu 24.04 with read-only repository
permission and a 45-minute limit. It installs Temurin Java 17, checksum-verified
Linux x64 Node 24.21.0, exactly npm 11.19.0, and the committed Maven 3.9.16 wrapper.
Actions are pinned to full commits; there are no database/dependency caches or
publication steps. A local pass is separate evidence from a hosted Actions run.

## Prerequisites and complete local sequence

Use an isolated checkout, Java 17, Node 24.21.0, npm 11.19.0, Python 3 (without
`-O`/`PYTHONOPTIMIZE`), Docker with Compose v2 and a running Docker engine.
Allow several GB for Node modules, Maven, the packaged application, Chromium
and disposable PostgreSQL 16.15 volumes. Network access is needed to official
Node/Temurin archives, npm, Maven Central, JitPack, license sources and Playwright
browser downloads. The Maven wrapper verifies its distribution; grammar jar/POM
provenance and license generation remain mandatory. Do not substitute system Maven.

On macOS arm64:

```sh
bash scripts/install-local-tools.sh
. scripts/local-env.sh
java -version
node --version
npm --version
./mvnw --version
npm ci
npm run preflight
npm test
bash scripts/test-postgres.sh -Dskip.frontend=true test
./mvnw -Pproduction -DskipTests package
npx --no-install playwright install chromium
npm run test:browser
python3 scripts/collect-ci-artifacts.py cleanup
python3 scripts/collect-ci-artifacts.py collect
```

On Linux x86_64 use Ubuntu 24.04, Temurin Java 17 selected through `JAVA_HOME`,
Python 3, Docker/Compose, curl, CA certificates and xz. Do not source the Mac
local-env script. `bash scripts/install-ci-tools.sh` prints a shell-quoted PATH
export; execute that export in the current terminal (in Actions it writes to
`GITHUB_PATH`). Run the same ordered commands, replacing the browser install with:

```sh
npx --no-install playwright install --with-deps chromium
```

The Linux dependency installation may need sudo. Do not run the macOS installer
on Linux. For another Mac architecture install the exact matching official tools;
the supplied local installer is arm64-specific. Backend tests must succeed before
packaging with `-DskipTests`; that flag avoids duplicate test execution, never
replaces the PostgreSQL suite. The harness verifies a production jar containing
static JS and refuses to use a development or existing server.

## Owned services, fixture and retained behavior

Neither command loads `.env.local`. Backend tests get an independent fresh
PostgreSQL project. Browser tests create `.tools/browser-tests/<24-hex-run-id>/`
with private permissions, random database/remember-me credentials, their own
`gakusei-browser-<run-id>` project and `_postgres-data` volume, tracked Java PID
and allocated loopback ports. The app port and database port differ and exclude
18082 and 15432. Conflicting inherited Spring/JVM/database/Compose settings are
removed before owned configuration is applied. A discovered listener is never
reused. Never connect to the retained preview, use its accounts, read its
credentials, stop project `gakusei-local`, or remove its volume.

Fresh startup migrates and validates without seeding. Explicit seed supplies
`genki 15` vocabulary. Chromium's Swedish UI journey registers one disposable
learner, explicitly logs out/in, selects Japanese reading → Swedish guess mode,
enables/asserts spaced repetition, submits alternating correct/incorrect answers,
and checks feedback/results against independent account/event/progress rows.
The same learner reauthenticates after app/PostgreSQL restart and explicit reseed;
no replacement registration is allowed. Snapshot agreement includes retention.
Protected routes, invalid login, anonymous admin denial and ordinary-user admin
denial are asserted. Flashcard reveal and translation input receive read-only
smoke checks, without answer writes. Kanji, quiz, favorites, grammar/inflection,
Web Speech, other languages and other browsers are not comprehensive coverage.

In the exercised Chromium flow, the retained remember-me behavior restores the
learner on reload; active exercise state returns to selection. Durable learning
state stays intact. A restart destroys the old HTTP session; the test explicitly
logs in again and compares the same account's data. This narrows the older README
observation that a local development reload did not restore an active session;
neither result promises all authentication/session cases.

The internal runner requires a valid live-owned manifest before any network
access. It runs serially, one Chromium worker, no retries, no focused tests,
three distinct phase output directories and bounded test/readiness timeouts.
See `tests/lifecycle/README.md` for the private manifest/state protocol.

## Failure diagnostics and privacy

The workflow's always-run, five-minute bounded fallback cleanup precedes
collection. The collector derives source-validated backend and browser test IDs,
actual statuses, closed safe cause categories and validated repository source
locations into `artifacts/browser/diagnostics.json`, a summary log and sanitized
Surefire XML. Harness checks distinguish readiness, SQL state, browser runner,
handled termination and cleanup failures. A phase directory only proves it was
started; phase success is recorded after runner and independent SQL checks pass.
Missing older-run or prerequisite evidence is explicitly `unavailable`; CI step
outcomes distinguish frontend/build failure from skipped dependent steps.
`diagnostics.png` renders these same scanned structured facts offline in Chromium.
It never opens the app. Source locations are retained when validated; unavailable
locations are labelled. Test IDs must match static source declarations. Dynamic
identifiers and all raw exception messages, learner values, headers, application
screenshots, raw XML/runner HTML, traces, service logs, credentials, environment,
browser storage and database exports stay private. Safe causes intentionally
omit private payloads while identifying which check and boundary failed.

The scan rejects synthetic markers, credential/header/manifest indicators,
generated token patterns, exact learner credentials/nonces, foreign files and
symlinks. It scans before and after rendering and atomically publishes only a
successful result. A failure removes stale upload output, fails the collection
step and prevents upload. Upload is gated on this step's success, with 14-day
retention. If dependencies/Chromium failed to install, collection may fail closed;
there is no fallback to unscanned raw data. Run `python3 scripts/test-ci-artifacts.py`
for positive/negative privacy cases, including actual generated database values.

## Bounded troubleshooting and exact recovery

Toolchain mismatch fails preflight: select the documented PATH/JAVA_HOME, then
rerun `npm ci`. Never bypass engines, peer constraints or grammar checks. If a
vendor download/checksum fails, retain private evidence and retry the exact pin;
do not silently use a different release. Sass, bundle-size, legacy audit and
external license retrieval warnings remain visible and are not upgrades.

Readiness waits are bounded (Compose 75 seconds; application 100 seconds;
phase 300 seconds). Check Docker availability, disk space, jar prerequisite and
private run logs. Port collisions cause bounded reallocation, never broad process
termination. A phase failure stops immediately and preserves earlier outputs.
Tests must not be weakened to hide a fixture or retained-behavior failure.

EXIT/INT/TERM traps stop/wait only the tracked matching Java PID and remove only
the exact owned Compose project/volume; handled signals fail the run. SIGKILL,
host failure and hard job cancellation may prevent all cleanup, including the
always-run step. Use the absolute ownership record printed by the failed run,
from its original checkout, for bounded idempotent recovery:

```sh
python3 scripts/verify-browser-state.py cleanup /absolute/checkout/.tools/browser-tests/<run-id>/ownership.json
```

The command checks root/run/project/volume/port identity and PID start identity
before access. A changed PID identity is rejected; investigate the exact recorded
process instead of killing it blindly. Never edit a record to point to the preview,
run global volume pruning or use broad `pkill`/Compose cleanup. In a disposable CI
checkout, `python3 scripts/collect-ci-artifacts.py cleanup` applies the same checks
to its run records. Failure to clean is reported, never converted to success.

Full local lifecycle/sentinel proof: `python3 tests/lifecycle/check.py`. It checks
success, injected runner failure, TERM, conflicting inherited settings and an
independent owned sentinel. It never uses preview resources. Keep `.tools/`,
`target/`, generated assets and public diagnostics out of source commits.

For the Boot 4 checkpoint, `boot3-upgrade` now runs the unchanged frozen Boot 3
harness against separately built frozen Boot 2 and Boot 3. `boot4-upgrade` binds
frozen Boot 3 and the candidate with private independent build records. Both
jobs depend on regression. See `backend-boot4.md`; local and hosted results are
separate evidence and neither is established by this configuration alone.
