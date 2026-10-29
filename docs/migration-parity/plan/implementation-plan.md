---
plan_slug: svelte-migration-pr7
phase: implementation-plan
rig: gakusei
rig_root: /Users/pierresandboge/bin/slay/daigaku/rigs/gakusei
artifact_root: /Users/pierresandboge/bin/slay/daigaku/rigs/gakusei/plans/svelte-migration-pr7
requirements_file: /Users/pierresandboge/bin/slay/daigaku/rigs/gakusei/plans/svelte-migration-pr7/requirements.md
status: draft
created_at: 2026-10-28T21:14:00Z
updated_at: 2026-10-28T21:33:00Z
---

# Implementation Plan: Convert the PR #7 frontend to Svelte

## Execution authorization — 29 October 2026

Owner authorized coordinated P0 acceptance-baseline execution and a PR for inspection/owner merge, and resumed the same work at 11:04 UTC. This supersedes planning-only language for P0 only. P1 Svelte conversion is not authorized by this P0 continuation. Existing final task gaku-d2wkd retains attempt3/max3, no counter reset; no product repair, merge or deployment.


## Summary

Use merged PR #7, commit `03ce2f38d3099e9ccd7dd09a430e023e9f4ce0d0`, as the immutable behavioral and source baseline. Develop a Svelte replacement in a new isolated branch/worktree. Preserve unfinished React work and its evidence separately. This is a new migration scope, not a retry of the exhausted FOCUS workflow. Planning is authorized; implementation, new engineering budgets, rig activation, publication and deployment are not yet authorized.

Recommended architecture: Svelte 5 client-side SPA, Vite build, existing Spring backend and same-origin session APIs. No additional application server or SSR requirement. Keep familiar layout and existing SCSS/assets initially; use semantic HTML and small Svelte components instead of React Bootstrap. Keep framework-independent libraries where justified. Choose exact stable Svelte/Vite/test-tool versions and verify Node compatibility when implementation starts; do not use floating versions or prereleases by default.

Deliver the full conversion through separate packages with explicit interfaces. First complete the bounded P0 acceptance-test baseline against PR7. Then prove an account-to-text-lesson Svelte vertical slice and complete every retained mode and page before switching the default frontend. Intermediate package integration is not user acceptance or rollout.

## Current System

- React/React DOM 18.3.1; React Bootstrap 0.32.1; React Router 5.3.4; Redux 3.7.2, react-redux 7.2.9, redux-persist 4.10.2. Webpack integrates output into Spring's static assets and generated Thymeleaf template.
- `AppProvider.js` owns persistence startup and route dispatch. Routes: `/`, `/start`, `/login`, `/logout`, `/home`, `/select/:type`, `/play/:type`, `/finish/:type`, `/grammar`, `/about`, `/settings`, plus unknown-route redirect.
- `shared/reducers/Security.js` and `registrationInitialization.js` implement session confirmation, serialized auth mutations, stale-operation ownership and registration initialization. Preserve these semantics, not just form appearance.
- `shared/reducers/Lessons.js` mixes domain rules, API calls, navigation and UI state. `playScreen.js` clones React elements into answer `cardData`; new state must use plain data.
- Card families: grammar/translate text answers; guess/quiz alternatives; flashcards; kanji handwriting. Selection, favorites, wrong answers, language/settings, summary/statistics and grammar content are also retained features.
- Analyst confirmed settings includes password change (`/api/changepassword`), grammar includes speech/anchors, and about displays frontend/backend license artifacts. Preserve these less-visible behaviors. Preserve locale codes including `se` and `jp` rather than silently normalizing them.
- `DrawArea.rules.js`, its data/tests, `Geometry.js`, `Speech.js`, locales and static content are candidates for reuse after import-side-effect review.
- Existing Mocha tests and Playwright browser journeys provide contract evidence. React wrapper tests require replacement, while pure logic tests and backend tests remain useful.

## Proposed Implementation

### Package boundaries and ownership

Proposed new root: `src/main/svelte/`. Keep old `src/main/js/` readable during development. These are proposed paths, not claims that code exists.

| Package | Owned deliverables and source references | Depends on | Completion evidence |
| --- | --- | --- | --- |
| P0 Acceptance-test baseline and contracts | Framework-independent Playwright acceptance pack against PR7; six-mode journeys, focus, session races, write counts, drawing, preferences/navigation; reusable pure fixtures, selected screenshots, production sizes and known-gap register. Define route/mode/API/storage contracts. Detailed bounds below. | None; first package before conversion | Repeatable commands and isolated fixtures, traceable per-scenario baseline results, fixed assertions, exact baseline SHA, recorded gaps and agreed interfaces. Blocked checks cannot be reported as verified. |
| P1 Build and shell | `app/`, `ui/`, Vite configuration, asset/template integration, route adapter, localization adapter, navigation/banner/footer, accessible shared controls. Replaces main/AppProvider/AppScreen/GakuseiNav/GuardedDropdown wrappers. | P0 | Dev and packaged Spring paths work, direct links and back/forward preserved, translated shell renders, isolated component harness available. |
| P2 Session and API services | `services/http`, `services/session`, `services/persistence`; account state and request ownership. Extract semantics from Security, registrationInitialization, getcsrf and configureStore. | P0; P1 for UI integration | Session/registration/logout/race/storage tests, form/CSRF contracts, fail-closed unknown identity and account isolation. |
| P3 Account and supporting pages | `features/account`, `features/content`: start/login/logout/about/grammar, auth status and retry UI. Reuse existing content/assets/locales. | P1 + P2 | Anonymous/authenticated route journeys, registration initialization, validation/errors, grammar/content/navigation parity. |
| P4 Lesson discovery and preferences | `features/catalog`, `features/settings`, `features/dashboard`: home/select/settings, favorites, wrong-answer counts, lesson/language selection, repetition and difficulty controls, user statistics. | P1 + P2; P0 lesson interfaces | Selection/preferences/favorites round trips; correct empty/error/loading states; isolated account data. |
| P5 Learning engine and standard cards | `domain/lesson`, `features/learning`, `features/results`: question processing, answer recording, timers, text/choice/flashcard/quiz cards, progress and finish rendering. Extract Lessons/playScreen/DisplayQuestion/Cards/LessonStats/finishScreen behavior. | P0; P1 + P2 for runtime; P4 selection contract | All five non-handwriting modes, one answer submission per action, feedback/timing/focus, safe unmount, correct results and API payloads. |
| P6 Handwriting | `features/handwriting`: canvas/drawing lifecycle, coordinate mapping, strokes, hints, recognition/difficulty and drawing upload. Reuse reviewed pure geometry/rules. | P0; P1 harness; P5 card interface | Rule fixtures pass unchanged where reusable; real pointer/touch/resizing tests; drawing payload and completion integration. |
| P7 Integration, cleanup and release evidence | Cross-feature parity, packaging/CI, dependency removal, licenses and documentation. Single owner controls package.json/lock/build/CI during integration. | P3 + P4 + P5 + P6 | Full acceptance matrix, production build and backend/browser evidence, no React runtime dependencies, measured bundle comparison and reviewed PR. |

P1, P2 and P5's pure domain extraction can proceed independently after P0. P3/P4 and the P5 UI can proceed together after shared contracts and shell are usable. P6 can build against fixtures and the frozen card interface while P5 proceeds. P7 integrates accepted commits; do not share uncommitted worktrees or have several owners editing the lockfile.

### P0: First bounded package — acceptance-test baseline

Owner amendment 2026-10-28: add this package to the plan before conversion. This amendment authorizes planning, not test execution or rig activation.

**Goal:** establish a small, fixed behavioral contract that can run unchanged in intent against both PR7 React and the Svelte replacement. Extend existing Playwright journeys rather than introduce a second end-to-end harness. New proposed location: `tests/browser/migration-parity/`; reusable pure fixtures under `tests/fixtures/migration-parity/`. Do not access React internals, Redux stores, component names or Svelte internals from acceptance tests.

**Fixed coverage:**

| Area | Bounded scenarios and observable assertions |
| --- | --- |
| Six learning modes | One deterministic short lesson per mode: guess, quiz, flashcards, translate, grammar, kanji. Include correct/incorrect or self-marked outcomes as applicable, feedback, progression, finish totals and replay. Confirm API and displayed results agree. |
| Keyboard/focus | Text-answer Enter submits once; disabled controls cannot activate; input/Next focus follows feedback and question reset. Verify actual activeElement, not CSS classes. Include navigation away during a pending transition. |
| Session isolation | Normal and invalid login, registration initialization, logout/refresh; deterministic delayed identity response across logout/account switch; delayed auth mutation superseded by a newer operation; failed identity read and explicit recovery. Check visible identity and account-owned data, not merely redirect URLs. |
| Progress writes | Count and inspect the intended answer, finish and drawing writes for the fixed journeys, including rapid duplicate activation and replay. Derive expected event semantics from PR7 source; do not assume all event types should have identical counts. |
| Handwriting | Fixed mouse/touch stroke fixtures, coordinate mapping after one resize, reset and one known scoring result, drawing export/upload; unmount/remount must not retain duplicate input handlers. Keep geometry/scoring fixtures as fast pure tests too. |
| Preferences/navigation | Language, favorites and relevant lesson settings; refresh, direct protected/lesson links and back/forward. Seed a sanitized legacy browser-state fixture to record preference restoration and server identity confirmation. Final Svelte storage-transition tests must follow the explicitly agreed migration policy. |

**Test boundaries:** use fixture-backed browser cases for deterministic response ordering, failures and payload inspection, clearly labeled as simulated API tests. Reuse disposable real-backend journeys to verify authentication/CSRF, lesson writes and persistence; mocked responses do not prove backend integration. Use synthetic accounts/data, isolated browser contexts and owned disposable services. Preserve existing protected-resource exclusions. Use bounded polling/event coordination rather than arbitrary long sleeps or timing-sensitive race assertions. Keep fixtures and production tests free of preview credentials and private account data.

**Reference evidence:** capture a small fixed screenshot set (selection, text feedback, results and handwriting) at one desktop and one mobile viewport, stable locale/data/fonts and disabled animations. These are visual review aids; behavioral assertions determine correctness. Record equivalent production JS/CSS raw/compressed sizes, asset manifest, dependency counts and exact build commands. Report dynamic content exclusions and capture environment; do not mask meaningful feedback or identity differences.

**Deliverables:** `acceptance-matrix.md` links each scenario ID to its test/fixture, expected behavior and later package owner; `baseline-results.json` records pass/fail/blocked/not-run, exact source SHA, tool versions, command/exit status and sanitized evidence paths; `known-gaps.md` distinguishes inherited defects from missing test infrastructure; `README.md` gives the same base-URL-driven acceptance command for either frontend, separate fixture-backed and real-backend commands, fixture setup/cleanup, screenshot capture and bundle measurement. Include route/API/storage inventory and the interfaces below. Store reports under this plan's `baseline/` directory; do not imply these files already exist.

**Exit and stop conditions:** all listed cases are implemented and attempted on PR7, or precisely identified as blocked with a concrete prerequisite. Review each inherited failure and agree the acceptance treatment before conversion: preserve established intended behavior, or name a deliberate improvement with a target assertion. Do not freeze bugs as desired behavior or suppress failing assertions. P0 cannot claim full verification or release downstream packages while material baseline gaps remain undisposed. Reuse the same assertions for Svelte; only semantic selectors/base URL and an explicitly reviewed storage-transition policy may differ. Product-fix loops, frontend conversion, broad test-tool rewrites, exhaustive mode/data combinations and unrelated historical repairs are outside P0. Freeze and report the first substantive blocker rather than consuming unlimited retries; implementation/review attempt budgets must be separately established before execution.

### Contracts to freeze before parallel implementation

1. **HTTP/session:** preserve endpoint, method, query spelling, form encoding, status/204 handling, same-origin cookies and `X-XSRF-TOKEN` behavior. Inventory calls in reducers and Utility rather than assuming one generic API shape. Define authentication as pending/confirmed/failed plus identity; a failed check is not confirmed anonymous access. Stale response or timer callbacks must not overwrite the active identity or route. Do not replay non-idempotent requests automatically.
2. **Navigation:** one `navigate(path)`/current-route interface, route parameters, redirect semantics, browser history and anchor handling. Preserve the existing authenticated-root/anonymous-start split and direct lesson route fallback. Select the smallest maintained router that satisfies these contracts during P1; do not build a general routing framework.
3. **Lesson:** plain `LessonSelection`, `QuestionView`, `AnswerRecord` and `LessonResult` shapes, documented from existing payloads. Include mode, lesson identity, question/answer language, repetition/difficulty, source question identity, alternatives/resources, submitted answer and outcome. No React/Svelte component instances or DOM nodes in domain state or persisted data. P5 owns transitions and answer submission; cards emit answer/next events rather than editing global state.
4. **Card/handwriting:** common question, disabled, feedback and hint inputs; `answer`, `next`, and drawing result outputs. Specify keyboard focus targets and timing. P6 owns canvas internals; P5 owns progression and submission. A card must not cause duplicate answer logging/drawing uploads.
5. **Localization:** retain resource keys, interpolation, locale switching and user-language initialization, with an i18next-to-Svelte subscription adapter initially. Explicitly replace React `Trans` markup with safe Svelte composition. Do not render untrusted translations/content using unrestricted HTML.
6. **Persistence:** inventory existing keys and actual rehydration rules. Prefer a versioned allowlist of non-sensitive preferences; restore identity from the server. Define import/reset behavior for legacy Redux state and rollback behavior before changing it. Never clear all origin storage. Preserve or explicitly agree changes to remembered preferences and ongoing-lesson behavior.

### Technical choices and limits

- Use Svelte state/stores for UI state and ordinary modules for domain/services. Remove Redux and React bindings from the final frontend; do not wrap the whole old Redux architecture permanently. Temporary reuse of extracted pure functions is welcome.
- Vite owns frontend compilation; Maven retains the existing build lifecycle. P1 must map current `webpack.partial.prod.js` generated-template placement, hashed script/style references, absolute asset paths, project version, dev proxy and license generation explicitly. Spring still serves the normal application routes and APIs. Test both dev and packaged assets; do not simply copy a Vite index into the template tree.
- Retain Bootstrap CSS/SCSS and existing visual assets initially, with native elements replacing React Bootstrap. Avoid introducing a new component framework and a redesign simultaneously. Replace React-only tooltip/toggle/icon/chart adapters with small native/Svelte adapters; retain underlying non-React libraries only after checking size and behavior.
- Keep Java/backend/schema/authentication rules unchanged. If a backend incompatibility is discovered, record it for scope disposition rather than widening this migration silently.
- Include cleanup of listeners, subscriptions, animation frames, pending reads and timers. Test route changes and account changes during in-flight work. Cancellation is not proof that a server-side mutation did not happen; reconcile identity/results where necessary.
- Inventory both answer and finish learning-event writes before changing lifecycle code: progression and replay must not duplicate server events. Although current answer state stores React `cardData`, finish renders question/answer fields rather than that component. Remove the unused framework-object coupling without inventing a new rendering requirement.
- Canvas currently attaches mouse/touch input to the canvas while some unmount cleanup targets window listeners. P6 must establish actual listener ownership and prove teardown; copying the lifecycle code verbatim would preserve this defect.
- Preserve grammar-generation provenance and existing licenses. Preserve intentional deletions from earlier merged PRs.

### Milestones

1. **Acceptance baseline (P0):** implement and run the bounded shared test pack on exact PR7, capture screenshots/size evidence, classify failures and accept the parity/known-gap matrix and interfaces before conversion. Preserve later work; no destructive checkout/reset.
2. **First usable slice:** Svelte shell + real session + select one text lesson + answer/feedback/next + results. Compare against baseline before implementing remaining UI. This is an architectural checkpoint, not permission to drop other features.
3. **Feature completion:** P3/P4 supporting journeys, all remaining P5 modes, P6 handwriting. Integrate accepted package commits with one integration owner.
4. **Cutover candidate:** production packaging, parity/security/accessibility checks, measured payload reduction, dependency cleanup and independent review. Create a focused PR only under separate publication authorization; merge/deploy remain separate.

## Testing

- Start with a source-based parity inventory, then record a fresh baseline test run only when execution is authorized. Historical passes are context, not freshly rerun evidence. Keep known R1 exhausted/S1 deferred and hiragana geometry gaps visible; conversion does not silently cure or waive them.
- Preserve pure behavior fixtures (`Lessons.test`, drawing rules, routing/registration/identity recovery) by extracting framework-independent logic. Replace React mount/wrapper tests with behavior-focused Svelte tests. Use Vitest and Testing Library for new component tests; retain Mocha temporarily for reusable legacy tests until equivalents pass.
- Preserve Playwright user journeys in `tests/browser/auth.spec.js`, `learning.spec.js`, `zz-compatibility.spec.js` and associated helpers. Adapt selectors only for semantic DOM changes; do not reduce assertions to obtain a pass.
- Explicitly cover login/invalid login/registration/logout/refresh, delayed and superseded identity reads/mutations, storage failures, account switching, CSRF, route guards, favorites/preferences, empty lessons, all six modes, finish statistics, pointer/touch handwriting, localization and restart persistence.
- Verify input and next-button activeElement, Enter behavior, exactly-one submission, disabled controls, question reset, two mounted instances, unmount/remount and route-change cleanup. Native Svelte bindings eliminate the need for findDOMNode but do not prove these behaviors automatically.
- Run backend PostgreSQL/migration tests and production package/browser journeys as integration checks. Disposable data/resources only. Existing protected ports/resources (52655/62508/62721/18082/18083/15432/15433) remain excluded before any service access; reuse reviewed isolation mechanisms and stop if prerequisites are missing. Do not read existing preview credentials/accounts.
- Compare equivalent production initial JS/CSS compressed and uncompressed bytes, lazy chunks and representative route payloads against PR7. Separate framework savings from images/fonts and deferred chunks. Record dependency count and build output, not an invented size target. No React/react-dom/react-redux/react-router/react-bootstrap runtime remains at completion.
- Use fresh scoped independent review after full integration, with finite engineering/review budgets established for this new milestone. A review execution succeeding does not mean product acceptance. Hosted CI evidence is required after an authorized push, with exact commit/run IDs.

## Rollout

Develop on a fresh branch based on the exact PR7 merge. Existing React remains the reference; do not reopen exhausted FOCUS tasks or create duplicate retries. At cutover, produce one Svelte frontend artifact with the existing backend; remove the old entry and unused dependencies only after parity proof. Preserve a rollback commit/artifact and compatible preference handling. No need for two frameworks in the shipped artifact.

Gakusei stays suspended during planning. Before execution: approve scope/interfaces and new finite budgets, authorize rig activation and new migration workflow, inspect available configured formulas and current ownership. Keep old histories/counters intact. This plan creates no executable beads and does not launch work.

## Open Questions

- Proposed default: behavioral/visual parity first, no redesign. Any deliberate feature removal or UX change should be named before implementation.
- Legacy browser-state transition policy needs inventory evidence in P0; durable preferences should survive where safe, server data must remain untouched.
- Exact router and dependency patches are implementation readiness decisions after compatibility verification. They do not require expanding to SvelteKit/SSR.
- Existing failing/deferred baseline behaviors need explicit acceptance classification. They are not prerequisites for unlimited repairs and are not automatically accepted as regressions.

## References

- PR7: https://github.com/psandboge/gakusei/pull/7
- Svelte overview: https://svelte.dev/docs/svelte/overview
- Svelte testing guidance: https://github.com/sveltejs/svelte/blob/main/documentation/docs/07-misc/02-testing.md
- Svelte Testing Library setup: https://testing-library.com/docs/svelte-testing-library/setup/
- Existing source references are all relative to PR7's pinned commit, not the unfinished shared candidate.
- Read-only analyst findings and package review: `analyst-findings.md` alongside this plan.

## Owner follow-up — 29 October 2026, 11:30 UTC

Known P0 product failures are explicitly assigned to conversion fixes; if unresolved after conversion, create open bugs with retained reproduction/evidence. See conversion-defect-disposition.md. Remove the P0 language-cache-restoration case; revisit language after conversion. Superseded-identity synchronization and necessary committed-source provenance are the focused current correction. This does not reset prior attempts or launch P1.
