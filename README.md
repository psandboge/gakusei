# gakusei
Gakusei, which means _student_ in Japanese, is an application for learning and practicing Japanese.
The project's primary focus is to develop a tool for learning Japanese via Swedish.
Gakusei is governed by [Daigaku Sverige](http://www.daigaku.se), and sponsored by [Kits](https://www.kits.se).

A beta version of Gakusei can be tested at [gakusei.daigaku.se](http://gakusei.daigaku.se).

## Verified local development (macOS arm64)

This disposable baseline uses **Temurin 17.0.16+8, Maven 3.9.16, Node 24.21.0,
npm 11.19.0, Spring Boot 2.7.18 and PostgreSQL 16.15**. React 16/Redux and the existing
API/session authentication are retained. Boot 2.7 is a temporary local
compatibility bridge, not an ongoing supported server deployment. The exact
frontend graph is in `package-lock.json`; use `npm ci`, not `npm install`.

### Install and select tools

From the checkout root:

```sh
./scripts/install-local-tools.sh
. scripts/local-env.sh
java -version
node --version
npm --version
./mvnw --version
npm ci
npm test
npm run compile
./scripts/test-postgres.sh
```

The installer downloads pinned vendor archives, verifies SHA-256, and extracts
them under `~/.cache/gakusei-tools`; it does not replace global defaults.
`GAKUSEI_TOOLS_DIR` can select another cache directory. Source `local-env.sh` in
each terminal. The Maven wrapper pins and checks its distribution. Maven rejects
JDKs outside 17 and Maven versions other than 3.9.16; npm rejects different
Node/npm versions. Other operating systems need matching pinned native tools;
the supplied installer is specifically for this Mac.

The grammar dependency is `com.github.psandboge:japanese-grammar-utils:1.0.0`
from JitPack, built from commit `5b7743099eaa7e0c38d2064ec9d25fa7a03d49b8`.
Maven validates the jar and POM against committed SHA-256 pins before compilation
(`scripts/verify-grammar.sh`). An unavailable or changed artifact is a build
failure; no floating upstream clone or grammar stub is used.

### Start the local PostgreSQL application

First initialize PostgreSQL and explicitly seed as described in
[Persistent local PostgreSQL](#persistent-local-postgresql). Then:

Terminal 1:

```sh
. scripts/local-env.sh
./mvnw -Dskip.frontend=true spring-boot:run -Dspring-boot.run.profiles=local-postgres
```

Terminal 2:

```sh
. scripts/local-env.sh
npm start
```

Open **http://localhost:7777**. Both listeners bind to 127.0.0.1. Use `localhost`
consistently for browser cookies. The dev server proxies API, login/logout,
registration and static resources to the backend; React Refresh and style HMR
update frontend edits. Stop each foreground command with Ctrl-C. Backend edits
require recompilation/restart. The local profile disables the extra LiveReload
server. `skip.frontend=true` skips every Maven frontend execution, so backend
commands do not rebuild a separately served frontend.

If a port is occupied, inspect it with `lsof -nP -iTCP:8080 -sTCP:LISTEN`; do not
stop an unrelated process. For example, the acceptance run used these alternatives:

```sh
./mvnw -Dskip.frontend=true spring-boot:run -Dspring-boot.run.profiles=local-postgres \
  -Dspring-boot.run.arguments=--server.port=18080
GAKUSEI_BACKEND_PORT=18080 GAKUSEI_FRONTEND_PORT=17777 npm start
# Browser: http://localhost:17777
```

Register a disposable username/password locally, choose Vocabulary → Guess the
word and the populated **genki 15** lesson. Answer its six questions, inspect
feedback/results, then logout and login again. Completed answers reduce the
remaining-question count and update progress. A study-route refresh loads the
application without a 404 and returns to lesson selection because active lesson
state is transient. An active session is not restored after a full browser reload.

### Build and run the standalone jar

Stop the dev backend first (and the dev server for standalone acceptance):

```sh
. scripts/local-env.sh
./scripts/test-postgres.sh clean verify -Pproduction
java -jar target/gakusei.jar --spring.profiles.active=local-postgres
# Open http://localhost:8080
```

Maven installs its own pinned native Node/npm under ignored `node/`, runs `npm ci`
and builds production assets. The jar embeds the generated template, hashed
`/js/` assets, local Bootstrap 3.3.7 styles/fonts and license resources. No CDN,
dev server, Redis or production credentials are needed at runtime. Local
PostgreSQL and exported database settings are required.
For another local port add `--server.port=18081`. API documentation is now
`/v3/api-docs` and `/swagger-ui/index.html` (sign in locally); the old Springfox
`/v2/api-docs` endpoint is replaced.

### Data lifecycle, content and limitations

The default runtime profile is `local-postgres`. The `local` and `development`
aliases also select PostgreSQL. There is no embedded database fallback: Docker,
a reachable database and exported `LOCAL_DB_PASSWORD` are required. Migrations
run at startup and Hibernate validates the schema. Normal startup never seeds;
use `local-postgres,local-seed` once to install the sample content. Repeating
that explicit seed is safe and preserves users and progress. Backend and
container restarts preserve data in the named volume. Resetting requires an
explicit destructive `docker compose down -v` on the intended local project.
The sample seed creates six disposable users, vocabulary, lessons, kanji,
quizzes and event categories. Register your own local account for learning.

Vocabulary is the verified core flow. Bundled material exposes five vocabulary lessons, two kanji lessons and one
quiz in lesson-selection APIs (three quiz records exist in the raw repository).
It is sample content, not the production corpus. Grammar reference/inflection fixtures and
favorites remain incomplete; browser Japanese Web Speech voices are optional.
PostgreSQL is required through the dedicated `local-postgres` profile below.
The retained historical `postgres` profile is unchanged; use the dedicated
local configuration. The supported-server migration decision remains a follow-up.

Installation/build still need network access to vendor archives, npm, Maven
Central, JitPack and some dependency license URLs. License generation is retained;
its logs identify missing metadata and unavailable external endpoints (including
GNU URLs and the old activation license). This does not imply every third-party
license text was retrieved. Legacy runtime dependencies still produce npm audit
findings; no forced major upgrades or blanket peer bypass were applied. Sass
`@import` and bundle-size warnings remain visible in build logs; they do not
prevent the verified local flow.

`react-tooltip` and `react-popup` are pinned to React-16-compatible releases;
`redux-thunk` stays compatible with Redux 3. The vendored MIT
`react-toggle-button@2.2.0` changes only its obsolete peer declaration to include
React 16; its implementation is unchanged (`vendor/react-toggle-button/PROVENANCE.md`).

### Persistent local PostgreSQL

Docker Desktop must be running. This Compose project contains only PostgreSQL
16.15, pinned by manifest SHA-256. Its dedicated named volume is disposable local
data; no production dump or services are used. PostgreSQL and both app listeners
bind to loopback. The example credentials are only for disposable local use.

```sh
cp .env.local.example .env.local
# Edit the password; optionally choose another LOCAL_DB_PORT if 5432 is occupied.
docker compose --env-file .env.local -f compose.local.yml up -d --wait
. scripts/local-env.sh
set -a
. ./.env.local
set +a
# Explicit first-run bootstrap; stop it after startup succeeds.
./mvnw -Dskip.frontend=true spring-boot:run \
  -Dspring-boot.run.profiles=local-postgres,local-seed
# Normal startup (no sample initialization):
./mvnw -Dskip.frontend=true spring-boot:run \
  -Dspring-boot.run.profiles=local-postgres
# Start npm in a separate terminal as documented above.
```

The container initialization creates `contentschema` owned by the local role.
Liquibase runs the unchanged historical master plus local incremental changes;
Hibernate validates the result. Local additions widen JPA IDs/references to
bigint and retention fields to double precision. Seeding reuses migration-owned
categories and requires an empty users/content database without a seed marker.
Fixtures and the marker commit in one transaction; errors abort startup and roll
back. Repeating `local-seed` serializes on the marker table and leaves seeded
accounts, content and progress unchanged. Normal startup never seeds.
Integration tests use a separate disposable Compose project and volume:
`./scripts/test-postgres.sh`. The harness exports random local credentials,
waits for SQL readiness, runs all tests, then removes only its own volume.
Pass Maven goals/options to run the packaged build against that database.
A direct Maven test command must supply an isolated empty PostgreSQL database;
the integration tests explicitly seed it and expect six sample users.

For a packaged persistent application after the full production build:

```sh
java -jar target/gakusei.jar --spring.profiles.active=local-postgres
# Same browser hostname: http://localhost:8080
# Stop the app before stopping/resetting PostgreSQL.
docker compose --env-file .env.local -f compose.local.yml stop
# Resume with up -d --wait; the named volume retains data.
# DESTRUCTIVE reset of this disposable local project only:
docker compose --env-file .env.local -f compose.local.yml down -v
# Then up -d --wait and explicitly bootstrap with local-seed again.
```

Historical run details are archived in `verification/ORDERED-PHASES.md`.
Current PostgreSQL-only verification is recorded in the assigned task report.
The restored server/dependency stack remains a local compatibility bridge with
the limitations listed above.


## Historical server setup

The following notes describe historical server infrastructure and are not
prerequisites or verified commands for local development.

### Staging and production servers
The staging and production environments have similar setups. They are CentOs Linux 7 (Core) servers hosted by [Linode](https://www.linode.com/), with an [nginx](http://nginx.org/) web server.

The following happens on deploy:

#### 1. `deploy_gakusei.sh`
* set some enivronmental variables (script mode (=deploy), logfile name, production jar file name, db user etc)
* execute `node /home/<staging or production>/deploy-watcher/index.js`

#### 2. `index.js`
* create backups
  * the old .jar file and logfile are moved to the backup directory
  * the old database is dumped to the db backup directory
* the old .jar gets replaced by the new .jar
* `pkill --pidfile <pidfile>` is executed to terminate the running process with the pid in `<pidfile>`.
* `nohup java -jar <new>.jar --spring.profiles.active='postgres,enable-resource-caching' &> <logfile> & echo &! > <pidfile>` is executed to run the new jar (with the postgres and enable-resource-caching profiles active), redirect the output to the logfile and save the pid to file.

#### Other useful scripts
Other bash scripts than the deploy script are available in the `Scripts` directory:
* `backup_gakusei.sh`
* `restart_gakusei.sh`
* `start_gakusei.sh`
* `stop_gakusei.sh`

#### nginx
The main nginx configuration file (`nginx.conf`) is located in `etc/nginx/`. Linode has a guide that covers most of the directives and setup: https://www.linode.com/docs/web-servers/nginx/how-to-configure-nginx.

The virtual domains ([server block](https://www.linode.com/docs/web-servers/nginx/how-to-configure-nginx#server-virtual-domains-configuration)) configuration is located in `sites-available`.

nginx listens to incoming http requests on port 80 and https requests on port 443. <br>
All incoming http requests are rewritten to https URIs and redirected to port 443. <br>
Subsequently the requests are proxied to Tomcat serving Gakusei on localhost:8080.

### Monit
Monit is a free open-source proccess supervision tool. It is used on the Gakusei servers in order to run the start up script when Gakusei is down. `monit status` shows the status of the server. The configuration for monit is in `/etc/monitrc`.

## System overview <a name="system"/>
The following picture gives a brief overview of the projects structure:

![Alt System Overview](./doc/img/GakuseiOverview.png)

### Frontend
- React
- React Redux
- React Router
- React Bootstrap
- Webpack

Webpack packages everything into a bundle file (except for most resource files, they'll get merged in eventually as well), which is served via a single index.html file given either by the back-end in production (thymeleaf, inside `templates/` dir) or by the webpack dev server front-end on port 7777 (`templates/webpack_index.html`).

### Backend
- Spring Boot
- Maven
- Ehcache

The backend is a Spring Boot application. The frontend's REST requests are received by the controllers which handles the
request. The controllers uses modules with business logic and repositories with the database connections in order to
handle the requests and returning a response.

Ehcache is a very popular caching tool used to make the app run faster. The configuration for the cache is in ehcache.xml. Ehcache is only enabled if the `enable-resource-caching` profile is active which is highly recommended. Spring automatically configures Ehcache and only the `@EnableCaching` and `@Cacheable` annotations are required to use the cache. See the spring documentation on how to invalidate the cache if needed.

### Misc
In the project's Spring Boot configuration file (src/main/resources/application.yml) the data initialization and event
logging can be turned on and off. Data initialization is only for the development environment, as actual data is not shipped in this project.
Any changes to data structure is done via liquibase's changeset file. Make sure your changes are incremental (one changeset for each new change) after you've published your application somewhere, otherwise liquibase will think you've done something wrong modifying existing changesets, and will refuse to continue.
