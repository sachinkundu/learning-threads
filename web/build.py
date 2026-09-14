"""Build the reading app directly, without the chat visualization wrapper."""
import base64
import hashlib
from pathlib import Path
import re

folder = Path(__file__).resolve().parent
content = (folder / 'reading.html').read_text()
for filename in ['thread-examples.css']:
    content = content.replace(f'<link rel="stylesheet" href="./{filename}">', '<style>' + (folder / filename).read_text() + '</style>')
for filename in ['study-store.js', 'study-links.js', 'assistant-client.js', 'thread-examples.js']:
    content = content.replace(f'<script src="./{filename}"></script>', '<script>' + (folder / filename).read_text() + '</script>')
# Keep the same pinned icon set as the approved prototype.
content += '''
<script src="https://unpkg.com/lucide@1.17.0/dist/umd/lucide.js"></script>
<script>globalThis.lucide?.createIcons({attrs:{width:16,height:16}});</script>
'''
scripts = re.findall(r'<script>([\s\S]*?)</script>', content)
hashes = ' '.join("'sha256-" + base64.b64encode(hashlib.sha256(script.encode()).digest()).decode() + "'" for script in scripts)
policy = f"default-src 'none'; script-src {hashes} https://unpkg.com/lucide@1.17.0/; style-src 'unsafe-inline'; img-src 'self' data: blob:; connect-src 'self'; object-src 'none'; base-uri 'none'; form-action 'self'"
document = f'''<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="referrer" content="no-referrer">
<meta http-equiv="Content-Security-Policy" content="{policy}">
<title>Learning Threads</title>
<style>html,body{{margin:0;padding:0}}svg.lucide{{width:16px;height:16px;flex-shrink:0;vertical-align:middle}}</style>
</head>
<body>{content}</body>
</html>
'''
(folder / 'index.html').write_text(document)
print(folder / 'index.html')
