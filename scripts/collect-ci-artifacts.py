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


# Public facts are reconstructed from static source identifiers and closed enums.
CHECKS = ('database-readiness', 'application-readiness', 'fresh-state', 'seed-fixture',
          'browser-tests', 'durable-state', 'restart-state', 'reseed-state',
          'backend-tests', 'owned-cleanup', 'lifecycle')
CAUSES = ('none', 'assertion-failed', 'command-failed', 'timeout', 'readiness-failed',
          'sql-state-mismatch', 'handled-termination', 'cleanup-failed', 'unavailable', 'check-failed')
STATUSES = ('passed', 'failed', 'interrupted', 'unavailable', 'skipped')
CI_PHASES = ('tools', 'dependencies', 'preflight', 'frontend', 'backend', 'build', 'chromium', 'browser', 'privacy_tests', 'cleanup')


def location(file, line):
    # Only existing repository source files and real line numbers; never paths from logs.
    path = Path(file)
    if path.is_absolute():
        try:
            path = path.relative_to(ROOT)
        except ValueError:
            return None
    workflow = path.as_posix() == '.github/workflows/ci.yml'
    if '..' in path.parts or not path.parts or (path.parts[0] not in ('scripts', 'tests', 'src') and not workflow):
        return None
    source = ROOT / path
    try:
        source.resolve().relative_to(ROOT.resolve())
    except ValueError:
        return None
    if source.is_symlink() or not source.is_file() or (source.suffix not in ('.py', '.js', '.java') and not workflow):
        return None
    if type(line) is not int or not 1 <= line <= len(source.read_text().splitlines()):
        return None
    return {'file': path.as_posix(), 'line': line}


def fact(check, phase, status, cause, source=None):
    return dict(check=check, phase=phase, status=status, cause=cause, location=source)


def harness_facts(data):
    facts = []
    for item in data.get('checks', [])[:100]:
        if (item.get('check') not in CHECKS or item.get('phase') not in (*PHASES, 'setup', 'backend', 'cleanup')
                or item.get('status') not in STATUSES or item.get('cause') not in CAUSES):
            raise ValueError('Invalid structured check')
        loc = item.get('location') or {}
        facts.append(fact(item['check'], item['phase'], item['status'], item['cause'],
                          location(loc.get('file', ''), loc.get('line'))))
    return facts


def browser_facts(directory, phase):
    report = directory / phase / 'results.json'
    if not report.is_file():
        return [fact('browser-tests', phase, 'unavailable', 'unavailable')]
    data = json.loads(report.read_text())
    facts = []
    def visit(suite):
        for spec in suite.get('specs', []):
            file = spec.get('file', '')
            if '/' not in file and file.endswith('.spec.js'):
                file = 'tests/browser/' + file
            loc = location(file, spec.get('line'))
            # A title is public only if it is the exact static test declaration at this location.
            title = spec.get('title', '')
            declaration = (ROOT / loc['file']).read_text().splitlines()[loc['line'] - 1] if loc else ''
            if not re.match(r"test\(['\"]" + re.escape(title) + r"['\"],", declaration) or len(title) > 160:
                title = 'undeclared-browser-test'
            for test in spec.get('tests', []):
                results = test.get('results', [])
                result = results[-1] if results else {}
                status = result.get('status')
                public_status = {'passed': 'passed', 'failed': 'failed', 'timedOut': 'failed',
                                 'interrupted': 'interrupted', 'skipped': 'skipped'}.get(status, 'unavailable')
                cause = {'passed': 'none', 'timedOut': 'timeout', 'interrupted': 'handled-termination',
                         'skipped': 'unavailable'}.get(status, 'check-failed')
                errors = result.get('errors', [])
                if status == 'failed' and any('expect(' in e.get('message', '') for e in errors):
                    cause = 'assertion-failed'
                error_loc = next((location(e.get('location', {}).get('file', ''),
                                           e.get('location', {}).get('line')) for e in errors
                                  if e.get('location')), None)
                facts.append(fact(title, phase, public_status, cause, error_loc or loc))
        for child in suite.get('suites', []):
            visit(child)
    for suite in data.get('suites', []):
        visit(suite)
    if data.get('errors') or not facts:
        facts.append(fact('browser-tests', phase, 'failed', 'check-failed'))
    return facts


def ci_facts():
    data = json.loads(os.environ.get('CI_PHASE_RESULTS', '{}'))
    facts = []
    for phase in CI_PHASES:
        outcome = data.get(phase, {}).get('outcome')
        status = {'success': 'passed', 'failure': 'failed', 'cancelled': 'interrupted',
                  'skipped': 'skipped'}.get(outcome, 'unavailable')
        cause = {'passed': 'none', 'failed': 'command-failed', 'interrupted': 'handled-termination'}.get(status, 'unavailable')
        if phase == 'cleanup' and status == 'failed':
            cause = 'cleanup-failed'
        workflow = ROOT / '.github/workflows/ci.yml'
        lines = workflow.read_text().splitlines() if workflow.is_file() else []
        line = next((i + 1 for i, value in enumerate(lines) if value.strip() == 'id: ' + phase), None)
        facts.append(fact(phase, 'ci', status, cause, location('.github/workflows/ci.yml', line)))
    return facts


def upgrade_facts(directory):
    marker = directory / 'upgrade-private-marker.json'
    if not marker.is_file():
        return []
    result = directory / 'upgrade-result-private.json'
    if not result.is_file():
        return [fact('immutable-upgrade', 'upgrade', 'unavailable', 'unavailable')]
    data = json.loads(result.read_text())
    current = subprocess.check_output(['git', '-C', str(ROOT), 'rev-parse', 'HEAD'], text=True).strip()
    if data.get('candidate_sha') != current:
        return [fact('immutable-upgrade', 'upgrade', 'unavailable', 'unavailable')]
    status = data.get('status')
    if status not in ('passed', 'failed', 'interrupted'):
        raise ValueError('Invalid upgrade result')
    if status == 'passed' and not all((directory / name).is_file() for name in
            ('upgrade-before-private.json', 'upgrade-after-private.json', 'ownership.json')):
        status = 'unavailable'
    cause = {'passed':'none', 'failed':'check-failed', 'interrupted':'handled-termination',
             'unavailable':'unavailable'}[status]
    return [fact('immutable-upgrade', 'upgrade', status, cause)]


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
            suite['checks'] = []
            candidates = list((ROOT / 'src/test/java').rglob(name + '.java')) if name in declared else []
            source = candidates[0] if len(candidates) == 1 else None
            text = source.read_text() if source else ''
            for case in doc.findall('testcase'):
                method = case.get('name', '')
                match = re.search(r'\bvoid\s+' + re.escape(method) + r'\s*\(', text) if re.fullmatch(r'[A-Za-z_][A-Za-z0-9_]{0,100}', method) else None
                identity = name + '.' + method if match else 'undeclared-backend-test'
                loc = location(str(source), text[:match.start()].count('\n') + 1) if match else None
                failure = case.find('failure')
                if failure is None:
                    failure = case.find('error')
                if source and failure is not None:
                    frame = re.search(re.escape(source.name) + r':(\d+)\)', failure.text or '')
                    if frame:
                        loc = location(str(source), int(frame.group(1))) or loc
                failed = failure is not None
                skipped = case.find('skipped') is not None
                cause = 'assertion-failed' if case.find('failure') is not None else 'check-failed'
                suite['checks'].append(fact(identity, 'backend', 'failed' if failed else 'skipped' if skipped else 'passed',
                                             cause if failed else 'unavailable' if skipped else 'none', loc))
            suites.append(suite)
        runs = []
        for path in records():
            directory = path.parent
            result = directory / 'result.json'
            data = json.loads(result.read_text()) if result.exists() else {}
            checks = harness_facts(data)
            checks.extend(upgrade_facts(directory))
            for phase in PHASES:
                checks.extend(browser_facts(directory, phase))
            for check in checks:
                check['run'] = len(runs) + 1
            runs.append({'exit_code': integer(data['exit_code']) if 'exit_code' in data else None,
                         'complete': (directory / 'proof.json').is_file(),
                         'phases': {p: data.get('phases', {}).get(p, 'unavailable') for p in PHASES},
                         'checks': checks})
            if any(v not in STATUSES for v in runs[-1]['phases'].values()):
                raise ValueError('Invalid phase status')
        report = {'backend': suites, 'browser': runs, 'ci': ci_facts()}
        facts = report['ci'] + [f for s in suites for f in s['checks']] + [f for r in runs for f in r['checks']]
        (stage / 'diagnostics.json').write_text(json.dumps(report, indent=2) + '\n')
        (stage / 'diagnostics.log').write_text('Safe structured CI checks; raw payloads remain private.\n' +
            '\n'.join((f"run {f['run']}: " if 'run' in f else '') + f"{f['phase']}: {f['check']}: {f['status']}: {f['cause']}: " +
                      (f"{f['location']['file']}:{f['location']['line']}" if f['location'] else 'location unavailable')
                      for f in facts) + '\n')
        summary = ET.Element('testsuites')
        for suite in suites:
            node = ET.SubElement(summary, 'testsuite', {k: str(v) for k, v in suite.items() if k != 'checks'})
            for check in suite['checks']:
                ET.SubElement(node, 'testcase', {k: str(check[k]) for k in ('check', 'status', 'cause')})
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
