#!/usr/bin/env python3
"""Derive public diagnostics from private evidence. Never copy raw input files."""
import importlib.util
import json
import os
from pathlib import Path
import re
import shutil
import subprocess
import sys
import xml.etree.ElementTree as ET

ROOT = Path(__file__).resolve().parent.parent
DEST = ROOT / 'artifacts/browser'
PHASES = ('journey', 'after-restart', 'after-reseed')


def integer(value):
    if isinstance(value, bool):
        raise ValueError('Boolean count')
    result = int(value)
    if not -255 <= result <= 1000000:
        raise ValueError('Count out of range')
    return result


def records():
    return sorted((ROOT / '.tools/browser-tests').glob('*/ownership.json'))


def cleanup_all():
    spec = importlib.util.spec_from_file_location('owned', ROOT / 'scripts/verify-browser-state.py')
    owned = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(owned)
    failed = False
    for path in records():
        try:
            owned.cleanup(path)  # checks absolute root, prefix/run, port and PID identity
        except Exception:
            failed = True
    if failed:
        raise RuntimeError('Owned fallback cleanup failed')


def secrets_from_runs():
    values = []
    for path in records():
        for name in ('learner.json', 'manifest.json', 'ownership.json'):
            file = path.parent / name
            if not file.exists():
                continue
            data = json.loads(file.read_text())
            values += [str(data[k]) for k in ('password', 'username', 'nonce') if k in data]
    return values


def privacy_scan(directory, secrets=()):
    allowed = {'diagnostics.json', 'diagnostics.log', 'diagnostics.png', 'surefire-summary.xml'}
    files = list(directory.iterdir())
    if {p.name for p in files} - allowed:
        raise ValueError('Upload allowlist violation')
    forbidden = re.compile(rb'(?i)(synthetic[_ -]?secret|authorization|set-cookie|cookie|password|'
                           rb'learner\.json|manifest\.json|ownership\.json|jdbc:|'
                           rb'\b[a-f0-9]{36,}\b|gakusei-browser-[a-f0-9]+)')
    for path in files:
        if path.is_symlink() or not path.is_file():
            raise ValueError('Invalid artifact')
        content = path.read_bytes()
        if forbidden.search(content) or any(s and s.encode() in content for s in secrets):
            raise ValueError('Private value detected')
        if path.suffix == '.png' and not content.startswith(b'\x89PNG\r\n\x1a\n'):
            raise ValueError('Invalid diagnostic screenshot')


def collect():
    os.umask(0o077)
    # Remove any previous upload gate/output before attempting collection.
    if DEST.exists():
        if DEST.is_symlink():
            DEST.unlink()
        else:
            shutil.rmtree(DEST)
    stage = ROOT / '.tools/ci-public-stage'
    if stage.exists():
        shutil.rmtree(stage)
    stage.mkdir(parents=True)
    try:
        suites = []
        declared = {p.stem for p in (ROOT / 'src/test/java').rglob('*.java')}
        for path in sorted((ROOT / 'target/surefire-reports').glob('TEST-*.xml')):
            doc = ET.parse(path).getroot()
            # XML names, messages, properties, system-out and system-err stay private.
            suite = {k: integer(doc.get(k, '0')) for k in ('tests', 'failures', 'errors', 'skipped')}
            name = doc.get('name', '').rsplit('.', 1)[-1]
            suite['suite'] = name if name in declared else 'undeclared-suite'
            suites.append(suite)
        runs = []
        for path in records():
            directory = path.parent
            result = directory / 'result.json'
            runs.append({'exit_code': integer(json.loads(result.read_text())['exit_code']) if result.exists() else None,
                         'complete': (directory / 'proof.json').is_file(),
                         'phases': {p: (directory / p).is_dir() for p in PHASES}})
        report = {'backend': suites, 'browser': runs}
        (stage / 'diagnostics.json').write_text(json.dumps(report, indent=2) + '\n')
        (stage / 'diagnostics.log').write_text(
            'Sanitized diagnostics: backend counts and browser phase completion only.\n'
            f'Backend suites: {len(suites)}; owned runs: {len(runs)}.\n'
            'Raw reports, service logs, application images and runner HTML remain private.\n')
        summary = ET.Element('testsuites')
        for suite in suites:
            ET.SubElement(summary, 'testsuite', {k: str(v) for k, v in suite.items()})
        ET.ElementTree(summary).write(stage / 'surefire-summary.xml', encoding='utf-8', xml_declaration=True)
        private = secrets_from_runs()
        privacy_scan(stage, private)
        # Screenshot renders ONLY the derived, scanned JSON in an offline browser.
        subprocess.run(['node', 'scripts/collect-ci-artifacts.js', str(stage)], cwd=ROOT,
                       check=True, timeout=45, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
        privacy_scan(stage, private)
        DEST.parent.mkdir(parents=True, exist_ok=True)
        stage.replace(DEST)
        print('PASS privacy validation; sanitized diagnostics ready')
    except BaseException:
        shutil.rmtree(stage, ignore_errors=True)
        raise


if __name__ == '__main__':
    try:
        mode = sys.argv[1] if len(sys.argv) > 1 else 'collect'
        if mode == 'cleanup':
            cleanup_all()
        elif mode == 'collect':
            collect()
        else:
            raise ValueError('Unknown mode')
    except Exception:
        # No exception payloads (which could contain input data) reach public logs.
        print('FAIL safe artifact handling; upload suppressed', file=sys.stderr)
        sys.exit(1)
