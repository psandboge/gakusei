#!/usr/bin/env python3
"""Build one clean production checkout and write private independent provenance."""
import argparse
import hashlib
import json
import os
from pathlib import Path
import subprocess
import zipfile
import importlib.util
spec = importlib.util.spec_from_file_location('java_provenance', Path(__file__).with_name('java-provenance.py'))
provenance = importlib.util.module_from_spec(spec)
spec.loader.exec_module(provenance)

SCHEMA = provenance.SCHEMA

def git(root, *args):
    return subprocess.check_output(['git', '-C', str(root), *args], text=True).strip()

def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--checkout', required=True, type=Path)
    parser.add_argument('--manifest', required=True, type=Path)
    parser.add_argument('--java-home', required=True, type=Path)
    parser.add_argument('--expected-java-major', required=True, type=int, choices=(17,25))
    args = parser.parse_args()
    assert args.manifest.is_absolute() and not args.manifest.exists() and not args.manifest.is_symlink(), 'Exclusive manifest path required'
    root = args.checkout
    assert root.is_absolute() and root.resolve() == root
    assert git(root, 'rev-parse', '--show-toplevel') == str(root)
    assert not git(root, 'status', '--porcelain', '--untracked-files=no'), 'Clean tracked source required'
    sha = git(root, 'rev-parse', 'HEAD')
    jar = root / 'target/gakusei.jar'
    # Remove a previous output so a successful command cannot attest a stale jar.
    if jar.exists():
        jar.unlink()
    jdk = provenance.jdk(args.java_home, args.expected_java_major)
    maven = provenance.maven(root, args.java_home, args.expected_java_major)
    command = provenance.BUILD_COMMAND
    subprocess.run(command, cwd=root, env=provenance.environment(args.java_home), check=True)
    assert git(root, 'rev-parse', 'HEAD') == sha
    assert not git(root, 'status', '--porcelain', '--untracked-files=no')
    assert jar.is_file() and not jar.is_symlink()
    with zipfile.ZipFile(jar) as archive:
        text = archive.read('META-INF/MANIFEST.MF').decode()
        version = next(line.split(': ', 1)[1] for line in text.splitlines() if line.startswith('Spring-Boot-Version: '))
    record = dict(schema=SCHEMA, checkout=str(root), source_sha=sha, tracked_source_clean=True,
                  build_command=command, build_exit=0, jar=str(jar),
                  jar_sha256=hashlib.sha256(jar.read_bytes()).hexdigest(), boot_version=version, jdk=jdk, maven=maven, classes=provenance.classes(jar, maven['compiler_release']))
    manifest = args.manifest
    assert manifest.is_absolute() and not manifest.is_symlink()
    manifest.parent.mkdir(mode=0o700, parents=True, exist_ok=True)
    fd = os.open(manifest, os.O_WRONLY | os.O_CREAT | os.O_EXCL, 0o600)
    with os.fdopen(fd, 'w') as output:
        json.dump(record, output, indent=2)
        output.write('\n')
    print('BUILD_MANIFEST=' + str(manifest))

if __name__ == '__main__':
    main()
