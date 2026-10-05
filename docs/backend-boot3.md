# Spring Boot 3 compatibility checkpoint

This bounded migration targets Spring Boot 3.5.16 on Java 17. The source starts
at accepted develop commit `9d614c2506d5e58ad3a8343a92dc7d87f9fde1c4`.
The same frozen commit supplies the separate Boot 2.7.18 upgrade fixture.
Publication and hosted results follow final review in the build workflow.

## Dependencies and configuration

Springdoc is 2.8.17 (`springdoc-openapi-starter-webmvc-ui`); Swagger annotations
are OpenAPI 3 Jakarta annotations. Security, Hibernate, Liquibase, Jackson and
PostgreSQL driver versions follow the Boot BOM. The Liquibase Maven plugin is
4.31.1; its old SnakeYAML override is removed. The build profile now uses the
supported JAR layout. Production still includes frontend and generated license
assets, and grammar jar/POM provenance validation remains mandatory.

Thymeleaf uses the Security 6 dialect. Ehcache uses the managed 3.10.9 Jakarta
classifier, excluding its legacy JAXB runtime range and adding managed JAXB
runtime 4.0.9. JCache remains `javax.cache`; Java SE annotation processing is
also outside the Jakarta namespace migration. The unused internal Hibernate
exception import is removed; no application exception path used it.

Liquibase owns schema changes and Hibernate validates them. Applied changelogs
are unchanged. The environment postprocessor remains registered under its
supported `spring.factories` key. Default cache remains disabled; optional local
cache use selects `local-postgres,enable-resource-caching` and explicitly sets
`spring.cache.type=jcache` where local profile precedence otherwise selects none.
`Boot3IntegrationTest` loads the XML cache and proves put/get/evict plus a real
lesson cache hit and invalidation after a database write.

## Retained contracts

`SecurityFilterChain` replaces the adapter, and `EnableMethodSecurity` preserves
repository admin guards. Boot 2 left unmatched requests without authorization
attributes; its public fallback is retained explicitly. Documentation remains
public as measured on the baseline. Admin reads still return 401 anonymously,
403 for ordinary learners and 200 for admins. JS bypass, same-origin frames,
BCrypt, Basic, session persistence, form login and keyed remember-me remain.
Authentication filters explicitly save to a shared request/session repository;
Basic also saves there to preserve its baseline session behavior. Read-only
responses do not automatically resave authentication after logout.
Registration returns 201 without authenticating; the frontend then calls `/auth`
for its 200 success or 403 failure. Logout returns 204 for the tested non-HTML
client and clears login state. The inactive CSRF cookie repository is removed;
effective CSRF remains disabled, matching the baseline.

Controller trailing-slash aliases are retained with the framework compatibility
setting. Error handling explicitly requests the Boot 3 status attribute, avoiding
an NPE in denial dispatch. Framework 6 missing-resource errors retain the previous
`No message available` body. Missing-parameter errors retain the detailed
parameter/type message instead of the new shortened ErrorResponse detail. `Boot3SecurityContractTest` measures both statuses
and error bodies, sessions, new remember-me cookies, registration and logout.
The same matrix is also executed against the frozen Boot 2 source.

`Boot3LearningContractTest` exercises real vocabulary/kanji shapes, quiz
alternatives/image references, grammar inflection, drawing JSON/timestamp storage
and Unicode localization resources. Existing controller, question, progress,
seed-safety and real PostgreSQL baseline tests remain in the suite. Browser
coverage retains the full mixed-answer guess journey and flashcard/translation
smoke; it does not cover every stroke/speech/input/language or learning-mode UI.

## Reproduce the upgrade proof

Build the frozen Boot 2 source separately using the pinned Java 17, Maven 3.9.16,
Node 24.21.0 and npm 11.19.0 setup, clean npm install/preflight, PostgreSQL tests
and production package. Build and test the candidate separately. Do not replace
either jar while an application is running.

```sh
bash scripts/test-boot3-upgrade.sh \
  --baseline-jar /absolute/boot2/target/gakusei.jar \
  --candidate-jar /absolute/candidate/target/gakusei.jar \
  --baseline-sha 9d614c2506d5e58ad3a8343a92dc7d87f9fde1c4
python3 tests/lifecycle/upgrade-guards.py
python3 tests/lifecycle/upgrade-interrupt.py /absolute/boot2/target/gakusei.jar /absolute/candidate/target/gakusei.jar
python3 scripts/verify-boot3-upgrade.py --cleanup
```

The harness validates absolute jars, embedded Boot versions, manifest, production
JS/license assets and immutable hashes before allocation and across restarts.
It proves empty/no-seed migration, explicit guarded seed, authenticated account
and mixed learning/retention writes, then upgrade/new writes/database-app restart
and two reseeds. Private comparisons retain original account, event, progress,
seed and content state plus Liquibase identity, order, execution type/date,
deployment and original recorded Liquibase version. Only the supported v8-to-v9
checksum recalculation is accepted; history reexecution or other mutation fails.
See [Liquibase checksum guidance](https://docs.liquibase.com/secure/user-guide-5-1/what-is-a-changeset-checksum).
No checksum reset or history rewrite is performed.

The harness uses PostgreSQL 16.15, random private credentials and the existing
strict ownership protocol. All services bind owned loopback ports; protected
18082/15432, project `gakusei-local` and its volume are excluded. It never reads
`.env.local` or preview credentials. Raw snapshots and logs stay private beneath
`.tools/browser-tests/<run>/`; upgrade payloads use private names and are excluded
from public diagnostics. Privacy regressions test that exclusion. Failure and
TERM tests prove exact cleanup and preservation of an independent sentinel under
hostile inherited settings. Cleanup failures stay failures. Unconditional CI
cleanup validates ownership before touching any process/container/volume.

## CI and delivery limits

The existing regression job retains its checks and gains lifecycle/ownership
checks. A separate dependent 45-minute upgrade job builds the immutable baseline
and candidate and runs two-fixture and interruption proof, with bounded steps
and unconditional cleanup. This separates the additional proof from the original
job budget. Hosted Linux execution and duration remain a downstream publication
checkpoint; local macOS timing is not a Linux measurement. Upgrade raw evidence
is not uploaded.

New sessions/remember-me behavior is tested. Cross-version cookies and seamless
old active-session migration are not promised. Revert source before deployment
for rollback; an already upgraded database requires proven backup/restore or a
supported forward fix. Do not run the old application against upgraded data as
an assumed rollback. The workflow must review locally verified source, publish a
feature PR to develop and monitor CI on the delivered head. Merge and deployment
remain outside this work item.
