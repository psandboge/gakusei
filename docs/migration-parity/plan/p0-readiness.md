# P0 implementation readiness

Read-only source analysis, 2026-10-29. Baseline: PR7 merge
`03ce2f38d3099e9ccd7dd09a430e023e9f4ce0d0`. No tests, services,
credentials or protected resources were accessed. This report is the only file
written by this analysis. Owner authorization reported by coordinator covers P0
and a PR for inspection; old planning-only language needs that amendment recorded.

## Minimal implementation split

1. **Harness/contracts owner:** separate fixture Playwright configuration, owned
   ephemeral loopback static server, synthetic API fixture router, route/API/storage
   inventory and acceptance matrix. Own package scripts and common helpers.
2. **Learning cases owner:** six deterministic short lessons, answer-event ledger,
   text/choice/flash focus and duplicate-activation assertions, results/replay,
   kanji mouse/touch/resize/reset fixtures. Depends only on harness interfaces.
3. **Session/preferences cases owner:** synthetic accounts, delayed identity/auth
   responses, registration/logout/recovery, legacy preference fixture, navigation,
   screenshots and sanitized evidence. Depends only on harness interfaces.
4. **Integrator:** run immutable PR7 builds, classify first material failures,
   measure production assets and retain existing owned real-service proof. Review
   one coherent P0 PR; do not begin conversion or repair product behavior in P0.

Two case owners can proceed in parallel once fixtures expose base URL, scenario
setup and captured request ledger. Do not split by six independent mode workers:
shared engine and event semantics would create unnecessary integration work.

## Fixture browser approach

Existing `playwright.config.js` uses `validate-run` global setup, one worker,
zero retries, and `testMatch: '*.spec.js'` in `tests/browser`. It cannot simply run
new nested parity tests without configuration changes. Existing helpers invoke
scoped SQL and require private live manifests. Keep those safeguards intact.

Add an explicit separate fixture config, proposed
`playwright.migration-fixtures.config.js`, collecting only
`tests/browser/migration-parity/**/*.spec.js`. It must not import live-manifest
setup/helpers. Serve built PR7 assets on a newly bound loopback port; close only
that server on teardown. Return SPA HTML for document routes and static assets
for actual asset requests. Use deterministic per-context route interception for
`/username`, auth endpoints and `/api/**`, including same-origin CSRF cookie and
response shapes. Reject unmatched APIs and external requests, rather than letting
them contact a real backend. Disable service workers. Fixtures use synthetic
values exclusively; tests interact through UI, never Redux or React internals.

Use controlled promises to order responses, then assert visible identity and
account-owned content. Capture parsed outgoing requests in an in-memory ledger.
Count `answeredCorrectly` events as answer/progress writes, not every telemetry
record. `/api/events2` batches heterogeneous records; finish also queues events.
Freeze expected event batching from source and actual baseline observations.

Question API fixture families differ: `/api/questions`, `/api/questions/kanji`,
`/api/quiz`; catalog uses `/api/lessons` or the existing spelling `/api/quizes`.
Incorrect answers use `/api/wrongquestions` and `/api/wrongquestions/kanji`, with
204 handling. Include favorites, counts, language initialization, statistics,
quiz images, drawing upload and static SVG resources in the endpoint inventory.
Do not invent a generic response shape. Derive fixtures from controller/test
source and reducer assumptions before browser execution.

Fixture tests prove browser behavior and request contracts, not real cookies,
CSRF enforcement, password mutation or durable PostgreSQL writes. Label them
`fixture-backed`; keep real-service results separate.

## Existing real proof and prerequisites

`tests/browser/README.md`: guess has a complete mixed-answer journey and durable
restart/reseed proof. Flashcards and translate have rendering-only smoke without
answer writes. Kanji, quiz and grammar are inventoried, not executed. Existing
`auth.spec.js` covers protected routes, invalid login and denied admin API;
`zz-compatibility.spec.js` covers anchors, chart, localization, icons and overlays.
No six-mode baseline already exists.

`scripts/test-browser.sh` delegates to the owned lifecycle runner. It requires a
production `target/gakusei.jar`, Docker/Compose PostgreSQL, a compatible JDK,
Chromium and fixture seed data. The runner allocates resources, validates process
and Compose ownership, and runs journey/restart/reseed phases with the same
synthetic learner. Never supply an arbitrary existing origin or reuse a preview.
Do not rebuild the JAR during that run. Do not publish private learner/manifests,
raw HTML reports or unreviewed screenshots.

Important readiness discrepancies: lifecycle README still mentions Java 17,
but **PR7 pom.xml specifies Java 25**. Use pinned source configuration, not the
stale README prerequisite. Node/npm are exactly 24.21.0/11.19.0 and preflight
rejects mismatches. The inspected lifecycle runner protects 18082, 18083, 15432,
15433; the migration plan additionally excludes 52655, 62508, 62721. Enforce the
union before any newly authorized service launch. Do not silently weaken it.

Existing real fixture metadata explicitly supplies six genki-15 vocabulary
identities. It does not expose equivalent deterministic quiz, conjugation and
kanji stroke/scoring fixtures. Those need source-derived fixtures or separate
owned seed additions; fixture-backed cases can progress without a backend.

## Commands and evidence

Commands below are recommendations for the authorized isolated P0 worktree,
not commands executed by this analysis. First verify its HEAD is exactly PR7 and
use the repository-pinned toolchain. Dependency installation/build writes only
that worktree. Do not run generic browser specs against a retained preview.

```sh
git rev-parse HEAD
npm ci
npm run preflight
npm test
npm run compile:production
node tests/browser/check-guards.js
npx --no-install playwright install chromium
```

After the proposed fixture configuration exists:

```sh
npx --no-install playwright test --config playwright.migration-fixtures.config.js --list
npx --no-install playwright test --config playwright.migration-fixtures.config.js
```

Collection is not execution evidence. Proposed configuration must own server
startup/cleanup and reject any caller-supplied foreign origin.

Only after owned-service readiness and the complete protected-port exclusion
check, existing real integration commands are:

```sh
bash scripts/test-postgres.sh -Dskip.frontend=true test
./mvnw -Pproduction -DskipTests package
npm run test:browser
```

These start disposable services and are intentionally distinct from fixture
execution. If the service prerequisites or exclusion guard are absent, record
real integration as blocked and retain fixture progress; do not bypass ownership
validation. Existing test scripts are not a permission to resume the rig.

Record exact source SHA, tool versions, commands, exit codes and per-scenario
pass/fail/blocked/not-run. Measure built JS/CSS raw and gzip bytes from the same
production build; distinguish initial assets, deferred chunks, fonts and images.
Pin screenshots to Swedish locale, synthetic content, desktop/mobile viewports
and stable animations/fonts. First inherited failure becomes a named gap with
expected baseline behavior and owner disposition, not an automatic product fix
or accepted Svelte regression. P0 is ready to implement with these boundaries;
full six-mode verification remains to be established.
