# Java 25 runtime checkpoint

The candidate retains Spring Boot 4.1.1, Maven 3.9.16, Node 24.21.0 and npm
11.19.0. Its supported compiler/runtime is Java25, with release25 (class major69,
minor0) and Enforcer [25,26). No preview features are enabled. Frozen fixtures
use Java17; their source and public harnesses remain immutable.

## Verified tools

Run `bash scripts/install-java-tools.sh` with a private
`GAKUSEI_JAVA_TOOLS_DIR`, then evaluate its export statements in an owned shell.
The local installer uses the same helper. Source `scripts/local-env.sh` to
select the candidate Java25 home. Linux CI installs tools per job.
Both macOS arm64 and Linux x86_64 use exact checksum-verified Temurin25.0.4.1+1
and Temurin17.0.16+8. See the installer for official immutable archive URLs and
SHA256 pins. Canonical homes and receipts bind java, javac and jcmd digests.
A cache without a matching receipt, or altered executable, fails installation.
Tool selection is scoped to owned subprocesses, with no running preview changes.

## Independent proof builds

From the candidate checkout, use independent clean accepted checkouts:

```sh
python3 scripts/build-upgrade-jar.py --checkout /absolute/boot3 --manifest /absolute/private/boot3.json --java-home "$GAKUSEI_JAVA17_HOME" --expected-java-major 17
python3 scripts/build-upgrade-jar.py --checkout /absolute/merged-boot4 --manifest /absolute/private/boot4-java17.json --java-home "$GAKUSEI_JAVA17_HOME" --expected-java-major 17
python3 scripts/build-upgrade-jar.py --checkout /absolute/candidate --manifest /absolute/private/candidate.json --java-home "$GAKUSEI_JAVA25_HOME" --expected-java-major 25
python3 scripts/run-boot4-proof.py --proof-pair boot3-boot4 --baseline-build-manifest /absolute/private/boot3.json --candidate-build-manifest /absolute/private/candidate.json
python3 scripts/run-boot4-proof.py --proof-pair boot4-java25 --baseline-build-manifest /absolute/private/boot4-java17.json --candidate-build-manifest /absolute/private/candidate.json
```

Repeat both public pair commands with `--interrupt`. Baseline source is exactly
1bac4e96fe9a2f405eddff503056ef231fb4a8f9 for boot3-boot4 and
710a0051099492f34b5e383c0bd9457d9934f2bc for boot4-java25.
Candidate source must be distinct and descend from the accepted baseline.
Each v2 record binds clean source, a clean production package, jar hash,
executed Maven/JDK/compiler/plugins and application bytecode. Private per-start
jcmd records attest the tracked owned PID/start identity, Java home/vendor/version
and jar. Missing evidence fails proof; inherited PATH cannot substitute a launcher.

Both pairs retain fresh/populated history, checksum, learner-data, new-write,
restart, two-reseed and unsafe-seed refusal assertions. All fixtures use uniquely
owned disposable services. Never access preview localhost:18082, PostgreSQL
127.0.0.1:15432, gakusei-local or gakusei-local_postgres-data.

## Acceptance and limitations

Follow the complete ordered local sequence in ci-browser-baseline.md: frontend,
owned PostgreSQL tests before packaging, Chromium, lifecycle/ownership/negative
guards, privacy, independent historical fixtures and both current pairs plus
interruptions. No new skips, relaxed assertions or extended budgets count as
success. Final-source evidence and independent acceptance/test-evidence/simplicity
review precede a feature-only develop PR. Terminal successful exact-SHA hosted
regression, boot3-upgrade, boot4-upgrade and java25-upgrade are required; then await
owner merge. Local proof alone does not establish hosted acceptance.

Coverage remains bounded to the retained Chromium journeys and tested routes,
aliases and session flows; it does not claim every browser, locale/input or
active-session continuity across runtimes. The Thymeleaf Spring/Security6 bridge
remains. Liquibase retains FSL-1.1-ALv2/community limits. Historical failures and
prototype evidence are distinct from final clean-source proof. Deployment needs
a separately authorized and validated backup/restore rehearsal or independently
reviewed forward fix; an old jar is not assumed safe after candidate writes.

Raw jcmd, build/runtime/ownership manifests, SQL, credentials and logs remain
private. Only allowlisted derived diagnostics passing the fail-closed privacy
scanner may be uploaded. Pair markers/results must agree.
