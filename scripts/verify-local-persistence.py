#!/usr/bin/env python3
"""Read-only restart proof for a disposable localhost vocabulary learner."""
import argparse, base64, json
from urllib.parse import urlparse
from urllib.request import Request, urlopen
p = argparse.ArgumentParser()
p.add_argument('origin')
p.add_argument('username')
p.add_argument('--answers', type=int, default=6)
a = p.parse_args()
u = urlparse(a.origin)
assert u.scheme == 'http' and u.hostname in ('localhost', '127.0.0.1') and u.port
headers = {'Authorization': 'Basic ' + base64.b64encode(b'admin:gakusei').decode()}
with urlopen(Request(a.origin.rstrip('/') + '/api/users', headers=headers), timeout=20) as r:
    users = json.load(r)
learner = next(x for x in users if x['username'] == a.username)
events = [e for e in learner['events'] if e['type'] == 'answeredCorrectly']
assert len(events) == a.answers, (len(events), a.answers)
assert len(learner['progressTrackingList']) == a.answers
assert all(x['correctCount'] == 1 for x in learner['progressTrackingList'])
assert len([x for x in users if x['username'] == 'nulluser']) == 1
print('PASS persisted account', a.username, 'answer events:', len(events), 'progress rows:', len(learner['progressTrackingList']))
