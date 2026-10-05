#!/usr/bin/env python3
"""Real-service lifecycle proof with an independent owned sentinel."""
import importlib.util
import json
import os
from pathlib import Path
import subprocess
import sys

root = Path(__file__).resolve().parents[2]
spec = importlib.util.spec_from_file_location('owned', root / 'scripts/verify-browser-state.py')
owned = importlib.util.module_from_spec(spec)
spec.loader.exec_module(owned)
os.umask(0o077)
sentinel = owned.Run()
results = []
try:
    sentinel.up()
    owned.sql(sentinel.r, sentinel.env, "CREATE TABLE public.lifecycle_sentinel(value text); INSERT INTO public.lifecycle_sentinel VALUES ('untouched'); SELECT '{}'::json;")
    identity = owned.inspect_service(sentinel.r, sentinel.env)
    for case in ('success', 'failure', 'term'):
        env = os.environ.copy()
        # All destinations belong to the sentinel, never to preview resources.
        env.update(SPRING_DATASOURCE_URL=sentinel.env['SPRING_DATASOURCE_URL'],
                   SPRING_DATASOURCE_PASSWORD='hostile', SPRING_PROFILES_ACTIVE='postgres',
                   SPRING_APPLICATION_JSON='{"server":{"port":1}}',
                   SPRING_CONFIG_LOCATION='/nonexistent/hostile',
                   JAVA_TOOL_OPTIONS='-Dserver.port=1', JDK_JAVA_OPTIONS='-Dspring.profiles.active=postgres',
                   _JAVA_OPTIONS='-Dgakusei.data-init=true',
                   LOCAL_DB_PORT=str(sentinel.r['db_port']), LOCAL_DB_PASSWORD='hostile',
                   LOCAL_DB_NAME='hostile', LOCAL_DB_USER='hostile',
                   COMPOSE_PROJECT_NAME=sentinel.r['project'])
        log = sentinel.directory / (case + '.log')
        with log.open('w') as out:
            result = subprocess.run(['bash', 'scripts/test-browser.sh', 'python3',
                                     'tests/lifecycle/runner.py', case], cwd=root, env=env,
                                     stdout=out, stderr=out, timeout=600)
        lines = log.read_text().splitlines()
        record = Path(next(x.split('=', 1)[1] for x in lines if x.startswith('OWNERSHIP=')))
        r = owned.load_record(record)
        assert result.returncode == (0 if case == 'success' else 143 if case == 'term' else 1), (case, result.returncode)
        # Exact project's containers and volume must be absent.
        assert not owned.command(['docker', 'ps', '-aq', '--filter',
            'label=com.docker.compose.project=' + r['project']], capture_output=True).stdout.strip()
        volume = subprocess.run(['docker', 'volume', 'inspect', r['volume']], capture_output=True)
        assert volume.returncode != 0
        for app_log in record.parent.glob('app-*.log'):
            assert 'Started GakuseiApplication' in app_log.read_text()
        # Successful run keeps the exact snapshot proof, failed phases do not.
        assert (record.parent / 'proof.json').exists() == (case == 'success')
        for _ in range(2):
            owned.cleanup(record)
        assert owned.inspect_service(sentinel.r, sentinel.env) == identity
        assert owned.sql(sentinel.r, sentinel.env, "SELECT json_agg(value) FROM public.lifecycle_sentinel;") == ['untouched']
        assert owned.sql(sentinel.r, sentinel.env, "SELECT json_agg(tablename) FROM pg_tables WHERE schemaname='public';") == ['lifecycle_sentinel']
        results.append(dict(case=case, exit_code=result.returncode, project=r['project'], cleanup=True, sentinel=True))
        print('PASS ' + case + ': owned cleanup and hostile-env sentinel preservation', flush=True)
    invalid = sentinel.directory / 'bad.json'
    owned.atomic(invalid, dict(sentinel.r, project='gakusei-local'))
    try:
        owned.cleanup(invalid)
        raise RuntimeError('Invalid record accepted')
    except AssertionError:
        pass
    print('PASS invalid ownership rejected before Docker/process access', flush=True)
    original = owned.command
    def denied(args, *a, **kw):
        if 'down' in args:
            raise subprocess.CalledProcessError(9, args)
        return original(args, *a, **kw)
    owned.command = denied
    try:
        try:
            owned.cleanup(sentinel.record)
            raise AssertionError('Cleanup error was suppressed')
        except RuntimeError:
            pass
    finally:
        owned.command = original
    assert owned.inspect_service(sentinel.r, sentinel.env) == identity
    print('PASS cleanup error reported without removing sentinel', flush=True)
finally:
    owned.cleanup(sentinel.record)
    owned.atomic(sentinel.directory / 'lifecycle-results.json', results)
print('EVIDENCE=' + str(sentinel.directory / 'lifecycle-results.json'))
