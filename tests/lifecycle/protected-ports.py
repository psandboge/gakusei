#!/usr/bin/env python3
"""Offline proof: protected listeners are never contacted or used as sentinels."""
import importlib.util
import json
import secrets
import sys
sys.dont_write_bytecode = True
from pathlib import Path
from unittest.mock import patch

root = Path(__file__).resolve().parents[2]
spec = importlib.util.spec_from_file_location('owned', root / 'scripts/verify-browser-state.py')
owned = importlib.util.module_from_spec(spec)
spec.loader.exec_module(owned)
ports = (18082, 18083, 15432, 15433)
run = secrets.token_hex(12)
directory = root / '.tools/browser-tests' / run
directory.mkdir(parents=True, mode=0o700)
record = directory / 'ownership.json'
body = dict(run_id=run, project='gakusei-browser-' + run,
            volume='gakusei-browser-' + run + '_postgres-data', root=str(root),
            app_port=23456, db_port=23457, origin='http://127.0.0.1:23456')
try:
    owned.atomic(record, body)
    assert owned.load_record(record) == body
    for port in ports:
        for key in ('app_port', 'db_port'):
            rejected = {**body, key:port}
            if key == 'app_port': rejected['origin'] = f'http://127.0.0.1:{port}'
            owned.atomic(record, rejected)
            try: owned.load_record(record)
            except AssertionError: pass
            else: raise AssertionError(f'Accepted protected {key} {port}')
    # A deterministic socket double proves allocator refusal without binding ports.
    sequence = iter((*ports, 23456))
    class Socket:
        def __enter__(self): return self
        def __exit__(self, *args): pass
        def bind(self, address): assert address == ('127.0.0.1', 0)
        def getsockname(self): return ('127.0.0.1', next(sequence))
    with patch.object(owned.socket, 'socket', return_value=Socket()):
        assert owned.free_port() == 23456
    print('PASS offline: all four protected ports rejected as app/database destinations and skipped by allocator')
finally:
    record.unlink(missing_ok=True)
    directory.rmdir()
