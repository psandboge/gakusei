#!/usr/bin/env python3
"""Real upgrade failure/TERM cleanup with a separate owned sentinel."""
import importlib.util
import json
import os
from pathlib import Path
import signal
import subprocess
import sys

ROOT = Path(__file__).resolve().parents[2]
spec = importlib.util.spec_from_file_location('upgrade', ROOT / 'scripts/verify-boot3-upgrade.py')
upgrade = importlib.util.module_from_spec(spec)
spec.loader.exec_module(upgrade)

if sys.argv[1] == 'child':
    case, baseline, candidate = sys.argv[2:]
    def interruption(sig, frame):
        raise SystemExit(128 + sig)
    signal.signal(signal.SIGTERM, interruption)
    original = upgrade.populate
    def injected(run):
        if case == 'term':
            os.kill(os.getpid(), signal.SIGTERM)
        raise RuntimeError('Injected owned upgrade failure')
    upgrade.populate = injected
    upgrade.fixture(Path(baseline), Path(candidate), False)
else:
    baseline, candidate = map(Path, sys.argv[1:])
    upgrade.jar_proof(baseline, '2.7.18')
    upgrade.jar_proof(candidate, '3.5.16')
    owned = upgrade.owned
    sentinel = owned.Run()
    try:
        sentinel.up()
        owned.sql(sentinel.r, sentinel.env, "CREATE TABLE lifecycle_sentinel(value text); INSERT INTO lifecycle_sentinel VALUES ('untouched'); SELECT '{}'::json;")
        identity = owned.inspect_service(sentinel.r, sentinel.env)
        for case in ('failure', 'term'):
            log = sentinel.directory / ('upgrade-' + case + '-private.log')
            env = dict(os.environ, SPRING_DATASOURCE_URL=sentinel.env['SPRING_DATASOURCE_URL'],
                       SPRING_DATASOURCE_PASSWORD='hostile', SPRING_PROFILES_ACTIVE='postgres',
                       LOCAL_DB_PORT=str(sentinel.r['db_port']), LOCAL_DB_PASSWORD='hostile',
                       COMPOSE_PROJECT_NAME=sentinel.r['project'], JAVA_TOOL_OPTIONS='-Dserver.port=1')
            with log.open('w') as out:
                result = subprocess.run([sys.executable, __file__, 'child', case, str(baseline), str(candidate)],
                                        cwd=ROOT, env=env, stdout=out, stderr=out, timeout=300)
            record = Path(next(line.split('=', 1)[1] for line in log.read_text().splitlines() if line.startswith('OWNERSHIP=')))
            r = owned.load_record(record)
            assert result.returncode == (143 if case == 'term' else 1)
            assert not owned.command(['docker','ps','-aq','--filter','label=com.docker.compose.project='+r['project']], capture_output=True).stdout.strip()
            assert subprocess.run(['docker','volume','inspect',r['volume']], capture_output=True).returncode != 0
            owned.cleanup(record)
            assert owned.inspect_service(sentinel.r, sentinel.env) == identity
            assert owned.sql(sentinel.r, sentinel.env, 'SELECT json_agg(value) FROM lifecycle_sentinel;') == ['untouched']
            assert owned.sql(sentinel.r, sentinel.env, "SELECT json_agg(tablename) FROM pg_tables WHERE schemaname='public';") == ['lifecycle_sentinel']
            print('PASS upgrade ' + case + ': exact cleanup and hostile-env sentinel preservation', flush=True)
    finally:
        owned.cleanup(sentinel.record)
