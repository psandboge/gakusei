// Offline screenshot of the scanned count/phase report; never opens the app.
const fs = require('node:fs');
const path = require('node:path');
const { chromium } = require('@playwright/test');
(async () => {
  const directory = process.argv[2];
  const report = JSON.parse(fs.readFileSync(path.join(directory, 'diagnostics.json'), 'utf8'));
  const browser = await chromium.launch({ headless: true });
  try {
    const page = await browser.newPage({ viewport: { width: 1100, height: 850 } });
    await page.route('**/*', route => route.abort());
    await page.setContent(`<html><body style="font:18px system-ui;padding:24px;color:#172438">
      <style>table{border-collapse:collapse;width:100%}td,th{border:1px solid #ccd5df;padding:7px;text-align:left}th{background:#eef2f6}</style>
      <h1>CI count and phase diagnostics</h1><h2>Backend suites</h2><table id="backend"></table>
      <h2>Owned runs</h2><table id="runs"></table></body></html>`);
    await page.evaluate(data => {
      function table(id, headings, rows) {
        const node = document.getElementById(id);
        const header = node.insertRow();
        headings.forEach(value => { const cell = document.createElement('th'); cell.textContent = value; header.append(cell); });
        rows.forEach(values => { const row = node.insertRow(); values.forEach(value => { row.insertCell().textContent = String(value); }); });
      }
      table('backend', ['Suite', 'Tests', 'Failures', 'Errors', 'Skipped'],
        data.backend.map(s => [s.suite, s.tests, s.failures, s.errors, s.skipped]));
      table('runs', ['Run', 'Exit', 'Complete', 'Journey', 'Restart', 'Reseed'],
        data.browser.map((s, i) => [i + 1, s.exit_code ?? 'no result', s.complete,
          s.phases.journey, s.phases['after-restart'], s.phases['after-reseed']]));
    }, report);
    await page.screenshot({ path: path.join(directory, 'diagnostics.png'), fullPage: true });
  } finally { await browser.close(); }
})().catch(() => { process.exitCode = 1; });
