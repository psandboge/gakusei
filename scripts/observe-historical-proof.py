#!/usr/bin/env python3
"""Run unchanged frozen public commands with bounded owned Java17 observations."""
import argparse
import importlib.util
import json
import os
from pathlib import Path
import signal
import subprocess
import sys
import threading
import time

ROOT = Path(__file__).resolve().parents[1]
spec = importlib.util.spec_from_file_location('provenance', ROOT/'scripts/java-provenance.py')
provenance = importlib.util.module_from_spec(spec)
spec.loader.exec_module(provenance)

def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--fixture', required=True, type=Path)
    parser.add_argument('--java-home', required=True, type=Path)
    parser.add_argument('--baseline-checkout', required=True, type=Path)
    parser.add_argument('--records', required=True, type=Path)
    parser.add_argument('command', nargs=argparse.REMAINDER)
    args = parser.parse_args()
    assert args.command and args.command[0] == '--'
    assert args.command[1:3] in (['bash','scripts/test-boot3-upgrade.sh'],
                               ['python3','tests/lifecycle/upgrade-interrupt.py']), 'Frozen public command required'
    jars = {}
    for checkout, expected in ((args.fixture,'1bac4e96fe9a2f405eddff503056ef231fb4a8f9'),
                               (args.baseline_checkout,'9d614c2506d5e58ad3a8343a92dc7d87f9fde1c4')):
        assert checkout.is_absolute() and checkout.resolve() == checkout
        assert subprocess.check_output(['git','-C',str(checkout),'rev-parse','HEAD'],text=True).strip() == expected
        assert not subprocess.check_output(['git','-C',str(checkout),'status','--porcelain','--untracked-files=no'],text=True).strip()
        jar = checkout/'target/gakusei.jar'
        jars[str(jar)] = dict(source_sha=expected, jar_sha256=provenance.digest(jar))
    tools = provenance.jdk(args.java_home,17)
    spec = importlib.util.spec_from_file_location('frozen_owned',args.fixture/'scripts/verify-browser-state.py')
    owned = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(owned)
    args.records.mkdir(mode=0o700, parents=True, exist_ok=False)
    directory = args.fixture/'.tools/browser-tests'
    existing = set(directory.glob('*/ownership.json'))
    seen, errors, pending = set(), [], {}
    done = threading.Event()
    def observe():
        while not done.wait(.1):
            for path in set(directory.glob('*/ownership.json')) - existing:
                try:
                    record = owned.load_record(path)
                    pid = record.get('pid')
                    if not pid:
                        continue
                    key = (pid, record['pid_identity'])
                    if key in seen:
                        continue
                    pending.setdefault(key,time.monotonic())
                    assert time.monotonic() - pending[key] < 10, 'Historical VM observation budget expired'
                    assert owned.pid_identity(pid) == key[1], 'Historical owned PID changed'
                    raw = provenance.capture([tools['jcmd'],str(pid),'VM.system_properties'],args.java_home,timeout=3)
                    facts = dict(line.split('=',1) for line in raw.splitlines() if '=' in line)
                    jar = facts['sun.java.command'].split()[0]
                    assert jar in jars and provenance.digest(jar) == jars[jar]['jar_sha256']
                    assert facts['java.home'] == tools['home'] and facts['java.vendor'] == tools['vendor']
                    assert facts['java.version'] == '17.0.16'
                    assert owned.pid_identity(pid) == key[1]
                    owned.atomic(args.records/f'{pid}-{len(seen)}-private.json',
                                 dict(schema='gakusei.historical-runtime.v1', pid=pid,pid_identity=key[1],
                                      jar=jar, **jars[jar],jdk=tools,vm_properties=raw))
                    seen.add(key)
                except subprocess.CalledProcessError:
                    if time.monotonic() - pending.get(key,time.monotonic()) < 10:
                        continue
                    errors.append('Historical attachment failed')
                    done.set()
                except Exception as exc:
                    errors.append(type(exc).__name__+': '+str(exc))
                    done.set()
    process = subprocess.Popen(args.command[1:],cwd=args.fixture,env=provenance.environment(args.java_home))
    def interrupted(sig, frame):
        process.send_signal(sig)
    for sig in (signal.SIGINT,signal.SIGTERM):
        signal.signal(sig,interrupted)
    watcher = threading.Thread(target=observe,daemon=True)
    watcher.start()
    status = process.wait()
    done.set()
    watcher.join(timeout=5)
    if errors or not seen or set(pending) - seen:
        print('Historical runtime observation failed: '+('; '.join(errors) or 'No owned VM observation'),file=sys.stderr)
        return status or 1
    return status
if __name__ == '__main__':
    sys.exit(main())
