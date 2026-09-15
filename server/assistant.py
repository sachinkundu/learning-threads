"""Optional local preview proxy. All learning and assistant work runs in Cloudflare."""
import argparse
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
import json
from pathlib import Path
import traceback
from urllib.parse import urlsplit
from cloud_sync import CloudStudy

SOURCE_ASSETS = {f'/source-pages/modern-robotics-p{page}.png' for page in [*range(1, 11), 16]} | {'/source-pages/modern-robotics-figure-1-1.png'}


def handler(site, origins, cloud):
    hosts = {urlsplit(origin).netloc for origin in origins}

    class Handler(BaseHTTPRequestHandler):
        def send_json(self, value, status=200):
            data = json.dumps(value).encode()
            self.send_response(status)
            self.send_header('Content-Type', 'application/json')
            self.send_header('Cache-Control', 'no-store')
            self.send_header('X-Content-Type-Options', 'nosniff')
            self.send_header('Content-Length', str(len(data)))
            self.end_headers()
            try:
                self.wfile.write(data)
            except (BrokenPipeError, ConnectionResetError):
                pass

        def api_allowed(self):
            return (self.headers.get('Host') in hosts
                    and self.headers.get('X-Learning-Threads') == '1'
                    and (not self.headers.get('Origin') or self.headers['Origin'] in origins)
                    and self.headers.get('Sec-Fetch-Site') not in ['cross-site'])

        def proxy(self, method):
            if not self.api_allowed():
                return self.send_json({'error': 'Open the reading app to continue.'}, 403)
            try:
                data = None
                if method == 'POST':
                    size = int(self.headers.get('Content-Length', '0'))
                    if not 0 < size <= 2_000_000 or self.headers.get_content_type() != 'application/json':
                        return self.send_json({'error': 'Send JSON smaller than 2 MB.'}, 400)
                    data = self.rfile.read(size)
                status, result = cloud.forward(method, self.path, data)
                return self.send_json(result, status)
            except Exception as error:
                traceback.print_exc()
                return self.send_json({'error': f'Could not reach the cloud app: {type(error).__name__}: {error}'}, 502)

        def do_GET(self):
            path = urlsplit(self.path).path
            if self.headers.get('Host') not in hosts:
                return self.send_json({'error': 'Unknown host.'}, 403)
            if path in ['/', '/index.html'] or path in SOURCE_ASSETS:
                asset = site / ('index.html' if path in ['/', '/index.html'] else path.lstrip('/'))
                if not asset.is_file():
                    return self.send_json({'error': 'Source page not found.'}, 404)
                data = asset.read_bytes()
                self.send_response(200)
                self.send_header('Content-Type', 'image/png' if path in SOURCE_ASSETS else 'text/html; charset=utf-8')
                self.send_header('Cache-Control', 'no-cache')
                self.send_header('X-Content-Type-Options', 'nosniff')
                self.send_header('Content-Length', str(len(data)))
                self.end_headers()
                self.wfile.write(data)
                return
            if path in ['/api/study', '/api/usage', '/api/settings'] or path.startswith(('/api/study/', '/api/replies/')):
                return self.proxy('GET')
            self.send_json({'error': 'Not found.'}, 404)

        def do_POST(self):
            if self.path in ['/api/study', '/api/replies', '/api/settings']:
                return self.proxy('POST')
            self.send_json({'error': 'Not found.'}, 404)

    return Handler


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('--site', type=Path, required=True)
    parser.add_argument('--cloud-config', type=Path, required=True)
    parser.add_argument('--port', type=int, default=63402)
    parser.add_argument('--origin', action='append', default=[])
    args = parser.parse_args()
    origins = set(args.origin + [f'http://127.0.0.1:{args.port}', f'http://localhost:{args.port}'])
    server = ThreadingHTTPServer(('127.0.0.1', args.port), handler(args.site, origins, CloudStudy(args.cloud_config)))
    print(f'Learning Threads preview on 127.0.0.1:{args.port}', flush=True)
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        pass
    finally:
        server.server_close()


if __name__ == '__main__':
    main()
