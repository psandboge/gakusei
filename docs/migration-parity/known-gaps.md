# Known product findings and owner disposition

Owner29October11:30UTC: try to fix these during the Svelte conversion; if still unresolved after conversion, create open bugs for later. This does not claim the existing product passes. Keep regression assertions meaningful.

| Finding | Evidence / conversion task |
| --- | --- |
| Repeated identical-kanji state reset | Mouse and synthetic touch completion/self-mark state persists into next question. Reset on new question; remount assertions remain unverified beyond this failure. |
| Pending lesson timer after navigation | Final-answer timer replaces /about with /finish/translate after navigation. Guard/dispose timers by route/lesson lifecycle. |
| Stale account favorites | Delayed Alice favorites publish after same-document logout and Bob login. Guard account-owned read publication. This is fixture-backed UI isolation evidence, not a proved server authorization failure. |

## Harness findings resolved or removed

- T3-IDENTITY-BARRIER: fixed and verified on committed461d93b3. Native Fetch settlement/exact request and same-document checkpoints replace Response.finished on an intentionally unread body. Bob/no-Alice assertions passed.
- T3-HEAD: fixed and verified; committed test-only descendant allowed, product/build/lock remain compared to immutable PR7. Static rejection controls5/5 passed.
- T3-LOCALE: language-cache test removed explicitly by owner; not a pass. Revisit language after conversion. Server-language case remains passing.

Historical reports and prior gaps are retained under history/attempt3/. Latest full result remains19pass4knownproductfail, not a green suite. Product repairs happen during conversion under its execution scope; they are not implemented by this harness correction. No P1 started here.

## Evidence and CI limits

Synthetic API/browser behavior does not prove real cookie/CSRF enforcement, durable server writes or physical-device touch behavior. Existing real-service proof remains separate. Reference screenshots are not visual-diff assertions. Private traces/ledgers/ownership manifests are not uploaded.

Parity CI now runs on draft PRs using `npm run test:parity:baseline`; the raw `npm run test:parity` remains strict. The baseline gate requires the exact23-case inventory and assertion-source hashes, and accepts only the four recorded failure fingerprints. New failures, incomplete/stale reports, skips/retries/timeouts, process failures, or invalid build/source provenance fail the gate. Known-case passes are reported as improvements. A gate pass means no new regressions, not product fixes or full product acceptance. Owner12:28 authorized continuation5/max5 with one hosted verification; it is pending publication. No automatic sixth attempt. Existing standard CI remains unchanged.

## CI gate continuation6

Owner12:50 authorized one focused gate diagnostic/repair and one hosted verification, cumulative6/max6. The gate now removes ANSI color formatting from Playwright snippets before the same exact pinned-source comparison. Four CI-colored assertion frames deterministically reproduce old rejection and repaired acceptance; the prior hosted rejection cause remains unconfirmed because its private artifacts were not retained. Fixed rejection codes now identify evidence failures without exposing dynamic error text. All105 gate/runner controls pass, including the original86. The retained report still classifies gatePASS/rawFAIL19pass4fail; this is not a new browser run. Hosted verification for the repaired commit is pending. No automatic seventh attempt, product repair, merge or deployment.
