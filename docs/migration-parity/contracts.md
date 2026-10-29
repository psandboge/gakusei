# PR7 frontend contracts

Source baseline: `03ce2f38d3099e9ccd7dd09a430e023e9f4ce0d0` (merged PR #7).
This is a source-derived inventory, not a claim that every behavior has passed
browser verification. Paths below are relative to that commit. It records the
existing application; it does not prescribe new framework types or APIs.

## Routes and navigation

`src/main/js/AppProvider.js` declares eleven route patterns plus a wildcard.
Protected routes use `shared/components/AuthenticatedComponent.js`: pending or
failed identity renders no protected child and preserves the URL; the shell
shows session status or explicit retry. A confirmed anonymous visitor is sent to
`/login`, retaining the requested pathname as `redirectUrl`. Persisted identity
is not sufficient for admission.

| Pattern | Admission and existing behavior |
| --- | --- |
| `/` (exact) | Authenticated: lesson selection, default guess mode. Anonymous: start screen at `/`, retaining `/` as redirect target. |
| `/start` | Public landing/start content. |
| `/login` | Public login and registration UI; successful login confirms server identity before navigation to saved target or `/`. |
| `/logout` | Public route component issues logout; do not treat the URL alone as proof of cookie/session deletion. |
| `/home` | Protected progress/statistics dashboard and starred lessons. |
| `/select/:type` | Protected catalog, favorites, retention and incorrect-answer selection for the requested mode. |
| `/play/:type` | Protected active lesson. Missing questions redirects to selection for that type; no resumable lesson is promised on reload. |
| `/finish/:type` | Protected results, replay and selection navigation; missing answer history triggers fallback navigation. |
| `/grammar` | Protected static grammar/reference page, Japanese speech and section anchors. Distinct from grammar learning mode. |
| `/about` | Public content, attribution and frontend/backend license lists. |
| `/settings` | Protected question/answer language controls and password change. |
| unmatched | Redirect to `/`; root then applies its authenticated/anonymous choice. |

`shared/routing.js` exposes push/replace/go/back/forward and publishes the initial
browser location before rendering children. Browser history, direct navigation
and anchor behavior are user-visible contracts, not Redux action-name contracts.
`AppScreen.js` fetches identity and announcement; navigation/footer remain shared.
`AppProvider` calls anchor scrolling after updates. `DisplayQuestion` and
`shared/util/Speech.js` provide Japanese text/speech across learning and content.

## Six learning modes

`screens/app/screens/play/playScreen.js` selects these modes; there is no retained
separate `/play/write` mode.

| `:type` | Card and progression |
| --- | --- |
| `guess` | Alternatives, mark selected response, timed feedback and automatic next/finish. |
| `quiz` | Alternatives plus image from quiz-image endpoint; timed next/finish. |
| `flashcards` | Reveal answer, self-mark with boolean outcome, timed next/finish. |
| `translate` | Typed answer, feedback and explicit Next for intermediate questions; timed finish on last answer. |
| `grammar` | Same typed-answer card family as translate; distinct lesson data/content. |
| `kanji` | Writing card, stroke comparison/hints/difficulty, exported drawing and self/outcome marking; timed next/finish. |

Default automatic delay is 1500 ms; typed last-question finish delay is 2000 ms.
Existing `window.customDelay` is a test override, not an application feature.
Submitting disables controls. Typed intermediate feedback re-enables controls;
Next clears hint, advances/processes question and requests input focus. Assertions
must inspect actual focus and one action's writes, not just a CSS state.

`shared/reducers/Lessons.js` defaults: question language `reading`, answer
`swedish`, mode `guess`, difficulty `hard`, spaced repetition true. Retention
modes are guess, translate, flashcards and kanji. Selection also supports favorite
aggregation, starred lessons and incorrect-answer review; don't collapse these
into a single ordinary-lesson request.

## Frontend HTTP inventory

This inventories requests issued by PR7 frontend source, not every Spring API.
Unless stated otherwise, methods are GET, responses are JSON, and authenticated
requests use same-origin credentials. Query names/case/spelling below are literal
legacy contracts. Do not silently normalize `quizes`, `userName` or locale codes.

| Endpoint | Method / request and response interpretation |
| --- | --- |
| `/username` | GET; 200 JSON `{loggedIn:boolean, username:string}` required. Non-200, malformed JSON or transport failure leaves identity failed/uncertain; explicit retry is available. |
| `/auth` | POST URL-encoded form, `Content-Type: application/x-www-form-urlencoded; charset=utf-8`; 200 triggers identity refresh before navigation, 403 shows invalid-information feedback. Other failure attempts identity recovery. |
| `/registeruser` | POST encoded form body with `Content-Type: text/plain; charset=utf-8`; 201 starts delayed auto-login under the same auth operation; 406 username length; 422 duplicate username. |
| `/logout` | POST `X-XSRF-TOKEN`; 200/204 confirms anonymous, clears auth feedback and redirects. Other status/failure checks actual identity. |
| `/api/checkUserLanguage` | POST raw username body; 200 text selects UI locale, only while the initiating session is current. |
| `/api/checkNewUser` | POST raw username; 202 means no initialization; 200 adds default stars for `GENKI 01`/guess and `KLL 01`/kanji, refreshing related data. |
| `/api/settings` | GET navigation locale-option data. |
| `/api/saveUserLanguage` | POST JSON `{username,language}`, JSON Accept/Content-Type; persist chosen UI locale for confirmed user. UI also changes on non-OK response; network rejection behavior is not a verified recovery guarantee. |
| `/api/announcement` | GET banner content. Dismissal is frontend state. |
| `/api/lessons?lessonType=…` | GET ordinary catalog. |
| `/api/quizes` | GET quiz catalog (existing spelling). |
| `/api/lessonInfo?username=…&lessonType=…` | GET addressed/new/retention information. Some dashboard calls omit a type and legacy interpolation sends `undefined`; record baseline rather than inventing a new protocol. |
| `/api/questions` | GET ordinary questions with `lessonName`, `questionType`, `answerType`, `lessonType`, `username`, `spacedRepetition`. |
| `/api/questions/kanji` | GET same selection parameters, kanji questions. |
| `/api/quiz` | GET same selection parameters, quiz questions. |
| `/api/wrongquestions` | GET with `lessonType`, `questionType`, `answerType`, `userName`; empty 204 is handled as text rather than JSON. |
| `/api/wrongquestions/kanji` | GET same incorrect-review parameters for kanji. |
| `/api/lessons/favorite?username=…&lessonType=…` | GET aggregate favorite lesson. |
| `/api/userLessons?username=…` | GET starred lesson list. |
| `/api/userLessons/add?lessonName=…&username=…` | POST, JSON Content-Type and CSRF header; refresh stars then aggregate favorite. |
| `/api/userLessons/remove?lessonName=…&username=…` | DELETE, JSON Content-Type and CSRF header; refresh stars then aggregate favorite. |
| `/api/lessons/incorrectcount?username=…&lessonType=…` | GET incorrect-answer count. |
| `/api/statistics/{username}` | GET progress/success data for home. |
| `/api/quiz/nugget/correctAnswer/{correctAnswer}` | GET JSON containing `quizImage`; legacy play rendering can request this repeatedly. Request multiplicity is a baseline observation, not a required new design. |
| `/api/kanji-drawings` | POST JSON `{timestamp,nuggetid,username,data,difficulty}`; `data` is exported canvas URL; JSON Content-Type and CSRF header. |
| `/api/events2` | POST JSON array of collected events; JSON Content-Type and CSRF header. See event semantics below. |
| `/api/events` | Legacy/deprecated `Utility.postEvent` POST for one event; retained helper, not the normal batch path. |
| `/api/changepassword` | POST JSON-string body `{username,oldPass,newPass}`; current frontend does not explicitly set JSON Content-Type or CSRF header. 200 success dialog, 406 wrong-password dialog; fields clear after handled response. Do not silently claim stronger client validation/error handling than source provides. |
| `license/licenses.xml` | GET backend license artifact; about page parses XML. |
| `license/frontend_licenses.json` | GET generated frontend dependency license data. |

Static image/SVG, font, CSS and JS requests are separate from APIs. Kanji drawing
loads referenced SVG stroke assets; quiz uses the image reference returned by API.
About-page license requests are relative URLs in the source. Preserve attributions
and production asset/template behavior, not a dependency on the existing XML parser.

Source references: `shared/reducers/{Security,Lessons}.js`,
`shared/registrationInitialization.js`, `shared/util/Utility.js`,
`screens/app/components/GakuseiNav.js`, settings/about screens.
`shared/util/getcsrf.js` reads the `XSRF-TOKEN` cookie and callers place it in
`X-XSRF-TOKEN`; it returns null when absent. Source inventory is not evidence that
the server permits or rejects every missing-header combination.

## State, persistence and session ownership

`configureStore.js` combines lessons, security, statistics and routing, with thunk
and browser-history middleware. `AppProvider.js` uses redux-persist 4, default
localStorage and `blacklist: ['routing']`; concrete legacy keys are
`reduxPersist:lessons`, `reduxPersist:security`, `reduxPersist:statistics`.
`AppProvider.test.js` supplies these key formats. Routing is neither restored nor
written by this persistence setup; an old routing key may remain untouched.

Startup waits for rehydration. Storage failure pauses persistence and shows
`Application persistence failed`; unmount pauses and releases owned persistence
subscriptions. Security rehydration copies only stored loggedIn/user, marks
identity pending and compares stored `projectVersion` with current version.
Mismatch sets purgeNeeded and AppProvider purges persisted state. Regardless of
stored identity, server confirmation gates protected content.

The Lessons reducer explicitly rejects incoming persisted lesson data on
REHYDRATE. Thus stored language preferences, selected lesson, active question and
answer history are **not restored by PR7**. Do not promise preference restoration
or resumable lessons merely because keys exist. Statistics has no custom
rehydration case; migration must inventory actual reconciled behavior before
making a storage compatibility claim. Server progress is durable independently
of these browser records. UI locale detection uses i18next's browser detector;
locale cache is separate from Redux, and server language can override after login.

`shared/i18n.js` uses in-repository resources, namespace `translations`, literal
keys (`keySeparator:false`) and fallback `se`. UI language codes include `se`,
`en`, `jp`; logout changes to the legacy `1337` value and falls back. These are
distinct from learning question/answer codes `reading`/`swedish`. Settings prevents
choosing identical learning languages; it also exposes password change, not just
locale preferences.

`registrationInitialization.js` serializes auth mutations, tracks operation
epochs/ownership and coalesces initialization for the confirmed current account.
Late identity, language or favorites responses must not publish into a newer
session. An issued superseded mutation can make server identity uncertain;
recovery must confirm identity before reopening protected content. Failed identity
is not confirmed anonymous. Registration plus delayed auto-login is one operation;
default favorite chains both settle before initialization ownership is released.

## Lesson and event boundaries for Svelte work

Preserve these existing observable interfaces; they are not new proposed types:

- Navigation receives target pathname/mode and supports history/back/forward.
  Route guards preserve requested paths during unknown identity and login.
- Session owns server identity, auth-operation admission and recovery. Lesson,
  locale and favorite requests can publish only for their current account.
- Selection supplies mode, selected lesson or favorite/incorrect source,
  question/answer languages, repetition and kanji difficulty.
- Question responses contain `question`, nested `correctAlternative`,
  `alternative1` and optional `alternative2`/`alternative3`, `questionNuggetId`,
  optional `resourceReference` and `explanationText`. Processing creates shapes,
  randomized alternatives and feedback styles. Current code sets
  `correctAlternativeNuggetId` from **questionNuggetId**; don't assume positional
  alternative identity or silently change event identity during migration.
- Answer handling accepts text or a boolean self-mark. Text correctness is a
  case-insensitive comparison against any nested correct alternative. Boolean
  answers store null userAnswer and the supplied correctness. Results use
  question shapes, correct alternatives, userAnswer and userCorrect. React
  `cardData` is also stored today, but results don't require rendering it;
  future state should carry data without depending on a React element.
- Drawing exchanges strokes/scoring, disabled state, difficulty/hints and canvas
  export. Input listener/timer cleanup and reset are behavioral checks, not
  assumptions implied by a framework replacement.

Events have `{timestamp,gamemode,type,data,nuggetid,username,lesson,nuggetcategory}`.
`Utility.logEvent` expands array data into multiple records. Processing questions
queues `question` and `alternative` telemetry and flushes it. Answer handling
queues userAnswer, shape/answer correctAlternative telemetry and exactly one
`answeredCorrectly` outcome, optionally `updateRetention` when repetition is on,
then flushes. **Count answeredCorrectly records, not POSTs or all records, as
answer outcomes.** Finish separately queues correctAlternative/userAnswer
telemetry without an immediate flush; a subsequent operation may flush it.
Login flushes its login event. Kanji drawing upload is a separate POST.
Tests must distinguish telemetry batching, answer outcomes, retention and drawing
writes; replay is a new lesson, not a duplicate of prior progress.

## What each test environment proves

Fixture-backed browser tests can prove UI progression, focus, guards, deterministic
response ordering, request encoding/payloads and displayed account isolation.
Use synthetic accounts/data, reject unexpected APIs and external destinations,
and never read application framework internals to drive acceptance. Mocking a
200 login or CSRF cookie does not prove authentication or CSRF enforcement.

Owned real-backend journeys separately prove real registration/login/logout,
CSRF/cookies, endpoint integration and scoped SQL progress/retention persistence
across restart/reseed. Existing real suite has full guess proof; flash/translate
have no-write smoke, while quiz/grammar/kanji were only inventoried. No fixture
pass upgrades those modes to real persistence acceptance. Retain manifest/process/
Compose ownership checks, synthetic disposable data and protected-resource
exclusions. Mark missing checks blocked/not-run rather than verified.
