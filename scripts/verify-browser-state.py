#!/usr/bin/env python3
"""Owned browser lifecycle and allowlisted SQL proof. See tests/lifecycle/README.md."""
import collections
import json
import os
from pathlib import Path
import re
import secrets
import signal
import socket
import subprocess
import sys
import time
import traceback
import urllib.request
import zipfile

if not __debug__:
    raise RuntimeError('Ownership checks require Python without optimization')

ROOT = Path(__file__).resolve().parent.parent
PROTECTED = {18082, 15432}


def safe_env():
    return {k: v for k, v in os.environ.items() if not k.startswith(
        ('SPRING_', 'LOCAL_DB_', 'LOCAL_REMEMBER_', 'GAKUSEI_', 'MAVEN_', 'COMPOSE_', 'SERVER_', 'LOGGING_', 'PYTHON'))
        and k not in ('JAVA_TOOL_OPTIONS', 'JDK_JAVA_OPTIONS', '_JAVA_OPTIONS')}


def command(args, env=None, timeout=90, **kwargs):
    data = kwargs.pop('input', None)
    if kwargs.pop('capture_output', False):
        kwargs.update(stdout=subprocess.PIPE, stderr=subprocess.PIPE)
    if data is not None:
        kwargs['stdin'] = subprocess.PIPE
    process = subprocess.Popen(args, cwd=ROOT, env=env if env is not None else safe_env(),
                               text=True, start_new_session=True, **kwargs)
    try:
        stdout, stderr = process.communicate(data, timeout=timeout)
        if process.returncode:
            raise subprocess.CalledProcessError(process.returncode, args, stdout, stderr)
        return subprocess.CompletedProcess(args, process.returncode, stdout, stderr)
    except BaseException:
        if process.poll() is None:
            os.killpg(process.pid, signal.SIGTERM)
            try:
                process.wait(timeout=5)
            except subprocess.TimeoutExpired:
                os.killpg(process.pid, signal.SIGKILL)
                process.wait(timeout=5)
        raise


def atomic(path, data):
    tmp = Path(str(path) + '.tmp')
    tmp.write_text(json.dumps(data, sort_keys=True, indent=2) + '\n')
    tmp.chmod(0o600)
    tmp.replace(path)


def free_port():
    for _ in range(20):
        with socket.socket() as s:
            s.bind(('127.0.0.1', 0))
            port = s.getsockname()[1]
        if port not in PROTECTED:
            return port
    raise RuntimeError('Cannot allocate an unprotected port')


def load_record(path):
    path = Path(path).resolve()
    r = json.loads(path.read_text())
    run = r['run_id']
    assert re.fullmatch('[a-f0-9]{24}', run), 'Invalid run identity'
    assert r['project'] == 'gakusei-browser-' + run
    assert r['volume'] == r['project'] + '_postgres-data'
    assert path == ROOT / '.tools/browser-tests' / run / 'ownership.json'
    assert r['root'] == str(ROOT)
    assert path.stat().st_mode & 0o077 == 0, 'Ownership record must be private'
    assert path.parent.stat().st_mode & 0o077 == 0, 'Run directory must be private'
    assert all(type(r[k]) is int and 1024 <= r[k] <= 65535 and r[k] not in PROTECTED
               for k in ('db_port', 'app_port'))
    assert r['db_port'] != r['app_port']
    assert r['origin'] == 'http://127.0.0.1:' + str(r['app_port'])
    return r


def compose(r):
    return ['docker', 'compose', '--env-file', os.devnull, '-p', r['project'], '-f', str(ROOT / 'compose.local.yml')]


def inspect_service(r, env):
    ids = command(compose(r) + ['ps', '-q', 'postgres'], env, capture_output=True).stdout.split()
    assert len(ids) == 1, 'Missing owned PostgreSQL'
    info = json.loads(command(['docker', 'inspect', ids[0]], env, capture_output=True).stdout)[0]
    labels = info['Config']['Labels']
    assert labels['com.docker.compose.project'] == r['project']
    assert labels['com.docker.compose.service'] == 'postgres'
    assert info['State']['Running'] and info['State']['Health']['Status'] == 'healthy'
    assert any(m.get('Name') == r['volume'] for m in info['Mounts'])
    ports = info['NetworkSettings']['Ports']['5432/tcp']
    assert ports == [{'HostIp': '127.0.0.1', 'HostPort': str(r['db_port'])}]
    return ids[0]


def sql(r, env, query):
    inspect_service(r, env)
    result = command(compose(r) + ['exec', '-T', 'postgres', 'sh', '-c',
        'exec psql -X -qAt -v ON_ERROR_STOP=1 -U "$POSTGRES_USER" -d "$POSTGRES_DB"'],
        env, input=query, capture_output=True).stdout.strip()
    return json.loads(result)


def content(r, env):
    return sql(r, env, """SELECT json_build_object(
      'migrations', (SELECT count(*) FROM public.databasechangelog),
      'seed', (SELECT count(*) FROM public.local_sample_seed),
      'nuggets', (SELECT count(*) FROM contentschema.nuggets),
      'lessons', (SELECT count(*) FROM contentschema.lessons),
      'users', (SELECT count(*) FROM public.users));""")


def fixture(r, env):
    return sql(r, env, """SELECT json_build_object('lesson', 'genki 15', 'category', 2,
      'nuggets', (SELECT json_agg(x ORDER BY id) FROM
        (SELECT n.id, n.jp_read AS reading, n.swedish FROM contentschema.nuggets n
         JOIN contentschema.lessons_nuggets ln ON ln.nugget_id=n.id
         JOIN contentschema.lessons l ON l.id=ln.lesson_id
         WHERE l.name='genki 15' AND n.hidden=false) x));""")


def learner_state(r, env, state):
    assert state['run_id'] == r['run_id'] and state['nonce'] == r['nonce']
    assert state['origin'] == r['origin'] and state['lesson'] == 'genki 15'
    assert state['category'] == 2
    user = state['username']
    assert re.fullmatch('[A-Za-z0-9]{2,32}', user)
    submissions = state['submissions']
    assert submissions and all(type(s['correct']) is bool for s in submissions)
    allowed = {n['id'] for n in fixture(r, env)['nuggets']}
    assert all(s['nugget_id'] in allowed for s in submissions)
    # Every value interpolated into SQL is fixed or validated above.
    snapshot = sql(r, env, f"""SELECT json_build_object(
      'account', (SELECT count(*) FROM users WHERE username='{user}'),
      'events', (SELECT coalesce(json_agg(x ORDER BY id), '[]') FROM
        (SELECT id, nugget_id, data FROM events WHERE user_ref='{user}'
         AND lesson='genki 15' AND nugget_type_ref=2 AND type='answeredCorrectly') x),
      'progress', (SELECT coalesce(json_agg(x ORDER BY nugget_id), '[]') FROM
        (SELECT p.nugget_id, p.correct_count, p.incorrect_count, p.latest_result,
                p.latest_timestamp, p.retention_factor, p.retention_interval, p.retention_date
         FROM progresstrackinglist p WHERE user_ref='{user}' AND nugget_type_ref=2
         AND nugget_id IN (SELECT ln.nugget_id FROM contentschema.lessons_nuggets ln
           JOIN contentschema.lessons l ON l.id=ln.lesson_id WHERE l.name='genki 15')) x));""")
    assert snapshot['account'] == 1
    expected = collections.Counter((s['nugget_id'], str(s['correct']).lower()) for s in submissions)
    actual = collections.Counter((s['nugget_id'], s['data']) for s in snapshot['events'])
    assert actual == expected, 'Answer events differ from submitted choices'
    counts = collections.defaultdict(lambda: [0, 0])
    for s in submissions:
        counts[s['nugget_id']][0 if s['correct'] else 1] += 1
    assert len(snapshot['progress']) == len(counts)
    for row in snapshot['progress']:
        assert [row['correct_count'], row['incorrect_count']] == counts[row['nugget_id']]
        assert row['latest_result'] == next(s['correct'] for s in reversed(submissions)
                                             if s['nugget_id'] == row['nugget_id'])
    return snapshot


def pid_identity(pid):
    return command(['ps', '-p', str(pid), '-o', 'lstart=', '-o', 'command='],
                   capture_output=True).stdout.strip()


def cleanup(path):
    r = load_record(path)
    errors = []
    pid = r.get('pid')
    if pid:
        try:
            identity = pid_identity(pid)
        except subprocess.CalledProcessError:
            identity = ''
        if identity:
            assert identity == r['pid_identity'], 'PID identity changed; refusing stop'
            os.kill(pid, signal.SIGTERM)
            for _ in range(100):
                try:
                    os.kill(pid, 0)
                except ProcessLookupError:
                    break
                # A child may be a zombie until its orchestrator waits.
                try:
                    status = command(['ps', '-p', str(pid), '-o', 'stat='], capture_output=True).stdout
                except subprocess.CalledProcessError:
                    break
                if status.strip().startswith('Z'):
                    break
                time.sleep(.1)
            else:
                assert pid_identity(pid) == r['pid_identity'], 'PID identity changed during cleanup'
                os.kill(pid, signal.SIGKILL)
    env = safe_env()
    env['LOCAL_DB_PASSWORD'] = 'unused-cleanup-placeholder'
    env['LOCAL_DB_PORT'] = str(r['db_port'])
    try:
        ids = command(['docker', 'ps', '-aq', '--filter',
                      'label=com.docker.compose.project=' + r['project']], env, capture_output=True).stdout.split()
        for cid in ids:
            info = json.loads(command(['docker', 'inspect', cid], env, capture_output=True).stdout)[0]
            assert info['Config']['Labels']['com.docker.compose.project'] == r['project']
        with open(Path(path).parent / 'cleanup.log', 'a') as log:
            command(compose(r) + ['down', '-v', '--remove-orphans', '--timeout', '10'], env,
                    stdout=log, stderr=log, timeout=45)
    except Exception as exc:
        errors.append(type(exc).__name__)
    if errors:
        raise RuntimeError('Owned cleanup failed: ' + ','.join(errors))


class Run:
    def __init__(self):
        os.umask(0o077)
        run = secrets.token_hex(12)
        self.directory = ROOT / '.tools/browser-tests' / run
        self.directory.mkdir(parents=True, mode=0o700)
        self.record = self.directory / 'ownership.json'
        self.r = dict(run_id=run, project='gakusei-browser-' + run,
                      volume='gakusei-browser-' + run + '_postgres-data', root=str(ROOT),
                      db_port=free_port(), app_port=free_port(), nonce=secrets.token_hex(24))
        while self.r['app_port'] == self.r['db_port']:
            self.r['app_port'] = free_port()
        self.r['origin'] = 'http://127.0.0.1:' + str(self.r['app_port'])
        self.env = safe_env()
        self.env.update(LOCAL_DB_NAME='gakusei_browser', LOCAL_DB_USER='gakusei_browser',
                        LOCAL_DB_PASSWORD=secrets.token_hex(24), LOCAL_DB_PORT=str(self.r['db_port']))
        self.env.update(SPRING_DATASOURCE_URL=f"jdbc:postgresql://127.0.0.1:{self.r['db_port']}/gakusei_browser",
                        SPRING_DATASOURCE_USERNAME='gakusei_browser',
                        SPRING_DATASOURCE_PASSWORD=self.env['LOCAL_DB_PASSWORD'],
                        SPRING_CONFIG_LOCATION='classpath:/application.yml',
                        SPRING_PROFILES_ACTIVE='local-postgres', SERVER_ADDRESS='127.0.0.1',
                        SERVER_PORT=str(self.r['app_port']), GAKUSEI_DATA_INIT='false',
                        GAKUSEI_LOCAL_SEED='false', LOCAL_REMEMBER_ME_KEY=secrets.token_hex(24))
        self.check_id = 'lifecycle'
        self.phase_id = 'setup'
        self.checks = []
        self.phases = {}
        self.process = None
        self.learner = None
        self.app_started = False
        atomic(self.record, self.r)
        print('OWNERSHIP=' + str(self.record), flush=True)

    def up(self):
        self.check_id = 'database-readiness'
        for attempt in range(5):
            try:
                with open(self.directory / 'compose.log', 'a') as log:
                    command(compose(self.r) + ['up', '-d', '--wait', '--wait-timeout', '75'],
                            self.env, stdout=log, stderr=log, timeout=90)
                self.r['container'] = inspect_service(self.r, self.env)
                atomic(self.record, self.r)
                return
            except subprocess.CalledProcessError:
                cleanup(self.record)
                if attempt == 4:
                    raise
                self.r['db_port'] = free_port()
                self.env['LOCAL_DB_PORT'] = str(self.r['db_port'])
                self.env['SPRING_DATASOURCE_URL'] = f"jdbc:postgresql://127.0.0.1:{self.r['db_port']}/gakusei_browser"
                atomic(self.record, self.r)

    def start(self, seed=False):
        self.check_id = 'application-readiness'
        # Refuse occupied ports before launching; readiness never attaches to them.
        for attempt in range(5):
            try:
                with socket.socket() as s:
                    s.setsockopt(socket.SOL_SOCKET, socket.SO_REUSEADDR, 1)
                    s.bind(('127.0.0.1', self.r['app_port']))
                break
            except OSError:
                if self.app_started or attempt == 4:
                    raise
                self.r['app_port'] = free_port()
                while self.r['app_port'] == self.r['db_port']:
                    self.r['app_port'] = free_port()
                self.r['origin'] = 'http://127.0.0.1:' + str(self.r['app_port'])
                self.env['SERVER_PORT'] = str(self.r['app_port'])
                atomic(self.record, self.r)
        env = dict(self.env, GAKUSEI_LOCAL_SEED=str(seed).lower())
        log_path = self.directory / (('seed-' if seed else 'app-') + secrets.token_hex(4) + '.log')
        log = open(log_path, 'w')
        self.process = subprocess.Popen(['java', '-jar', str(ROOT / 'target/gakusei.jar'),
            '--spring.config.location=classpath:/application.yml',
            '--spring.profiles.active=local-postgres', '--server.address=127.0.0.1',
            '--server.port=' + str(self.r['app_port']), '--gakusei.data-init=false',
            '--logging.file.name=' + str(self.directory / 'spring-private.log'),
            '--gakusei.local-seed=' + str(seed).lower()], cwd=ROOT, env=env, stdout=log, stderr=log)
        log.close()
        self.app_started = True
        self.r['pid'] = self.process.pid
        self.r['pid_identity'] = pid_identity(self.process.pid)
        atomic(self.record, self.r)
        deadline = time.monotonic() + 100
        while time.monotonic() < deadline:
            assert self.process.poll() is None, 'Tracked Java startup failed'
            inspect_service(self.r, self.env)
            # ApplicationRunner must finish (HTTP may be listening before seed).
            ready = ('Started Gakusei' in log_path.read_text())
            if ready:
                try:
                    opener = urllib.request.build_opener(urllib.request.ProxyHandler({}))
                    with opener.open(self.r['origin'] + '/username', timeout=2) as response:
                        if response.status == 200 and (not seed or content(self.r, self.env)['seed'] == 1):
                            assert self.process.poll() is None
                            return
                except (OSError, ValueError):
                    pass
            time.sleep(.5)
        raise RuntimeError('Bounded app readiness expired')

    def stop(self):
        if self.process:
            self.process.terminate()
            try:
                self.process.wait(timeout=15)
            except subprocess.TimeoutExpired:
                self.process.kill()
                self.process.wait(timeout=5)
            self.process = None
            self.r.pop('pid', None)
            self.r.pop('pid_identity', None)
            atomic(self.record, self.r)

    def phase(self, phase, runner):
        self.phase_id = phase
        self.check_id = 'browser-tests'
        self.phases[phase] = 'unavailable'
        inspect_service(self.r, self.env)
        assert self.process and self.process.poll() is None
        output = self.directory / phase
        output.mkdir(mode=0o700)
        manifest = dict(self.r, phase=phase, fixture=fixture(self.r, self.env),
                        state_path=str(self.directory / 'learner.json'), output_dir=str(output))
        atomic(self.directory / 'manifest.json', manifest)
        env = dict(self.env, GAKUSEI_BROWSER_PHASE=phase,
                   GAKUSEI_BROWSER_MANIFEST=str(self.directory / 'manifest.json'),
                   GAKUSEI_BROWSER_OUTPUT_DIR=str(output))
        process = subprocess.Popen(runner, cwd=ROOT, env=env, start_new_session=True)
        try:
            exit_code = process.wait(timeout=300)
            if exit_code:
                raise subprocess.CalledProcessError(exit_code, runner)
        finally:
            if process.poll() is None:
                os.killpg(process.pid, signal.SIGTERM)
                try:
                    process.wait(timeout=10)
                except subprocess.TimeoutExpired:
                    os.killpg(process.pid, signal.SIGKILL)
                    process.wait(timeout=5)
        self.checks.append(dict(check='browser-tests', phase=phase, status='passed', cause='none'))
        self.check_id = 'durable-state'
        state_path = self.directory / 'learner.json'
        assert state_path.stat().st_mode & 0o077 == 0, 'Learner state must be private'
        state = json.loads(state_path.read_text())
        if phase == 'journey':
            self.learner = state
        else:
            assert state == self.learner, 'Later phases changed the learner/submission identity'
        deadline = time.monotonic() + 15
        while True:
            try:
                snapshot = learner_state(self.r, self.env, state)
                self.phases[phase] = 'passed'
                self.checks.append(dict(check='durable-state', phase=phase, status='passed', cause='none'))
                return snapshot
            except AssertionError:
                if time.monotonic() >= deadline:
                    raise
                time.sleep(.3)


def run(mode, args):
    if mode == 'run':
        with zipfile.ZipFile(ROOT / 'target/gakusei.jar') as jar:
            names = jar.namelist()
            assert any(n.startswith('BOOT-INF/classes/static/js/') for n in names), 'Production jar required'
    lifecycle = Run()
    code = 0
    def interrupted(sig, frame):
        raise SystemExit(128 + sig)
    signal.signal(signal.SIGTERM, interrupted)
    signal.signal(signal.SIGINT, interrupted)
    try:
        lifecycle.up()
        if mode == 'backend':
            # System properties override test annotations and inherited settings.
            options = ['-Dspring.profiles.active=local-postgres,local-seed',
                       '-Dspring.config.location=classpath:/application.yml',
                       '-Dspring.datasource.url=' + lifecycle.env['SPRING_DATASOURCE_URL'],
                       '-Dspring.datasource.username=gakusei_browser',
                       '-Dgakusei.data-init=false', '-Dgakusei.local-seed=true',
                       '-Dserver.address=127.0.0.1', '-Dserver.port=0',
                       '-Dlogging.file.name=' + str(lifecycle.directory / 'backend-private.log')]
            # Only Maven goals and non-Spring build options may be supplied.
            assert all(a in ('test', 'verify', '-Dskip.frontend=true') for a in args), 'Only full backend test goals and skip.frontend are allowed'
            lifecycle.check_id = 'backend-tests'
            lifecycle.phase_id = 'backend'
            command(['./mvnw'] + (args or ['-Dskip.frontend=true', 'test']) + options,
                    lifecycle.env, timeout=600)
        else:
            runner = args or ['npx', '--no-install', 'playwright', 'test']
            lifecycle.start()
            lifecycle.check_id = 'fresh-state'
            fresh = content(lifecycle.r, lifecycle.env)
            assert fresh['migrations'] > 0 and fresh['seed'] == 0
            assert fresh['users'] == fresh['nuggets'] == fresh['lessons'] == 0
            atomic(lifecycle.directory / 'fresh.json', fresh)
            lifecycle.stop()
            lifecycle.start(seed=True)
            lifecycle.check_id = 'seed-fixture'
            assert fixture(lifecycle.r, lifecycle.env)['nuggets']
            lifecycle.stop()
            lifecycle.start()
            before = lifecycle.phase('journey', runner)
            seeded = content(lifecycle.r, lifecycle.env)
            atomic(lifecycle.directory / 'journey-snapshot.json', before)
            lifecycle.stop()
            command(compose(lifecycle.r) + ['restart', 'postgres'], lifecycle.env)
            command(compose(lifecycle.r) + ['up', '-d', '--wait', '--wait-timeout', '75'], lifecycle.env)
            lifecycle.start()
            restarted = lifecycle.phase('after-restart', runner)
            lifecycle.check_id = 'restart-state'
            assert restarted == before
            assert content(lifecycle.r, lifecycle.env) == seeded
            lifecycle.stop()
            lifecycle.start(seed=True)
            lifecycle.stop()
            lifecycle.start()
            reseeded = lifecycle.phase('after-reseed', runner)
            lifecycle.check_id = 'reseed-state'
            assert reseeded == before
            assert content(lifecycle.r, lifecycle.env) == seeded
            atomic(lifecycle.directory / 'proof.json', dict(fresh=fresh, seeded=seeded, phases=3))
            print('PASS fresh migration, explicit seed, same-learner restart/reseed and phase state', flush=True)
    except SystemExit as exc:
        code = int(exc.code)
        lifecycle.checks.append(dict(check=lifecycle.check_id, phase=lifecycle.phase_id,
                                     status='interrupted', cause='handled-termination'))
        if lifecycle.phase_id in ('journey', 'after-restart', 'after-reseed'):
            lifecycle.phases[lifecycle.phase_id] = 'interrupted'
    except Exception as exc:
        cause = 'check-failed'
        if isinstance(exc, AssertionError):
            cause = 'sql-state-mismatch' if lifecycle.check_id in ('durable-state', 'fresh-state', 'restart-state', 'reseed-state') else 'assertion-failed'
        elif isinstance(exc, subprocess.TimeoutExpired):
            cause = 'timeout'
        elif isinstance(exc, subprocess.CalledProcessError):
            cause = 'command-failed'
        if lifecycle.check_id in ('application-readiness', 'database-readiness'):
            cause = 'readiness-failed'
        frames = traceback.extract_tb(exc.__traceback__)
        source = next((f for f in reversed(frames) if f.filename == __file__), None)
        lifecycle.checks.append(dict(check=lifecycle.check_id, phase=lifecycle.phase_id, status='failed',
                                     cause=cause, location=dict(file='scripts/verify-browser-state.py', line=source.lineno) if source else None))
        if lifecycle.phase_id in ('journey', 'after-restart', 'after-reseed'):
            lifecycle.phases[lifecycle.phase_id] = 'failed'
        # Do not print command/environment exceptions containing credentials.
        (lifecycle.directory / 'error-private.txt').write_text(traceback.format_exc())
        print('FAIL ' + type(exc).__name__ + '; private evidence: ' + str(lifecycle.directory), file=sys.stderr)
        code = 1
    finally:
        try:
            lifecycle.stop()
            cleanup(lifecycle.record)
            lifecycle.checks.append(dict(check='owned-cleanup', phase='cleanup', status='passed', cause='none'))
        except Exception as exc:
            lifecycle.checks.append(dict(check='owned-cleanup', phase='cleanup', status='failed', cause='cleanup-failed'))
            print('FAIL cleanup: ' + type(exc).__name__, file=sys.stderr)
            code = code or 1
        atomic(lifecycle.directory / 'result.json', {'exit_code': code, 'project': lifecycle.r['project'], 'checks': lifecycle.checks, 'phases': lifecycle.phases})
    return code


if __name__ == '__main__':
    try:
        mode, *args = sys.argv[1:]
        if mode == 'cleanup':
            cleanup(args[0])
            sys.exit(0)
        if mode == 'validate-manifest':
            path = Path(args[0]).resolve()
            assert path.stat().st_mode & 0o077 == 0
            m = json.loads(path.read_text())
            r = load_record(path.parent / 'ownership.json')
            assert path == ROOT / '.tools/browser-tests' / r['run_id'] / 'manifest.json'
            assert m['nonce'] == r['nonce'] and m['origin'] == r['origin']
            assert m['phase'] in ('journey', 'after-restart', 'after-reseed')
            assert m['state_path'] == str(path.parent / 'learner.json')
            assert m['output_dir'] == str(path.parent / m['phase'])
            assert pid_identity(r['pid']) == r['pid_identity']
            inspect_service(r, os.environ.copy())
            print(json.dumps(m))
            sys.exit(0)
        if mode == 'snapshot':
            r = load_record(args[0])
            # Browser runner inherits owned datasource; credentials never enter JSON.
            print(json.dumps(learner_state(r, os.environ.copy(), json.loads(Path(args[1]).read_text()))))
            sys.exit(0)
        assert mode in ('run', 'backend')
        sys.exit(run(mode, args))
    except Exception as exc:
        print('FAIL ' + type(exc).__name__, file=sys.stderr)
        sys.exit(1)
