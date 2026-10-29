#!/usr/bin/env node
// Standalone synthetic browser baseline; never accepts a live app origin.
const { spawnSync } = require('node:child_process');
const fs = require('node:fs');
const path = require('node:path');
const {snapshot,root} = require('../tests/browser/migration-parity/harness/provenance');
process.umask(0o077);
const args = process.argv.slice(2);
const baselineMode = args[0] === '--baseline';
if (args.includes('--baseline') && (!baselineMode || args.length !== 1)) {
  console.error('Baseline mode accepts no test filters, retries, projects or other arguments');
  process.exit(1);
}
require('./preflight');
const run = `${Date.now()}-${process.pid}`;
const output=path.join(root,'.tools/migration-parity/runs',run);
fs.mkdirSync(path.dirname(output),{recursive:true});
fs.mkdirSync(output); // Exclusive creation: an old report can never be reused.
const before=snapshot();
const startedAt=Date.now();
fs.writeFileSync(path.join(output,'source-before.json'),JSON.stringify(before,null,2));
console.log(`Parity evidence: .tools/migration-parity/runs/${run}`);
const controls = spawnSync(process.execPath, ['--test', 'tests/browser/migration-parity/harness/server.test.js'], {stdio:'inherit'});
if (controls.status !== 0 || controls.signal || controls.error) process.exit(controls.status || 1);
const result = spawnSync(process.execPath, [require.resolve('@playwright/test/cli'), 'test', '--config=playwright.parity.config.js', ...(baselineMode ? [] : args)], {stdio:'inherit',env:{...process.env,GAKUSEI_PARITY_RUN_ID:run},timeout:420000});
const rawExitStatus=result.status === null ? 1 : result.status;
process.exitCode=rawExitStatus;
let after;
try { after=snapshot(); } catch { console.error('Unable to verify parity source after execution'); }
const unchanged=!!after && before.sourceDigest===after.sourceDigest;
fs.writeFileSync(path.join(output,'source-after.json'),JSON.stringify({...after,unchanged,exitStatus:rawExitStatus},null,2));
if(!unchanged){console.error('Frozen parity source changed during verification');process.exitCode=1;}
const finishedAt=Date.now();
const invocation={run,output,startedAt,finishedAt,preflight:'pass',controlsExitStatus:controls.status,
  rawRunnerExitStatus:result.status,rawRunnerSignal:result.signal || null,rawRunnerError:result.error ? result.error.code || 'process-error' : null};
fs.writeFileSync(path.join(output,'invocation.json'),JSON.stringify(invocation,null,2));
if(baselineMode){
  const {evaluateRun,summary}=require('./migration-parity-gate');
  let gate;
  try {
    gate=evaluateRun({root,run,startedAt,finishedAt,testedHead:before.testedHead,sourceDigest:before.sourceDigest});
    process.exitCode=0;
    const message=summary(gate);
    console.log(message);
    if(process.env.GITHUB_STEP_SUMMARY) fs.appendFileSync(process.env.GITHUB_STEP_SUMMARY,message);
  } catch {
    // Never expose raw reports, assertion bodies, origins, ledgers or traces in CI summaries.
    gate={schemaVersion:1,gate:'fail',rawRunnerExitStatus:result.status,sourceAfterExitStatus:rawExitStatus,
      reason:'Evidence invalid, incomplete, changed, or contains a new regression. Inspect private runner evidence.'};
    process.exitCode=1;
    const message=`### Synthetic parity baseline gate\nGate: **FAIL**. Raw runner exit: ${result.status}; source-after exit: ${rawExitStatus}.\nEvidence rejected or new regression; no product acceptance.\n`;
    console.error(message);
    if(process.env.GITHUB_STEP_SUMMARY) fs.appendFileSync(process.env.GITHUB_STEP_SUMMARY,message);
  }
  fs.writeFileSync(path.join(output,'gate-result.json'),JSON.stringify(gate,null,2));
}
