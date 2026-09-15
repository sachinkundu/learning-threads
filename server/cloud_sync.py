"""Optional authenticated local-preview connection to the cloud app."""
import json
from pathlib import Path
import urllib.request
import urllib.error


class CloudStudy:
    def __init__(self, config):
        self.config = Path(config) if config else None

    def forward(self, method, path, data=None, raw=False):
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
                if raw:
                    return response.status, response.read(1_000_000), dict(response.headers)
                return response.status, json.load(response)
        except urllib.error.HTTPError as error:
            if raw:
                return error.code, error.read(1_000_000), dict(error.headers)
            try:
                return error.code, json.load(error)
            except (ValueError, UnicodeDecodeError) as cause:
                raise RuntimeError(f'Cloud sync returned HTTP {error.code}.') from cause
