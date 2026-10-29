# P0 independent source review — first pass

Reviewed 2026-10-29 while scenario implementation was in progress. Read-only
inspection of harness, fixture/config, scenarios, measurement and CI sources;
no tests/services were run by this reviewer. This is not a passing execution or
final review of a frozen commit. Only this report was written.

**Disposition: changes needed before claiming the planned P0 coverage.** The
reported repeated-kanji baseline failure must remain visible and requires owner
disposition; P0 does not authorize fixing production or weakening its assertion.

## Findings

### 1. Stale identity across logout/account switch is still untested (medium)

`tests/browser/migration-parity/specs/session.spec.js`, `P0-IDENTITY-DELAY`, holds
startup `/username`, navigates to public about, then releases Bob. No newer
authentication operation supersedes that read. Correctly displaying Bob is
therefore ordinary completion, not proof that a stale Alice identity cannot
overwrite logout or Bob's login. The separate issued-login serialization case
does not exercise this independent identity-read race.

Add one controlled old identity read, supersede it via a real UI auth operation,
then release the old response. Assert the final visible account and absence of
old-account catalog/favorite publication. Preserve the existing pending-route
test under its narrower coverage description.

### 2. Exactly-once write assertions never challenge duplicate activation (medium)

`specs/learning.spec.js` sends one click or Enter per question, then counts
`answeredCorrectly`. `P0-FOCUS` likewise presses Enter once before moving on.
These tests catch spontaneous duplicates, but not the specifically planned rapid
duplicate activation or disabled-control activation defect.

Add a deliberate bounded pair of user activations during feedback/disabled state,
assert one outcome for that question, and ensure counts remain correct after
transition. Keep assertions on API events and observable UI; do not inspect
component guards. Current scenario names/results must not claim duplicate
activation coverage until that stimulus exists.

### 3. Language reload can pass without server restoration (medium)

`specs/navigation.spec.js`, `P0-LANGUAGE`, saves English and reloads in the same
browser storage context. i18next's detector cache alone satisfies the final
English-link assertion; `/api/checkUserLanguage` is not asserted as the source of
restoration. The case title says server persistence while its comment correctly
describes browser storage, leaving a materially ambiguous contract.

Keep the browser-cache check and label it precisely. For server restoration,
clear only the locale detector cache (or create a fresh browser context), perform
UI login to trigger the server language fetch, then assert its request identity,
text response and resulting translated UI. A fixture-backed result still proves
frontend restoration behavior rather than actual database persistence.

### 4. Legacy preference observation is confounded by forced purge (low)

`tests/fixtures/migration-parity/legacy-state.json` always contains an obsolete
projectVersion. `P0-LEGACY` consequently exercises purge plus server identity
confirmation. Its preference assertions cannot independently establish the
documented behavior that PR7 rejects restored lesson preferences even when the
security version matches.

Retain the obsolete-version case for purge. Add a current-version fixture case
using the build's public project version and assert the same learning defaults,
or explicitly limit this scenario's coverage to obsolete-version purge. Do not
infer all preference rehydration semantics from a forced-reset path.

## Harness and evidence observations

- Fixture configuration is separate from live-manifest setup; original
  `playwright.config.js` explicitly ignores the nested suite. Existing real-service
  ownership validation remains in place. No existing listener/origin is accepted.
- Server binds loopback to a randomly selected port excluding the complete
  protected union, logs unknown API requests and returns 501. Browser routing
  blocks foreign origins; no privileged service probes are needed. The port
  selection currently fails on collision rather than trying another port; that
  is an occasional infrastructure failure, not a product failure/retry budget.
- Teardown closes the server and active sockets, and each test has fresh
  synthetic state. Browser contexts should explicitly set `serviceWorkers:
  'block'` to make the intended interception guarantee explicit even though PR7
  currently registers no worker. This is hardening, not a claimed observed leak.
- Learning assertions target UI and request payloads rather than Redux/React
  internals. However mode coverage is intentionally shallow: kanji mode journey
  uses don't-know twice; successful scoring is a separate handwriting case.
  Synthetic touch dispatch checks the shipped adapter, not physical-device input.
- Current handwriting reset assertion is valuable: after question 1 it expects
  the successful-answer control to disappear for question 2. Preserve the reported
  inherited failure. Do not replace it with a wait for the already visible canvas.
- Current drawing coordinate assertion only checks bounds; it would accept
  systematically shifted/scaled in-bounds points. Describe it as bounded export
  evidence, not exact coordinate-mapping equivalence without a fixture tolerance
  check on exported points.
- API ledgers redact auth/register bodies and fixtures are synthetic. Private
  output includes HTML reports and retained failure traces. CI deliberately
  uploads none; maintain that policy unless an explicit sanitized allowlist is
  added. Screenshot files on successful tests are reference artifacts, not pixel
  comparisons or verified visual parity.
- Asset measurement correctly states all emitted JS/CSS totals are not initial
  route payloads. Build manifest records HEAD, but HEAD alone cannot establish a
  clean immutable source build when worktree files are dirty. Final evidence must
  record the reviewed commit and tracked source cleanliness or a reproducible
  source-diff digest. P0 tests added on PR7 are expected; unrecorded frontend
  changes would invalidate the baseline.
- At inspection time the acceptance matrix, known-gap register and baseline
  result summary had not yet appeared in `docs/migration-parity/`; scenario files
  and this review cannot substitute for the final coverage/evidence mapping.

Re-review after scenario owners finish and the coordinator freezes the candidate.
Do not label this source review as hosted CI, real backend proof or owner
acceptance of inherited product failures.
