"""Publish the reader and its Codex bridge on this Mac's private tailnet."""
import json
import os
from pathlib import Path
import plistlib
import shutil
import sqlite3
import subprocess
import sys
import time
import urllib.request

ROOT = Path(__file__).resolve().parents[1]
TAILSCALE = '/Applications/Tailscale.app/Contents/MacOS/Tailscale'
LABEL = 'com.sachinkundu.learning-threads'
PORT = 63402
HTTPS_PORT = 8443
HOME_DIR = Path.home()
APP = HOME_DIR / 'Library/Application Support/LearningThreads'
SITE = APP / 'site'
PLIST = HOME_DIR / 'Library/LaunchAgents' / (LABEL + '.plist')
LOGS = HOME_DIR / 'Library/Logs/LearningThreads'
TARGET = f'gui/{os.getuid()}/{LABEL}'

def run(*args, check=True):
    return subprocess.run(args, check=check, capture_output=True, text=True)

try:
    status = json.loads(run(TAILSCALE, 'status', '--json').stdout)
    if status.get('BackendState') != 'Running':
        raise RuntimeError('Tailscale is not connected.')
    hostname = status['Self']['DNSName'].rstrip('.')
    current = json.loads(run(TAILSCALE, 'serve', 'status', '--json').stdout or '{}')
    origin = f'{hostname}:{HTTPS_PORT}'
    destination = f'http://127.0.0.1:{PORT}'
    existing = current.get('Web', {}).get(origin)
    expected = {'Handlers': {'/': {'Proxy': destination}}}
    if existing and existing != expected:
        raise RuntimeError(f'Tailscale port {HTTPS_PORT} already serves another app.')
    if str(HTTPS_PORT) in current.get('TCP', {}) and not existing:
        raise RuntimeError(f'Tailscale port {HTTPS_PORT} already has another listener.')
    if current.get('AllowFunnel', {}).get(origin):
        raise RuntimeError(f'Tailscale port {HTTPS_PORT} is public; choose a private port.')

    python = shutil.which('python3') or sys.executable
    database = APP / 'data/assistant.sqlite3'
    if database.exists():
        with sqlite3.connect(database) as db:
            if db.execute("SELECT count(*) FROM calls WHERE status IN ('queued','running')").fetchone()[0]:
                raise RuntimeError('A reply is still running. Deploy after it finishes.')
    codex = '/Applications/ChatGPT.app/Contents/Resources/codex'
    if not Path(codex).is_file():
        raise RuntimeError('The configured app-bundled Codex executable is missing.')
    login = run(codex, 'login', 'status')
    if 'ChatGPT' not in login.stdout + login.stderr:
        raise RuntimeError('This bridge requires the existing ChatGPT Codex login.')
    old_arguments = [python, '-u', '-m', 'http.server', str(PORT), '--bind', '127.0.0.1', '--directory', str(SITE)]
    arguments = [python, '-u', str(APP / 'assistant.py'), '--site', str(SITE),
                 '--data', str(APP / 'data'), '--codex', codex, '--port', str(PORT),
                 '--origin', f'https://{origin}']
    for address in status['Self'].get('TailscaleIPs', []):
        if ':' not in address:
            arguments += ['--origin', f'http://{address}:8080']
    reload_agent = False
    if PLIST.exists():
        old = plistlib.loads(PLIST.read_bytes())
        if old.get('Label') != LABEL or old.get('ProgramArguments') not in [arguments, old_arguments]:
            raise RuntimeError('The existing launch agent does not match this app.')
        reload_agent = old.get('ProgramArguments') != arguments

    run(python, str(ROOT / 'web/build.py'))
    SITE.mkdir(parents=True, exist_ok=True)
    LOGS.mkdir(parents=True, exist_ok=True)
    PLIST.parent.mkdir(parents=True, exist_ok=True)
    # Keep the previous artifact and Serve config for recovery. Copy only the
    # built page and its checked source renders; no directory listing or PDF.
    if (SITE / 'index.html').exists():
        shutil.copy2(SITE / 'index.html', APP / 'previous-index.html')
    (APP / 'previous-serve.json').write_text(json.dumps(current, indent=2))
    if PLIST.exists():
        shutil.copy2(PLIST, APP / 'previous-launch-agent.plist')
    shutil.copy2(ROOT / 'server/assistant.py', APP / 'assistant.next')
    (APP / 'assistant.next').replace(APP / 'assistant.py')
    shutil.copy2(ROOT / 'server/cloud_sync.py', APP / 'cloud_sync.py')
    shutil.copy2(ROOT / 'web/index.html', SITE / 'index.next')
    (SITE / 'index.next').replace(SITE / 'index.html')
    (SITE / 'source-pages').mkdir(exist_ok=True)
    for asset in (ROOT / 'web/source-pages').glob('*.png'):
        shutil.copy2(asset, SITE / 'source-pages' / asset.name)
    PLIST.write_bytes(plistlib.dumps({
        'Label': LABEL,
        'ProgramArguments': arguments,
        'RunAtLoad': True,
        'KeepAlive': True,
        'ThrottleInterval': 10,
        'StandardOutPath': str(LOGS / 'server.log'),
        'StandardErrorPath': str(LOGS / 'server-error.log'),
    }))
    loaded = run('launchctl', 'print', TARGET, check=False).returncode == 0
    if reload_agent and loaded:
        run('launchctl', 'bootout', TARGET)
        loaded = False
    if not loaded:
        # launchd may finish removing the old service just after bootout returns.
        for attempt in range(20):
            launched = run('launchctl', 'bootstrap', f'gui/{os.getuid()}', str(PLIST), check=False)
            if launched.returncode == 0:
                break
            if attempt == 19:
                raise subprocess.CalledProcessError(launched.returncode, launched.args, launched.stdout, launched.stderr)
            time.sleep(0.25)
    else:
        run('launchctl', 'kickstart', '-k', TARGET)

    for attempt in range(20):
        try:
            with urllib.request.urlopen(destination, timeout=2) as response:
                if response.read() != (ROOT / 'web/index.html').read_bytes():
                    raise RuntimeError('The local preview does not match the built app.')
            break
        except (OSError, urllib.error.URLError):
            if attempt == 19:
                raise
            time.sleep(0.25)
    result = run(TAILSCALE, 'serve', '--bg', f'--https={HTTPS_PORT}', destination)
    print(result.stdout.strip())
    print(f'https://{origin}/')
except subprocess.CalledProcessError as error:
    print(error.stderr or error.stdout, file=sys.stderr)
    raise
