"""Real D1 concurrency/authorization probe, restricted to the disposable QA Worker."""
import argparse
from concurrent.futures import ThreadPoolExecutor
from copy import deepcopy
from datetime import datetime, timezone
import json
from pathlib import Path
import urllib.error
import urllib.request
import uuid

parser = argparse.ArgumentParser()
parser.add_argument('--config', type=Path, required=True)
args = parser.parse_args()
config = json.loads(args.config.read_text())
assert config['origin'].startswith('https://learning-threads-sync-qa.'), 'Never run against the real study database.'


def request(path, body=None, authenticated=True):
    headers = {'Content-Type': 'application/json', 'User-Agent': 'LearningThreadsSync/1.0'}
    if authenticated:
        headers['Authorization'] = 'Bearer ' + config['token']
    req = urllib.request.Request(config['origin']+path, data=json.dumps(body).encode() if body is not None else None, headers=headers)
    try:
        with urllib.request.urlopen(req, timeout=25) as response:
            return response.status, json.load(response)
    except urllib.error.HTTPError as error:
        return error.code, json.load(error)


for path in ['/', '/source-pages/modern-robotics-p16.png', '/api/study', '/internal/study']:
    assert request(path, authenticated=False)[0] == 401, path
assert request('/')[0] == 401, 'A machine credential must not open the reader.'
status, current = request('/internal/study')
assert status == 200 and current['head'], 'Seed QA through the reader first.'
head = current['head']; bodies = []
for label in ['A', 'B']:
    state = deepcopy(head['state']); state['notes'][0] = 'Cloud concurrency probe '+label
    bodies.append({'id': 's-'+str(uuid.uuid4()), 'book': 'modern-robotics-2019-preprint', 'base': head['version'], 'state': state})
with ThreadPoolExecutor(max_workers=2) as pool:
    results = list(pool.map(lambda value: request('/internal/study', value), bodies))
assert sorted(status for status, _ in results) == [200, 409], results
winner = next(i for i, (_, result) in enumerate(results) if result['accepted'])
winner_version = results[winner][1]['version']
status, repeated = request('/internal/study', bodies[winner])
assert status == 200 and repeated['version'] == winner_version
changed = deepcopy(bodies[winner]); changed['state']['notes'][0] = 'Must be rejected'
assert request('/internal/study', changed)[0] == 409
assert request('/internal/study')[1]['head']['version'] == winner_version
loser = 1-winner
changed = deepcopy(bodies[loser]); changed['base'] = winner_version
assert request('/internal/study', changed)[0] == 409
assert request('/internal/study')[1]['head']['version'] == winner_version, 'A reused rejected ID must not move the head.'
changed['state']['notes'][0] = 'Changed rejected copy'
assert request('/internal/study', changed)[0] == 409
assert request('/internal/study')[1]['head']['version'] == winner_version
record_id = 'qa-ledger-'+str(uuid.uuid4())
record = {'id': record_id, 'payload': {'question': 'Protocol fixture, not a model call.', 'context': {}}, 'status': 'completed', 'created': datetime.now(timezone.utc).isoformat(), 'result': {'text': 'Fixture', 'usage': None, 'cost_usd': None}}
assert request('/internal/replies/record', record)[0] == 200
assert request('/internal/replies/record', record)[0] == 200
changed = deepcopy(record); changed['payload']['question'] = 'Must be rejected'
assert request('/internal/replies/record', changed)[0] == 409
print(json.dumps({'authorization':'passed','concurrent_writers':'one accepted, one preserved conflict','idempotency':'passed','head_version':winner_version,'preserved_versions':[r[1]['version'] for r in results],'fixture_ledger_id':record_id}))
