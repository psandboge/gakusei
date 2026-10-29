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

The new parity job is skipped while PR8 is draft; existing repository CI runs independently. Marking it ready enables the strict suite, which still reports the four known product failures. Do not interpret skipped parity as success. Cumulative correction/verification4/4 is spent; any additional run needs owner disposition.
