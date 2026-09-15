import json
from pathlib import Path
import tempfile
import threading
import unittest
import sys
from urllib.request import Request, urlopen
from urllib.error import HTTPError
sys.path.insert(0, str(Path(__file__).resolve().parents[1] / 'server'))
import assistant

class AssistantTests(unittest.TestCase):
    def test_preview_guards_private_files_and_proxies_calls_without_a_local_runner(self):
        class Cloud:
            def __init__(self): self.calls=[]
            def forward(self,method,path,data=None):
                self.calls.append((method,path,data))
                return 202,{'id':'browser-request-1','status':'running'}
        with tempfile.TemporaryDirectory() as tmp:
            site=Path(tmp);(site/'index.html').write_text('Reader');(site/'source-pages').mkdir()
            (site/'source-pages/modern-robotics-p1.png').write_bytes(b'checked-page')
            cloud=Cloud();server=assistant.ThreadingHTTPServer(('127.0.0.1',0),assistant.handler(site,set(),cloud))
            origin=f'http://127.0.0.1:{server.server_port}'
            server.RequestHandlerClass=assistant.handler(site,{origin},cloud)
            thread=threading.Thread(target=server.serve_forever);thread.start()
            try:
                payload=json.dumps({'id':'browser-request-1','question':'Why?','context':{'replyTo':'m4'}}).encode()
                for headers in [{'Content-Type':'application/json'},{'Content-Type':'application/json','X-Learning-Threads':'1','Origin':'https://elsewhere.example'}]:
                    with self.assertRaises(HTTPError) as error: urlopen(Request(origin+'/api/replies',payload,headers))
                    self.assertEqual(error.exception.code,403);error.exception.close()
                for path in ['/private.db','/source-pages/','/source-pages/../private.db','/MR-v2.pdf']:
                    with self.assertRaises(HTTPError) as error: urlopen(origin+path)
                    error.exception.close()
                with urlopen(origin+'/source-pages/modern-robotics-p1.png') as response:
                    self.assertEqual(response.read(),b'checked-page');self.assertEqual(response.headers.get_content_type(),'image/png')
                with urlopen(Request(origin+'/api/replies',payload,{'Content-Type':'application/json','X-Learning-Threads':'1','Origin':origin})) as response:
                    self.assertEqual(response.status,202)
                self.assertEqual(cloud.calls,[('POST','/api/replies',payload)])
                self.assertFalse(hasattr(assistant,'Jobs'));self.assertFalse(hasattr(assistant,'codex_reply'))
            finally: server.shutdown();thread.join();server.server_close()

if __name__=='__main__': unittest.main()
