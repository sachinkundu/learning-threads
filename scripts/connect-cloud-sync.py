"""Install a scoped machine secret without printing it or putting it in the site."""
import argparse
import json
import os
from pathlib import Path
import secrets
import subprocess

parser = argparse.ArgumentParser()
parser.add_argument('--config', default='wrangler.jsonc')
parser.add_argument('--output', type=Path, required=True)
parser.add_argument('--origin', required=True)
args = parser.parse_args()
if args.output.exists():
    raise SystemExit('The bridge is already configured. Keep the existing secret.')
token = secrets.token_urlsafe(48)
result = subprocess.run(['npx', 'wrangler', 'secret', 'put', 'BRIDGE_TOKEN', '--config', args.config],
    input=token, capture_output=True, text=True)
if result.returncode:
    raise SystemExit(result.stderr or result.stdout)
args.output.parent.mkdir(parents=True, exist_ok=True, mode=0o700)
fd = os.open(args.output, os.O_WRONLY | os.O_CREAT | os.O_EXCL, 0o600)
with os.fdopen(fd, 'w') as handle:
    json.dump({'origin': args.origin, 'token': token}, handle)
print('Cloud sync connected. The secret is stored outside the served site.')
