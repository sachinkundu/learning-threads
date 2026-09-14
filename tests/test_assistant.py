import importlib.util
import json
from pathlib import Path
import tempfile
import threading
import unittest
import sys
from urllib.request import Request, urlopen
from urllib.error import HTTPError

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / 'server'))
spec = importlib.util.spec_from_file_location('assistant', Path(__file__).resolve().parents[1] / 'server/assistant.py')
assistant = importlib.util.module_from_spec(spec)
spec.loader.exec_module(assistant)


class AssistantTests(unittest.TestCase):
    def test_real_event_shape_and_missing_usage(self):
        events = [
            {'type': 'error', 'message': 'Transient connection error'},
            {'type': 'item.completed', 'item': {'type': 'agent_message', 'text': 'A joint rotates.'}},
            {'type': 'turn.completed', 'usage': {'input_tokens': 40, 'cached_input_tokens': 10, 'output_tokens': 8}},
        ]
        result = assistant.parse_events('\n'.join(map(json.dumps, events)), '', 0)
        self.assertIsNone(result['error'])
        self.assertEqual(result['usage']['input_tokens'], 40)
        self.assertIsNone(result['usage']['reasoning_output_tokens'])
        self.assertIsNone(result['cost_usd'])
        failed = assistant.parse_events('{"type":"turn.failed","error":{"message":"Rate limit reached"}}', '', 1)
        self.assertEqual(failed['error'], 'Rate limit reached')
        self.assertIsNone(failed['usage'])

    def test_idempotency_and_retry_ledger(self):
        with tempfile.TemporaryDirectory() as tmp:
            count = []
            def runner(payload):
                count.append(payload)
                return {'text': 'Answer', 'usage': {'input_tokens': 20, 'output_tokens': 5}, 'cost_usd': None}
            jobs = assistant.Jobs(Path(tmp) / 'jobs.db', runner)
            payload = {'question': 'Why?', 'context': {}}
            for _ in range(3):
                jobs.submit('same-request-id', payload)
            with self.assertRaises(ValueError):
                jobs.submit('same-request-id', {'question': 'Changed?', 'context': {}})
            jobs.submit('new-attempt-id', payload)
            jobs.pool.shutdown(wait=True)
            self.assertEqual(len(count), 2)
            self.assertEqual(jobs.ledger()['totals']['input_tokens'], 40)
            reopened = assistant.Jobs(Path(tmp) / 'jobs.db', runner)
            self.assertEqual(reopened.get('same-request-id')['text'], 'Answer')
            self.assertEqual(len(reopened.ledger()['calls']), 2)
            reopened.pool.shutdown()

    def test_restart_marks_interrupted_work_without_automatic_resubmission(self):
        with tempfile.TemporaryDirectory() as tmp:
            jobs = assistant.Jobs(Path(tmp) / 'jobs.db', lambda p: self.fail('Must not rerun'))
            with jobs.connect() as db:
                db.execute('INSERT INTO calls VALUES (?,?,?,?,?,NULL)', ('interrupted-call', 'digest', '{"question":"Why?"}', 'running', assistant.now()))
            jobs.pool.shutdown()
            reopened = assistant.Jobs(Path(tmp) / 'jobs.db', lambda p: self.fail('Must not rerun'))
            self.assertEqual(reopened.get('interrupted-call')['status'], 'failed')
            self.assertIsNone(reopened.get('interrupted-call')['usage'])
            self.assertIsNone(reopened.ledger()['totals']['input_tokens'])
            reopened.pool.shutdown()

    def test_http_origin_guard_and_private_files(self):
        with tempfile.TemporaryDirectory() as tmp:
            site = Path(tmp); (site / 'index.html').write_text('Reader')
            (site / 'source-pages').mkdir()
            (site / 'source-pages/modern-robotics-p16.png').write_bytes(b'checked-page')
            jobs = assistant.Jobs(site / 'private.db', lambda p: {'text': 'Answer', 'usage': None})
            server = assistant.ThreadingHTTPServer(('127.0.0.1', 0), assistant.handler(site, jobs, set()))
            origin = f'http://127.0.0.1:{server.server_port}'
            server.RequestHandlerClass = assistant.handler(site, jobs, {origin})
            thread = threading.Thread(target=server.serve_forever); thread.start()
            try:
                payload = json.dumps({'id': 'browser-request-1', 'question': 'Why?', 'context': {}}).encode()
                for headers in [{'Content-Type': 'application/json'}, {'Content-Type': 'application/json', 'X-Learning-Threads': '1', 'Origin': 'https://elsewhere.example'}]:
                    with self.assertRaises(HTTPError) as error:
                        urlopen(Request(origin + '/api/replies', payload, headers))
                    self.assertEqual(error.exception.code, 403)
                    error.exception.close()
                with self.assertRaises(HTTPError) as error:
                    urlopen(origin + '/private.db')
                error.exception.close()
                with urlopen(origin + '/source-pages/modern-robotics-p16.png') as response:
                    self.assertEqual(response.read(), b'checked-page')
                    self.assertEqual(response.headers.get_content_type(), 'image/png')
                for path in ['/source-pages/', '/source-pages/../private.db', '/MR-v2.pdf']:
                    with self.assertRaises(HTTPError) as error:
                        urlopen(origin + path)
                    error.exception.close()
                with urlopen(Request(origin + '/api/replies', payload, {'Content-Type': 'application/json', 'X-Learning-Threads': '1', 'Origin': origin})) as response:
                    self.assertEqual(response.status, 202)
            finally:
                server.shutdown(); thread.join(); server.server_close(); jobs.pool.shutdown(wait=True)


if __name__ == '__main__':
    unittest.main()
