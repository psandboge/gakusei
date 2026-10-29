# Analyst findings: PR7 to Svelte

Read-only analysis completed 2026-10-28 against `03ce2f38d3099e9ccd7dd09a430e023e9f4ce0d0` by delegated analyst `svelte_analyst`. No source/service changes or implementation launches.

The analyst independently recommends a Svelte SPA retaining Spring, cookie/session/CSRF APIs, routes and JAR packaging. The code has separable account/reference, discovery/progress, learning and handwriting areas, provided session and lesson contracts are established first.

## Concrete observations

- AppProvider contains eleven retained route patterns plus unknown-route fallback. Session identity confirmation must precede protected rendering.
- Security and registrationInitialization contain serialized auth mutation, stale-read ownership, uncertainty recovery and registration initialization. These are essential behavior, not removable Redux boilerplate.
- Lessons mixes catalog, favorites, retention, incorrect answers, preferences, progression, logging, drawing uploads and statistics. Split service/domain responsibilities before assigning independent UI packages.
- Six modes: guess, quiz, flashcards, translate, grammar, kanji. Existing browser coverage is incomplete, particularly quiz/grammar/kanji behavior; enumerate parity per mode.
- Finish includes result rows, replay/back navigation and extra learning-event writes. Define answer and finish event semantics to avoid duplicate progress writes.
- Settings includes password change; home includes chart/starred lessons/counts; grammar includes speech and anchors; about includes generated frontend/backend licenses and XML parser polyfills.
- Existing locale codes include Swedish `se` and Japanese `jp`. Keep codes/fallback and user-language behavior.
- playScreen clones React card elements into stored `cardData`. Finish does not currently render those elements; convert state to plain records rather than reproducing framework coupling.
- Canvas listener attachment/cleanup targets differ. Explicit ownership and teardown tests are needed for the replacement.
- Legacy identity, registration, routing and drawing tests provide reusable scenarios. Replace framework test machinery while retaining behavioral assertions.

## Package review

Suggested graph: baseline/contracts -> foundation -> account/reference, discovery/progress and learning; frozen learning-card interface -> handwriting; all feature packages -> integration/results/release evidence.

The implementation plan refines foundation into separate shell/build and session/API packages, and groups results with the learning engine. This keeps tightly coupled answer/result semantics under one owner. One integrator owns shared package/lock/build changes. Other packages own distinct directories and consume fixed interfaces; source handoffs use accepted commits.

First demonstrable slice: authenticated selection -> typed answer -> feedback -> results -> replay. Complete all other modes and supporting journeys before final cutover.
