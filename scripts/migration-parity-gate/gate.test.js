const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const crypto = require('node:crypto');
const zlib = require('node:zlib');
const { spawnSync } = require('node:child_process');
const { evaluate, evaluateRun, summary, rejectionCode } = require('./index');
const fixture = require('./fixtures/scenarios.json');
const hash = data => crypto.createHash('sha256').update(data).digest('hex');
function sample(root='/synthetic/repository') {
  const run='1000000-123'; const startedAt=1000000; const finishedAt=1100000;
  const testedHead='a'.repeat(40); const files=[{path:'synthetic-input',sha256:hash('source')},
    ...structuredClone(fixture.assertionSources)].sort((a,b)=>a.path.localeCompare(b.path));
  const sourceDigest=hash(JSON.stringify(files));
  const context={root,run,startedAt,finishedAt,testedHead,sourceDigest};
  const output=path.join(root,'.tools/migration-parity/runs',run);
  const source={baseline:'03ce2f38d3099e9ccd7dd09a430e023e9f4ce0d0',testedHead,productSourceUnchanged:true,
    sourceDigest,trackedDiffSha256:hash('diff'),files};
  const specs=fixture.cases.map((c,i)=>{
    const failed=c.status==='failed';
    const result={retry:0,annotations:[],errors:[],status:c.status,startTime:new Date(1000100+i*100).toISOString(),duration:50};
    if(failed){
      const location={file:path.join(root,'tests/browser/migration-parity/specs',c.failure.assertion.file),
        line:c.failure.assertion.line,column:c.failure.assertion.column};
      const message=c.failure.messageHeader.replaceAll('<owned-port>','27747')+'\n\nCall log:\n  - synthetic diagnostic\n';
      result.error={location,snippet:c.failure.assertion.snippet,message};
      result.errorLocation=location;
      result.errors=[{location,message:message+'\n'+c.failure.assertion.snippet}];
    }
    return {title:c.title,file:c.file,line:c.line,column:c.column,id:`scenario-${i}`,tags:[],ok:!failed,
      tests:[{projectId:'chromium',projectName:'chromium',expectedStatus:'passed',timeout:45000,annotations:[],
        status:failed?'unexpected':'expected',results:[result]}]};
  });
  const report={config:{version:'1.63.0',workers:1,forbidOnly:true,fullyParallel:false,shard:null,maxFailures:0,
    globalTimeout:300000,grep:{},grepInvert:null,rootDir:path.join(root,'tests/browser/migration-parity/specs'),
    configFile:path.join(root,'playwright.parity.config.js'),globalSetup:path.join(root,'tests/browser/migration-parity/harness/build.js'),
    globalTeardown:null,argv:['node',path.join(root,'node_modules/@playwright/test/cli.js'),'test','--config=playwright.parity.config.js'],
    projects:[{name:'chromium',id:'chromium',retries:0,repeatEach:1,outputDir:path.join(output,'results'),
      testDir:path.join(root,'tests/browser/migration-parity/specs'),timeout:45000,testIgnore:[],testMatch:['**/*.@(spec|test).?(c|m)[jt]s?(x)']}],
    reporter:[['line',null],['json',{outputFile:path.join('.tools/migration-parity/runs',run,'results.json')}],['html',{}]]},
    errors:[],stats:{startTime:new Date(1000100).toISOString(),duration:10000,expected:19,unexpected:4,skipped:0,flaky:0},
    suites:[{specs,suites:[]}]};
  const bytes=Buffer.from('synthetic bundle');
  const build={sourceCommit:source.baseline,testedHead,sourceDigest,productSourceUnchanged:true,node:'24.21.0',react:'18.3.1',projectVersion:'2.1.1',
    files:[{name:'main.synthetic.js',bytes:bytes.length,gzipBytes:zlib.gzipSync(bytes).length,sha256:hash(bytes)}]};
  const evidence={report,before:source,after:{...structuredClone(source),unchanged:true,exitStatus:1},build,
    invocation:{run,output,startedAt,finishedAt,preflight:'pass',controlsExitStatus:0,rawRunnerExitStatus:1,rawRunnerSignal:null,rawRunnerError:null}};
  return {context,evidence,bytes};
}
const specs = e => e.report.suites[0].specs;
const failed = e => specs(e)[0].tests[0].results[0];
function makePass(spec) {
  spec.ok=true; const t=spec.tests[0];t.status='expected';
  const r=t.results[0];r.status='passed';r.errors=[];delete r.error;delete r.errorLocation;
}
test('recorded four failures: raw FAIL remains separate from gate PASS',()=>{
  const {evidence,context}=sample();const result=evaluate(evidence,context);
  assert.equal(result.gate,'pass');assert.equal(result.rawSuite,'fail');assert.equal(result.rawRunnerExitStatus,1);
  assert.equal(result.sourceAfterExitStatus,1);assert.equal(result.passed,19);assert.equal(result.failed,4);
  assert.deepEqual(result.knownFailures,['P0-DRAW-mouse','P0-DRAW-touch','P0-FOCUS','P0-ACCOUNT-READ']);
  const text=summary(result);assert.match(text,/product failures remain unresolved/);assert.doesNotMatch(text,/27747|synthetic diagnostic|Call log/);
});
test('all pass explicitly reports all four positive improvements',()=>{
  const {evidence:e,context}=sample();specs(e).forEach(makePass);e.report.stats.expected=23;e.report.stats.unexpected=0;
  e.invocation.rawRunnerExitStatus=0;e.after.exitStatus=0;
  const result=evaluate(e,context);assert.equal(result.rawSuite,'pass');assert.equal(result.improvements.length,4);
  assert.match(summary(result),/P0-FOCUS: improvement: passed/);
});
test('one known-case improvement passes and remains explicit',()=>{
  const {evidence:e,context}=sample();makePass(specs(e)[0]);e.report.stats.expected++;e.report.stats.unexpected--;
  assert.deepEqual(evaluate(e,context).improvements,['P0-DRAW-mouse']);
});
const rejects={
  'new failure in passing case':e=>{const t=specs(e)[2].tests[0];t.results[0].status='failed';t.status='unexpected';specs(e)[2].ok=false;},
  'different failure in known case':e=>{failed(e).error.message='Error: expect different assertion';},
  'same known assertion with different received value':e=>{failed(e).error.message=failed(e).error.message.replace('Received: 1','Received: 2');},
  'earlier assertion in known case':e=>{failed(e).error.location={...failed(e).error.location,line:49};},
  'wrong assertion file':e=>{failed(e).error.location={...failed(e).error.location,file:'/other/handwriting.spec.js'};},
  'wrong assertion column':e=>{failed(e).error.location={...failed(e).error.location,column:1};},
  'wrong assertion snippet':e=>{failed(e).error.snippet=failed(e).error.snippet.replace('toHaveCount(0)','toHaveCount(1)');},
  'secondary new error':e=>{failed(e).errors.push({message:'new teardown failure'});},
  'missing case':e=>{specs(e).pop();},
  'extra case':e=>{specs(e).push(structuredClone(specs(e)[0]));},
  'duplicate case replacing required case':e=>{specs(e)[1]=structuredClone(specs(e)[0]);},
  'unknown case':e=>{specs(e)[1].title='P0-UNKNOWN';},
  'changed case file':e=>{specs(e)[1].file='other.spec.js';},
  'duplicate report ID':e=>{specs(e)[1].id=specs(e)[0].id;},
  'skipped result':e=>{failed(e).status='skipped';},
  'skipped stats':e=>{e.report.stats.skipped=1;},
  'timed out result':e=>{failed(e).status='timedOut';},
  'interrupted result':e=>{failed(e).status='interrupted';},
  'retried result':e=>{failed(e).retry=1;},
  'multiple attempts':e=>{specs(e)[0].tests[0].results.push(structuredClone(failed(e)));},
  'flaky case':e=>{specs(e)[0].tests[0].status='flaky';},
  'flaky aggregate':e=>{e.report.stats.flaky=1;},
  'expected failure annotation':e=>{specs(e)[0].tests[0].expectedStatus='failed';},
  'skip annotation':e=>{specs(e)[0].tests[0].annotations=[{type:'skip'}];},
  'global error':e=>{e.report.errors=[{message:'build failed'}];},
  'raw exit mismatch':e=>{e.invocation.rawRunnerExitStatus=0;},
  'source-after exit mismatch':e=>{e.after.exitStatus=0;},
  'raw process failure':e=>{e.invocation.rawRunnerExitStatus=2;},
  'raw signal':e=>{e.invocation.rawRunnerSignal='SIGTERM';},
  'raw process error':e=>{e.invocation.rawRunnerError='ETIMEDOUT';},
  'controls failure':e=>{e.invocation.controlsExitStatus=1;},
  'preflight failure':e=>{e.invocation.preflight='fail';},
  'missing provenance':e=>{delete e.before;},
  'bad provenance digest':e=>{e.before.sourceDigest='0'.repeat(64);},
  'missing source file digest':e=>{e.before.files[0].sha256=null;},
  'source drift':e=>{e.after.unchanged=false;},
  'source after different files':e=>{e.after.files[0].sha256='1'.repeat(64);},
  'wrong tested head':e=>{e.after.testedHead='b'.repeat(40);},
  'product changed':e=>{e.after.productSourceUnchanged=false;},
  'missing build':e=>{delete e.build;},
  'wrong build source':e=>{e.build.sourceCommit='b'.repeat(40);},
  'build digest mismatch':e=>{e.build.sourceDigest='0'.repeat(64);},
  'empty build files':e=>{e.build.files=[];},
  'invalid bundle path':e=>{e.build.files[0].name='../escape.js';},
  'project added':e=>{e.report.config.projects.push(structuredClone(e.report.config.projects[0]));},
  'project renamed':e=>{e.report.config.projects[0].name='firefox';},
  'case project changed':e=>{specs(e)[0].tests[0].projectId='firefox';},
  'configured retries':e=>{e.report.config.projects[0].retries=1;},
  'CLI filter':e=>{e.report.config.argv.push('--grep=FOCUS');},
  'configured grep':e=>{e.report.config.grep={source:'FOCUS'};},
  'configured shard':e=>{e.report.config.shard={current:1,total:2};},
  'wrong output':e=>{e.report.config.projects[0].outputDir='/old/results';},
  'wrong reporter output':e=>{e.report.config.reporter[1][1].outputFile='old/results.json';},
  'old run identity':e=>{e.invocation.run='999999-123';},
  'stale report':e=>{e.report.stats.startTime=new Date(999999).toISOString();},
  'incomplete report duration':e=>{e.report.stats.duration=200000;},
  'aggregate mismatch':e=>{e.report.stats.expected=20;},
  'missing suites':e=>{delete e.report.suites;},
  'missing result errors':e=>{delete failed(e).errors;},
  'unowned localhost port':e=>{failed(e).error.message=failed(e).error.message.replace('27747','52655');const r=specs(e)[8].tests[0].results[0];r.error.message=r.error.message.replace('27747','52655');}
};
for(const [name,mutate] of Object.entries(rejects)) test(`reject ${name}`,()=>{
  const {evidence,context}=sample();mutate(evidence);assert.throws(()=>evaluate(evidence,context));
});
function onDisk() {
  const root=fs.mkdtempSync(path.join(os.tmpdir(),'parity-gate-test-'));
  const {evidence,context,bytes}=sample(root);
  const output=evidence.invocation.output;fs.mkdirSync(path.join(output,'build/js'),{recursive:true});
  for(const [name,value] of Object.entries({'results.json':evidence.report,'source-before.json':evidence.before,
    'source-after.json':evidence.after,'build/bundle-manifest.json':evidence.build,'invocation.json':evidence.invocation}))
    fs.writeFileSync(path.join(output,name),JSON.stringify(value));
  fs.writeFileSync(path.join(output,'build/js/main.synthetic.js'),bytes);
  fs.utimesSync(path.join(output,'results.json'),1050,1050);
  return {root,context,output};
}
test('exact run reader verifies complete report and actual bundle bytes',()=>{
  const {root,context}=onDisk();try {assert.equal(evaluateRun(context).gate,'pass');} finally {fs.rmSync(root,{recursive:true,force:true});}
});
for(const [name,mutate] of Object.entries({
  'missing current report despite sibling report':o=>{fs.copyFileSync(path.join(o,'results.json'),path.join(o,'../old-results.json'));fs.unlinkSync(path.join(o,'results.json'));},
  'truncated current report':o=>fs.writeFileSync(path.join(o,'results.json'),'{"config":'),
  'stale current report file':o=>fs.utimesSync(path.join(o,'results.json'),900,900),
  'missing source after':o=>fs.unlinkSync(path.join(o,'source-after.json')),
  'malformed build manifest':o=>fs.writeFileSync(path.join(o,'build/bundle-manifest.json'),'null'),
  'missing build bundle':o=>fs.unlinkSync(path.join(o,'build/js/main.synthetic.js')),
  'corrupt build bundle':o=>fs.writeFileSync(path.join(o,'build/js/main.synthetic.js'),'corrupt'),
  'symlink report':o=>{fs.renameSync(path.join(o,'results.json'),path.join(o,'other.json'));fs.symlinkSync('other.json',path.join(o,'results.json'));}
})) test(`reader rejects ${name}`,()=>{
  const {root,context,output}=onDisk();try {mutate(output);assert.throws(()=>evaluateRun(context));} finally {fs.rmSync(root,{recursive:true,force:true});}
});
test('baseline command rejects extra CLI arguments before preflight/browser execution',()=>{
  for(const args of [['--baseline','--grep=FOCUS'],['--baseline','--retries=1'],['--baseline','--project=chromium'],['--list','--baseline']]){
    const p=spawnSync(process.execPath,[path.join(__dirname,'../run-migration-parity.js'),...args],{encoding:'utf8'});
    assert.equal(p.status,1);assert.match(p.stderr,/Baseline mode accepts no/);assert.doesNotMatch(p.stdout,/Parity evidence/);
  }
});

test('Playwright leaf suite may omit empty child suites',()=>{
  const {evidence,context}=sample();delete evidence.report.suites[0].suites;
  assert.equal(evaluate(evidence,context).gate,'pass');
});

test('changed scenario assertion source rejected even with consistent recomputed provenance',()=>{
  const {evidence:e,context}=sample();e.before.files[1].sha256='f'.repeat(64);
  e.before.sourceDigest=hash(JSON.stringify(e.before.files));context.sourceDigest=e.before.sourceDigest;
  e.after={...structuredClone(e.before),unchanged:true,exitStatus:1};e.build.sourceDigest=e.before.sourceDigest;
  assert.throws(()=>evaluate(e,context),/Scenario assertion source changed/);
});
// Execute the real runner with synthetic process boundaries: no browser, build,
// dependency installation or repository mutation. This checks exit wiring too.
function runnerControl({baseline=true,controls=0,raw=1,signal=null,processError=null,omitReport=false,preflightFail=false,drift=false,afterSnapshotFail=false,mutateEvidence=()=>{},gateFault}={}) {
  const vm=require('node:vm');
  const root=fs.mkdtempSync(path.join(os.tmpdir(),'parity-runner-control-'));
  const messages=[];
  const original=sample(root);let ticks=2000000,snapshots=0,children=0,output;
  class Clock extends Date {static now(){return ticks+=1000;}}
  const fakeProcess={argv:['node','runner',...(baseline?['--baseline']:[])],pid:321,execPath:process.execPath,
    env:{GITHUB_STEP_SUMMARY:path.join(root,'summary.md')},umask(){},exitCode:undefined,exit(code){this.exitCode=code;throw new Error('synthetic-exit');}};
  const child={spawnSync(){
    children++;
    if(children===1)return {status:controls,signal:null};
    output=fs.readdirSync(path.join(root,'.tools/migration-parity/runs'))[0];
    const runDir=path.join(root,'.tools/migration-parity/runs',output);
    const s=sample(root);const e=s.evidence;
    e.report.config.projects[0].outputDir=path.join(runDir,'results');
    e.report.config.reporter[1][1].outputFile=path.join('.tools/migration-parity/runs',output,'results.json');
    e.report.stats.startTime=new Date(ticks+100).toISOString();e.report.stats.duration=500;
    specs(e).forEach((spec,i)=>{const result=spec.tests[0].results[0];result.startTime=new Date(ticks+100+i).toISOString();result.duration=1;});
    mutateEvidence(e);
    fs.mkdirSync(path.join(runDir,'build/js'),{recursive:true});
    fs.writeFileSync(path.join(runDir,'build/bundle-manifest.json'),JSON.stringify(e.build));
    fs.writeFileSync(path.join(runDir,'build/js/main.synthetic.js'),s.bytes);
    if(!omitReport){fs.writeFileSync(path.join(runDir,'results.json'),JSON.stringify(e.report));fs.utimesSync(path.join(runDir,'results.json'),(ticks+600)/1000,(ticks+600)/1000);}
    // A complete sibling report must never rescue a failed current invocation.
    fs.writeFileSync(path.join(root,'.tools/migration-parity/runs','old-results.json'),JSON.stringify(e.report));
    return {status:raw,signal,error:processError};
  }};
  const loader=name=>{
    if(name==='node:child_process')return child;
    if(name==='../tests/browser/migration-parity/harness/provenance')return {root,snapshot(){
      snapshots++;if(afterSnapshotFail&&snapshots>1)throw new Error('snapshot-failed');const s=structuredClone(original.evidence.before);
      if(drift&&snapshots>1)s.sourceDigest='f'.repeat(64);return s;
    }};
    if(name==='./preflight'){if(preflightFail)throw new Error('synthetic-preflight');return {};}
    if(name==='./migration-parity-gate'){
      const gate=require('./index');
      return gateFault ? {...gate,evaluateRun(){throw gateFault;}} : gate;
    }
    return require(name);
  };
  loader.resolve=()=>path.join(root,'node_modules/@playwright/test/cli.js');
  try {
    try {vm.runInNewContext(fs.readFileSync(path.join(__dirname,'../run-migration-parity.js'),'utf8'),
      {require:loader,process:fakeProcess,Date:Clock,console:{log(m){messages.push(m);},error(m){messages.push(m);}}});}
    catch(error){assert.match(error.message,/synthetic-exit|synthetic-preflight/);}
    const result={exit:fakeProcess.exitCode,children,messages:messages.join('\n'),
      summary:fs.existsSync(path.join(root,'summary.md')) ? fs.readFileSync(path.join(root,'summary.md'),'utf8') : ''};
    if(output){
      const runDir=path.join(root,'.tools/migration-parity/runs',output);
      result.after=JSON.parse(fs.readFileSync(path.join(runDir,'source-after.json')));
      if(baseline)result.gate=JSON.parse(fs.readFileSync(path.join(runDir,'gate-result.json')));
    }
    return result;
  } finally {fs.rmSync(root,{recursive:true,force:true});}
}
test('runner baseline permits only recorded failures and preserves source-after raw exit',()=>{
  const r=runnerControl();assert.equal(r.exit,0);assert.equal(r.gate.gate,'pass');assert.equal(r.after.exitStatus,1);
});
test('original raw runner command still exits 1 for the same four failures',()=>{
  const r=runnerControl({baseline:false});assert.equal(r.exit,1);assert.equal(r.after.exitStatus,1);
});
test('runner stops after failed controls without launching browser',()=>{
  const r=runnerControl({controls:1});assert.equal(r.exit,1);assert.equal(r.children,1);
});
test('runner stops on preflight failure before controls/browser',()=>{
  const r=runnerControl({preflightFail:true});assert.equal(r.children,0);
});
for(const [name,options] of Object.entries({
  'build failure with only an older sibling report':{omitReport:true},
  'runner signal despite complete report':{signal:'SIGTERM'},
  'runner process failure despite complete report':{raw:2},
  'runner timeout despite complete report':{processError:{code:'ETIMEDOUT'}},
  'source drift despite complete report':{drift:true},
  'failed after-snapshot despite complete report':{afterSnapshotFail:true},
  'null runner status with signal despite complete report':{raw:null,signal:'SIGTERM'}
})) test(`runner rejects ${name}`,()=>{
  const r=runnerControl(options);assert.equal(r.exit,1);assert.equal(r.gate.gate,'fail');
});

// Generate frames through the installed pinned Playwright implementation, with
// the same options as runner.addLocationAndSnippetToError. No test execution.
function playwrightFrames({color,ci=true}) {
  const env={...process.env,CI:ci?'1':'',FORCE_COLOR:color?'1':'0'};
  delete env.NO_COLOR;
  const child=spawnSync(process.execPath,['-e',`
    const fs=require('node:fs'),path=require('node:path');
    const babel=require('./node_modules/playwright/lib/transform/babelBundle');
    const fixture=require('./scripts/migration-parity-gate/fixtures/scenarios.json');
    const frames=fixture.cases.filter(c=>c.failure).map(c=>{
      const f=c.failure.assertion;
      return babel.codeFrameColumns(fs.readFileSync(path.join('tests/browser/migration-parity/specs',f.file),'utf8'),
        {start:{line:f.line,column:f.column}},{highlightCode:true});
    });
    process.stdout.write(JSON.stringify(frames));
  `],{cwd:path.join(__dirname,'../..'),env,encoding:'utf8'});
  assert.equal(child.status,0,child.stderr);
  return JSON.parse(child.stdout);
}
const coloredFrames=playwrightFrames({color:true});
const plainFrames=playwrightFrames({color:false,ci:false});
function applyFrames(e,frames) {
  specs(e).filter(s=>s.tests[0].results[0].status==='failed').forEach((s,i)=>{
    s.tests[0].results[0].error.snippet=frames[i];
  });
}
for(const root of ['/home/runner/work/gakusei/gakusei','/Users/synthetic/check out']) {
  for(const [name,frames] of [['CI colored',coloredFrames],['local plain',plainFrames]]) {
    test(`${name} installed Playwright frames preserve exact fingerprints at ${root}`,()=>{
      const {evidence,context}=sample(root);applyFrames(evidence,frames);
      frames.forEach((frame,i)=>{
        assert.equal(/\x1b\[/.test(frame),name==='CI colored');
        assert.equal(frame.replace(/\x1b\[[0-9;]*m/g,''),plainFrames[i]);
      });
      const result=evaluate(evidence,context);
      assert.equal(result.gate,'pass');assert.equal(result.rawSuite,'fail');assert.equal(result.failed,4);
    });
  }
}
for(const [name,mutate,code] of [
  ['colored changed source',e=>{failed(e).error.snippet=failed(e).error.snippet.replace('toHaveCount','toHaveText');},'ASSERTION_SNIPPET_CHANGED'],
  ['colored earlier location',e=>{failed(e).error.location={...failed(e).error.location,line:49};},'ASSERTION_LOCATION_CHANGED'],
  ['colored changed received',e=>{failed(e).error.message=failed(e).error.message.replace('Received: 1','Received: 2');},'ASSERTION_HEADER_CHANGED'],
  ['colored secondary changed received',e=>{failed(e).errors[0].message=failed(e).errors[0].message.replace('Received: 1','Received: 2');},'ASSERTION_HEADER_CHANGED'],
  ['colored additional error',e=>{failed(e).errors.push({message:'private secondary failure'});},'ASSERTION_FAILURE_UNRECORDED'],
  ['non-color terminal escape',e=>{failed(e).error.snippet+='\x1b[2J';},'ASSERTION_SNIPPET_CHANGED'],
  ['missing snippet',e=>{delete failed(e).error.snippet;},'ASSERTION_SNIPPET_CHANGED'],
  ['oversized snippet',e=>{failed(e).error.snippet='x'.repeat(16001);},'ASSERTION_SNIPPET_CHANGED'],
  ['Linux config root drift',e=>{e.report.config.rootDir='/another/root';},'RUNNER_CONFIG_CHANGED'],
  ['Linux CLI path drift',e=>{e.report.config.argv[1]='/another/cli.js';},'RUNNER_CONFIG_CHANGED'],
  ['Linux setup path drift',e=>{e.report.config.globalSetup='/another/build.js';},'RUNNER_CONFIG_CHANGED'],
  ['Linux output run drift',e=>{e.report.config.projects[0].outputDir='/another/results';},'PROJECT_CONFIG_CHANGED']
]) test(`portable gate rejects ${name} with fixed code`,()=>{
  const {evidence,context}=sample('/home/runner/work/gakusei/gakusei');applyFrames(evidence,coloredFrames);mutate(evidence);
  assert.throws(()=>evaluate(evidence,context),error=>rejectionCode(error)===code);
});
test('runner accepts installed CI-colored snippets while retaining raw exit 1',()=>{
  const r=runnerControl({mutateEvidence:e=>applyFrames(e,coloredFrames)});
  assert.equal(r.exit,0);assert.equal(r.gate.gate,'pass');assert.equal(r.after.exitStatus,1);
});
test('runner emits fixed rejection code in JSON, console and GitHub summary',()=>{
  const r=runnerControl({mutateEvidence:e=>{failed(e).error.snippet='private assertion body https://private.example/account';}});
  assert.equal(r.exit,1);assert.equal(r.gate.rejectionCode,'ASSERTION_SNIPPET_CHANGED');
  for(const text of [JSON.stringify(r.gate),r.messages,r.summary]){
    assert.match(text,/ASSERTION_SNIPPET_CHANGED/);assert.doesNotMatch(text,/private assertion|private.example|account/);
  }
});
test('untrusted error text and forged diagnostic codes cannot enter public output',()=>{
  const fault=Object.assign(new Error('private assertion https://secret.example/account'),{code:'PRIVATE_DYNAMIC_CODE'});
  const r=runnerControl({gateFault:fault});
  assert.equal(r.exit,1);assert.equal(r.gate.rejectionCode,'UNEXPECTED_GATE_ERROR');
  for(const text of [JSON.stringify(r.gate),r.messages,r.summary]){
    assert.match(text,/UNEXPECTED_GATE_ERROR/);assert.doesNotMatch(text,/private assertion|secret.example|PRIVATE_DYNAMIC_CODE/);
  }
  for(const error of [fault,null,undefined,'PRIVATE_DYNAMIC_CODE',{code:'ASSERTION_HEADER_CHANGED'}])
    assert.equal(rejectionCode(error),'UNEXPECTED_GATE_ERROR');
});
