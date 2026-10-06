#!/usr/bin/env python3
"""Owned browser lifecycle and allowlisted SQL proof. See tests/lifecycle/README.md."""
import collections
from contextlib import contextmanager
import hashlib
import hmac
import json
import math
import os
from pathlib import Path
import re
import secrets
import signal
import socket
import stat
import subprocess
import sys
import time
import traceback
import urllib.request
import zipfile

if not __debug__:
    raise RuntimeError('Ownership checks require Python without optimization')

ROOT = Path(__file__).resolve().parent.parent
PROTECTED = {18082, 18083, 15432, 15433}


def safe_env():
    return {k: v for k, v in os.environ.items() if not k.startswith(
        ('SPRING_', 'LOCAL_DB_', 'LOCAL_REMEMBER_', 'GAKUSEI_', 'MAVEN_', 'COMPOSE_', 'SERVER_', 'LOGGING_', 'PYTHON'))
        and k not in ('JAVA_TOOL_OPTIONS', 'JDK_JAVA_OPTIONS', '_JAVA_OPTIONS')}


def remaining(deadline, limit=None):
    if deadline is None:
        return limit
    assert type(deadline) in (int, float) and math.isfinite(deadline), 'Invalid phase deadline'
    left = deadline - time.monotonic()
    if left <= 0:
        raise subprocess.TimeoutExpired(['browser-phase-budget'], 0)
    return left if limit is None else min(left, limit)


def command(args, env=None, timeout=90, deadline=None, **kwargs):
    data = kwargs.pop('input', None)
    if kwargs.pop('capture_output', False):
        kwargs.update(stdout=subprocess.PIPE, stderr=subprocess.PIPE)
    if data is not None:
        kwargs['stdin'] = subprocess.PIPE
    timeout = remaining(deadline, timeout)
    process = subprocess.Popen(args, cwd=ROOT, env=env if env is not None else safe_env(),
                               text=True, start_new_session=True, **kwargs)
    try:
        stdout, stderr = process.communicate(data, timeout=remaining(deadline, timeout))
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
    path = Path(path)
    r = private_browser_json(path, path)
    run = r['run_id']
    assert re.fullmatch('[a-f0-9]{24}', run), 'Invalid run identity'
    assert r['project'] == 'gakusei-browser-' + run
    assert r['volume'] == r['project'] + '_postgres-data'
    assert path == ROOT / '.tools/browser-tests' / run / 'ownership.json'
    assert r['root'] == str(ROOT)
    assert all(type(r[k]) is int and 1024 <= r[k] <= 65535 and r[k] not in PROTECTED
               for k in ('db_port', 'app_port'))
    assert r['db_port'] != r['app_port']
    assert r['origin'] == 'http://127.0.0.1:' + str(r['app_port'])
    return r


def compose(r):
    return ['docker', 'compose', '--env-file', os.devnull, '-p', r['project'], '-f', str(ROOT / 'compose.local.yml')]


def inspect_service(r, env, deadline=None):
    ids = command(compose(r) + ['ps', '-q', 'postgres'], env, deadline=deadline, capture_output=True).stdout.split()
    assert len(ids) == 1, 'Missing owned PostgreSQL'
    info = json.loads(command(['docker', 'inspect', ids[0]], env, deadline=deadline, capture_output=True).stdout)[0]
    labels = info['Config']['Labels']
    assert labels['com.docker.compose.project'] == r['project']
    assert labels['com.docker.compose.service'] == 'postgres'
    assert info['State']['Running'] and not info['State'].get('Paused', False)
    assert info['State']['Health']['Status'] == 'healthy'
    assert any(m.get('Name') == r['volume'] for m in info['Mounts'])
    ports = info['NetworkSettings']['Ports']['5432/tcp']
    assert ports == [{'HostIp': '127.0.0.1', 'HostPort': str(r['db_port'])}]
    return ids[0]


def sql(r, env, query, deadline=None):
    inspect_service(r, env, deadline=deadline)
    if deadline is not None:
        milliseconds = max(1, int(remaining(deadline) * 1000))
        query = f'SET statement_timeout={milliseconds}; SET lock_timeout={milliseconds};\n' + query
    result = command(compose(r) + ['exec', '-T', 'postgres', 'sh', '-c',
        'exec psql -X -qAt -v ON_ERROR_STOP=1 -U "$POSTGRES_USER" -d "$POSTGRES_DB"'],
        env, input=query, deadline=deadline, capture_output=True).stdout.strip()
    return json.loads(result)


def content(r, env):
    return sql(r, env, """SELECT json_build_object(
      'migrations', (SELECT count(*) FROM public.databasechangelog),
      'seed', (SELECT count(*) FROM public.local_sample_seed),
      'nuggets', (SELECT count(*) FROM contentschema.nuggets),
      'lessons', (SELECT count(*) FROM contentschema.lessons),
      'users', (SELECT count(*) FROM public.users));""")


def fixture(r, env, deadline=None):
    return sql(r, env, """SELECT json_build_object('lesson', 'genki 15', 'category', 2,
      'nuggets', (SELECT json_agg(x ORDER BY id) FROM
        (SELECT n.id, n.jp_read AS reading, n.swedish FROM contentschema.nuggets n
         JOIN contentschema.lessons_nuggets ln ON ln.nugget_id=n.id
         JOIN contentschema.lessons l ON l.id=ln.lesson_id
         WHERE l.name='genki 15' AND n.hidden=false) x));""", deadline=deadline)


def browser_language_fixture(record, env, phase, deadline=None):
    assert phase in ('journey', 'after-restart', 'after-reseed'), 'Invalid language fixture phase'
    remaining(deadline, 90)
    owned = load_record(ROOT / '.tools/browser-tests' / record['run_id'] / 'ownership.json')
    assert owned == record, 'Fixture ownership record changed'
    assert record.get('pid') and pid_identity(record['pid'], deadline=deadline) == record['pid_identity'], 'Fixture application identity unavailable'
    inspect_service(record, env, deadline=deadline)
    expected = [
        dict(language='Japanese', language_code='jp', flag_svg='/img/flags/japan-flag.svg', enabled=True),
        dict(language='Swedish', language_code='se', flag_svg='/img/flags/sweden-flag.svg', enabled=True),
    ]
    query = """SELECT coalesce(json_agg(x ORDER BY language_code),'[]') FROM
        (SELECT language,language_code,flag_svg,enabled FROM public.settings) x;"""
    if phase == 'journey':
        assert sql(record, env, query, deadline=deadline) == [], 'Unexpected existing browser language fixture'
        sql(record, env, """BEGIN;
          LOCK TABLE public.settings IN EXCLUSIVE MODE;
          DO $$ BEGIN
            IF EXISTS (SELECT 1 FROM public.settings) THEN
              RAISE EXCEPTION 'Unexpected existing browser language fixture';
            END IF;
            INSERT INTO public.settings(language,language_code,flag_svg,enabled) VALUES
              ('Swedish','se','/img/flags/sweden-flag.svg',true),
              ('Japanese','jp','/img/flags/japan-flag.svg',true);
          END $$;
          COMMIT;
          SELECT '{}'::json;""", deadline=deadline)
    observed = sql(record, env, query, deadline=deadline)
    assert observed == expected, 'Browser language fixture changed'
    return observed


def browser_packaged_flags(jar, record, deadline):
    remaining(deadline)
    assert jar.is_file() and not jar.is_symlink()
    assert hashlib.sha256(jar.read_bytes()).hexdigest() == record['jar_hashes'][str(jar)]
    flags = dict(jp='/img/flags/japan-flag.svg', se='/img/flags/sweden-flag.svg', selector='/img/flags/flags.svg')
    with zipfile.ZipFile(jar) as archive:
        result = {code: dict(path=path, sha256=hashlib.sha256(archive.read('BOOT-INF/classes/static' + path)).hexdigest())
                  for code, path in flags.items()}
    remaining(deadline)
    return result


def private_stamp(info):
    return (info.st_dev, info.st_ino, info.st_uid, info.st_gid, info.st_mode,
            info.st_nlink, info.st_size, info.st_mtime_ns, info.st_ctime_ns)


def private_file_info(info):
    assert stat.S_ISREG(info.st_mode), 'Private proof must be a regular file'
    assert info.st_uid == os.geteuid(), 'Private proof owner changed'
    assert stat.S_IMODE(info.st_mode) == 0o600, 'Private proof mode must be exactly 0600'
    assert info.st_nlink == 1, 'Private proof must not have hard links'


@contextmanager
def private_browser_parent(path, expected, deadline=None, root=None):
    # ROOT is the trusted canonical checkout anchor; no caller path is resolved
    # through links. Every opened descendant directory is checked on its FD.
    root = ROOT if root is None else Path(root)
    path, expected = Path(path), Path(expected)
    assert root.is_absolute() and path.is_absolute() and path == expected
    assert '..' not in path.parts and '..' not in root.parts
    assert path.is_relative_to(root), 'Foreign private proof path'
    relative = path.relative_to(root)
    assert len(relative.parts) >= 4 and relative.parts[:2] == ('.tools', 'browser-tests')
    assert re.fullmatch('[a-f0-9]{24}', relative.parts[2]), 'Invalid private run path'
    if len(relative.parts) > 4:
        assert len(relative.parts) == 5 and relative.parts[3] in ('journey', 'after-restart', 'after-reseed')
    descriptors, links = [], []
    def budget():
        if deadline is not None:
            remaining(deadline)
    def check_directory(fd, private):
        info = os.fstat(fd)
        assert stat.S_ISDIR(info.st_mode) and info.st_uid == os.geteuid(), 'Owned directory required'
        mode = stat.S_IMODE(info.st_mode)
        assert mode == 0o700 if private else not mode & 0o022, 'Unsafe owned directory mode'
        return info
    def check_chain():
        current = os.stat(root, follow_symlinks=False)
        assert (current.st_dev, current.st_ino) == (anchor.st_dev, anchor.st_ino), 'Checkout anchor replaced'
        check_directory(descriptors[0], False)
        for parent, name, fd, private, identity in links:
            info = check_directory(fd, private)
            named = os.stat(name, dir_fd=parent, follow_symlinks=False)
            assert (named.st_dev, named.st_ino, named.st_mode, named.st_uid) == (info.st_dev, info.st_ino, info.st_mode, info.st_uid), 'Owned directory path replaced'
            assert (info.st_dev, info.st_ino) == identity, 'Owned directory identity changed'
        budget()
    try:
        budget()
        fd = os.open(root, os.O_RDONLY | os.O_DIRECTORY | os.O_NOFOLLOW | os.O_CLOEXEC)
        descriptors.append(fd)
        anchor = check_directory(fd, False)
        for index, name in enumerate(relative.parts[:-1]):
            budget()
            child = os.open(name, os.O_RDONLY | os.O_DIRECTORY | os.O_NOFOLLOW | os.O_CLOEXEC, dir_fd=fd)
            descriptors.append(child)
            private = index >= 2
            info = check_directory(child, private)
            links.append((fd, name, child, private, (info.st_dev, info.st_ino)))
            fd = child
        check_chain()
        yield fd, relative.name, check_chain
        check_chain()
    finally:
        for fd in reversed(descriptors):
            os.close(fd)


def private_browser_read(path, expected, deadline=None, root=None):
    with private_browser_parent(path, expected, deadline, root) as (parent, name, check_chain):
        # NONBLOCK lets fstat reject FIFOs/devices without waiting for a writer.
        fd = os.open(name, os.O_RDONLY | os.O_NOFOLLOW | os.O_NONBLOCK | os.O_CLOEXEC, dir_fd=parent)
        try:
            initial = os.fstat(fd)
            private_file_info(initial)
            parts = []
            while True:
                if deadline is not None:
                    remaining(deadline)
                chunk = os.read(fd, 65536)
                if not chunk:
                    break
                parts.append(chunk)
            current = os.fstat(fd)
            private_file_info(current)
            assert private_stamp(current) == private_stamp(initial), 'Private proof changed while reading'
            named = os.stat(name, dir_fd=parent, follow_symlinks=False)
            assert private_stamp(named) == private_stamp(current), 'Private proof path replaced while reading'
            check_chain()
            return b''.join(parts), dict(device=current.st_dev, inode=current.st_ino)
        finally:
            os.close(fd)


def private_browser_create(path, data, deadline):
    content = (json.dumps(data, sort_keys=True) + '\n').encode('utf-8')
    with private_browser_parent(path, path, deadline) as (parent, name, check_chain):
        remaining(deadline)
        fd = os.open(name, os.O_WRONLY | os.O_CREAT | os.O_EXCL | os.O_NOFOLLOW | os.O_CLOEXEC, 0o600, dir_fd=parent)
        try:
            private_file_info(os.fstat(fd))
            offset = 0
            while offset < len(content):
                remaining(deadline)
                written = os.write(fd, content[offset:])
                assert written > 0
                offset += written
            os.fsync(fd)
            current = os.fstat(fd)
            private_file_info(current)
            assert private_stamp(os.stat(name, dir_fd=parent, follow_symlinks=False)) == private_stamp(current), 'Created key path replaced'
            check_chain()
        finally:
            os.close(fd)


def private_browser_json(path, expected, deadline=None, root=None):
    content, _ = private_browser_read(path, expected, deadline, root)
    return json.loads(content)


def browser_proof_context(record_path, env, deadline=None):
    record = load_record(record_path)
    directory = ROOT / '.tools/browser-tests' / record['run_id']
    manifest = private_browser_json(directory / 'manifest.json', directory / 'manifest.json', deadline)
    assert manifest['nonce'] == record['nonce'] and manifest['origin'] == record['origin']
    assert manifest['phase'] in ('journey', 'after-restart', 'after-reseed')
    assert manifest['state_path'] == str(directory / 'learner.json')
    assert manifest['output_dir'] == str(directory / manifest['phase'])
    # Only the parent failure-finally supplies a separate bounded proof deadline.
    # Browser CLI operations always use the unchanged original phase deadline.
    deadline = manifest['phase_deadline'] if deadline is None else deadline
    remaining(deadline)
    assert pid_identity(record['pid'], deadline=deadline) == record['pid_identity'], 'Browser proof PID changed'
    inspect_service(record, env, deadline=deadline)
    return record, directory, manifest['phase'], deadline


def full_browser_account(record, env, username, deadline=None):
    assert re.fullmatch('[A-Za-z0-9]{2,32}', username), 'Invalid browser account identity'
    return sql(record, env, f"""SELECT json_build_object(
      'account', (SELECT row_to_json(u) FROM public.users u WHERE username='{username}'),
      'events', (SELECT coalesce(json_agg(e ORDER BY id),'[]') FROM public.events e WHERE user_ref='{username}'),
      'answer_events', (SELECT coalesce(json_agg(e ORDER BY id),'[]') FROM public.events e
        WHERE user_ref='{username}' AND lesson='genki 15' AND nugget_type_ref=2 AND type='answeredCorrectly'),
      'progress', (SELECT coalesce(json_agg(p ORDER BY nugget_id,nugget_type_ref),'[]')
        FROM public.progresstrackinglist p WHERE user_ref='{username}'));""", deadline=deadline)


def account_membership_material(record, deadline, create=False):
    directory = ROOT / '.tools/browser-tests' / record['run_id']
    assert load_record(directory / 'ownership.json') == record
    path = directory / 'account-membership-key-private.json'
    if create:
        data = dict(schema='gakusei.browser-membership-key.v1', run_id=record['run_id'],
                    nonce=record['nonce'], origin=record['origin'], password=secrets.token_hex(32))
        private_browser_create(path, data, deadline)
    remaining(deadline)
    content, identity = private_browser_read(path, path, deadline)
    # JSON decoding and its pinned digest use exactly the same validated bytes.
    data = json.loads(content)
    digest = hashlib.sha256(content).hexdigest()
    assert data['schema'] == 'gakusei.browser-membership-key.v1'
    assert data['run_id'] == record['run_id'] and data['nonce'] == record['nonce']
    assert data['origin'] == record['origin']
    assert type(data['password']) is str and re.fullmatch('[a-f0-9]{64}', data['password'])
    baseline_path = directory / 'original-account-private.json'
    if os.path.lexists(baseline_path):
        baseline = private_browser_json(baseline_path, baseline_path, deadline)
        assert digest == baseline['membership_key_sha256'], 'Membership key changed'
        assert identity == baseline['membership_key_identity'], 'Membership key file replaced'
    remaining(deadline)
    return bytes.fromhex(data['password']), digest, identity


def account_membership_key(record, deadline, create=False):
    return account_membership_material(record, deadline, create)[0]


def account_membership_digest(record, deadline):
    return account_membership_material(record, deadline)[1]


def account_membership_mac(key, username):
    assert type(username) is str
    encoded = username.encode('utf-8')  # Entire exact value; no case/Unicode normalization.
    message = b'gakusei.browser-membership.v1\x00' + len(encoded).to_bytes(8, 'big') + encoded
    return hmac.new(key, message, hashlib.sha256).hexdigest()


def browser_account_inventory(record, env, deadline, create_key=False):
    key = account_membership_key(record, deadline, create=create_key)
    # Raw complete usernames exist only in this native SQL response in memory.
    # Persist only the keyed whole-set representation, never renamed raw fields.
    users = sql(record, env, """SELECT coalesce(json_agg(x ORDER BY username COLLATE "C"),'[]')
        FROM (SELECT username FROM public.users) x;""", deadline=deadline)
    members = sorted(account_membership_mac(key, row['username']) for row in users)
    assert len(members) == len(set(members)), 'Duplicate or colliding membership identity'
    remaining(deadline)
    return members


def specialized_isolation(record_path, env, deadline=None, require_registered=False):
    record, directory, phase, deadline = browser_proof_context(record_path, env, deadline)
    baseline = private_browser_json(directory / 'original-account-private.json', directory / 'original-account-private.json', deadline)
    assert account_membership_digest(record, deadline) == baseline['membership_key_sha256'], 'Membership key changed'
    members = browser_account_inventory(record, env, deadline)
    selected_path = directory / 'specialized-learner-private.json'
    full = None
    if not selected_path.exists():
        assert not require_registered and phase == 'journey'
        assert members == baseline['pre_registration_membership'], 'Account inventory changed before registration'
        registered = False
    else:
        selected = private_browser_json(selected_path, selected_path, deadline)
        original = private_browser_json(directory / 'learner.json', directory / 'learner.json', deadline)
        assert selected['run_id'] == record['run_id'] and selected['nonce'] == record['nonce']
        assert selected['origin'] == record['origin']
        assert re.fullmatch('[A-Za-z0-9]{2,32}', selected['username']) and selected['username'] != original['username']
        assert type(selected['password']) is str and 2 <= len(selected['password']) <= 100
        extra = account_membership_mac(account_membership_key(record, deadline), selected['username'])
        assert extra not in baseline['pre_registration_membership'], 'Selected account was preexisting'
        expected = sorted(baseline['pre_registration_membership'] + [extra])
        full = full_browser_account(record, env, selected['username'], deadline)
        registered = full['account'] is not None
        if require_registered or phase != 'journey' or (directory / 'specialized-language-private.json').exists():
            assert registered, 'Registered specialized account disappeared'
        assert members == (expected if registered else baseline['pre_registration_membership']), 'Unexpected account membership or extra account'
        if registered:
            assert full['progress'] == [], 'Specialized progress write prohibited'
            assert full['answer_events'] == [], 'Specialized answer write prohibited'
            assert all(e['type'] in ('login', 'logout') for e in full['events']), 'Specialized non-auth event write prohibited'
            assert full['account']['site_language'] in (None, 'jp', 'se'), 'Unexpected specialized language'
            proof_path = directory / 'specialized-language-private.json'
            if proof_path.exists():
                proof = private_browser_json(proof_path, proof_path, deadline)
                # The retained select route marks this selected learner no longer new.
                # It does not affect the original learner or language-step equality.
                assert type(full['account']['new_user']) is bool
                assert proof['last_account']['new_user'] is True or full['account']['new_user'] is False
                expected_account = dict(proof['last_account'], site_language=full['account']['site_language'], new_user=full['account']['new_user'])
                assert full['account'] == expected_account, 'Other specialized non-language fields changed'
    path = directory / 'specialized-isolation-private.json'
    history = private_browser_json(path, path, deadline) if path.exists() else dict(run_id=record['run_id'], nonce=record['nonce'], observations=[])
    assert history['run_id'] == record['run_id'] and history['nonce'] == record['nonce']
    if any(item['registered'] for item in history['observations']):
        assert registered, 'Previously registered specialized account disappeared'
    history['observations'].append(dict(phase=phase, registered=registered, membership=members, full=full))
    atomic(path, history)
    return dict(passed=True, registered=registered)


def original_account_proof(record_path, env, operation, deadline=None):
    assert operation in ('capture', 'verify'), 'Invalid original account operation'
    record, directory, phase, deadline = browser_proof_context(record_path, env, deadline)
    state_path = directory / 'learner.json'
    state_bytes, _ = private_browser_read(state_path, state_path, deadline)
    state = json.loads(state_bytes)
    snapshot = learner_state(record, env, state, deadline=deadline)
    assert snapshot == state['snapshot'], 'Original inherited snapshot changed'
    full = full_browser_account(record, env, state['username'], deadline=deadline)
    assert full['account'] is not None, 'Original account missing'
    baseline_path = directory / 'original-account-private.json'
    state_digest = hashlib.sha256(state_bytes).hexdigest()
    if baseline_path.exists():
        baseline = private_browser_json(baseline_path, baseline_path, deadline)
        assert baseline['run_id'] == record['run_id'] and baseline['nonce'] == record['nonce']
        assert baseline['username'] == state['username'] and baseline['learner_sha256'] == state_digest
        assert account_membership_digest(record, deadline) == baseline['membership_key_sha256'], 'Membership key changed'
        assert baseline['account'] == full['account'], 'Original full account row changed'
        assert baseline['answer_events'] == full['answer_events'], 'Original answer rows changed'
        assert baseline['progress'] == full['progress'], 'Original full progress rows changed'
    else:
        assert phase == 'journey' and operation == 'capture', 'Original proof baseline absent'
        assert full['account']['site_language'] is None, 'Original initial language must explicitly be null'
        members = browser_account_inventory(record, env, deadline, create_key=True)
        _, key_digest, key_identity = account_membership_material(record, deadline)
        atomic(baseline_path, dict(run_id=record['run_id'], nonce=record['nonce'], username=state['username'],
                                  learner_sha256=state_digest, account=full['account'], answer_events=full['answer_events'],
                                  progress=full['progress'], pre_registration_membership=members, membership_key_sha256=key_digest,
                                  membership_key_identity=key_identity))
    before = directory / phase / 'original-before-specialized-private.json'
    if operation == 'capture':
        specialized_isolation(record_path, env, deadline)
        assert not before.exists(), 'Original phase proof already captured'
        atomic(before, dict(run_id=record['run_id'], nonce=record['nonce'], full=full, snapshot=snapshot))
    else:
        previous = private_browser_json(before, before, deadline)
        assert previous['run_id'] == record['run_id'] and previous['nonce'] == record['nonce']
        assert previous['full'] == full, 'Specialized flow changed original account/events/progress'
        assert previous['snapshot'] == snapshot, 'Specialized flow changed original inherited snapshot'
        atomic(directory / phase / 'original-after-specialized-private.json',
               dict(run_id=record['run_id'], nonce=record['nonce'], full=full, snapshot=snapshot))
    return dict(passed=True)


def specialized_account_proof(record_path, env, operation, code=None, deadline=None):
    assert operation in ('registered', 'authenticated', 'language', 'finish', 'isolation'), 'Invalid specialized operation'
    assert (operation == 'language' and code in ('jp', 'se')) or (operation != 'language' and code is None)
    if operation == 'isolation':
        return specialized_isolation(record_path, env, deadline)
    record, directory, phase, deadline = browser_proof_context(record_path, env, deadline)
    specialized_isolation(record_path, env, deadline, require_registered=True)
    specialized = private_browser_json(directory / 'specialized-learner-private.json', directory / 'specialized-learner-private.json', deadline)
    full = full_browser_account(record, env, specialized['username'], deadline)
    proof_path = directory / 'specialized-language-private.json'
    if operation == 'registered':
        assert phase == 'journey' and not proof_path.exists()
        assert full['account']['site_language'] is None, 'Specialized initial language must be observed null'
        proof = dict(run_id=record['run_id'], nonce=record['nonce'], username=specialized['username'],
                     initial_account=full['account'], last_account=full['account'], phases={})
    else:
        proof = private_browser_json(proof_path, proof_path, deadline)
        assert proof['run_id'] == record['run_id'] and proof['nonce'] == record['nonce']
        assert proof['username'] == specialized['username']
        assert full['account']['password'] == proof['initial_account']['password'], 'Specialized credential hash changed'
        assert full['account']['userrole'] == proof['initial_account']['userrole'], 'Specialized role changed'
    if operation == 'authenticated':
        assert phase != 'journey' and full['account'] == proof['last_account'], 'Specialized account changed across restart/reseed'
    item = proof['phases'].setdefault(phase, dict(transitions=[]))
    if operation in ('registered', 'authenticated'):
        assert 'initial' not in item
        item['initial'] = full
    elif operation == 'language':
        expected_code = ('jp', 'se')[len(item['transitions'])] if len(item['transitions']) < 2 else None
        assert code == expected_code, 'Unexpected specialized language sequence'
        assert full['account']['site_language'] == code, 'Specialized SQL language differs from UI POST'
        assert full['account'] == dict(proof['last_account'], site_language=code), 'Language selection changed other specialized account fields'
        item['transitions'].append(dict(code=code, full=full))
    else:
        assert [t['code'] for t in item['transitions']] == ['jp', 'se']
        assert full['account']['site_language'] == 'se'
        assert full['account']['new_user'] is False, 'Selection route did not retain new-user transition'
        assert full['progress'] == [] and full['answer_events'] == []
        assert all(e['type'] in ('login', 'logout') for e in full['events'])
        item['final'] = full
    proof['last_account'] = full['account']
    atomic(proof_path, proof)
    return dict(passed=True, code=code)


def learner_state(r, env, state, deadline=None):
    assert state['run_id'] == r['run_id'] and state['nonce'] == r['nonce']
    assert state['origin'] == r['origin'] and state['lesson'] == 'genki 15'
    assert state['category'] == 2
    user = state['username']
    assert re.fullmatch('[A-Za-z0-9]{2,32}', user)
    submissions = state['submissions']
    assert submissions and all(type(s['correct']) is bool for s in submissions)
    allowed = {n['id'] for n in fixture(r, env, deadline=deadline)['nuggets']}
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
           JOIN contentschema.lessons l ON l.id=ln.lesson_id WHERE l.name='genki 15')) x));""", deadline=deadline)
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


def pid_identity(pid, deadline=None):
    return command(['ps', '-p', str(pid), '-o', 'lstart=', '-o', 'command='],
                   deadline=deadline, capture_output=True).stdout.strip()


def cleanup(path, deadline=None):
    deadline = time.monotonic() + 60 if deadline is None else deadline
    remaining(deadline)
    r = load_record(path)
    errors = []
    pid = r.get('pid')
    if pid:
        try:
            identity = pid_identity(pid, deadline=deadline)
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
                    status = command(['ps', '-p', str(pid), '-o', 'stat='], deadline=deadline, capture_output=True).stdout
                except subprocess.CalledProcessError:
                    break
                if status.strip().startswith('Z'):
                    break
                time.sleep(remaining(deadline, .1))
            else:
                assert pid_identity(pid, deadline=deadline) == r['pid_identity'], 'PID identity changed during cleanup'
                os.kill(pid, signal.SIGKILL)
    env = safe_env()
    env['LOCAL_DB_PASSWORD'] = 'unused-cleanup-placeholder'
    env['LOCAL_DB_PORT'] = str(r['db_port'])
    try:
        ids = command(['docker', 'ps', '-aq', '--filter',
                      'label=com.docker.compose.project=' + r['project']], env, deadline=deadline, capture_output=True).stdout.split()
        for cid in ids:
            info = json.loads(command(['docker', 'inspect', cid], env, deadline=deadline, capture_output=True).stdout)[0]
            assert info['Config']['Labels']['com.docker.compose.project'] == r['project']
        with open(Path(path).parent / 'cleanup.log', 'a') as log:
            command(compose(r) + ['down', '-v', '--remove-orphans', '--timeout', '10'], env,
                    stdout=log, stderr=log, timeout=45, deadline=deadline)
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

    def start(self, seed=False, jar_path=None, profiles="local-postgres", java_executable=None):
        assert profiles in ("local-postgres", "upgrade-seed-refusal"), "Only owned fixture profiles allowed"
        # Optional immutable production jar for cross-version upgrade proof. The
        # default and ownership-record validation remain unchanged.
        jar = ROOT / 'target/gakusei.jar' if jar_path is None else Path(jar_path)
        assert jar.is_absolute() and jar.is_file() and not jar.is_symlink(), 'Absolute immutable jar required'
        self.jar = jar
        digest = hashlib.sha256(jar.read_bytes()).hexdigest()
        hashes = self.r.setdefault('jar_hashes', {})
        assert hashes.get(str(jar), digest) == digest, 'Jar changed across restart'
        hashes[str(jar)] = digest
        with zipfile.ZipFile(jar) as archive:
            assert any(n.startswith('BOOT-INF/classes/static/js/') and n.endswith('.js')
                       for n in archive.namelist()), 'Production jar required'
        atomic(self.record, self.r)
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
        if java_executable is not None:
            launcher = Path(java_executable)
            assert launcher.is_absolute() and launcher.resolve() == launcher and launcher.is_file()
            env.update(JAVA_HOME=str(launcher.parent.parent), PATH=str(launcher.parent)+os.pathsep+env.get('PATH',''))
        self.process = subprocess.Popen([str(java_executable) if java_executable is not None else 'java', '-jar', str(jar),
            '--spring.config.location=classpath:/application.yml',
            '--spring.profiles.active=' + profiles, '--server.address=127.0.0.1',
            '--server.port=' + str(self.r['app_port']), '--gakusei.data-init=false',
            '--logging.file.name=' + str(self.directory / 'spring-private.log'),
            '--gakusei.local-seed=' + str(seed).lower()], cwd=ROOT, env=env, stdout=log, stderr=log)
        log.close()
        self.app_started = True
        self.r['pid'] = self.process.pid
        self.r['pid_identity'] = pid_identity(self.process.pid)
        atomic(self.record, self.r)
        deadline = time.monotonic() + 100
        observer = getattr(self, 'runtime_observer', None)
        if observer is not None:
            observer(self, deadline)
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

    def stop(self, deadline=None):
        if self.process:
            self.process.terminate()
            try:
                self.process.wait(timeout=remaining(deadline, 15))
            except subprocess.TimeoutExpired:
                self.process.kill()
                self.process.wait(timeout=remaining(deadline, 5))
            self.process = None
            self.r.pop('pid', None)
            self.r.pop('pid_identity', None)
            atomic(self.record, self.r)

    def phase(self, phase, runner, deadline=None):
        # An optional earlier cap is for native boundary proof; it cannot extend300s.
        start = time.monotonic()
        assert phase in ('journey', 'after-restart', 'after-reseed')
        if deadline is not None:
            assert type(deadline) in (int, float) and math.isfinite(deadline), 'Invalid earlier deadline cap'
        deadline = min(start + 300, deadline) if deadline is not None else start + 300
        self.phase_id = phase
        self.check_id = 'browser-tests'
        self.phases[phase] = 'unavailable'
        output = self.directory / phase
        process = None
        completed = False
        try:
            remaining(deadline)
            inspect_service(self.r, self.env, deadline=deadline)
            assert self.process and self.process.poll() is None
            output.mkdir(mode=0o700)
            manifest = dict(self.r, phase=phase, fixture=fixture(self.r, self.env, deadline=deadline),
                            state_path=str(self.directory / 'learner.json'), output_dir=str(output),
                            phase_deadline=deadline, phase_deadline_epoch_ms=(time.time() + remaining(deadline)) * 1000,
                            packaged_flags=browser_packaged_flags(self.jar, self.r, deadline))
            remaining(deadline)
            atomic(self.directory / 'manifest.json', manifest)
            env = dict(self.env, GAKUSEI_BROWSER_PHASE=phase,
                       GAKUSEI_BROWSER_MANIFEST=str(self.directory / 'manifest.json'),
                       GAKUSEI_BROWSER_OUTPUT_DIR=str(output))
            self.check_id = 'browser-language-fixture'
            if phase == 'journey':
                command(['node', 'tests/browser/empty-language.js'], env, timeout=45, deadline=deadline)
            languages = browser_language_fixture(load_record(self.record), self.env, phase, deadline=deadline)
            remaining(deadline)
            atomic(output / 'language-fixture-private.json', dict(run_id=self.r['run_id'], nonce=self.r['nonce'], languages=languages))
            self.checks.append(dict(check='browser-language-fixture', phase=phase, status='passed', cause='none'))
            self.check_id = 'browser-tests'
            remaining(deadline)  # Fail before Popen, never grant a new minimal wait.
            process = subprocess.Popen(runner, cwd=ROOT, env=env, start_new_session=True)
            exit_code = process.wait(timeout=remaining(deadline))
            if exit_code:
                raise subprocess.CalledProcessError(exit_code, runner)
            if (output / 'original-before-specialized-private.json').exists():
                original_account_proof(self.record, self.env, 'verify', deadline=deadline)
                specialized_account_proof(self.record, self.env, 'finish', deadline=deadline)
                self.checks.append(dict(check='original-account', phase=phase, status='passed', cause='none'))
                self.checks.append(dict(check='specialized-language', phase=phase, status='passed', cause='none'))
                self.checks.append(dict(check='specialized-isolation', phase=phase, status='passed', cause='none'))
            else:
                assert runner != ['npx', '--no-install', 'playwright', 'test'], 'Default browser runner omitted specialized proof'
                self.checks.append(dict(check='original-account', phase=phase, status='unavailable', cause='unavailable'))
                self.checks.append(dict(check='specialized-language', phase=phase, status='unavailable', cause='unavailable'))
                self.checks.append(dict(check='specialized-isolation', phase=phase, status='unavailable', cause='unavailable'))
            self.checks.append(dict(check='browser-tests', phase=phase, status='passed', cause='none'))
            self.check_id = 'durable-state'
            state_path = self.directory / 'learner.json'
            assert state_path.stat().st_mode & 0o077 == 0, 'Learner state must be private'
            state = json.loads(state_path.read_text())
            if phase == 'journey':
                self.learner = state
            else:
                assert state == self.learner, 'Later phases changed the learner/submission identity'
            durable_deadline = min(deadline, time.monotonic() + 15)
            while True:
                try:
                    snapshot = learner_state(self.r, self.env, state, deadline=durable_deadline)
                    remaining(deadline)
                    self.phases[phase] = 'passed'
                    self.checks.append(dict(check='durable-state', phase=phase, status='passed', cause='none'))
                    completed = True
                    return snapshot
                except AssertionError:
                    time.sleep(remaining(durable_deadline, .3))
        finally:
            primary = sys.exc_info()[1]
            failures = []
            proof_checks = []
            # These are separately bounded mandatory failure actions; the original
            # browser deadline and manifest are never changed or restarted.
            child_stop_deadline = time.monotonic() + 15
            try:
                if process is not None and process.poll() is None:
                    os.killpg(process.pid, signal.SIGTERM)
                    try:
                        process.wait(timeout=remaining(child_stop_deadline, 10))
                    except subprocess.TimeoutExpired:
                        os.killpg(process.pid, signal.SIGKILL)
                        process.wait(timeout=remaining(child_stop_deadline, 5))
            except Exception as exc:
                failures.append(exc)
                proof_checks.append(dict(check='owned-cleanup', phase=phase, status='failed', cause='cleanup-failed'))
            if not completed:
                post_proof_deadline = time.monotonic() + 45
                operations = []
                if (output / 'original-before-specialized-private.json').exists():
                    operations.append(('original-account', lambda: original_account_proof(self.record, self.env, 'verify', deadline=post_proof_deadline)))
                if (self.directory / 'original-account-private.json').exists():
                    operations.append(('specialized-isolation', lambda: specialized_isolation(self.record, self.env, deadline=post_proof_deadline)))
                for check, operation in operations:
                    try:
                        operation()
                        proof_checks.append(dict(check=check, phase=phase, status='passed', cause='none'))
                    except Exception as exc:
                        failures.append(exc)
                        cause = 'timeout' if isinstance(exc, subprocess.TimeoutExpired) else 'assertion-failed' if isinstance(exc, AssertionError) else 'command-failed'
                        proof_checks.append(dict(check=check, phase=phase, status='failed', cause=cause))
                if output.is_dir():
                    atomic(output / 'mandatory-failure-proof-private.json', dict(phase_deadline=deadline,
                        post_proof_deadline=post_proof_deadline, primary_error=type(primary).__name__ if primary else None,
                        checks=proof_checks, specialized_started=(self.directory / 'specialized-learner-private.json').exists()))
                self.checks.extend(proof_checks)
            if failures:
                raise AssertionError('Mandatory phase proof or child cleanup failed') from (primary or failures[0])



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
            cleanup_deadline = time.monotonic() + 60
            lifecycle.stop(deadline=cleanup_deadline)
            cleanup(lifecycle.record, deadline=cleanup_deadline)
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
        if mode == 'original-proof':
            assert len(args) == 2
            print(json.dumps(original_account_proof(args[0], os.environ.copy(), args[1])))
            sys.exit(0)
        if mode == 'specialized-proof':
            assert len(args) in (2, 3)
            print(json.dumps(specialized_account_proof(args[0], os.environ.copy(), args[1], args[2] if len(args) == 3 else None)))
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
            deadline = m.get('phase_deadline')
            remaining(deadline, 90)
            assert pid_identity(r['pid'], deadline=deadline) == r['pid_identity']
            inspect_service(r, os.environ.copy(), deadline=deadline)
            print(json.dumps(m))
            sys.exit(0)
        if mode == 'snapshot':
            r = load_record(args[0])
            # Browser runner inherits owned datasource; credentials never enter JSON.
            manifest_path = Path(args[0]).parent / 'manifest.json'
            m = private_browser_json(manifest_path, manifest_path)
            assert m['nonce'] == r['nonce'] and m['origin'] == r['origin']
            deadline = m.get('phase_deadline')
            remaining(deadline, 90)
            print(json.dumps(learner_state(r, os.environ.copy(), json.loads(Path(args[1]).read_text()), deadline=deadline)))
            sys.exit(0)
        assert mode in ('run', 'backend')
        sys.exit(run(mode, args))
    except Exception as exc:
        print('FAIL ' + type(exc).__name__, file=sys.stderr)
        sys.exit(1)
