"""Extract a review draft and exact page renders; the checked catalog is committed separately."""
import argparse
import json
from pathlib import Path
import re
import unicodedata
import pdfplumber

parser = argparse.ArgumentParser()
parser.add_argument('pdf', type=Path)
parser.add_argument('--output', type=Path, default=Path('tmp/pdfs'))
args = parser.parse_args()
args.output.mkdir(parents=True, exist_ok=True)
paragraphs = []
current = None
section = 'Preview'

def finish():
    global current
    if not current:
        return
    text = '\n'.join(current.pop('lines'))
    text = unicodedata.normalize('NFKC', text).replace('↵', 'ff').replace('\x00', 'ffi')
    keep = {'end', 'speed', 'two', 'three', 'six', 'time', 'open', 'closed', 'force', 'joint', 'motion', 'point', 'differential'}
    text = re.sub(r'(\w+)-\n', lambda m: m[1] + ('-' if m[1] in keep else ''), text)
    text = re.sub(r'\s+', ' ', text).strip().replace('http: //', 'http://')
    current['text'] = text
    paragraphs.append(current)
    current = None

with pdfplumber.open(args.pdf) as pdf:
    for printed in range(1, 11):
        page = pdf.pages[printed + 19]
        page.to_image(resolution=120).save(args.output / f'modern-robotics-p{printed}.png')
        if printed == 2:
            page.crop((134, 157, 500, 321)).to_image(resolution=240).save(args.output / 'modern-robotics-figure-1-1.png')
        low = 340 if printed == 1 else 408 if printed == 2 else 160
        for line in page.extract_text_lines(x_tolerance=1, y_tolerance=3):
            if not low < line['top'] < 652:
                continue
            text = line['text']
            if re.match(r'Chapter \d+:', text):
                finish()
                section = text
                continue
            if 149 < line['x0'] < 151:
                finish()
            if current is None:
                current = {'section': section, 'sourcePages': [], 'lines': []}
            if printed not in current['sourcePages']:
                current['sourcePages'].append(printed)
            current['lines'].append(text)
finish()
(args.output / 'chapter-one-draft.json').write_text(json.dumps(paragraphs, ensure_ascii=False, indent=2))
print(f'{len(paragraphs)} paragraph drafts; ten exact source pages; Figure 1.1')
