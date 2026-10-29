# P0 unresolved findings

P0 is not accepted. Existing attempt3/max3 is exhausted. Further correction/verification requires explicit owner disposition; no product repair or Svelte conversion starts here.

## Test-harness blockers

- **T3-HEAD:** harness/provenance.js requires HEAD to equal PR7 exactly. Committing this test pack changes HEAD, so post-commit/local/hosted execution will fail before checking product invariance. Proposed correction: allow the test-only descendant commit, compare product/build/dependencies against pinned PR7, and record both baseline and tested HEAD plus source digest. Not corrected or rerun after final freeze.
- **T3-LOCALE:** P0-LANGUAGE-CACHE uses a dropdown selector matching two controls. Its language-save/cache-restore assertions were not reached; this is not evidence of a locale product defect. Scope the selector to the intended language control, then reverify only within a new owner-approved allowance.
- **T3-IDENTITY-BARRIER:** same-document old-identity test reached the new Bob account/catalog but timed out on Response.finished after releasing the old Alice response. Final identity/no-stale-publication assertions remain unverified. Diagnose the barrier without assuming either application correctness or a stale-identity defect.

## Inherited PR7 product findings

- **P0-DRAW (mouse and synthetic touch):** completing a repeated identical kanji leaves self-mark/completed state visible on the next question. The scoring/export/coordinate-tolerance assertions passed before the reset failure; remount assertions were not reached.
- **P0-ROUTE-TIMER:** the pending final-answer timer changes /about to /finish/translate after the user navigates away. Earlier focus/Enter/disabled/reset assertions in that case passed.
- **P0-ACCOUNT-READ:** a delayed old-account favorites response updates the new account's lesson favorite state after same-document logout/login. This is fixture-backed browser reproduction and source evidence; no live-user data was accessed. The ordinary lesson read path lacks the publication ownership check used for registration initialization.

These should be explicitly dispositioned before migration parity is accepted. Keep the failing assertions meaningful; do not hide them with skip, expected-fail or broad selector changes. Resolving existing product behavior is separate from repairing the test harness.

## Evidence limits

The new pack uses synthetic APIs and does not establish real session cookies, CSRF enforcement, durable writes or physical-device touch correctness. The existing real-service suite is separate and does not cover all24 new contracts. The images are synthetic reference captures only. Raw traces, auth payload ledgers, fixture ownership manifests and browser HTML reports remain private and are not uploaded. A red baseline can be reviewed without being accepted.

## Draft CI posture

The new parity job is skipped when the pull request is a draft. This prevents an unbudgeted fourth parity execution and the known post-commit startup failure. Marking the PR ready would enable that job; do not do so until the test-harness blockers and new verification allowance are dispositioned. No hosted parity pass is claimed. Existing repository CI is unchanged.
