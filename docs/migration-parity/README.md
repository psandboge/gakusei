# PR7 migration acceptance baseline (P0)

This package measures existing React18 behavior before any Svelte conversion. Product baseline: merged PR7, `03ce2f38d3099e9ccd7dd09a430e023e9f4ce0d0`. Product JavaScript/backend/dependency versions are unchanged. The test pack defines browser-visible contracts, not React internals.

## Commands

Use the repository-pinned Node/npm environment, then `npm ci --strict-peer-deps`.

- `npm run test:parity`: isolated fixture-backed browser baseline, no arbitrary origin or live account.
- `node --test tests/browser/migration-parity/harness/server.test.js`: local harness isolation controls.
- `node scripts/measure-migration-assets.js .tools/migration-parity/build`: emitted JS/CSS sizes using fixed compression boundaries.
- Existing real-service browser suite remains separate through its owned lifecycle runner; see `tests/browser/README.md`. Its observed journey/restart/reseed result is summarized in real-service-baseline.json.

Playwright is pinned by the repository lockfile; Chromium must be installed in the selected environment. Each browser run keeps a unique private directory under `.tools/migration-parity/runs/`. Zero test retries. Unknown API/foreign traffic is rejected, synthetic fixture accounts are isolated, and only owned loopback servers are stopped. No real backend/credential/preview is an input to the fixture suite. Fixture authentication results do not prove server CSRF/session enforcement or durable database writes.

## Evidence and interpretation

contracts.md inventories actual PR7 routes, HTTP and storage semantics. review.md records source-review findings. The final baseline report and coverage matrix must distinguish inherited product defects, test-contract mistakes, passed checks and missing coverage. A meaningful failing regression assertion is retained; tests are not marked expected-fail or weakened simply to make this baseline green.

Raw browser traces/reports, fixture account records and database ownership manifests are excluded from Git/CI artifacts. Only reviewed synthetic reference screenshots and sanitized summaries may be committed. Screenshots are reference captures, not a passed pixel-diff assertion. All emitted JS/CSS totals include lazy/static assets and are not initial-route download sizes.

P0 does not repair the product, begin Svelte implementation, waive known gaps or permit merge/deployment. A red baseline PR can be inspected, but conversion requires explicit disposition of material gaps.
