#!/usr/bin/env python3
"""Fail closed before resource allocation for untrusted jars and ownership."""
import importlib.util
import tempfile
import unittest
from pathlib import Path
from unittest.mock import patch
import zipfile

ROOT = Path(__file__).resolve().parents[2]
spec = importlib.util.spec_from_file_location('upgrade', ROOT / 'scripts/verify-boot4-upgrade.py')
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

    def test_history_and_any_checksum_mutation_block_acceptance(self):
        row = dict(id='original', author='original', filename='original.yaml', orderexecuted=1,
                   exectype='EXECUTED', dateexecuted='2026-10-05', deployment_id='original', md5sum='9:'+'a'*32, liquibase='4.31.1')
        self.assertEqual([], upgrade.assert_history([row], [dict(row)]))
        for key in row:
            with self.assertRaises(AssertionError):
                upgrade.assert_history([row], [dict(row, **{key:'changed'})])

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


    def test_exact_cleanup_requires_absolute_identity(self):
        with patch.object(upgrade.owned, 'cleanup') as cleanup:
            with patch('sys.argv', ['upgrade', '--cleanup', 'relative.json']), self.assertRaises(AssertionError):
                upgrade.main()
            cleanup.assert_not_called()

    def test_manifest_privacy_source_and_hash_are_independently_checked(self):
        import json
        import hashlib
        import subprocess
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory).resolve()
            subprocess.run(['git', 'init', '-q', str(root)], check=True)
            subprocess.run(['git', '-C', str(root), '-c', 'user.name=Guard', '-c', 'user.email=guard@example.invalid', 'commit', '--allow-empty', '-qm', 'fixture'], check=True)
            sha = upgrade.git(root, 'rev-parse', 'HEAD')
            jar = root / 'target/gakusei.jar'
            jar.parent.mkdir()
            with zipfile.ZipFile(jar, 'w') as archive:
                archive.writestr('BOOT-INF/lib/spring-boot-3.5.16.jar', b'')
                archive.writestr('BOOT-INF/classes/static/js/main.js', b'fixture')
                archive.writestr('BOOT-INF/classes/static/license/licenses.xml', b'fixture')
                archive.writestr('META-INF/MANIFEST.MF', 'Start-Class: se.kits.gakusei.GakuseiApplication\nSpring-Boot-Version: 3.5.16\n')
            digest = hashlib.sha256(jar.read_bytes()).hexdigest()
            proof = dict(schema='gakusei.upgrade-build.v1', checkout=str(root), source_sha=sha,
                         tracked_source_clean=True, build_command=['./mvnw', '-B', '-ntp', '-Pproduction', '-DskipTests', 'package'],
                         build_exit=0, jar=str(jar), jar_sha256=digest, boot_version='3.5.16')
            manifest = root / 'build.json'
            upgrade.owned.atomic(manifest, proof)
            self.assertEqual(root, upgrade.binding(jar, sha, digest, manifest, '3.5.16'))
            for key, value in [('source_sha', 'a'*40), ('jar_sha256','b'*64), ('build_exit',1),
                               ('tracked_source_clean',False), ('boot_version','4.1.1'), ('jar',str(root/'foreign.jar'))]:
                upgrade.owned.atomic(manifest, dict(proof, **{key:value}))
                with self.assertRaises(AssertionError):
                    upgrade.binding(jar, sha, digest, manifest, '3.5.16')
            upgrade.owned.atomic(manifest, proof)
            manifest.chmod(0o644)
            with self.assertRaises(AssertionError):
                upgrade.binding(jar, sha, digest, manifest, '3.5.16')
            manifest.chmod(0o600)
            jar.write_bytes(b'swapped')
            with self.assertRaises(AssertionError):
                upgrade.binding(jar, sha, digest, manifest, '3.5.16')

if __name__ == '__main__':
    unittest.main()
