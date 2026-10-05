const { defineConfig } = require('@playwright/test');
const path = require('node:path');
process.umask(0o077);
const output = process.env.GAKUSEI_BROWSER_OUTPUT_DIR || '.tools/browser-collection';
module.exports = defineConfig({
  testDir: './tests/browser', testMatch: '*.spec.js',
  globalSetup: require.resolve('./tests/browser/validate-run'),
  fullyParallel: false, workers: 1, forbidOnly: true, retries: 0,
  timeout: 180000, globalTimeout: 300000, expect: { timeout: 15000 },
  outputDir: path.join(output, 'results'),
  reporter: [['json', { outputFile: path.join(output, 'results.json') }], ['line'], ['html', { outputFolder: path.join(output, 'report'), open: 'never' }]],
  use: { browserName: 'chromium', locale: 'sv-SE', timezoneId: 'Europe/Stockholm',
    viewport: { width: 1280, height: 900 }, actionTimeout: 15000,
    navigationTimeout: 30000, trace: 'off', video: 'off', screenshot: 'only-on-failure' },
  projects: [{ name: 'chromium' }]
});
