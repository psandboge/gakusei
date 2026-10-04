#!/usr/bin/env python3
"""Exercise disposable local API/session state; never accept a remote origin."""
import argparse, base64, http.cookiejar, json, re, time
from urllib.parse import urlencode, urlparse
from urllib.request import build_opener, HTTPCookieProcessor, Request

parser = argparse.ArgumentParser()
parser.add_argument('origin')
parser.add_argument('--reset-proof', action='store_true')
args = parser.parse_args()
url = urlparse(args.origin)
assert url.scheme == 'http' and url.hostname in ('localhost', '127.0.0.1') and url.port, 'Explicit local HTTP port required'
origin = args.origin.rstrip('/')
jar = http.cookiejar.CookieJar()
client = build_opener(HTTPCookieProcessor(jar))
def request(path, body=None, content_type=None, admin=False):
    headers = {}
    if content_type: headers['Content-Type'] = content_type
    if admin: headers['Authorization'] = 'Basic ' + base64.b64encode(b'admin:gakusei').decode()
    if isinstance(body, str): body = body.encode()
    with client.open(Request(origin + path, body, headers), timeout=20) as response:
        return response.status, response.read().decode()
def get_json(path, admin=False):
    status, data = request(path, admin=admin)
    assert status == 200
    return json.loads(data)
users = get_json('/api/users', admin=True)
if args.reset_proof:
    assert len(users) == 6
    assert not any(u['username'].startswith('httpproof') or u['username']=='localdev1004' for u in users)
    assert all(not u['events'] and not u['progressTrackingList'] for u in users)
    print('PASS H2 restart reset: exactly six sample users, zero prior users/events/progress')
    raise SystemExit(0)
name = 'httpproof' + str(int(time.time()))
form = urlencode({'username': name, 'password': 'disposableproof', 'remember-me': 'false'})
assert request('/registeruser', form, 'text/plain')[0] == 201
assert request('/auth', form, 'application/x-www-form-urlencoded')[0] == 200
identity = get_json('/username')
assert identity['loggedIn'] and identity['username'] == name
assert any(c.name == 'JSESSIONID' for c in jar)
shell = request('/play/guess')[1]
assert 'index_root' in shell
assets = re.findall(r'src=["\']?(/js/[^"\'\s>]+\.js)', shell)
assert assets and all(request(asset)[0] == 200 for asset in assets)
assert 'maxcdn' not in shell
assert request('/bootstrap/css/bootstrap.min.css')[0] == 200
assert request('/license/frontend_licenses.json')[0] == 200
assert 'openapi' in get_json('/v3/api-docs')
query = urlencode({'lessonName':'genki 15','username':name,'questionType':'reading','answerType':'swedish'})
questions = get_json('/api/questions?' + query)
assert len(questions) == 6
repetition = get_json('/api/questions?' + query + '&spacedRepetition=true')
assert repetition
for question in questions:
    event = {'timestamp': int(time.time()*1000), 'gamemode':'lessons', 'type':'answeredCorrectly', 'data':'true', 'nuggetid':question['questionNuggetId'], 'nuggetcategory':'guess', 'username':name, 'lesson':'genki 15'}
    answer_timestamp = event['timestamp']
    event['type']='question'
    event['timestamp']=answer_timestamp - 1000
    assert request('/api/events', json.dumps(event), 'application/json')[0] == 200
    event['type']='userAnswer'
    event['timestamp']=answer_timestamp
    assert request('/api/events', json.dumps(event), 'application/json')[0] == 200
    event['type']='answeredCorrectly'
    assert request('/api/events', json.dumps(event), 'application/json')[0] == 200
    event['type']='updateRetention'
    assert request('/api/events', json.dumps(event), 'application/json')[0] == 200
proof = next(u for u in get_json('/api/users', admin=True) if u['username']==name)
assert sum(e['type']=='answeredCorrectly' for e in proof['events']) == 6
assert len(proof['progressTrackingList']) == 6
assert all(p['correctCount']==1 and p['nuggetType']['type']=='vocab' for p in proof['progressTrackingList'])
assert request('/logout', '', 'application/x-www-form-urlencoded')[0] in (200, 204)
assert not get_json('/username')['loggedIn']
assert request('/auth', form, 'application/x-www-form-urlencoded')[0] == 200
assert get_json('/username')['username'] == name
print('PASS local registration/auth/session, six questions/events/progress, repetition, route/static assets/docs, logout/login')
print('Account:',name,'seed users before:',len(users),'questions:',len(questions),'progress rows:',len(proof['progressTrackingList']))
