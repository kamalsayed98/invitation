#!/usr/bin/env python3
"""Build a dependency-free Pages artifact with content-versioned local assets."""
import hashlib
import json
import re
import shutil
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
OUTPUT = ROOT / '_site'


def digest(data):
    return hashlib.sha256(data).hexdigest()[:16]


def build(source=ROOT, output=OUTPUT):
    source, output = Path(source).resolve(), Path(output).resolve()
    if output == source or output in source.parents:
        raise ValueError('Build output must not contain the source directory')
    files = {}

    def versioned(name, data):
        path = Path(name)
        target = path.with_name(f'{path.stem}.{digest(data)}{path.suffix}').as_posix()
        files[target] = data
        return target

    config = (source / 'config.js').read_text()
    # Only rewrite the two local image settings; leave external image URLs intact.
    def image_setting(match):
        key, quote, value = match.groups()
        if not value or re.match(r'^(?:[a-z]+:|//)', value, re.I):
            return match.group(0)
        path = (source / value).resolve()
        if not path.is_relative_to(source) or not path.is_file():
            raise ValueError(f'Image is missing or outside the project: {value}')
        target = versioned(path.relative_to(source).as_posix(), path.read_bytes())
        return f'{key}: {quote}{target}{quote}'

    config = re.sub(r'''\b(coupleImage|catImage)\s*:\s*(['"])(.*?)\2''', image_setting, config)
    names = {
        'style.css': versioned('style.css', (source / 'style.css').read_bytes()),
        'app.js': versioned('app.js', (source / 'app.js').read_bytes()),
        'config.js': versioned('config.js', config.encode()),
    }
    html = (source / 'index.html').read_text()
    for original, target in names.items():
        html, count = re.subn(r'((?:src|href)=["\'])' + re.escape(original) + r'(["\'])',
                              lambda match: match[1] + target + match[2], html)
        if count != 1:
            raise ValueError(f'Expected one HTML reference to {original}, got {count}')
    release = digest(html.encode())
    html = html.replace('</head>', f'  <meta name="invitation-version" content="{release}">\n</head>')
    files['index.html'] = html.encode()
    files['version.json'] = (json.dumps({'version': release}) + '\n').encode()
    files['.nojekyll'] = b''
    # All validation completes before replacing the previous generated output.
    if output.exists():
        shutil.rmtree(output)
    output.mkdir(parents=True)
    for name, data in files.items():
        path = output / name
        path.parent.mkdir(parents=True, exist_ok=True)
        path.write_bytes(data)
    print(f'Built release {release}: {len(files)} files in {output}')
    return release


if __name__ == '__main__':
    build()
