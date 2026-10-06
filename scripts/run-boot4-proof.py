#!/usr/bin/env python3
"""Translate two private build records into the required immutable proof CLI."""
import argparse
import json
from pathlib import Path
import subprocess
import sys

ROOT = Path(__file__).resolve().parents[1]
parser = argparse.ArgumentParser(description=__doc__)
parser.add_argument('--baseline-build-manifest', required=True, type=Path)
parser.add_argument('--candidate-build-manifest', required=True, type=Path)
parser.add_argument('--interrupt', action='store_true')
parser.add_argument('--proof-pair', choices=('boot3-boot4', 'boot4-java25'), default='boot3-boot4')
args = parser.parse_args()
command = [sys.executable, str(ROOT / ('tests/lifecycle/boot4-upgrade-interrupt.py' if args.interrupt else 'scripts/verify-boot4-upgrade.py'))]
command += ['--proof-pair', args.proof_pair]
for name in ('baseline', 'candidate'):
    path = getattr(args, name + '_build_manifest')
    data = json.loads(path.read_text())
    for flag, field in [('jar', 'jar'), ('sha', 'source_sha'), ('jar-sha256', 'jar_sha256')]:
        command += ['--' + name + '-' + flag, data[field]]
    command += ['--' + name + '-build-manifest', str(path)]
subprocess.run(command, cwd=ROOT, check=True)
