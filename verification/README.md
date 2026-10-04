# Local baseline execution record

Executed on 2026-10-04 from the isolated `gaku-5m7` worktree based on
`22900f525bf4719b7665978472910363e5d7a8e3`. Local commits only; no push, PR or deployment.

## Results

| Check | Observed result | Evidence |
| --- | --- | --- |
| First verification: `npm ci` with original checkout | FAIL: no package-lock | first-npm-ci.log |
| Pinned tool archives | SHA-256/SHA-512 matched; Temurin 17.0.16+8, Node 24.21.0/npm 11.19.0, Maven 3.9.16 | README pins; wrapper checksum; provenance.log |
| `npm ci` | PASS clean reinstall; no peer bypass; unchanged locked graph | npm-ci-final.log; packaged-build.log |
| `npm test` | PASS **7 tests**: original 6 plus namespace/fallback regression | frontend-test-final.log |
| `npm run compile`, `npm start` | PASS dev compilation; later React Refresh startup and live edit verified | frontend-build-4.log; dev-frontend-refresh.log |
| `npm run compile:production` | PASS; production builds retain Sass and asset-size warnings | frontend-production.log; packaged-build.log |
| `./mvnw -Dskip.frontend=true test` | PASS **45 tests**, 0 failures/errors/skipped, including 2 real local context/repository/HTTP checks | backend-test-3.log |
| `./mvnw clean verify -Pproduction` | PASS **45 backend tests**, full frontend install/production build, executable jar | packaged-build.log |
| Grammar dependency | Jar/POM strong hashes validated; source commit from JitPack build log | scripts/verify-grammar.sh; provenance.log |
| Backend dependencies/effective POM | H2 2.1.214/Boot 2.7.18; every frontend execution receives skip switch and Node/npm pins | dependency-tree.log; effective-pom.xml |
| Dev browser acceptance | PASS account registration, session, populated lesson, feedback/results, logout/login, progress and HMR | UI observations described below; dev-users.json; dev-backend-alt.log |
| Packaged jar HTTP acceptance | PASS fresh local session, six questions/events/progress, repetition selection, static assets/docs and logout/login | packaged-http-final.log |
| Jar inspection | Generated template, hashed JS, local Bootstrap fonts/styles and license resources embedded | jar-assets.txt; artifact-sha256.txt |
| H2 restart | PASS exactly six fixtures; prior accounts/events/progress absent | h2-reset.log; packaged-restart.log |
| Packaged jar browser acceptance | **BLOCKED**: computer-use server lost native window (`cgWindowNotFound`); Firefox/Safari reconnection and in-app browser unavailable | No completed visual jar flow claimed |

Final proof command: `python3 scripts/verify-local-http.py http://localhost:18081`:
**PASS**, starting with six fixtures; six answer events and six progress rows.
Run it only against a disposable local instance. It asserts a loopback HTTP origin.
After stopping/restarting the jar, `python3 scripts/verify-local-http.py
http://localhost:18081 --reset-proof` passed. The helper posts the existing event
sequence (question, userAnswer, answeredCorrectly, updateRetention), not a new API.

## Browser observations

Firefox inspected the public production landing page read-only: navigation,
gradient Bootstrap navbar, Japanese background illustration and landing sections.
The local page retains that layout. No production account or event action occurred.

Local development ran at localhost:17777 with backend 127.0.0.1:18080 because
8080 was occupied by an unrelated process. Disposable `localdev1004` registered
and logged in. Vocabulary → genki 15 supplied six questions with four alternatives.
Three questions were answered before an HMR compatibility repair; after a study
route refresh the app returned to selection and supplied the three remaining
questions. The final results screen showed 3/3 and 100%; the backend recorded all
six answer events and six distinct progress rows. Logout returned to the public
page with Swedish fallback; re-login showed genki 15 at 100% progress.

A temporary `HMR verified` marker in LessonStats appeared without navigation,
retaining the current question and answer state after switching from failing old
react-hot-loader to React Refresh. The marker was removed and its removal appeared
live. Full study-route reloads load the shell and return to selection; transient
active lesson state is not restored. Screenshots were inspected through computer
use but the native interface did not provide saved screenshot artifacts.

The dev server and backend were stopped before packaged checks. The jar alone
ran at localhost:18081. Browser automation then returned `cgWindowNotFound` across
Firefox and Safari; no in-app browser was available. HTTP/jar inspection evidence
is recorded separately and does not establish packaged visual acceptance.

## Actual failures and repairs

- Original clean install lacked a lockfile.
- Modern npm rejected react-tooltip 3.11.6's malformed `>=^16.0.0` peer range:
  pinned 3.8.4. React popup was kept at 0.9.3, Redux thunk at 2.3.0, and prop-types
  at 15.6.2 to satisfy the actual React-16/Redux-3 graph. Toggle's obsolete peer
  declaration is patched in a vendored MIT package; no force/legacy-peer-deps.
- Boot compilation failed on the removed ErrorController method and boolean
  ErrorAttributes argument: adapted to Boot 2.7's API.
- Babel register rejected the legacy ignore function; Chai register subpaths did
  not resolve. Updated bootstrap; Mocha exits explicitly because the legacy
  React/jsdom environment leaves handles alive after its completed tests.
- Webpack 5/Dart Sass exposed root stylesheet imports, absolute asset resolution
  and the XML parser's timers/stream dependencies: configured explicit handling.
- Runtime revealed missing process shim, wrong translation namespace and an
  undefined Redux dispatch after login: fixed; namespace/fallback has a regression.
- Old react-hot-loader crashed during a live edit: replaced only its build/runtime
  integration with React Refresh, then repeated live browser verification.
- Default backend startup found 8080 in use: verified configurable alternate ports.
- Early HTTP helper probes assumed quoted minified HTML attributes and omitted
  prerequisite question/userAnswer events. Those assumptions were corrected to the
  observed API contract; the jar's early 500 traces remain in packaged-runtime.log.
  Requesting repetition after all material is scheduled returns the existing empty
  question 500; the proof checks repetition selection before completing material.

## Content gaps and remaining risk

`content-coverage.json` records five vocabulary lessons, two kanji lessons,
zero grammar lessons and one selectable quiz. Raw quiz repository has three
records. Correct kanji and quiz question endpoints each returned five questions
(`content-question-probes.json`), but their complete browser flows were not tested.
Raw Spring Data REST `/api/kanjis` returns 500 with a Jackson object-id definition
error; the custom kanji question endpoint succeeds. That auxiliary serialization
gap is retained for follow-up, rather than implying all APIs/features are restored.

License generation ran, with missing grammar metadata and unavailable GNU/activation
URLs logged explicitly. It is not proof all license texts downloaded. `npm audit`
reports **103 findings: 22 moderate, 35 high, 46 critical** across the retained legacy
graph. No broad security modernization is claimed by this local compatibility task.
Boot 2.7 and retained frontend runtime majors need the separately scoped supported
server/dependency decision. PostgreSQL persistence/migrations/seed/reset remain M4;
currently supported server migration planning remains M5. Grammar content/favorites
and optional Japanese speech voices are not accepted by vocabulary-only evidence.

## Retry 2: sandbox verification (gaku-18x)

The previous implementation is unchanged. Native Firefox and Safari each still
return `Computer Use server error -10005: cgWindowNotFound`; the native launch API
is unavailable and `cua.createBrowserTab("iab", ...)` returns
`Browser is not available: iab`. No packaged visual flow is claimed.

macOS `/usr/bin/sandbox-exec` is available even though the command executor itself
is unrestricted. `local-verification.sb` restricts writes to this worktree and
OS temporary directories and restricts TCP traffic to loopback. Reads and other
operations retain the default policy; this is a verification sandbox, not a
production security boundary. The denial probes in
`retry-sandbox-enforcement.log` demonstrate outside writes and remote outbound
connections fail with PermissionError, while local bind/listen/connect works.

From the validated worktree with `. scripts/local-env.sh`:

```sh
WORKTREE="$(pwd -P)"
sandbox-exec -D "WORKTREE=$WORKTREE" -f verification/local-verification.sb npm test
JAVA_TOOL_OPTIONS=-Djava.net.preferIPv4Stack=true sandbox-exec -D "WORKTREE=$WORKTREE" -f verification/local-verification.sb ./mvnw -o -B -ntp -Dskip.frontend=true test
sandbox-exec -D "WORKTREE=$WORKTREE" -f verification/local-verification.sb java -Djava.net.preferIPv4Stack=true -jar target/gakusei.jar --spring.profiles.active=local --server.port=18081
# Wait for the jar to be ready, then in a second terminal:
sandbox-exec -D "WORKTREE=$WORKTREE" -f verification/local-verification.sb python3 scripts/verify-local-http.py http://localhost:18081
# Stop/restart the jar using the same command before:
sandbox-exec -D "WORKTREE=$WORKTREE" -f verification/local-verification.sb python3 scripts/verify-local-http.py http://localhost:18081 --reset-proof
```

Frontend: **7 passing**. Backend: **45 tests, zero failures/errors/skipped**.
Packaged HTTP proof: **PASS**, six fixtures before registration, six questions,
six answer/progress rows, auth/session, static assets/docs and logout/login.
The existing full-build jar is used, with no dev server. No dependency install or
new packaging was necessary because source/tool pins are unchanged.

Actual retry failures are retained: the first sandbox's combined local/remote
network filter did not constrain remote traffic; the corrected profile splits
bind/inbound/outbound allowances, and all enforcement probes pass. Initial
backend/jar execution failed to bind Java's dual-stack socket in the localhost
sandbox; `-Djava.net.preferIPv4Stack=true` resolves it without widening access.
The first HTTP probe ran before readiness and got ConnectionRefusedError; the
final probe waited for a successful root response and passed. Initial/dualstack/
before-ready logs preserve these failures separately from final results.

Sandboxed H2 reset proof: **PASS**, exactly six fixtures and zero prior users,
events or progress after restart (`retry-sandbox-h2-reset.log`). Both retry jar
processes were stopped after verification. Listener inspection recorded only
127.0.0.1:18081, and no dev server was used.

## Retry 3: browser availability (gaku-96k)

The first verification command `cua.getState()` passed inventory discovery but
returned no browser providers. Native Firefox and Safari both still fail with
`Computer Use server error -10005: cgWindowNotFound`; creating an in-app browser
fails with `Browser is not available: iab`. Exact calls/results are retained in
`retry3-browser-availability.log`. No usable visual surface exists, so the packaged
browser flow remains blocked. No application process was started on this attempt.
Source behavior is unchanged; the previously passing build, 7 frontend tests,
45 backend tests and sandboxed HTTP/reset evidence remain valid. Repeating those
checks would not resolve the missing visual gate.
