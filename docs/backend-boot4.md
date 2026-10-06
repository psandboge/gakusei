# Spring Boot 4 compatibility checkpoint

The candidate uses released Spring Boot 4.1.1 on Java 17. The Boot BOM manages
Framework 7.0.9, Security 7.1.1, Jackson 3.1.5, Hibernate 7.4.5.Final,
Liquibase Community 5.0.3 and PostgreSQL JDBC 42.7.13. PostgreSQL server remains
16.15; Node 24.21.0, npm 11.19.0 and Maven 3.9.16 remain pinned.
Springdoc webmvc UI is 3.1.1. Webmvc, Liquibase and test integrations use modular
Boot starters. TestRestTemplate uses Boot's resttestclient module and explicit
AutoConfigureTestRestTemplate. JUnit Vintage retains existing JUnit 4 tests.

Jackson core/databind imports move to tools.jackson; Jackson annotations stay
in com.fasterxml.jackson.annotation. Seed loading uses JsonMapper. Explicit
controller slash aliases preserve methods and payloads without redirects.
The environment guard and spring.factories key both use
org.springframework.boot.EnvironmentPostProcessor, with ConfigData ordering + 1.
Packaged startup proof requires missing-password refusal before datasource or
server startup. Security context saving, Basic/form/session/remember-me/logout,
method authorization and the retained disabled effective CSRF policy are unchanged.

Thymeleaf's BOM-managed Spring/Security 6 bridge remains in use. Anonymous,
learner and admin expression rendering, actual OpenAPI JSON/UI assets, optional
JCache put/get/evict and lesson hit/invalidation are checked. The vendor's future
Spring 7 module roadmap remains a limitation. Liquibase 5.0.3 declares
FSL-1.1-ALv2, replacing the earlier license declaration. Generated dependency
license assets and Community startup must be checked; no Secure/trial dependency
or license-plugin bypass is used. Grammar jar/POM hashes remain mandatory.

## Local proof

Run the complete ordered baseline in docs/ci-browser-baseline.md, then:

```sh
python3 tests/lifecycle/boot4-environment.py
python3 tests/lifecycle/check.py
node tests/browser/check-guards.js
python3 tests/lifecycle/upgrade-guards.py
python3 tests/lifecycle/boot4-upgrade-guards.py
python3 scripts/test-ci-artifacts.py
```

Commit the focused source before creating candidate build evidence. Preserve
frozen detached Boot 2 source 9d614c2506d5e58ad3a8343a92dc7d87f9fde1c4 and
Boot 3 source 1bac4e96fe9a2f405eddff503056ef231fb4a8f9 in independent worktrees.
Build/test/package each fixture with its pinned environment. Run the unchanged
Boot 3 harness and interruption checks FROM the frozen Boot 3 checkout using
frozen Boot 2 and Boot 3 jars; the new candidate cannot replace that old pair.

For the new pair, independently run the following after backend tests succeed:

```sh
python3 scripts/build-upgrade-jar.py --checkout /absolute/boot3-checkout --manifest /absolute/private/boot3-build.json
python3 scripts/build-upgrade-jar.py --checkout /absolute/candidate-checkout --manifest /absolute/private/boot4-build.json
python3 scripts/run-boot4-proof.py --baseline-build-manifest /absolute/private/boot3-build.json --candidate-build-manifest /absolute/private/boot4-build.json
python3 scripts/run-boot4-proof.py --interrupt --baseline-build-manifest /absolute/private/boot3-build.json --candidate-build-manifest /absolute/private/boot4-build.json
```

The build helper executes production packaging itself and writes a new 0600
manifest after zero exit and clean tracked-source checks. It records canonical
checkout/jar, full source SHA, build command, hash and embedded Boot version.
The underlying test-boot4-upgrade.sh and boot4-upgrade-interrupt.py require all
of --baseline-jar, --candidate-jar, --baseline-sha, --candidate-sha,
--baseline-jar-sha256, --candidate-jar-sha256, --baseline-build-manifest and
--candidate-build-manifest. run-boot4-proof.py translates those private records
into these arguments; the verifier independently revalidates them.

Before allocation and every restart, reject changed/fake source labels, dirty
tracked source, foreign/symlink jars, invalid/private manifest fields, wrong Boot
versions, missing assets, identical jars and hash changes. Candidate ancestry must
include the accepted merged Boot 3 commit. Fresh migration has no implicit seed.
Populated proof compares original account/role/language, events, progress and
retention, content/reference counts and full applied Liquibase history, then
candidate writes, app/database restart and two explicit reseeds. Every checksum
must remain identical. A real transition requires vendor evidence and independent
review; no clearCheckSums, mark-run or history rewrite is authorized.

## Ownership, privacy and delivery

Only randomly owned loopback PostgreSQL/resources are used. Never access preview
18082, database listener 15432, project gakusei-local, its volume or credentials.
Failure/TERM proof uses an independent owned sentinel under hostile inherited
settings. Exact bounded cleanup must succeed and remain idempotent:

```sh
python3 scripts/verify-boot4-upgrade.py --cleanup /absolute/checkout/.tools/browser-tests/RUN_ID/ownership.json
python3 scripts/collect-ci-artifacts.py cleanup
python3 scripts/collect-ci-artifacts.py collect
```

Raw SQL, logs, learner records and build/ownership manifests stay private.
Diagnostics expose only scanned allowlisted facts. Missing/stale/incomplete
upgrade evidence is unavailable. CI retains read-only permissions and pinned
actions; both independent upgrade jobs depend on candidate regression.

Source compilation or this document is not acceptance evidence. The exact-SHA
implementation summary records executed commands, results, private/sanitized
paths and failures. Independent source review and a develop-targeted PR with all
three hosted jobs terminal success remain later gates. Never merge or deploy.
Chromium guess/reload/restart/reseed plus flashcard/translation smoke and focused
backend kanji/drawing/quiz/grammar/localization contracts are bounded evidence;
stroke recognition, speech, all languages/browsers and cross-version active
sessions/cookies are not comprehensively verified.

After candidate writes, application rollback alone is not assumed safe. A later
authorized deployment needs backup/restore rehearsal to a separate validated
database or an independently reviewed forward fix. Do not run an old jar against
upgraded protected data as an assumed downgrade.
