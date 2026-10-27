"""Regression: cached invitations must remain fully styled after a new release."""
import importlib.util
import re
import subprocess
import tempfile
import unittest
from pathlib import Path

spec = importlib.util.spec_from_file_location('invitation_build', Path(__file__).resolve().parents[1] / 'scripts/build.py')
builder = importlib.util.module_from_spec(spec)
spec.loader.exec_module(builder)


class CachedInvitationTests(unittest.TestCase):
    def test_older_html_and_image_configuration_keep_working(self):
        with tempfile.TemporaryDirectory() as temp:
            source = Path(temp) / 'repo'
            source.mkdir()
            def git(*args):
                return subprocess.check_output(['git', '-C', str(source), *args], stderr=subprocess.DEVNULL)
            git('init', '-b', 'main')
            git('config', 'user.email', 'test@example.com')
            git('config', 'user.name', 'Build test')
            (source / 'scripts').mkdir()
            (source / 'scripts/build.py').write_text('# First versioned deployment\n')
            (source / 'index.html').write_text('<head><link href="style.css"><script src="config.js"></script><script src="app.js"></script></head>')
            (source / 'style.css').write_text('body { background: beige; }')
            (source / 'app.js').write_text('// invitation v1')
            (source / 'config.js').write_text("window.invitationConfig = {coupleImage: 'couple.webp', catImage: 'cat.webp'};")
            (source / 'couple.webp').write_bytes(b'couple original')
            (source / 'cat.webp').write_bytes(b'cat original')
            git('add', '.')
            git('commit', '-m', 'First deployment')
            old = Path(temp) / 'old'
            builder.build_release(source, old)
            old_html = (old / 'index.html').read_text()
            old_files = {p.name: p.read_bytes() for p in old.iterdir() if re.search(r'\.[0-9a-f]{16}\.', p.name)}
            (source / 'style.css').write_text('body { background: ivory; }')
            (source / 'app.js').write_text('// invitation v2')
            (source / 'cat.webp').write_bytes(b'cat updated')
            git('add', '.')
            git('commit', '-m', 'Second deployment')
            new = Path(temp) / 'new'
            builder.build_release(source, new)
            self.assertNotEqual(old_html, (new / 'index.html').read_text())
            for name, data in old_files.items():
                self.assertEqual((new / name).read_bytes(), data, name)
            for name in ['style.css', 'app.js', 'config.js', 'couple.webp', 'cat.webp']:
                self.assertEqual((new / name).read_bytes(), (source / name).read_bytes())
            for html in [old_html, (new / 'index.html').read_text()]:
                for name in re.findall(r'(?:src|href)="([^"]+)"', html):
                    self.assertTrue((new / name).is_file(), name)


if __name__ == '__main__':
    unittest.main()
