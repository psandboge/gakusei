# P0 baseline result and coverage

**P0 acceptance blocked.** Final local run: 24 cases, 18 passed, 6 failed; retries0. No test assertion was skipped or weakened to accept the result.

Product baseline: `03ce2f38d3099e9ccd7dd09a430e023e9f4ce0d0`. Tested source digest: `712714500d8338e783851f2572762f72883b6b998a7cac32124434d236285f69`, unchanged before/after the run. The test files were uncommitted during execution; the later PR commit adds docs/CI metadata but does not claim a post-commit rerun.

| Case | Result | Classification / evidence limit |
| --- | --- | --- |
| P0-DRAW-mouse | failed | inherited-product: Repeated same kanji retains completed self-mark control on question2; expected0, actual1. Scoring, bounded export and endpoint mapping within2CSS pixels passed before reset failure. Remount assertions not reached. |
| P0-DRAW-touch | failed | inherited-product: Repeated same kanji retains completed self-mark control on question2; expected0, actual1. Synthetic touch adapter scoring, bounded export and endpoint mapping within2CSS pixels passed before reset failure. Remount assertions not reached; physical-device touch not tested. |
| P0-MODE-guess | passed | verified-fixture-behavior: All assertions in this bounded simulated-API case passed. |
| P0-MODE-quiz | passed | verified-fixture-behavior: All assertions in this bounded simulated-API case passed. |
| P0-MODE-flashcards | passed | verified-fixture-behavior: All assertions in this bounded simulated-API case passed. |
| P0-MODE-translate | passed | verified-fixture-behavior: All assertions in this bounded simulated-API case passed. |
| P0-MODE-grammar | passed | verified-fixture-behavior: All assertions in this bounded simulated-API case passed. |
| P0-MODE-kanji | passed | verified-fixture-behavior: All assertions in this bounded simulated-API case passed. |
| P0-FOCUS | failed | inherited-product: Typed Enter, disabled input, actual Next/input focus and reset passed; pending final-answer timer replaced /about with /finish/translate after navigation. |
| P0-DUPLICATE | passed | verified-fixture-behavior: All assertions in this bounded simulated-API case passed. |
| P0-PREFERENCES | passed | verified-fixture-behavior: All assertions in this bounded simulated-API case passed. |
| P0-LEGACY-obsolete | passed | verified-fixture-behavior: All assertions in this bounded simulated-API case passed. |
| P0-LEGACY-current | passed | verified-fixture-behavior: All assertions in this bounded simulated-API case passed. |
| P0-LANGUAGE-CACHE | failed | test-authoring: Strict selector .glosorDropdown resolves2buttons, so language selection, save and browser-cache restoration assertions were not reached. This failure does not establish a product locale defect. |
| P0-LANGUAGE-SERVER | passed | verified-fixture-behavior: All assertions in this bounded simulated-API case passed. |
| P0-SESSION | passed | verified-fixture-behavior: All assertions in this bounded simulated-API case passed. |
| P0-IDENTITY-RECOVERY | passed | verified-fixture-behavior: All assertions in this bounded simulated-API case passed. |
| P0-IDENTITY-DELAY | passed | verified-fixture-behavior: All assertions in this bounded simulated-API case passed. |
| P0-REGISTRATION | passed | verified-fixture-behavior: All assertions in this bounded simulated-API case passed. |
| P0-IDENTITY-SUPERSEDED | timedOut | test-synchronization-unresolved: New UI Bob login and Bob catalog rendered in same document; released old Alice identity returnedHTTP200 but response.finished barrier did not settle before45s timeout. Final Bob/no-Alice publication assertions not reached. No stale-identity acceptance claim; root cause beyond barrier remains unverified. |
| P0-AUTH-SUPERSEDED | passed | verified-fixture-behavior: All assertions in this bounded simulated-API case passed. |
| P0-ACCOUNT-READ | failed | inherited-product: Across UI logout and Bob login in same document, releasing old Alice userLessons response made Bob lesson favorite active. Expected inactive, actual active. Ordinary fetchUserStarredLessons lacks the registration-context publication guard in pinned source. |
| P0-VISUAL-desktop | passed | verified-fixture-behavior: All assertions in this bounded simulated-API case passed. |
| P0-VISUAL-mobile | passed | verified-fixture-behavior: All assertions in this bounded simulated-API case passed. |

## Other evidence

- Existing real-service browser suite passed journey, restart and reseed with owned cleanup; sanitized results in real-service-baseline.json.
- Fixture controls2passed; pure stroke-scoring fixture1passed; syntax/24-case collection passed.
- Eight reference images are in screenshots/. They use synthetic fixture data; all were visually reviewed for publication. These are baseline references, not pixel-diff passes.
- baseline-assets.json measures all emitted JS/CSS under fixed compression; not initial-route transfer size.
- baseline-result.json records full per-case observations, known gaps, execution limits, tools and remaining0 budget.

## Readiness

Two runtime test-contract gaps and a static post-commit provenance guard defect remain. Product defects are not fixed. See known-gaps.md. This PR is a draft for owner inspection, not P0 acceptance or authorization for P1. No fourth browser attempt was run.
