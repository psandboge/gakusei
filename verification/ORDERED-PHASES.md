# Ordered local development execution (gaku-mtc)

Executed 2026-10-04 in the isolated gaku-5m7 worktree on
`gc/local-development-gaku-5m7`. Existing commits dd955add, 842665ba and e2c93adf
were preserved. This record supersedes the old PostgreSQL/browser blockers in
verification/README.md; that earlier record is retained as history.

## Phase 1 — Java/H2

First verification command with `. scripts/local-env.sh`:
`JAVA_TOOL_OPTIONS=-Djava.net.preferIPv4Stack=true sandbox-exec -D "WORKTREE=$PWD" -f verification/local-verification.sb ./mvnw -o -B -ntp -Dskip.frontend=true test`.
PASS: 45 tests, zero failures/errors/skipped (`ordered-phase1-backend.log`).
Sandboxed existing jar on local H2 at 18081 passed
`python3 scripts/verify-local-http.py http://localhost:18081` (sandbox prefix as
above): registration/login/session, six questions, answer events/progress,
repetition before completion, assets/docs/logout/login. Stop/restart then
`--reset-proof` passed: six fixtures, no prior learner/events/progress.
Logs: ordered-phase1-h2-runtime.log, ordered-phase1-h2-http.log,
ordered-phase1-h2-restart.log, ordered-phase1-reset.log.

## Phase 2 — frontend build

With the same sandbox prefix and pinned Node 24.21.0/npm 11.19.0:
`npm ci --offline`, `npm test`, `npm run compile`,
`npm run compile:production` all PASS. Seven tests passed. The locked graph is
unchanged; Sass/asset-size/legacy-package warnings remain. Evidence:
ordered-phase2-{install,test,dev-build,prod-build}.log.

## Phase 3 — PostgreSQL before frontend runtime

Official image `postgres:16.15-alpine3.24` pulled on arm64 and pinned by manifest
sha256:721873c34ceb9f8d8fc265984940dc982404c105f19ad51be9fdc5970a6080ea.
Official image/init-script behavior reference:
https://hub.docker.com/_/postgres and
https://docs.docker.com/guides/postgresql/immediate-setup-and-data-persistence/.
Docker's normal credential-desktop helper stalled with no output. A temporary
credential-free config pulled the public image successfully; the blocked pulls
were stopped and the temporary config removed. No host Docker configuration was
changed. `docker compose --env-file .env.local -f compose.local.yml up -d --wait`
passed. This run selected port 15432; default is 5432. SQL verified PostgreSQL
16.15, current local role, contentschema ownership and public namespace.
The first SQL quoting attempt failed; corrected heredoc SQL passed.

The unchanged historical master ran to completion on empty PostgreSQL. Hibernate
validation exposed int4 IDs vs Java Long, then a prerequisites schema omission.
Local incremental migration widens IDs/references and double retention fields;
Course maps prerequisites to contentschema. No old changeset was edited.
Dedicated local-postgres startup passed with Hibernate validate and no seed.
Explicit local-postgres,local-seed startup passed with six accounts, 378 nuggets,
nine lesson records, seven preexisting migration categories and one seed marker.
Repeated explicit seed logged "already applied" with unchanged data.
Fixture errors propagate; @Transactional rolls back checked and unchecked errors.
Three added tests cover unsafe profile rejection, completed-seed no-op and refusal
of an unmarked nonempty database. No injected PostgreSQL rollback-fault test was
performed; atomicity rests on the Spring transaction plus marker/fixtures design.
Evidence: ordered-phase3-*.log and ordered-seed-backend-test.log.

## Phase 4 — frontend runtime

`GAKUSEI_FRONTEND_PORT=17777 GAKUSEI_BACKEND_PORT=18082 sandbox-exec ... npm start`
passed; backend used local-postgres. Firefox native computer use was available
in this session (no browser-provider tabs were listed). Local UI showed layout,
assets and populated lesson cards. Registration of disposable pgbrowser1004
succeeded. On question 1/6, adding "Ordered HMR verified" to LessonStats appeared
without navigation or loss of question state; removing it appeared live. The
source file was restored exactly. After completion, direct navigation to
`/play/guess` rendered the shell and returned to selection with genki 15 at 100%.
Transient active questions are not restored by route refresh, as before.
Evidence: ordered-phase4-frontend.log plus observed Firefox AX/screenshot states.

## Phase 5 — integration, packaged app, persistence and reset

Development Firefox completed all six genki 15 questions correctly, showing
100% and 6/6 results. Logout returned to the Swedish public landing page.
Read-only progress helper via the frontend proxy verified six answer events
and six progress rows for pgbrowser1004. After stopping the apps and restarting
PostgreSQL, packaged startup with no seed preserved that account/events/progress.

`JAVA_TOOL_OPTIONS=-Djava.net.preferIPv4Stack=true sandbox-exec -D "WORKTREE=$PWD" -f verification/local-verification.sb ./mvnw -o -B -ntp clean verify -Pproduction`
PASS: frontend locked install/build, 48 backend tests with zero failures/errors/
skipped, executable jar. Final sandboxed `npm test`: seven passing. Jar inspection
found template, hashed assets, local PostgreSQL/seed profiles and changelog.

With the dev server stopped, Firefox at localhost:18082 registered pgjar1004,
completed genki 15, showed feedback then 100% correct / 6 of 6 possible questions,
and logged out. Six answer events/progress rows were verified through the jar.
Both PostgreSQL and jar were then restarted; final browser login and read-only
persistence proof are recorded below. Screenshots/AX states were inspected in
computer use; screenshots were not saved to disk. This is actual browser evidence,
separate from API evidence. English UI selection still uses Japanese→Swedish
material; logout restores the Swedish public fallback.

A second dedicated Compose project, gakusei-local-reset-proof at 15433, tested
fresh full migration + seed + API flow independently. `down -v`, then `up -d
--wait` removed users/seed tables. Explicit bootstrap again produced exactly six
fixtures and zero prior users/events/progress. That test project/volume was
removed afterward. The main persistent project is preserved. Updated jar H2
regression API/auth/event proof also passed with six fixtures and six progress
rows; H2 integration tests passed in the 48-test build.

Listener inspection proved 127.0.0.1 on 18081/18082/18083 and 15432. Application
verification used the existing macOS write/loopback sandbox; public dependency
installation/image pull and Docker container lifecycle use Docker outside that
application sandbox. No production account, production mutation, push, PR or
deployment occurred. The earlier baseline contains read-only production layout
comparison; no new production interaction was necessary.

## Remaining limits

Boot 2.7 and the retained legacy React graph remain a compatibility bridge.
Legacy audit findings, Sass/size warnings, incomplete grammar fixtures/favorites,
auxiliary raw kanji serialization and unavailable license URLs are retained from
the baseline. Kanji/quiz full browser flows and optional speech are not accepted
by vocabulary evidence. No blocker remains for the owned five-phase vocabulary
baseline. Supported-server migration remains separately scoped.

Final proof command:
`sandbox-exec -D "WORKTREE=$PWD" -f verification/local-verification.sb python3 scripts/verify-local-persistence.py http://localhost:18082 pgjar1004`
PASS after both PostgreSQL and packaged backend restart: six answer events and
six progress rows. Firefox re-login with pgjar1004 passed and showed genki 15 at
100% progress. Evidence: ordered-phase5-final-proof.log and observed browser AX
state. All started app processes were stopped after verification; the main
Compose database is stopped with its volume retained. Temporary reset-proof
project and volume were removed. No remote commit publication occurred.
