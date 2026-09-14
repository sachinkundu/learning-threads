import contextlib
import io
import json
from pathlib import Path
import sys
import tempfile
import threading
import unittest

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / 'server'))
from assistant import Jobs
from cloud_sync import CloudStudy


class FastStop(threading.Event):
    def wait(self, timeout=None):
        return super().wait(0.01)


class CloudSyncTests(unittest.TestCase):
    def test_lost_cloud_ack_and_repeated_delivery_do_not_rerun_codex(self):
        with tempfile.TemporaryDirectory() as tmp:
            config = Path(tmp) / 'cloud.json'; config.write_text('{}')
            calls = []
            def runner(payload):
                calls.append(payload)
                return {'text': 'A saved answer', 'usage': {'input_tokens': 20, 'output_tokens': 5}}
            jobs = Jobs(Path(tmp) / 'jobs.db', runner)
            cloud = CloudStudy(config); stop = FastStop(); records = []; polls = []
            def forward(method, path, data=None):
                if data:
                    record = json.loads(data); records.append(record)
                    if record['status'] == 'completed' and sum(r['status']=='completed' for r in records)==1:
                        raise ConnectionResetError('Acknowledgement lost after cloud commit')
                    return 200, {'saved': True}
                polls.append(True)
                if len(polls) >= 4:
                    stop.set()
                return 200, {'call': {'id': 'cloud-repeat-request', 'question': 'Why?', 'context': {}}}
            cloud.forward = forward
            with contextlib.redirect_stderr(io.StringIO()) as diagnostic:
                cloud.relay(jobs, stop)
            jobs.pool.shutdown(wait=True)
            self.assertEqual(len(calls), 1)
            self.assertEqual(len(jobs.ledger()['calls']), 1)
            self.assertGreaterEqual(sum(r['status']=='completed' for r in records), 2)
            self.assertIn('Acknowledgement lost after cloud commit', diagnostic.getvalue())
            self.assertTrue(all(r['id']=='cloud-repeat-request' for r in records))

    def test_unconfigured_bridge_preserves_a_clear_failure(self):
        status, value = CloudStudy(None).forward('GET', '/api/study')
        self.assertEqual(status, 503)
        self.assertIn('not connected', value['error'])
