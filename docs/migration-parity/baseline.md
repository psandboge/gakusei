# P0 baseline result and coverage

**Focused harness correction passed. Product baseline remains failing for four cases explicitly assigned to conversion fixes by the owner.**

Latest committed-candidate run: **23 cases, 19 passed, 4 failed**, retries0, 97.109 seconds. P0-LANGUAGE-CACHE was removed by owner instruction, not passed.

Product baseline `03ce2f38d3099e9ccd7dd09a430e023e9f4ce0d0`; tested commit `461d93b3c226b9e9d50d5d58d9867f3554bb5734`; source digest `3ba54177b651806157e3b686f72dc9c6ce52e8dc264855a40828570978734092`, unchanged before/after. Product/build/lock inputs remain PR7. Later documentation-only publication does not claim another run.

| Case | Result | Classification / evidence limit |
| --- | --- | --- |
| P0-DRAW-mouse | failed | inherited-product: Repeated same kanji retains completed self-mark control on question2; expected0, actual1. Scoring, bounded export and endpoint mapping within2CSS pixels passed before reset failure. Remount assertions not reached. |
| P0-DRAW-touch | failed | inherited-product: Repeated same kanji retains completed self-mark control on question2; expected0, actual1. Synthetic touch adapter scoring, bounded export and endpoint mapping within2CSS pixels passed before reset failure. Remount assertions not reached; physical-device touch not tested. |
| P0-MODE-guess | passed | verified-fixture-behavior: All assertions in this bounded synthetic API case passed. |
| P0-MODE-quiz | passed | verified-fixture-behavior: All assertions in this bounded synthetic API case passed. |
| P0-MODE-flashcards | passed | verified-fixture-behavior: All assertions in this bounded synthetic API case passed. |
| P0-MODE-translate | passed | verified-fixture-behavior: All assertions in this bounded synthetic API case passed. |
| P0-MODE-grammar | passed | verified-fixture-behavior: All assertions in this bounded synthetic API case passed. |
| P0-MODE-kanji | passed | verified-fixture-behavior: All assertions in this bounded synthetic API case passed. |
| P0-FOCUS | failed | inherited-product: Typed Enter, disabled input, actual Next/input focus and reset passed; pending final-answer timer replaced /about with /finish/translate after navigation. |
| P0-DUPLICATE | passed | verified-fixture-behavior: All assertions in this bounded synthetic API case passed. |
| P0-PREFERENCES | passed | verified-fixture-behavior: All assertions in this bounded synthetic API case passed. |
| P0-LEGACY-obsolete | passed | verified-fixture-behavior: All assertions in this bounded synthetic API case passed. |
| P0-LEGACY-current | passed | verified-fixture-behavior: All assertions in this bounded synthetic API case passed. |
| P0-LANGUAGE-SERVER | passed | verified-fixture-behavior: All assertions in this bounded synthetic API case passed. |
| P0-SESSION | passed | verified-fixture-behavior: All assertions in this bounded synthetic API case passed. |
| P0-IDENTITY-RECOVERY | passed | verified-fixture-behavior: All assertions in this bounded synthetic API case passed. |
| P0-IDENTITY-DELAY | passed | verified-fixture-behavior: All assertions in this bounded synthetic API case passed. |
| P0-REGISTRATION | passed | verified-fixture-behavior: All assertions in this bounded synthetic API case passed. |
| P0-IDENTITY-SUPERSEDED | passed | verified-fixture-behavior: All assertions in this bounded synthetic API case passed. |
| P0-AUTH-SUPERSEDED | passed | verified-fixture-behavior: All assertions in this bounded synthetic API case passed. |
| P0-ACCOUNT-READ | failed | inherited-product: Across UI logout and Bob login in same document, releasing old Alice userLessons response made Bob lesson favorite active. Expected inactive, actual active. Ordinary fetchUserStarredLessons lacks the registration-context publication guard in pinned source. |
| P0-VISUAL-desktop | passed | verified-fixture-behavior: All assertions in this bounded synthetic API case passed. |
| P0-VISUAL-mobile | passed | verified-fixture-behavior: All assertions in this bounded synthetic API case passed. |

## Resolved or removed harness findings

- Superseded identity now passes: exact delayed request/response identity, native Fetch fulfillment, same document and task/render checkpoint, then unchanged Bob/no-Alice publication assertions. The old stale body remains unread as intended; no cancellation/error was masked.
- Provenance now permits committed test-only descendants while comparing product/build/dependencies to pinned PR7, recording testedHEAD separately. Five static controls passed, including rejection of product/build/lock/dependency/untracked-source drift.
- Language-cache restoration removed at owner request; server-language case remains and passed. Language design is deferred until after conversion.

## Owner disposition and other evidence

Try to fix the three product defects during conversion. If unresolved afterward, create open bugs with reproduction/evidence. See plan/conversion-defect-disposition.md. Four failing assertions remain visible: two drawing-input variants, route timer and stale favorites after account switch. No product fixes are made here.

Existing real-service journey/restart/reseed evidence remains separate in real-service-baseline.json. Eight synthetic screenshots are baseline references, not pixel-diff passes. Asset totals include all emitted JS/CSS, not initial-route transfer size. Raw traces and private ownership data are not published.

Previous attempt3 report is retained under history/attempt3/. The prior correction used cumulative verification4/4. Owner12:28 authorized focused CI continuation5/max5: 86 gate/runner controls pass, and reclassification of the retained run passes the baseline gate while preserving raw suite FAIL19pass4fail. This reclassification is not a new browser run. Parity CI now runs on draft PRs using the explicit baseline gate; one hosted verification is pending for the published gate commit. No automatic sixth attempt is authorized. No P1 implementation, merge or deployment occurred.
