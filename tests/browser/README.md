# Owned Chromium baseline (package B)

Use the repository-pinned Node/npm/Java environment. Run `npm ci`,
`npm run preflight`, `npm test`, isolated backend tests via
`bash scripts/test-postgres.sh -Dskip.frontend=true test`, then
`./mvnw -Pproduction -DskipTests package`. Install with
`npx --no-install playwright install chromium` on macOS, or `install --with-deps chromium`
on Linux. Finally run `npm run test:browser`. The production jar must remain
unchanged during the run. Package A owns all service startup and cleanup.

`npm run test:browser:spec` is internal and fails without the live owned manifest.
`npx --no-install playwright test --list` only collects tests: it is not acceptance.
`node tests/browser/check-guards.js` proves malformed/missing/foreign manifests
and original-learner state fail offline before browser creation/network.
See `tests/lifecycle/README.md` for the concrete private ownership/phase interface.
The suite validates it in global setup and again before each scenario's first request.
One Chromium worker, sequential stateful operations, bounded timeouts, no retries
and unconditional forbidOnly are required. Mocha's existing source patterns stay separate.

The journey creates a disposable alphanumeric account through the UI, observes
registration's auto-login, then explicitly logs out/in. It selects genki 15,
asserts reading→Swedish and smart-learning state, and alternates correct/incorrect
answers by actual fixture/response identity and rendered text. It asserts colored
feedback, totals, each result row, and independent scoped SQL account/events/progress.
Only answeredCorrectly events count as answers; finish userAnswer telemetry does not.
Question identity and correct-alternative progress identity are recorded separately.
The current reducer sets correctAlternativeNuggetId to questionNuggetId; we verify
its alternative text against that content fixture, rather than a positional option.

The private atomic learner file contains credentials, submissions and the initial
SQL snapshot (0600). Restart/reseed phases require that same learner; fresh browser
contexts explicitly UI-login, compare exact durable rows/retention and reload.
Lesson/finish state resets to selection on reload while the authenticated HTTP
session remains; durable progress is independent of Redux's discarded lesson state.
The anonymous JSON users API uses 401/Basic. Ordinary-user denial is asserted in
the final after-reseed phase, after durable evidence, with no privileged payload.
Protected UI routes and invalid login are asserted in every phase.

## Mode inventory

| Mode | Fixture support | Executed scope |
| --- | --- | --- |
| guess | six seeded genki 15 vocabulary identities | complete mixed-answer acceptance, feedback/results and durable phase proof |
| flashcards | same vocabulary, legacy FlashCard | genki 15 question, UI flip and matching revealed answer; no answer writes |
| translate | same vocabulary, TranslateCard | genki 15 question and enabled text-answer control; no answer writes |
| kanji / write | nine seeded kanji entries; kanji route uses WriteCard and drawing rules | inventoried only; no deterministic stroke/recognition acceptance claimed |
| quiz | seeded quizzes.csv and QuizHandler/image reference path | inventoried only; no image-choice journey claimed |
| grammar | seeded verbs and Verbs lesson, retained grammar artifact/provenance | inventoried only; no conjugation-answer journey claimed |

There is no separate retained `/play/write` route: writing is the kanji card.
Additional mode smoke disables smart learning via UI to render the fixture after
the guess journey, then confirms durable guess state did not change. No placeholder
skips, API-created answers, browser store injection or test-only app selectors exist.

Reports/screenshots remain under each private phase output directory. Raw traces
and video are disabled. Screenshots use masked password inputs; credentials and
raw manifests must never be published. Package C owns a tested explicit allowlist,
redaction/privacy gate and hosted/Linux evidence; never upload the run directory
or raw HTML/error-context reports wholesale. The current proof is local macOS,
not hosted CI or comprehensive mode/browser acceptance.

Runner options follow the [official Playwright configuration](https://playwright.dev/docs/test-configuration).
