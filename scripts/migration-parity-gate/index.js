const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const manifest = require('./baseline.json');
const hash = data => crypto.createHash('sha256').update(data).digest('hex');
const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);
const digest = value => typeof value === 'string' && /^[a-f0-9]{64}$/.test(value);
const commit = value => typeof value === 'string' && /^[a-f0-9]{40}$/.test(value);
const finite = value => typeof value === 'number' && Number.isFinite(value) && value >= 0;
const check = (condition, reason) => { if (!condition) throw new Error(reason); };
const specRoot = 'tests/browser/migration-parity/specs';
const clean = value => value.replace(/\x1b\[[0-9;]*m/g, '');
function header(message) {
  check(typeof message === 'string' && message.length <= 16000, 'Invalid assertion message');
  return clean(message).split('\n\nCall log:\n')[0].replace(/http:\/\/127\.0\.0\.1:(\d+)/g, (url, digits) => {
    const port = Number(digits);
    check(port >= 20000 && port < 65000 && ![52655,62508,62721].includes(port), 'Non-owned assertion origin');
    return 'http://127.0.0.1:<owned-port>';
  });
}
function locationMatches(location, expected, root) {
  return location && location.file === path.join(root, specRoot, expected.file) &&
    location.line === expected.line && location.column === expected.column;
}
function knownFailure(result, expected, root) {
  const error = result.error;
  const failure = expected.knownFailure;
  return error && failure && result.errors.length === 1 &&
    locationMatches(error.location, failure.assertion, root) &&
    locationMatches(result.errorLocation, failure.assertion, root) &&
    locationMatches(result.errors[0].location, failure.assertion, root) &&
    error.snippet === failure.assertion.snippet &&
    header(error.message) === failure.messageHeader &&
    header(result.errors[0].message) === failure.messageHeader;
}
function collect(suites) {
  check(Array.isArray(suites), 'Missing suite collection');
  return suites.flatMap(suite => {
    check(suite && (Array.isArray(suite.specs) || Array.isArray(suite.suites)) &&
      (suite.specs === undefined || Array.isArray(suite.specs)) &&
      (suite.suites === undefined || Array.isArray(suite.suites)), 'Malformed suite collection');
    return [...(suite.specs || []), ...collect(suite.suites || [])];
  });
}
function validateSource(source, context) {
  check(source && source.baseline === manifest.baselineCommit && source.testedHead === context.testedHead &&
    commit(source.testedHead) && source.productSourceUnchanged === true &&
    digest(source.sourceDigest) && digest(source.trackedDiffSha256) && Array.isArray(source.files) && source.files.length > 0,
  'Invalid source provenance');
  const names = source.files.map(file => {
    check(file && typeof file.path === 'string' && file.path.length > 0 && !path.isAbsolute(file.path) &&
      !file.path.split('/').includes('..') && digest(file.sha256), 'Invalid source file provenance');
    return file.path;
  });
  check(new Set(names).size === names.length && same(names, [...names].sort()) &&
    hash(JSON.stringify(source.files)) === source.sourceDigest && source.sourceDigest === context.sourceDigest,
  'Source digest mismatch');
  for (const expected of manifest.assertionSources) {
    check(source.files.some(file => file.path === expected.path && file.sha256 === expected.sha256),
      'Scenario assertion source changed');
  }
}
function evaluate(evidence, context) {
  const { report, before, after, build, invocation } = evidence;
  const output = path.join(context.root, '.tools/migration-parity/runs', context.run);
  check(/^\d+-\d+$/.test(context.run) && path.isAbsolute(context.root), 'Invalid invocation identity');
  check(invocation && invocation.run === context.run && invocation.output === output &&
    invocation.startedAt === context.startedAt && invocation.finishedAt === context.finishedAt &&
    finite(context.startedAt) && finite(context.finishedAt) && context.finishedAt > context.startedAt &&
    invocation.preflight === 'pass' && invocation.controlsExitStatus === 0 &&
    invocation.rawRunnerSignal === null && invocation.rawRunnerError === null &&
    [0,1].includes(invocation.rawRunnerExitStatus), 'Incomplete or failed runner invocation');
  validateSource(before, context); validateSource(after, context);
  check(after.unchanged === true && after.exitStatus === invocation.rawRunnerExitStatus &&
    before.sourceDigest === after.sourceDigest && before.trackedDiffSha256 === after.trackedDiffSha256 &&
    same(before.files, after.files), 'Source drift or raw exit mismatch');
  check(build && build.sourceCommit === manifest.baselineCommit && build.testedHead === context.testedHead &&
    build.sourceDigest === before.sourceDigest && build.productSourceUnchanged === true &&
    build.node === '24.21.0' && build.react === '18.3.1' && build.projectVersion === '2.1.1' &&
    Array.isArray(build.files) && build.files.length > 0, 'Invalid build provenance');
  const bundleNames = new Set();
  for (const file of build.files) {
    check(file && typeof file.name === 'string' && /^[\w.-]+\.js$/.test(file.name) && !bundleNames.has(file.name) &&
      digest(file.sha256) && Number.isInteger(file.bytes) && file.bytes > 0 &&
      Number.isInteger(file.gzipBytes) && file.gzipBytes > 0, 'Invalid bundle manifest');
    bundleNames.add(file.name);
  }
  const config = report && report.config;
  check(config && config.version === manifest.playwrightVersion && config.workers === 1 &&
    config.forbidOnly === true && config.fullyParallel === false && config.shard === null &&
    config.maxFailures === 0 && config.globalTimeout === 300000 && same(config.grep, {}) && config.grepInvert === null &&
    config.rootDir === path.join(context.root, specRoot) &&
    config.configFile === path.join(context.root, 'playwright.parity.config.js') &&
    config.globalSetup === path.join(context.root, 'tests/browser/migration-parity/harness/build.js') &&
    config.globalTeardown === null &&
    Array.isArray(config.argv) && config.argv.length === 4 &&
    config.argv[1] === path.join(context.root, 'node_modules/@playwright/test/cli.js') &&
    same(config.argv.slice(2), ['test','--config=playwright.parity.config.js']), 'Changed runner configuration or CLI filters');
  check(Array.isArray(config.projects) && config.projects.length === 1, 'Changed project collection');
  const project = config.projects[0];
  check(project.name === manifest.project && project.id === manifest.project && project.retries === 0 &&
    project.repeatEach === 1 && project.outputDir === path.join(output, 'results') &&
    project.testDir === config.rootDir && project.timeout === 45000 && same(project.testIgnore, []) &&
    same(project.testMatch, ['**/*.@(spec|test).?(c|m)[jt]s?(x)']), 'Changed project configuration');
  check(Array.isArray(config.reporter) && config.reporter.length === 3 && config.reporter[1][0] === 'json' &&
    config.reporter[1][1].outputFile === path.join('.tools/migration-parity/runs', context.run, 'results.json'),
  'Report belongs to a different run');
  check(Array.isArray(report.errors) && report.errors.length === 0, 'Global runner errors');
  const stats = report.stats;
  const start = stats && Date.parse(stats.startTime);
  check(Number.isFinite(start) && start >= context.startedAt && start <= context.finishedAt && finite(stats.duration) &&
    start + stats.duration <= context.finishedAt + 1 && stats.duration > 0, 'Stale or incomplete report time window');
  check(stats.skipped === 0 && stats.flaky === 0, 'Skipped or flaky report');
  const specs = collect(report.suites);
  check(specs.length === manifest.cases.length, 'Missing or extra scenarios');
  const seen = new Set(); const seenIds = new Set();
  let passed = 0; let failed = 0;
  const knownFailures = []; const improvements = [];
  for (const spec of specs) {
    const expected = manifest.cases.find(c => c.title === spec.title && c.file === spec.file);
    check(expected && !seen.has(expected.caseId) && typeof spec.id === 'string' && spec.id.length > 0 &&
      !seenIds.has(spec.id) && spec.line === expected.line && spec.column === expected.column &&
      same(spec.tags, []), 'Unknown, duplicate or changed scenario identity');
    seen.add(expected.caseId); seenIds.add(spec.id);
    check(Array.isArray(spec.tests) && spec.tests.length === 1, 'Changed scenario projects');
    const test = spec.tests[0];
    check(test.projectId === manifest.project && test.projectName === manifest.project &&
      test.expectedStatus === 'passed' && test.timeout === 45000 && same(test.annotations, []) &&
      Array.isArray(test.results) && test.results.length === 1, 'Retries, skips or changed expectations');
    const result = test.results[0];
    const testStart = Date.parse(result.startTime);
    check(result.retry === 0 && same(result.annotations, []) && Array.isArray(result.errors) &&
      finite(result.duration) && Number.isFinite(testStart) && testStart >= start &&
      testStart + result.duration <= context.finishedAt + 1, 'Invalid scenario execution evidence');
    if (result.status === 'passed') {
      check(test.status === 'expected' && spec.ok === true && result.errors.length === 0 && !result.error &&
        !result.errorLocation, 'Inconsistent passing result');
      passed++;
      if (expected.knownFailure) improvements.push(expected.caseId);
    } else {
      check(result.status === 'failed' && test.status === 'unexpected' && spec.ok === false,
        'Timed out, interrupted, skipped or flaky scenario');
      check(knownFailure(result, expected, context.root), `New failure: ${expected.caseId}`);
      failed++; knownFailures.push(expected.caseId);
    }
  }
  check(stats.expected === passed && stats.unexpected === failed &&
    invocation.rawRunnerExitStatus === (failed ? 1 : 0), 'Raw runner exit or aggregate count mismatch');
  return { schemaVersion:1, gate:'pass', meaning:'No new regressions; known product failures are not fixes or product acceptance.',
    rawSuite: failed ? 'fail' : 'pass', rawRunnerExitStatus:invocation.rawRunnerExitStatus,
    sourceAfterExitStatus:after.exitStatus, cases:specs.length, passed, failed, knownFailures, improvements };
}
function readJson(file) {
  const stat = fs.lstatSync(file);
  check(stat.isFile() && !stat.isSymbolicLink() && stat.size > 0 && stat.size <= 16 * 1024 * 1024, 'Invalid evidence file');
  return JSON.parse(fs.readFileSync(file, 'utf8'));
}
// No discovery, globbing, last-report selection or standalone CLI. The runner owns context.
function evaluateRun(context) {
  const output = path.join(context.root, '.tools/migration-parity/runs', context.run);
  check(fs.lstatSync(output).isDirectory() && !fs.lstatSync(output).isSymbolicLink(), 'Invalid run directory');
  const reportPath = path.join(output, 'results.json');
  const reportTime = fs.statSync(reportPath).mtimeMs;
  check(reportTime >= context.startedAt && reportTime <= context.finishedAt + 1, 'Stale report file');
  const evidence = { report:readJson(reportPath), before:readJson(path.join(output,'source-before.json')),
    after:readJson(path.join(output,'source-after.json')), build:readJson(path.join(output,'build/bundle-manifest.json')),
    invocation:readJson(path.join(output,'invocation.json')) };
  for (const file of evidence.build.files || []) {
    check(typeof file.name === 'string' && /^[\w.-]+\.js$/.test(file.name), 'Unsafe bundle path');
    const bundle = path.join(output,'build/js',file.name);
    check(fs.lstatSync(bundle).isFile() && !fs.lstatSync(bundle).isSymbolicLink(), 'Missing build bundle');
    const bytes = fs.readFileSync(bundle);
    check(bytes.length === file.bytes && hash(bytes) === file.sha256 &&
      require('node:zlib').gzipSync(bytes).length === file.gzipBytes, 'Build bundle digest mismatch');
  }
  return evaluate(evidence, context);
}
function summary(result) {
  const lines = ['### Synthetic parity baseline gate',
    `Gate: **${result.gate.toUpperCase()}**. Raw suite: **${result.rawSuite.toUpperCase()}** (runner exit ${result.rawRunnerExitStatus}; source-after exit ${result.sourceAfterExitStatus}).`,
    `Cases: ${result.cases}; passed: ${result.passed}; failed: ${result.failed}.`,
    'Gate pass means no new regression. Recorded product failures remain unresolved.'];
  for (const c of manifest.cases.filter(c => c.knownFailure)) {
    const status = result.knownFailures.includes(c.caseId) ? 'recorded product failure' :
      result.improvements.includes(c.caseId) ? 'improvement: passed' : 'unclassified';
    lines.push(`- ${c.caseId}: ${status}`);
  }
  return lines.join('\n') + '\n';
}
module.exports = { evaluate, evaluateRun, summary };
