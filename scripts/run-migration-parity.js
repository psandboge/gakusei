#!/usr/bin/env node
// Standalone synthetic browser baseline; never accepts a live app origin.
const { spawnSync } = require('node:child_process');
const fs = require('node:fs');
const path = require('node:path');
const {snapshot,root} = require('../tests/browser/migration-parity/harness/provenance');
process.umask(0o077);
require('./preflight');
const run = `${Date.now()}-${process.pid}`;
const output=path.join(root,'.tools/migration-parity/runs',run);
fs.mkdirSync(output,{recursive:true});
const before=snapshot();
fs.writeFileSync(path.join(output,'source-before.json'),JSON.stringify(before,null,2));
console.log(`Parity evidence: .tools/migration-parity/runs/${run}`);
const controls = spawnSync(process.execPath, ['--test', 'tests/browser/migration-parity/harness/server.test.js'], {stdio:'inherit'});
if (controls.status !== 0) process.exit(controls.status || 1);
const result = spawnSync(process.execPath, [require.resolve('@playwright/test/cli'), 'test', '--config=playwright.parity.config.js', ...process.argv.slice(2)], {stdio:'inherit',env:{...process.env,GAKUSEI_PARITY_RUN_ID:run}});
process.exitCode=result.status === null ? 1 : result.status;
const after=snapshot();
const unchanged=before.sourceDigest===after.sourceDigest;
fs.writeFileSync(path.join(output,'source-after.json'),JSON.stringify({...after,unchanged,exitStatus:process.exitCode},null,2));
if(!unchanged){console.error('Frozen parity source changed during verification');process.exitCode=1;}
