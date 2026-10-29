# Owner disposition: known PR7 product defects

Owner2026-10-29T11:30Z directs attempting product fixes during the Svelte conversion. If a defect is not fixed by conversion completion, create an open bug with reproduction/evidence for later work. This is not a claim the existing product passes. No product fix is bundled into the current test-harness correction.

| Defect | Conversion expectation | If still present |
| --- | --- | --- |
| Repeated identical-kanji reset, mouse and synthetic touch | New question resets completion/self-mark state; keep both regression assertions. | Create open bug referencing P0-DRAW-mouse/touch and exact evidence. |
| Pending lesson-completion timer after navigation | Dispose/guard timers on route/lesson lifecycle changes; keep navigation assertion. | Create open bug with /about -> /finish/translate reproduction. |
| Stale account favorites publish after logout/login | Guard/cancel account-owned response publication; keep same-document race assertion. | Create open bug with delayed Alice favorites crossing Bob login reproduction; distinguish UI isolation from server authorization. |

P0-LANGUAGE-CACHE is removed at owner's direction, not passed. Language design/review is deferred until after conversion. Existing server-language evidence may remain without widening this correction.

P0 superseded-identity synchronization and post-commit provenance remain harness defects to repair/verify now under the one authorized focused follow-up gaku-pd2d2/cumulativeattempt4. Previous gaku-d2wkd3/max3 remains closed with failures/evidence unchanged. No further automatic attempt or P1 implementation is launched by this disposition file.
