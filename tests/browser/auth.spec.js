const { test, expect } = require('@playwright/test');
const { manifest } = require('./validate-run');
const { text, identity, denied } = require('./helpers');
test('protected routes, invalid login and anonymous admin denial', async ({ page }) => {
  const m = manifest();
  for (const route of ['/select/guess', '/play/guess']) {
    await page.goto(m.origin + route);
    await expect(page.getByPlaceholder(text('loginScreen.Form.placeholderName'))).toBeVisible();
    await identity(page);
  }
  await page.getByPlaceholder(text('loginScreen.Form.placeholderName')).fill('Absent' + m.run_id.slice(0,16));
  await page.getByPlaceholder(text('loginScreen.Form.placehoolderPassword')).fill('InvalidDisposablePassword');
  await page.getByRole('button', { name: text('loginScreen.login.login'), exact: true }).click();
  await expect(page.locator('[name="authFeedback"]')).toBeVisible();
  await identity(page);
  await denied(page, true);
});
