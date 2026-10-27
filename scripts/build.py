#!/usr/bin/env python3
"""Build a dependency-free Pages artifact with content-versioned local assets."""
import hashlib
import json
import re
import shutil
import subprocess
import tempfile
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
OUTPUT = ROOT / '_site'


def digest(data):
    return hashlib.sha256(data).hexdigest()[:16]


def build(source=ROOT, output=OUTPUT, revision=None, quiet=False):
    source, output = Path(source).resolve(), Path(output).resolve()
    if output == source or output in source.parents:
        raise ValueError('Build output must not contain the source directory')
    files = {}

    def read(name):
        if revision:
            return subprocess.check_output(['git', '-C', str(source), 'show', f'{revision}:{name}'])
        return (source / name).read_bytes()

    def versioned(name, data):
        path = Path(name)
        target = path.with_name(f'{path.stem}.{digest(data)}{path.suffix}').as_posix()
        files[target] = data
        return target

    original_config = read('config.js')
    config = original_config.decode()
    # Only rewrite the two local image settings; leave external image URLs intact.
    def image_setting(match):
        key, quote, value = match.groups()
        if not value or re.match(r'^(?:[a-z]+:|//)', value, re.I):
            return match.group(0)
        path = (source / value).resolve()
        if not path.is_relative_to(source):
            raise ValueError(f'Image is missing or outside the project: {value}')
        name = path.relative_to(source).as_posix()
        image = read(name)
        files[name] = image
        target = versioned(name, image)
        return f'{key}: {quote}{target}{quote}'

    config = re.sub(r'''\b(coupleImage|catImage)\s*:\s*(['"])(.*?)\2''', image_setting, config)
    names = {
        'style.css': versioned('style.css', read('style.css')),
        'app.js': versioned('app.js', read('app.js')),
        'config.js': versioned('config.js', config.encode()),
    }
    # Original URLs remain available for HTML cached before versioning was introduced.
    files.update({'style.css': read('style.css'), 'app.js': read('app.js'), 'config.js': original_config})
    html = read('index.html').decode()
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
    if not quiet:
        print(f'Built release {release}: {len(files)} files in {output}')
    return release


def build_release(source=ROOT, output=OUTPUT):
    source, output = Path(source), Path(output)
    # Recreate every published generation from Git history. This also works on a
    # fresh Actions runner; cached HTML can still load its exact original assets.
    additions = subprocess.check_output([
        'git', '-C', str(source), 'log', '--reverse', '--diff-filter=A',
        '--format=%H', '--', 'scripts/build.py'
    ], text=True).splitlines()
    retained = {}
    if additions:
        revisions = [additions[0]] + subprocess.check_output([
            'git', '-C', str(source), 'rev-list', '--reverse', '--first-parent',
            f'{additions[0]}..HEAD'
        ], text=True).splitlines()
        with tempfile.TemporaryDirectory() as temp:
            for revision in revisions:
                snapshot = Path(temp) / 'snapshot'
                build(source, snapshot, revision=revision, quiet=True)
                for path in snapshot.rglob('*'):
                    if path.is_file() and re.search(r'\.[0-9a-f]{16}\.', path.name):
                        retained[path.relative_to(snapshot)] = path.read_bytes()
    release = build(source, output)
    for name, data in retained.items():
        target = output / name
        target.parent.mkdir(parents=True, exist_ok=True)
        target.write_bytes(data)
    print(f'Retained {len(retained)} historical asset URLs for cached invitations')
    return release


if __name__ == '__main__':
    build_release()
