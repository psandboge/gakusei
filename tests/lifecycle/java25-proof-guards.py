#!/usr/bin/env python3
"""Public CLI refusal cases against genuine independent package manifests."""
import argparse
import copy
import json
from pathlib import Path
import subprocess
import sys
import tempfile

ROOT = Path.cwd()
def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--proof-pair', required=True, choices=('boot3-boot4','boot4-java25'))
    parser.add_argument('--baseline-build-manifest', required=True, type=Path)
    parser.add_argument('--candidate-build-manifest', required=True, type=Path)
    args = parser.parse_args()
    original=json.loads(args.candidate_build_manifest.read_text())
    assert Path(original['checkout']) == ROOT and not subprocess.check_output(
        ['git','status','--porcelain','--untracked-files=no'],text=True).strip()
    snapshots = set((ROOT/'.tools/browser-tests').glob('*/ownership.json'))
    with tempfile.TemporaryDirectory(dir=ROOT/'.tools') as directory:
        path=Path(directory)/'candidate.json'
        def refused(label, record=original, pair=args.proof_pair, missing=False):
            path.write_text(json.dumps(record))
            path.chmod(0o600)
            command=[sys.executable,str(ROOT/'scripts/run-boot4-proof.py'),
                     '--proof-pair',pair,'--baseline-build-manifest',str(args.baseline_build_manifest),
                     '--candidate-build-manifest',str(path if not missing else path.with_name('missing.json'))]
            result=subprocess.run(command,cwd=ROOT,capture_output=True,text=True,timeout=60)
            assert result.returncode != 0 and 'OWNERSHIP=' not in result.stdout, 'Guard allocated: '+label
            assert set((ROOT/'.tools/browser-tests').glob('*/ownership.json')) == snapshots, 'Guard left an owned record'
            print('PASS public refusal before allocation: '+label,flush=True)
        refused('wrong pair',pair='boot4-java25' if args.proof_pair=='boot3-boot4' else 'boot3-boot4')
        refused('missing provenance',missing=True)
        mutations=[
            ('historical v1 schema',('schema',),'gakusei.upgrade-build.v1'),
            ('wrong compiler release',('maven','compiler_release'),17),
            ('mixed Maven plugin',('maven','plugins','maven-compiler-plugin'),'0.0.0'),
            ('tampered effective compiler evidence',('maven','effective_pom_sha256'),'0'*64),
            ('wrong JDK major',('jdk','major'),17),
            ('wrong launcher',('jdk','java'),'/unverified/java'),
            ('tampered executable digest',('jdk','executables','java'),'0'*64),
            ('tampered receipt',('jdk','receipt_sha256'),'0'*64),
            ('wrong application class version',('classes','versions'),[dict(major=61,minor=0)]),
            ('stale jar digest',('jar_sha256',),'0'*64),
            ('stale source identity',('source_sha',),'0'*40),
            ('failed package exit',('build_exit',),1),
            ('unclean build source',('tracked_source_clean',),False)]
        for label,keys,value in mutations:
            record=copy.deepcopy(original)
            current=record
            for key in keys[:-1]: current=current[key]
            current[keys[-1]]=value
            refused(label,record)
        pom=ROOT/'pom.xml'
        contents=pom.read_bytes()
        try:
            pom.write_bytes(contents+b'\n')
            refused('actually dirty tracked checkout')
        finally:
            pom.write_bytes(contents)
    print('PASS '+args.proof_pair+' genuine-manifest public guard suite')
if __name__=='__main__':
    main()
