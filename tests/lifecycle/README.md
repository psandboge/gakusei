# Owned lifecycle interface (package A)

Build prerequisite: pinned Java 17/Node/npm environment, `npm ci`, then
`./mvnw -Pproduction -DskipTests package` after the independent backend tests.
`bash scripts/test-browser.sh` requires `target/gakusei.jar` with production JS.
Do not rebuild or replace `target/gakusei.jar` while the harness is running.
The default runner is `npx --no-install playwright test`, supplied by package B.
An explicit argument vector replaces the runner for the lifecycle probe only.
No arbitrary origin or existing listener is accepted. No `.env.local` is loaded.

Each run uses `.tools/browser-tests/<24-hex-id>/` (0700), random database and
remember-me credentials, a `gakusei-browser-<id>` project, its exact
`_postgres-data` volume and allocated loopback ports excluding 18082/15432.
`ownership.json` has no database or learner password. It is private and records
project, volume, ports, root, tracked Java PID/start identity and run nonce.
`manifest.json` is atomically replaced before each phase. The harness verifies
Java startup and Compose labels/mount/port/health before runner or SQL access.

Runner environment:

- `GAKUSEI_BROWSER_PHASE`: `journey`, `after-restart`, `after-reseed`.
- `GAKUSEI_BROWSER_MANIFEST`: absolute private JSON manifest path.
- `GAKUSEI_BROWSER_OUTPUT_DIR`: distinct private directory for this phase.

Manifest contains `run_id`, `nonce`, `origin`, `phase`, `state_path`,
`output_dir`, project ownership and `fixture`. Fixture has `lesson: genki 15`,
`category: 2`, and `nuggets: [{id, reading, swedish}]`. Reading-question and
correct-alternative identities must be recorded separately by B; state
`nugget_id` is the correct alternative identity emitted by the UI.
Before network access B must invoke
`python3 scripts/verify-browser-state.py validate-manifest "$GAKUSEI_BROWSER_MANIFEST"`
in its inherited environment and require success. This checks private permissions,
manifest identity, tracked PID and Compose ownership. Use only the allocated origin;
never use existing-server reuse. Configure output/report paths per phase.

The journey writes `state_path` atomically (0600), with this JSON structure:

```json
{"run_id":"<manifest run_id>","nonce":"<manifest nonce>",
 "origin":"<manifest origin>","username":"<alphanumeric 2–32 chars>",
 "password":"<private login password>","lesson":"genki 15","category":2,
 "submissions":[{"nugget_id":"<correct alternative ID>","correct":true}]}
```

Require this same identity in later phases; never register a replacement.
Harness compares independent scoped account/answeredCorrectly/progress SQL to
actual submissions, then compares exact durable rows (including retention)
across PostgreSQL/app restart and explicit reseed. B adds real UI login and
learning assertions; synthetic probe results are not browser acceptance.
`python3 scripts/verify-browser-state.py snapshot <ownership.json> <learner.json>`
provides the same read-only allowlisted proof within the inherited runner env.
No password hash or entire database is exported. Runner exits fail immediately.

Run focused real-service checks with `python3 tests/lifecycle/check.py`.
They use a synthetic account/event/progress fixture only for orchestration
proof, and an independent disposable PostgreSQL sentinel for isolation proof.
The sentinel is never the retained preview. Logs and all raw JSON remain
private; C must collect/scan an explicit safe allowlist before publication.
Never upload this run directory, learner JSON, raw traces or unsanitized logs.

Idempotent, bounded fallback (C's `if: always()`):
`python3 scripts/verify-browser-state.py cleanup <absolute-ownership.json>`.
It validates run/project/path identity, stops only the recorded matching PID,
and runs exact-project `down -v --remove-orphans --timeout 10`. EXIT, INT and
TERM clean up; handled signals fail. SIGKILL cannot run cleanup: retain the
ownership path and run the same exact recovery command. No global cleanup.
Backend `bash scripts/test-postgres.sh -Dskip.frontend=true test` uses its own
independent project and forces datasource/profiles/listener. It rejects user
Spring/JVM profile/property overrides. Parent Spring/JVM/DB/Compose settings
are removed before run-owned settings are applied.

Boot 4 adds an independently bound Boot 3→Boot 4 proof, packaged environment
factory check, provenance guards and bound failure/TERM sentinel proof. See
`docs/backend-boot4.md` for required full-SHA/hash/private-build-manifest inputs
and exact ownership cleanup. The old Boot 2→Boot 3 proof runs from frozen Boot 3.
