"""Expose the exported reading view as a normal, full-viewport page."""

from html.parser import HTMLParser
from pathlib import Path


class PreviewDocument(HTMLParser):
    def __init__(self):
        super().__init__(convert_charrefs=True)
        self.content = None

    def handle_starttag(self, tag, attributes):
        if tag == "iframe":
            self.content = dict(attributes).get("srcdoc")


folder = Path(__file__).resolve().parent
parser = PreviewDocument()
parser.feed((folder / "exported.html").read_text())
if not parser.content:
    raise ValueError("The rendered export did not contain its reading document.")
if "window.openai" in parser.content:
    raise ValueError("A chat-only interaction remains in the exported page.")
content = parser.content
# The export only allows inline code and approved CDNs. Bundle our local
# prototype modules into the document without broadening that policy.
content = content.replace(
    '<link rel="stylesheet" href="./thread-examples.css">',
    '<style>' + (folder / 'thread-examples.css').read_text() + '</style>',
)
content = content.replace(
    '<script src="./thread-examples.js"></script>',
    '<script>' + (folder / 'thread-examples.js').read_text() + '</script>',
)
(folder / "index.html").write_text(content)
print(folder / "index.html")
