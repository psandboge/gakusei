#!/usr/bin/env python3
"""Prove packaged factory discovery before any datasource/server allocation."""
import importlib.util
from pathlib import Path
import subprocess

ROOT = Path(__file__).resolve().parents[2]
spec = importlib.util.spec_from_file_location('owned', ROOT / 'scripts/verify-browser-state.py')
owned = importlib.util.module_from_spec(spec)
spec.loader.exec_module(owned)
jar = ROOT / 'target/gakusei.jar'
assert jar.is_file() and not jar.is_symlink()
directory = ROOT / '.tools/boot4-evidence'
directory.mkdir(mode=0o700, parents=True, exist_ok=True)
log = directory / 'packaged-missing-password-private.log'
with log.open('w') as output:
    log.chmod(0o600)
    try:
        owned.command(['java', '-jar', str(jar), '--spring.config.location=classpath:/application.yml',
                       '--spring.profiles.active=local-postgres', '--server.port=0',
                       '--LOCAL_DB_PORT=1', '--LOCAL_DB_PASSWORD=',
                       '--spring.datasource.url=jdbc:postgresql://127.0.0.1:1/unallocated'],
                      owned.safe_env(), timeout=30, stdout=output, stderr=output)
        raise AssertionError('Packaged startup accepted missing password')
    except subprocess.CalledProcessError:
        pass
text = log.read_text()
assert 'Local PostgreSQL requires LOCAL_DB_PASSWORD' in text
assert 'HikariPool' not in text and 'Tomcat started' not in text
print('PASS packaged environment factory discovery and pre-connection credential refusal')
