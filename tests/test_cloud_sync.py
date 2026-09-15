import json
from pathlib import Path
import sys
import tempfile
import unittest
from unittest.mock import patch
sys.path.insert(0, str(Path(__file__).resolve().parents[1] / 'server'))
from cloud_sync import CloudStudy

class CloudSyncTests(unittest.TestCase):
    def test_unconfigured_preview_preserves_a_clear_failure(self):
        status, value = CloudStudy(None).forward('GET', '/api/study')
        self.assertEqual(status, 503)
        self.assertIn('not connected', value['error'])

    def test_only_the_cloud_receives_the_unchanged_followup_packet(self):
        with tempfile.TemporaryDirectory() as tmp:
            config=Path(tmp)/'cloud.json'
            config.write_text(json.dumps({'origin':'https://learning-threads.example.workers.dev','token':'private-preview-token'}))
            payload=json.dumps({'id':'call-001','question':'Why?','context':{'replyTo':'m4','selectedText':'torque'}}).encode()
            class Reply:
                status=202
                def __enter__(self): return self
                def __exit__(self,*args): pass
                def read(self): return b'{"status":"running"}'
            with patch('cloud_sync.urllib.request.urlopen',return_value=Reply()) as sent:
                self.assertEqual(CloudStudy(config).forward('POST','/api/replies',payload),(202,{'status':'running'}))
                request=sent.call_args.args[0]
                self.assertEqual(request.full_url,'https://learning-threads.example.workers.dev/internal/replies')
                self.assertEqual(request.data,payload)
