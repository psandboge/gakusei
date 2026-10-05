#!/usr/bin/env python3
"""Synthetic lifecycle probe, not browser acceptance or UI learning evidence."""
import importlib.util
import json
import os
from pathlib import Path
import signal
import sys
import time

root = Path(__file__).resolve().parents[2]
spec = importlib.util.spec_from_file_location('owned', root / 'scripts/verify-browser-state.py')
owned = importlib.util.module_from_spec(spec)
spec.loader.exec_module(owned)
m = json.loads(owned.command(['python3', 'scripts/verify-browser-state.py', 'validate-manifest',
    os.environ['GAKUSEI_BROWSER_MANIFEST']], os.environ.copy(), capture_output=True).stdout)
r = owned.load_record(Path(m['state_path']).parent / 'ownership.json')
assert m['nonce'] == r['nonce'] and m['origin'] == r['origin']
assert os.environ['GAKUSEI_BROWSER_PHASE'] == m['phase']
assert owned.pid_identity(r['pid']) == r['pid_identity']
owned.inspect_service(r, os.environ.copy())
if m['phase'] == 'journey':
    case = sys.argv[1] if len(sys.argv) > 1 else 'success'
    if case == 'failure':
        sys.exit(23)
    if case == 'term':
        os.kill(os.getppid(), signal.SIGTERM)
        sys.exit(0)
    user = 'Life' + r['run_id'][:20]
    ids = [n['id'] for n in m['fixture']['nuggets'][:2]]
    assert len(ids) == 2
    statements = [f"INSERT INTO users(username,password,userrole) VALUES ('{user}','synthetic-not-login','ROLE_USER');"]
    submissions = []
    for index, nugget in enumerate(ids):
        correct = index == 0
        data = str(correct).lower()
        statements.append(f"INSERT INTO events(timestamp,gamemode,type,data,lesson,nugget_id,nugget_type_ref,user_ref) VALUES (now(),'guess','answeredCorrectly','{data}','genki 15','{nugget}',2,'{user}');")
        statements.append(f"INSERT INTO progresstrackinglist(user_ref,nugget_type_ref,nugget_id,correct_count,incorrect_count,latest_result) VALUES ('{user}',2,'{nugget}',{int(correct)},{int(not correct)},{data});")
        submissions.append(dict(nugget_id=nugget, correct=correct))
    owned.sql(r, os.environ.copy(), '\n'.join(statements) + "\nSELECT '{}'::json;")
    owned.atomic(Path(m['state_path']), dict(run_id=r['run_id'], nonce=r['nonce'], origin=r['origin'],
        username=user, password='synthetic-not-login', lesson='genki 15', category=2, submissions=submissions))
else:
    assert Path(m['state_path']).is_file()
print('PASS synthetic owned phase ' + m['phase'])
