const { defineConfig } = require('@playwright/test');
process.umask(0o077);
const path = require('node:path');
const run = process.env.GAKUSEI_PARITY_RUN_ID || `${Date.now()}-${process.pid}`;
if (!/^[0-9]+-[0-9]+$/.test(run)) throw new Error('Invalid parity run identifier');
const output = path.join('.tools/migration-parity/runs', run);
module.exports = defineConfig({
  testDir:'./tests/browser/migration-parity/specs',
  globalSetup:require.resolve('./tests/browser/migration-parity/harness/build'),
  fullyParallel:false, workers:1, retries:0, forbidOnly:true,
  timeout:45000, globalTimeout:300000, expect:{timeout:10000},
  outputDir:path.join(output,'results'),
  reporter:[['line'],['json',{outputFile:path.join(output,'results.json')}],['html',{outputFolder:path.join(output,'report'),open:'never'}]],
  use:{browserName:'chromium',trace:'retain-on-failure',screenshot:'only-on-failure',video:'off'},
  projects:[{name:'chromium'}]
});
