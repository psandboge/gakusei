#!/usr/bin/env python3
"""Private two-jar migration proof using the strict existing ownership protocol."""
import argparse
import hashlib
import importlib.util
import json
import re
import signal
import sys
import time
import zipfile
from pathlib import Path
import urllib.request
import urllib.parse
import http.cookiejar

ROOT = Path(__file__).resolve().parent.parent
BASELINE_SHA = '9d614c2506d5e58ad3a8343a92dc7d87f9fde1c4'
spec = importlib.util.spec_from_file_location('owned', ROOT / 'scripts/verify-browser-state.py')
owned = importlib.util.module_from_spec(spec)
spec.loader.exec_module(owned)


def jar_proof(path, version):
    path = Path(path)
    assert path.is_absolute() and path.is_file() and not path.is_symlink(), 'Absolute immutable jar required'
    with zipfile.ZipFile(path) as jar:
        names = jar.namelist()
        assert 'BOOT-INF/lib/spring-boot-' + version + '.jar' in names, 'Wrong embedded Boot version'
        assert any(n.startswith('BOOT-INF/classes/static/js/') and n.endswith('.js') for n in names), 'Missing production JS'
        assert 'BOOT-INF/classes/static/license/licenses.xml' in names, 'Missing generated dependency licenses'
        manifest = jar.read('META-INF/MANIFEST.MF').decode()
        assert 'Start-Class: se.kits.gakusei.GakuseiApplication' in manifest
        assert 'Spring-Boot-Version: ' + version in manifest
    return hashlib.sha256(path.read_bytes()).hexdigest()


def history(run):
    return owned.sql(run.r, run.env, """SELECT coalesce(json_agg(x ORDER BY orderexecuted),'[]') FROM
        (SELECT id,author,filename,orderexecuted,exectype,dateexecuted,deployment_id,md5sum,liquibase FROM databasechangelog) x;""")


def assert_history(before, after):
    assert len(before) == len(after), 'Applied history count changed'
    transitions = set()
    for old, new in zip(before, after):
        for key in ('id', 'author', 'filename', 'orderexecuted', 'exectype', 'dateexecuted', 'deployment_id', 'liquibase'):
            assert old[key] == new[key], 'Historical migration identity/execution changed'
        if old['md5sum'] != new['md5sum']:
            # Liquibase 4.23+ recalculates v8 checksums as v9 without rerunning
            # changesets. No other transition is accepted, and exectype/order
            # must match. Original records are kept privately for inspection.
            assert re.fullmatch(r'8:[a-f0-9]{32}', old['md5sum'])
            assert re.fullmatch(r'9:[a-f0-9]{32}', new['md5sum'])
            transitions.add('8->9')
    return sorted(transitions)


def snapshot(run, user):
    assert re.fullmatch('[A-Za-z0-9]{2,32}', user)
    return owned.sql(run.r, run.env, f"""SELECT json_build_object(
      'user', (SELECT row_to_json(x) FROM (SELECT username,password,userrole,new_user,site_language FROM users WHERE username='{user}') x),
      'events', (SELECT coalesce(json_agg(x ORDER BY id),'[]') FROM (SELECT * FROM events WHERE user_ref='{user}') x),
      'progress', (SELECT coalesce(json_agg(x ORDER BY id),'[]') FROM (SELECT * FROM progresstrackinglist WHERE user_ref='{user}') x),
      'seed', (SELECT json_agg(x) FROM (SELECT * FROM local_sample_seed) x),
      'content', (SELECT json_build_object(
        'nuggets', (SELECT count(*) FROM contentschema.nuggets),
        'lessons', (SELECT count(*) FROM contentschema.lessons),
        'kanjis', (SELECT count(*) FROM contentschema.kanjis),
        'quizzes', (SELECT count(*) FROM contentschema.quiz),
        'accounts', (SELECT count(*) FROM users))),
      'references', (SELECT coalesce(json_agg(x ORDER BY nugget_id,lesson_id),'[]') FROM
        (SELECT * FROM contentschema.lessons_nuggets WHERE nugget_id IN
          (SELECT nugget_id FROM events WHERE user_ref='{user}')) x));""")


def client(run):
    return urllib.request.build_opener(urllib.request.ProxyHandler({}),
        urllib.request.HTTPCookieProcessor(http.cookiejar.CookieJar()))


def request(run, http, path, data=None, content_type='application/json;charset=UTF-8'):
    req = urllib.request.Request(run.r['origin'] + path, data=data,
                                 headers={'Content-Type': content_type})
    with http.open(req, timeout=15) as response:
        return response.status, response.read().decode()


def login(run, http, user, password):
    data = urllib.parse.urlencode(dict(username=user, password=password, **{'remember-me':'true'})).encode()
    assert request(run, http, '/auth', data, 'application/x-www-form-urlencoded')[0] == 200
    assert json.loads(request(run, http, '/username')[1])['username'] == user


def write_event(run, http, user, nugget, correct, kind='answeredCorrectly'):
    event = dict(username=user, gamemode='guess', type=kind, data=str(correct).lower(),
                 lesson='genki 15', nuggetid=nugget, nuggetcategory='guess', timestamp=int(time.time()*1000))
    assert request(run, http, '/api/events', json.dumps(event).encode())[0] == 200


def populate(run):
    user = 'Upgrade' + run.r['run_id'][:20]
    password = 'Private' + run.r['nonce'][:20]
    http = client(run)
    data = urllib.parse.urlencode(dict(username=user, password=password, **{'remember-me':'true'})).encode()
    assert request(run, http, '/registeruser', data, 'application/x-www-form-urlencoded')[0] == 201
    assert not json.loads(request(run, http, '/username')[1])['loggedIn']
    login(run, http, user, password)
    query = urllib.parse.urlencode(dict(lessonName='genki 15', username=user,
                                        questionType='reading', answerType='swedish'))
    questions = json.loads(request(run, http, '/api/questions?' + query)[1])
    assert questions and all(q['correctAlternative'] for q in questions)
    ids = [q['questionNuggetId'] for q in questions[:2]]
    allowed = {n['id'] for n in owned.fixture(run.r, run.env)['nuggets']}
    assert all(n in allowed for n in ids)
    assert len(ids) == 2
    for index, nugget in enumerate(ids):
        # Retained clients record question and userAnswer before correctness;
        # retention derives both timing and latest timestamp from these events.
        write_event(run, http, user, nugget, index == 0, 'question')
        write_event(run, http, user, nugget, index == 0, 'userAnswer')
        write_event(run, http, user, nugget, index == 0)
        write_event(run, http, user, nugget, index == 0, 'updateRetention')
    state = snapshot(run, user)
    assert state['user'] and len(state['events']) == 8 and len(state['progress']) == 2
    assert all(p['retention_date'] and p['retention_factor'] > 0 for p in state['progress'])
    return user, password, ids, state



def finish(run):
    # A second INT/TERM cannot interrupt the bounded owned cleanup after the
    # first signal has unwound the fixture. Restore handlers for the next run.
    handlers = {sig: signal.signal(sig, signal.SIG_IGN) for sig in (signal.SIGINT, signal.SIGTERM)}
    try:
        try:
            run.stop()
        finally:
            owned.cleanup(run.record)
    finally:
        for sig, handler in handlers.items():
            signal.signal(sig, handler)

def fixture(baseline, candidate, upgrading):
    run = owned.Run()
    owned.atomic(run.directory / 'upgrade-private-marker.json', {'kind':'boot3-upgrade'})
    result = {'status':'failed', 'fixture':'populated-boot2' if upgrading else 'fresh-boot3'}
    try:
        run.up()
        run.start(jar_path=baseline if upgrading else candidate)
        fresh = owned.content(run.r, run.env)
        assert fresh['migrations'] > 0 and fresh['seed'] == 0
        assert fresh['users'] == fresh['nuggets'] == fresh['lessons'] == 0
        run.stop()
        run.start(seed=True, jar_path=baseline if upgrading else candidate)
        user, password, ids, before = populate(run)
        old_history = history(run)
        owned.atomic(run.directory / 'upgrade-before-private.json', {'history':old_history, 'data':before})
        run.stop()
        run.start(jar_path=candidate)
        transitions = assert_history(old_history, history(run))
        assert snapshot(run, user) == before, 'Upgrade changed durable learner rows'
        http = client(run)
        login(run, http, user, password)
        write_event(run, http, user, ids[0], True)
        written = snapshot(run, user)
        assert written['user'] == before['user']
        assert written['events'][:len(before['events'])] == before['events']
        assert len(written['events']) == len(before['events']) + 1
        assert written['events'][-1]['id'] > max(e['id'] for e in before['events'])
        assert len(written['progress']) == len(before['progress'])
        assert written['seed'] == before['seed'] and written['content'] == before['content']
        assert written['references'] == before['references']
        old_progress = {p['id']:p for p in before['progress']}
        for row in written['progress']:
            original = old_progress[row['id']]
            if row['nugget_id'] == ids[0]:
                assert row['correct_count'] == original['correct_count'] + 1
                assert row['incorrect_count'] == original['incorrect_count']
                assert row['latest_result'] is True
                for key in original.keys() - {'correct_count', 'latest_result', 'latest_timestamp'}:
                    assert row[key] == original[key], 'Unrelated progress/retention fields changed'
            else:
                assert row == original, 'Unrelated progress row changed'
        run.stop()
        owned.command(owned.compose(run.r) + ['restart', 'postgres'], run.env)
        deadline = time.monotonic() + 90
        while True:
            try:
                owned.inspect_service(run.r, run.env)
                break
            except AssertionError:
                assert time.monotonic() < deadline, 'Database restart readiness expired'
                time.sleep(.5)
        for seed in (False, True, True):
            run.start(seed=seed, jar_path=candidate)
            login(run, client(run), user, password)
            assert snapshot(run, user) == written, 'Restart/reseed changed durable rows'
            assert_history(old_history, history(run))
            run.stop()
        result.update(status='passed', checksum_transitions=transitions)
        owned.atomic(run.directory / 'upgrade-after-private.json', {'history':history(run), 'data':written})
    finally:
        finish(run)
        owned.atomic(run.directory / 'upgrade-result-private.json', result)
    print('PASS ' + result['fixture'] + ' upgrade/restart/reseed/write proof', flush=True)


def seed_refusal(candidate):
    run = owned.Run()
    owned.atomic(run.directory / 'upgrade-private-marker.json', {'kind':'seed-refusal'})
    try:
        run.up()
        run.start(jar_path=candidate)
        run.stop()
        owned.sql(run.r, run.env, "INSERT INTO users(username,password,userrole) VALUES ('ForeignFixture','private','ROLE_USER'); SELECT '{}'::json;")
        try:
            run.start(seed=True, jar_path=candidate)
            raise RuntimeError('Unsafe seed unexpectedly succeeded')
        except AssertionError:
            logs = ''.join(p.read_text() for p in run.directory.glob('seed-*.log'))
            assert 'Refusing sample seed on a nonempty database without its seed marker' in logs
        assert owned.content(run.r, run.env)['users'] == 1
        assert owned.content(run.r, run.env)['seed'] == 0
    finally:
        finish(run)
    print('PASS nonempty-without-marker seed refused', flush=True)



def seed_profile_refusal(candidate):
    run = owned.Run()
    owned.atomic(run.directory / 'upgrade-private-marker.json', {'kind':'unsafe-profile-refusal'})
    try:
        run.up()
        run.start(jar_path=candidate)
        run.stop()
        # Still the same validated owned DB. Enable its local changelog and
        # validation explicitly while withholding the required seed profile.
        run.env.update(SPRING_LIQUIBASE_ENABLED='true',
                       SPRING_LIQUIBASE_CHANGE_LOG='classpath:/db/db.changelog-local.yaml',
                       SPRING_JPA_HIBERNATE_DDL_AUTO='validate')
        try:
            run.start(seed=True, jar_path=candidate, profiles='upgrade-seed-refusal')
            raise RuntimeError('Unsafe profile seed unexpectedly succeeded')
        except AssertionError:
            logs = ''.join(p.read_text() for p in run.directory.glob('seed-*.log'))
            assert 'local-seed requires local-postgres without data-init' in logs
        data = owned.content(run.r, run.env)
        assert data['users'] == data['nuggets'] == data['lessons'] == data['seed'] == 0
    finally:
        finish(run)
    print('PASS seed without required profile refused', flush=True)

def cleanup_all():
    errors = []
    for marker in sorted((ROOT / '.tools/browser-tests').glob('*/upgrade-private-marker.json')):
        try:
            owned.cleanup(marker.parent / 'ownership.json')
        except Exception as exc:
            errors.append(type(exc).__name__)
    if errors:
        raise RuntimeError('Upgrade cleanup failed: ' + ','.join(errors))


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--baseline-jar', type=Path)
    parser.add_argument('--candidate-jar', type=Path)
    parser.add_argument('--baseline-sha')
    parser.add_argument('--cleanup', action='store_true')
    args = parser.parse_args()
    if args.cleanup:
        assert not any((args.baseline_jar, args.candidate_jar, args.baseline_sha))
        cleanup_all()
        return
    assert args.baseline_sha == BASELINE_SHA, 'Unaccepted baseline SHA'
    assert args.baseline_jar and args.candidate_jar
    baseline_hash = jar_proof(args.baseline_jar, '2.7.18')
    candidate_hash = jar_proof(args.candidate_jar, '3.5.16')
    assert args.baseline_jar.resolve() != args.candidate_jar.resolve()
    def interrupted(sig, frame):
        raise SystemExit(128 + sig)
    signal.signal(signal.SIGTERM, interrupted)
    signal.signal(signal.SIGINT, interrupted)
    fixture(args.baseline_jar, args.candidate_jar, False)
    fixture(args.baseline_jar, args.candidate_jar, True)
    seed_refusal(args.candidate_jar)
    seed_profile_refusal(args.candidate_jar)
    assert jar_proof(args.baseline_jar, '2.7.18') == baseline_hash
    assert jar_proof(args.candidate_jar, '3.5.16') == candidate_hash


if __name__ == '__main__':
    main()
