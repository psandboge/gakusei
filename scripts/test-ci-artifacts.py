#!/usr/bin/env python3
"""Privacy boundaries: synthetic and actual run-generated secret rejection."""
import importlib.util
import json
from pathlib import Path
import tempfile
import unittest
from unittest.mock import patch

ROOT = Path(__file__).resolve().parent.parent

def module(name, file):
    spec = importlib.util.spec_from_file_location(name, ROOT / file)
    result = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(result)
    return result

collector = module('collector', 'scripts/collect-ci-artifacts.py')
owned = module('owned', 'scripts/verify-browser-state.py')

class Privacy(unittest.TestCase):
    def test_secret_rejection(self):
        run = owned.Run()  # actual random DB/remember-me values, no services started
        with tempfile.TemporaryDirectory() as tmp:
            directory = Path(tmp)
            output = directory / 'diagnostics.log'
            actual = collector.secrets_from_runs()
            for token in ('SYNTHETIC_SECRET_MARKER', 'Authorization: Bearer value',
                          'Cookie: session=value', 'manifest.json', run.env['LOCAL_DB_PASSWORD'],
                          run.env['LOCAL_REMEMBER_ME_KEY'], 'GeneratedLearnerCredential', *actual):
                output.write_text(token)
                with self.assertRaises(ValueError):
                    collector.privacy_scan(directory, [run.env['LOCAL_DB_PASSWORD'], 'GeneratedLearnerCredential', *actual])
            output.write_text('Backend suites: 2; phases complete: 3\n')
            collector.privacy_scan(directory)
            (directory / 'raw.trace.zip').write_bytes(b'raw')
            with self.assertRaises(ValueError):
                collector.privacy_scan(directory)
        # This offline fixture must not enter production collection/cleanup.
        import shutil
        shutil.rmtree(run.directory)

    def test_derivation_and_failed_publish(self):
        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp)
            reports = root / 'target/surefire-reports'
            reports.mkdir(parents=True)
            reports.joinpath('TEST-secret.xml').write_text(
                '<testsuite tests="3" failures="1" errors="0" skipped="0">'
                '<system-out>SYNTHETIC_SECRET_PASSWORD Authorization private</system-out></testsuite>')
            run = root / '.tools/browser-tests' / ('a' * 24)
            run.mkdir(parents=True)
            run.joinpath('ownership.json').write_text(json.dumps({'nonce': 'private-nonce'}))
            run.joinpath('result.json').write_text('{"exit_code":1}')
            run.joinpath('journey').mkdir()
            # Only rendering is mocked here; real Chromium is proved by collection.
            def render(args, **kwargs):
                Path(args[-1], 'diagnostics.png').write_bytes(b'\x89PNG\r\n\x1a\n')
            with patch.object(collector, 'ROOT', root), patch.object(collector, 'DEST', root / 'artifacts/browser'):
                with patch.object(collector.subprocess, 'run', render):
                    collector.collect()
                public = root / 'artifacts/browser'
                data = json.loads(public.joinpath('diagnostics.json').read_text())
                self.assertEqual(data['backend'][0]['failures'], 1)
                self.assertEqual(data['browser'][0]['exit_code'], 1)
                self.assertFalse(data['browser'][0]['complete'])
                self.assertNotIn('SECRET', public.joinpath('diagnostics.json').read_text())
                def poison(args, **kwargs):
                    Path(args[-1], 'diagnostics.log').write_text('SYNTHETIC_SECRET_MARKER')
                with patch.object(collector.subprocess, 'run', poison):
                    with self.assertRaises(ValueError):
                        collector.collect()
                self.assertFalse(public.exists(), 'Old successful upload must not survive a rejected collection')
                self.assertFalse((root / '.tools/ci-public-stage').exists())

if __name__ == '__main__':
    unittest.main()
