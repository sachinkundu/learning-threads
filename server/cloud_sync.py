"""Cloudflare study storage reached only by the existing private Mac bridge."""
import json
from pathlib import Path
import urllib.request
import urllib.error
import threading
import traceback


class CloudStudy:
    def __init__(self, config):
        self.config = Path(config) if config else None

    def forward(self, method, path, data=None):
        if not self.config or not self.config.is_file():
            return 503, {'error': 'Cloud sync is not connected. Your study is saved in this browser.'}
        config = json.loads(self.config.read_text())
        origin = config['origin']
        if not origin.startswith('https://') or not origin.endswith('.workers.dev'):
            raise ValueError('The configured cloud sync origin is invalid.')
        request = urllib.request.Request(origin + path.replace('/api/', '/internal/', 1),
            data=data, method=method, headers={'Authorization': 'Bearer ' + config['token'], 'Content-Type': 'application/json', 'User-Agent': 'LearningThreadsSync/1.0'})
        try:
            with urllib.request.urlopen(request, timeout=25) as response:
                return response.status, json.load(response)
        except urllib.error.HTTPError as error:
            try:
                return error.code, json.load(error)
            except (ValueError, UnicodeDecodeError) as cause:
                raise RuntimeError(f'Cloud sync returned HTTP {error.code}.') from cause

    def relay(self, jobs, stop):
        published = {}
        while not stop.is_set():
            if not self.config or not self.config.is_file():
                stop.wait(5)
                continue
            try:
                # Publish durable local results before claiming a cloud request.
                # The same ID always reaches the same SQLite job, even after a
                # Mac restart, a lost response, or use from both web origins.
                with jobs.connect() as db:
                    rows = db.execute('SELECT id,payload,status,created,result FROM calls').fetchall()
                for request_id, payload, state, created, result in rows:
                    fingerprint = (state, result)
                    if published.get(request_id) == fingerprint:
                        continue
                    record = {'id': request_id, 'payload': json.loads(payload), 'status': state,
                              'created': created, 'result': jobs.get(request_id)}
                    status, value = self.forward('POST', '/api/replies/record', json.dumps(record).encode())
                    if status != 200:
                        raise RuntimeError(f'Cloud assistant record failed (HTTP {status}): {value.get("error", value)}')
                    published[request_id] = fingerprint
                status, value = self.forward('GET', '/api/replies/next')
                if status != 200:
                    raise RuntimeError(f'Cloud assistant poll failed (HTTP {status}): {value.get("error", value)}')
                if value.get('call'):
                    call = value['call']
                    try:
                        jobs.submit(call['id'], {'question': call['question'], 'context': call['context']})
                    except ValueError:
                        # Preserve the concrete failure in private logs. The
                        # durable cloud request remains queued for a later poll.
                        traceback.print_exc()
            except Exception:
                traceback.print_exc()
            stop.wait(3)

    def start_relay(self, jobs):
        stop = threading.Event()
        thread = threading.Thread(target=self.relay, args=(jobs, stop), daemon=True)
        thread.start()
        return stop
