# gakusei
Gakusei, which means _student_ in Japanese, is an application for learning and practicing Japanese.
The project's primary focus is to develop a tool for learning Japanese via Swedish.
Gakusei is governed by [Daigaku Sverige](http://www.daigaku.se), and sponsored by [Kits](https://www.kits.se).

A beta version of Gakusei can be tested at [gakusei.daigaku.se](http://gakusei.daigaku.se).

## Verified local development (macOS arm64)

This disposable baseline uses **Temurin 17.0.16+8, Maven 3.9.16, Node 24.21.0,
npm 11.19.0, Spring Boot 2.7.18 and H2 2.1.214**. React 16/Redux and the existing
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
./mvnw -Dskip.frontend=true test
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

### Start the disposable H2 applications

Terminal 1:

```sh
. scripts/local-env.sh
./mvnw -Dskip.frontend=true spring-boot:run -Dspring-boot.run.profiles=local
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
./mvnw -Dskip.frontend=true spring-boot:run -Dspring-boot.run.profiles=local \
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
./mvnw clean verify -Pproduction
java -jar target/gakusei.jar --spring.profiles.active=local
# Open http://localhost:8080
```

Maven installs its own pinned native Node/npm under ignored `node/`, runs `npm ci`
and builds production assets. The jar embeds the generated template, hashed
`/js/` assets, local Bootstrap 3.3.7 styles/fonts and license resources. No CDN,
dev server, PostgreSQL, ELK, Redis or production credentials are needed at runtime.
For another local port add `--server.port=18081`. API documentation is now
`/v3/api-docs` and `/swagger-ui/index.html` (sign in locally); the old Springfox
`/v2/api-docs` endpoint is replaced.

### Data lifecycle, content and limitations

The default runtime profile is `local`. Its in-memory H2 creates an empty schema,
seeds once per backend process and drops all accounts, events and progress on
shutdown. **Every backend restart resets your work**. Stop and start to reset;
there is no persistent volume or production dump. The seed creates six disposable
sample users (including `pieru` / `gakusei` and admin / `gakusei`), vocabulary,
lessons, kanji, quizzes, and the seven event categories needed for progress.
Use a newly registered account for learning acceptance. Fixture initialization
is transactional, missing JSON fails startup, and empty vocabulary fails clearly.
An optional `LOCAL_REMEMBER_ME_KEY` environment variable sets the local key;
no real credentials belong in tracked files.

Vocabulary is the verified core flow. Bundled material exposes five vocabulary lessons, two kanji lessons and one
quiz in lesson-selection APIs (three quiz records exist in the raw repository).
It is sample content, not the production corpus. Grammar reference/inflection fixtures and
favorites remain incomplete; browser Japanese Web Speech voices are optional.
Persistent PostgreSQL is available through the dedicated `local-postgres` profile
below. The retained historical `postgres` profile is unchanged; use the dedicated
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

### Persistent local PostgreSQL (phase 3)

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
Do not combine `local-postgres` with `local` or `development`.

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

Verified run details, actual test counts and browser/persistence evidence are in
`verification/ORDERED-PHASES.md`. The restored server/dependency stack remains a
local compatibility bridge with the limitations listed above.


## Historical auxiliary infrastructure

The ELK and deployment notes below describe historical infrastructure, not
prerequisites or verified commands for the local baseline. Do not use deployment
scripts as part of local restoration.

###	Using the Elastic stack (ELK) to analyse events
Requirements:
* Elasticsearch
* Kibana
* Logstash
* Logstash jdbc plugin
* postgres jdbc driver
* Running gakusei database

**Note #1:** Logstash currently requires Java 8 and does not support Java 9 or higher.

#### Installing ELK 

Complete steps 1-3 from this installation page for the Elastic Stack to install Elasticsearch, Kibana and Logstash:\
https://www.elastic.co/guide/en/elastic-stack/current/installing-elastic-stack.html

For Mac you can just use brew with the following commands:
* `brew install elasticsearch`
* `brew install kibana`
* `brew install logstash`

To be able to search the database, install the logstash jdbc input plugin with the following command:
* `logstash-plugin install logstash-input-jdbc`

In case the command does not work, refer to the installation page for the jdbc input plugin:\
https://www.elastic.co/blog/logstash-jdbc-input-plugin

Download the latest version of the postgres driver from this page:\
https://jdbc.postgresql.org/download.html

Create a config file for logstash, e.g., `gakusei-config.conf` and paste the following configuration into the file:

```
input {
	jdbc {
		jdbc_connection_string => "jdbc:postgresql://localhost:5432/gakusei"
		jdbc_user => "gakusei"
		jdbc_driver_library => "postgresql-42.2.5.jar"
		jdbc_driver_class => "org.postgresql.Driver"
		statement => "SELECT * from events"
	}
}

output {
	elasticsearch {
		index => "gakusei"
		document_type => "event"
		document_id => "%{id}"
		hosts => "localhost:9200"
	}
}
```
**Note 2:** `jdbc_driver_library` points to the postgres driver that you just downloaded.

**Note 3:** `index` does not have to be "gakusei". You can set the index to be whatever you want. You will refer to this later in Kibana.

#### Running ELK

1. Start Elasticsearch and Kibana by simply typing `elasticsearch` and `kibana` into seperate terminals.
2. Start Logstash with the following command: `logstash -f <pathToConfigFile>` in a third terminal.
3. Open a web browser and go to `http://localhost:5601` which hosts the Kibana application.
4. In the upper right corner, click on `Set up index pattern` and type in the name of the index you defined in the config file.
5. Click next to complete the setup and then navigate to the `Discover` page on the left panel to see the data.

**Note 4:** If nothing shows on the discover page, the timespan is probably too short. It can be changed from the upper right corner. You can also use the following command to check if Elasticsearch contains the data:
* `curl localhost:9200/gakusei/event/1`

This command would return the first indexed event by Elasticsearch where `gakusei` is the index name, `event` is the document type and the `1` at the end is the index of the event.

You should now have imported the data from your database into Elasticsearch and view it with Kibana.

Refer to online tutorials to learn how to use Kibana or use the Kibana user guide on the this page:\
https://www.elastic.co/guide/en/kibana/current/index.html

### Using the Elastic Stack (ELK) with Docker (Probably only MAC for now)

Requirements:
* Docker version 17.05+
* Docker Compose version 1.6.0+
* postgres jdbc driver
* Running gakusei database

#### Installing Docker

Download and install Docker from this page:\
https://www.docker.com/products/docker-engine#/download

Download and install Docker Compose from this page:\
https://docs.docker.com/compose/install/

Download the latest version of the postgres driver from this page:\
https://jdbc.postgresql.org/download.html

**Note 1:** On desktop systems like Docker for Mac and Windows, Docker Compose is included as part of those desktop installs.

Clone the docker-elk repository that includes a pre-configured Elastic Stack running on Docker:
* `git clone https://github.com/deviantony/docker-elk.git`

#### Configuring ELK on Docker from scratch

**Note 2:** If you already have the gakusei project on your machine, you can skip these steps and proceed to [Running ELK on Docker](#running)

Navigate to the `/logstash/pipeline` directory and create two files `gakusei_events.conf` and `gakusei_progresstrackinglist.conf`.

Paste the following configuration to `gakusei_events.conf`:
```
input {
	jdbc {
		jdbc_connection_string => "jdbc:postgresql://docker.for.mac.localhost:5432/gakusei?gakusei"
		jdbc_user => "gakusei"
		jdbc_password => "gakusei"
		jdbc_driver_library => "/usr/share/logstash/postgresql-42.2.5.jar"
		jdbc_driver_class => "org.postgresql.Driver"
		statement => "SELECT * from events"
	}
}

## Add your filters / logstash plugins configuration here

output {
	elasticsearch {
		index => "events"
		document_type => "event"
		document_id => "%{id}"
		hosts => "elasticsearch:9200"
	}
}
```

Paste the following configuration to `gakusei_progresstrackinglist`:
```
input {
	jdbc {
		jdbc_connection_string => "jdbc:postgresql://docker.for.mac.localhost:5432/gakusei?gakusei"
		jdbc_user => "gakusei"
		jdbc_password => "gakusei"
		jdbc_driver_library => "/usr/share/logstash/postgresql-42.2.5.jar"
		jdbc_driver_class => "org.postgresql.Driver"
		statement => "SELECT * from progresstrackinglist"
	}
}

## Add your filters / logstash plugins configuration here

output	{
	elasticsearch {
		index => "progresstrackinglist"
		document_type => "progresstracking"
		document_id => "%{id}"
		hosts => "elasticsearch:9200"
	}
}
```

**Note 3:** As you might have noticed, the jdbc connection string points to `docker.for.mac.localhost` as the host. This unfortuneately might only work on MAC computer for now, but should work fine with a remote postgres server that uses an ip address.

Navigate back to the `logstash` directory and open the `Dockerfile`.
Add these lines to the `Dockerfile` to configure logstash to work with our running postgres database:
```
# Install the logstash input jdbc plugin to work with postgres.
RUN logstash-plugin install logstash-input-jdbc

# Copy files from the host machine to the container. The syntax is 'COPY <source> <target>'.
COPY /pipeline/gakusei_events.conf /usr/share/logstash/pipeline/
COPY /pipeline/gakusei_progresstrackinglist.conf /usr/share/logstash/pipeline/
COPY postgresql-42.2.5.jar /usr/share/logstash/

# Commands to run on logstash startup.

# CMD ["-f", "/usr/share/logstash/pipeline/gakusei_progresstrackinglist.conf"]
# CMD ["-f", "/usr/share/logstash/pipeline/gakusei_events.conf"]
```

**Note 4:** The commands are intentionally commented out. As you will soon see, we will use them one at a time.

#### Running ELK on Docker <a name="running"/>

Make sure you are in the `Logstash` folder inside the `elk-on-docker` folder. Edit `Dockerfile` and uncomment one of the commands at the end. It does not matter which one, but lets go with the first.

Then start up the Elastic stack on Docker using these two commands:
1. docker-compose build
2. docker-compose up

Once all the data has been transfered to Elasticsearch, shut down the containers with `Ctrl + C` to edit the Dockerfile.
Comment out the first command and uncomment the second command in the `Dockerfile`, then build and run Docker again using the two commands above.

**Note 5:** You must run both commands after any changes that you make. You can shut down the docker containers with `Ctrl + C` and start it up again only with the second command and you should still have the data in Elasticsearch.

Elasticsearch should now contain all the data. You can view the indices in elasticsearch with the following command:

`curl http://localhost:9200/_cat/indices\?v`

In case you need to delete the data from elasticsearch and start from the beginning, you can use this command to delete entire indices, e.g. the 'events' index:

`curl -XDELETE localhost:9200/events`

When you have successfully executed all the above steps, you can open kibana in the browser and navigate to `Management => Saved Objects => import` to import a dashboard that includes graphs for 'number of answers per user' and 'number of incorrect answers per nugget' (More will be added). Import the file below and choose the corresponding index for each visualization and finally click on import. Now you should be able to see the graphs under the dashboard tab on the left panel.

[Dashboard file](https://kitsab-my.sharepoint.com/:u:/g/personal/akar_khatab_kits_se/EZxceBxFrNxApDKxtC--NeYBnEdbDMujqiEvSaxxUrT1fA?e=Lnffgt)

#### Inspecting the containers

To list all the containers that are currently running, use the following command:
* `docker ps`

To include containers that are not currently running, use the following command:
* `docker ps -a`

To inspect a docker image with bash, use the following command:
* `docker run --rm -it --entrypoint=/bin/bash <image name>` 


## Deployment <a name="deploy"/>
The repository is synched with [Travis CI](https://travis-ci.org/), which is a tool for continuous integration that automatically builds, tests and deploys the project.
Travis configuration is available in [.travis.yml](.travis.yml).

When pushing to master or develop, Travis does the following:
* `mvn clean package -Pproduction` to install npm packages, compile the front-end, back-end, and finally, package the .jar file to `target/`
* copy the .jar from the Travis build directory to the specified server
```
master  -> gakusei.daigaku.se
develop -> staging.daigaku.se
```
* ssh to the specified server
* run `deploy_gakusei.sh` located in the Scripts directory

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
