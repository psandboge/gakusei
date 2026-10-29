---
plan_slug: svelte-migration-pr7
phase: requirements
rig: gakusei
rig_root: /Users/pierresandboge/bin/slay/daigaku/rigs/gakusei
artifact_root: /Users/pierresandboge/bin/slay/daigaku/rigs/gakusei/plans/svelte-migration-pr7
status: draft
created_at: 2026-10-28T21:14:00Z
updated_at: 2026-10-28T21:33:00Z
---

# Requirements: Svelte conversion from PR #7

## Execution authorization — 29 October 2026

Owner authorized coordinated P0 acceptance-baseline execution and a PR for inspection/owner merge, and resumed the same work at 11:04 UTC. This supersedes planning-only language for P0 only. P1 Svelte conversion is not authorized by this P0 continuation. Existing final task gaku-d2wkd retains attempt3/max3, no counter reset; no product repair, merge or deployment.


## Problem Statement

The owner wants a plan to replace Gakusei's React frontend with Svelte, using the last merged PR rather than continuing stalled compatibility cleanup. Reduce frontend complexity while preserving the retained application and backend contracts. Split implementation into reasonably independent parts, informed by a read-only analyst.

## Solution

Provide a complete replacement frontend with equivalent retained features, verified against PR7 merge `03ce2f38d3099e9ccd7dd09a430e023e9f4ce0d0`. Make architecture and work boundaries explicit before implementation. Keep unfinished work and failure evidence intact.

## User Stories

### REQ-1 Existing users retain access and preferences

- Login, registration, logout, session recovery and route protection retain their current API/security semantics.
- Delayed operations cannot expose a different account's state; storage failures have explicit recoverable UI.
- Define safe transition of existing browser preferences without modifying server data or relying on cached identity.

### REQ-2 Learners retain all learning journeys

- Preserve selection/favorites/wrong-answer practice, languages, repetition and difficulty controls.
- Preserve grammar, translation, guess, quiz, flashcard and kanji handwriting modes, feedback, progression and results.
- Keyboard focus, native events, disabled controls and touch/pointer drawing are verified by behavior tests.

### REQ-3 Supporting content remains usable

- Preserve existing routes/direct links, navigation, about/grammar content, announcements, settings, statistics and localization.
- Preserve existing assets, grammar provenance and relevant licenses; maintain responsive layout and accessible controls.

### REQ-4 Maintainers receive a simpler frontend

- Final application uses Svelte without a React runtime or React-specific wrappers.
- Keep the existing backend, API, PostgreSQL data and deployment shape.
- Measure production asset/dependency changes against the baseline; do not assert savings before measurement.
- Separate packages have documented inputs, outputs, ownership and acceptance checks.

### REQ-5 Conversion is reviewable and reversible

- Establish a parity matrix and explicit known-gap register, then prove a complete learning slice before broad conversion.
- First complete a bounded framework-independent acceptance-test package against exact PR7: six-mode journeys, keyboard/focus, session races, progress-write counts, handwriting, preferences/navigation, plus selected reference screenshots and production bundle measurements.
- Reuse the acceptance assertions against Svelte. Distinguish simulated API tests from disposable real-backend proof; classify inherited failures and blocked checks explicitly before conversion.
- Complete retained browser/backend/build verification and an independent review before acceptance.
- Preserve old branches/history and define source/artifact rollback without destructive resets.

## Out Of Scope

Backend rewrite, database/schema changes, visual redesign, new learning features, React19 work, resuming exhausted FOCUS retries, fixing unrelated historical defects, service deployment or cloud changes. No executable work is launched by this draft.

## Other Notes

User requested planning with analyst assistance on 2026-10-28. Gakusei remains suspended. Requirements and implementation plan are drafts; no new retry budgets are implied. Existing protected previews, resource exclusions, owner-deferred gaps and model ceiling remain in force.

## Owner follow-up — 29 October 2026, 11:30 UTC

Known P0 product failures are explicitly assigned to conversion fixes; if unresolved after conversion, create open bugs with retained reproduction/evidence. See conversion-defect-disposition.md. Remove the P0 language-cache-restoration case; revisit language after conversion. Superseded-identity synchronization and necessary committed-source provenance are the focused current correction. This does not reset prior attempts or launch P1.
