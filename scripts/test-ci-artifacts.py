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


    def test_distinct_failures_and_phase_status(self):
        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp)
            java = root / 'src/test/java/ExampleTest.java'
            java.parent.mkdir(parents=True)
            java.write_text('class ExampleTest {\n void firstCheck() {}\n void secondCheck() {}\n}\n')
            spec = root / 'tests/browser/example.spec.js'
            spec.parent.mkdir(parents=True)
            spec.write_text("test('first browser check', async () => {});\ntest('second browser check', async () => {});\n")
            reports = root / 'target/surefire-reports'
            reports.mkdir(parents=True)
            run = root / '.tools/browser-tests' / ('a' * 24)
            phase = run / 'journey'
            phase.mkdir(parents=True)
            (run / 'ownership.json').write_text('{"nonce":"private-nonce","password":"private-credential"}')
            def render(args, **kwargs):
                Path(args[-1], 'diagnostics.png').write_bytes(b'\x89PNG\r\n\x1a\n')
            def derive(method, title, line, cause='assertion-failed', status='failed'):
                (reports / 'TEST-ExampleTest.xml').write_text(
                    f'<testsuite name="ExampleTest" tests="1" failures="1"><testcase name="{method}">'
                    '<failure message="private-credential Authorization">raw private-nonce</failure></testcase></testsuite>')
                (phase / 'results.json').write_text(json.dumps({'suites':[{'specs':[{
                    'title':title, 'file':'example.spec.js', 'line':line,
                    'tests':[{'results':[{'status':'failed', 'errors':[{'message':'expect(value).toBe private-credential',
                        'location':{'file':'tests/browser/example.spec.js','line':line}}]}]}]}]}]}))
                (run / 'result.json').write_text(json.dumps({'exit_code':143 if status == 'interrupted' else 1,
                    'phases':{'journey':status}, 'checks':[{'check':'browser-tests','phase':'journey','status':status,'cause':cause}]}))
                collector.collect()
                return json.loads((root / 'artifacts/browser/diagnostics.json').read_text())
            with patch.object(collector, 'ROOT', root), patch.object(collector, 'DEST', root / 'artifacts/browser'), \
                 patch.object(collector.subprocess, 'run', render), patch.dict(collector.os.environ,
                    {'CI_PHASE_RESULTS':'{"frontend":{"outcome":"failure"},"build":{"outcome":"skipped"}}'}):
                first = derive('firstCheck', 'first browser check', 1)
                second = derive('secondCheck', 'second browser check', 2)
                self.assertNotEqual(first, second, 'Equal counts must preserve distinct failed checks')
                check = second['backend'][0]['checks'][0]
                self.assertEqual(check['check'], 'ExampleTest.secondCheck')
                self.assertEqual(check['location'], {'file':'src/test/java/ExampleTest.java','line':3})
                browser = second['browser'][0]
                self.assertEqual(browser['phases']['journey'], 'failed')
                self.assertEqual(browser['phases']['after-restart'], 'unavailable')
                self.assertEqual(browser['checks'][1]['check'], 'second browser check')
                self.assertEqual(browser['checks'][1]['cause'], 'assertion-failed')
                self.assertEqual(next(f for f in second['ci'] if f['check']=='frontend')['status'], 'failed')
                self.assertEqual(next(f for f in second['ci'] if f['check']=='build')['status'], 'skipped')
                terminated = derive('firstCheck', 'first browser check', 1, 'handled-termination', 'interrupted')
                self.assertEqual(terminated['browser'][0]['checks'][0]['cause'], 'handled-termination')
                for token in ('private-credential', 'private-nonce', 'Authorization'):
                    self.assertNotIn(token, json.dumps(terminated))
                # Contamination of structured identity rejects collection and removes stale output.
                data = json.loads((run / 'result.json').read_text())
                for token in ('private-credential', 'private-nonce', 'Authorization'):
                    data['checks'][0]['check'] = token
                    (run / 'result.json').write_text(json.dumps(data))
                    with self.assertRaises(ValueError):
                        collector.collect()
                    self.assertFalse((root / 'artifacts/browser').exists())
                self.assertIsNone(collector.location('../outside.js', 1))
                self.assertIsNone(collector.location('tests/browser/example.spec.js', 900))


    def test_harness_readiness_backend_and_cleanup_results(self):
        import subprocess
        from types import SimpleNamespace
        with tempfile.TemporaryDirectory() as tmp:
            directory = Path(tmp)
            def noop(*args):
                pass
            fake = SimpleNamespace(directory=directory, record=directory/'ownership.json',
                r={'project':'private-project'}, env={'SPRING_DATASOURCE_URL':'private-destination'},
                checks=[], phases={}, check_id='database-readiness', phase_id='setup', stop=noop, up=noop)
            cases = [('readiness-failed', 'up', subprocess.TimeoutExpired('private-command', 1)),
                     ('command-failed', 'command', subprocess.CalledProcessError(1, 'private-command')),
                     ('cleanup-failed', 'cleanup', RuntimeError('private-credential'))]
            for cause, target, error in cases:
                fake.checks = []
                fake.phases = {}
                fake.check_id, fake.phase_id = 'database-readiness', 'setup'
                with patch.object(owned, 'Run', return_value=fake), patch.object(owned, 'command') as command, \
                     patch.object(owned, 'cleanup') as cleanup, patch.object(fake, 'up') as up:
                    {'up':up, 'command':command, 'cleanup':cleanup}[target].side_effect = error
                    self.assertEqual(owned.run('backend', ['test']), 1)
                result = json.loads((directory / 'result.json').read_text())
                self.assertTrue(any(f['cause'] == cause and f['status'] == 'failed' for f in result['checks']))
                self.assertNotIn('private-credential', json.dumps(result['checks']))

if __name__ == '__main__':
    unittest.main()
