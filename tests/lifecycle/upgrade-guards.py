#!/usr/bin/env python3
"""Fail closed before resource allocation for untrusted jars and ownership."""
import importlib.util
import tempfile
import unittest
from pathlib import Path
from unittest.mock import patch
import zipfile

ROOT = Path(__file__).resolve().parents[2]
spec = importlib.util.spec_from_file_location('upgrade', ROOT / 'scripts/verify-boot3-upgrade.py')
upgrade = importlib.util.module_from_spec(spec)
spec.loader.exec_module(upgrade)

class Guards(unittest.TestCase):
    def test_invalid_inputs_never_allocate_resources(self):
        with patch.object(upgrade.owned, 'Run', side_effect=AssertionError('Allocated resources')) as allocate:
            for args in (['--baseline-sha', 'develop'],
                         ['--baseline-sha', upgrade.BASELINE_SHA, '--baseline-jar', 'relative.jar', '--candidate-jar', 'relative.jar']):
                with patch('sys.argv', ['upgrade'] + args), self.assertRaises(AssertionError):
                    upgrade.main()
            allocate.assert_not_called()

    def test_embedded_version_assets_and_manifest_are_required(self):
        with tempfile.TemporaryDirectory() as directory:
            path = Path(directory) / 'untrusted.jar'
            with zipfile.ZipFile(path, 'w') as jar:
                jar.writestr('BOOT-INF/lib/spring-boot-2.7.18.jar', b'')
            with self.assertRaises(AssertionError):
                upgrade.jar_proof(path, '3.5.16')
            with self.assertRaises(AssertionError):
                upgrade.jar_proof(path, '2.7.18')
            link = Path(directory) / 'link.jar'
            link.symlink_to(path)
            with self.assertRaises(AssertionError):
                upgrade.jar_proof(link, '2.7.18')

    def test_history_reexecution_and_unknown_checksum_mutation_block_acceptance(self):
        row = dict(id='original', author='original', filename='original.yaml', orderexecuted=1,
                   exectype='EXECUTED', dateexecuted='2026-10-05', deployment_id='original-deployment', md5sum='8:'+'a'*32, liquibase='4.9.1')
        updated = dict(row, md5sum='9:'+'b'*32)
        self.assertEqual(['8->9'], upgrade.assert_history([row], [updated]))
        for invalid in (dict(updated, exectype='RERAN'), dict(updated, orderexecuted=2),
                        dict(updated, filename='renamed.yaml'), dict(updated, dateexecuted='changed'), dict(updated, md5sum='8:'+'c'*32)):
            with self.assertRaises(AssertionError):
                upgrade.assert_history([row], [invalid])

    def test_foreign_ownership_is_rejected_before_process_or_docker_access(self):
        with tempfile.TemporaryDirectory() as directory:
            path = Path(directory) / 'ownership.json'
            upgrade.owned.atomic(path, dict(run_id='a'*24, project='gakusei-local'))
            with patch.object(upgrade.owned, 'command') as command, self.assertRaises(AssertionError):
                upgrade.owned.cleanup(path)
            command.assert_not_called()


    def test_changed_jar_is_rejected_before_a_process_is_launched(self):
        import shutil
        run = upgrade.owned.Run()
        try:
            with tempfile.TemporaryDirectory() as directory:
                jar = Path(directory) / 'candidate.jar'
                jar.write_bytes(b'changed immutable content')
                run.r['jar_hashes'] = {str(jar): 'original-digest'}
                with patch.object(upgrade.owned.subprocess, 'Popen') as launch, self.assertRaises(AssertionError):
                    run.start(jar_path=jar)
                launch.assert_not_called()
        finally:
            shutil.rmtree(run.directory)  # Offline record only: no service was allocated.


    def test_cleanup_attempts_all_records_without_suppressing_failure(self):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            for name in ('a'*24, 'b'*24):
                marker = root / '.tools/browser-tests' / name / 'upgrade-private-marker.json'
                marker.parent.mkdir(parents=True)
                marker.write_text('{}')
            with patch.object(upgrade, 'ROOT', root), patch.object(upgrade.owned, 'cleanup', side_effect=[RuntimeError('failed'), None]) as cleanup:
                with self.assertRaises(RuntimeError):
                    upgrade.cleanup_all()
                self.assertEqual(2, cleanup.call_count)

if __name__ == '__main__':
    unittest.main()
