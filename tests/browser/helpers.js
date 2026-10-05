const { expect } = require('@playwright/test');
const { execFileSync } = require('node:child_process');
const path = require('node:path');
const strings = require('../../src/main/resources/locales/se/translation.json').translations;
const text = key => strings[key];
async function identity(page, username = '') {
  const result = await (await page.request.get(new URL('/username', page.url()).href)).json();
  expect(result.loggedIn).toBe(Boolean(username));
  // Boolean assertion keeps credentials/identity out of assertion diagnostics.
  expect(result.username === username).toBe(true);
}
async function login(page, m, s) {
  await page.goto(m.origin + '/login');
  await page.getByPlaceholder(text('loginScreen.Form.placeholderName')).fill(s.username);
  await page.getByPlaceholder(text('loginScreen.Form.placehoolderPassword')).fill(s.password);
  await page.getByRole('button', { name: text('loginScreen.login.login'), exact: true }).click();
  await expect.poll(async () => (await (await page.request.get(m.origin + '/username')).json()).loggedIn).toBe(true);
  await identity(page, s.username);
  await expect(page.locator('.profile-button')).toBeVisible();
}
async function logout(page) {
  await page.locator('.profile-button').getByRole('button').click();
  await page.getByRole('link', { name: text('gakuseiNav.logout'), exact: true }).click();
  await expect.poll(async () => (await (await page.request.get(new URL('/username', page.url()).href)).json()).loggedIn).toBe(false);
  await identity(page);
}
async function denied(page, anonymous) {
  const response = await page.request.get(new URL('/api/users', page.url()).href, { maxRedirects: 0, headers: { Accept: 'application/json' } });
  expect(response.status()).toBe(anonymous ? 401 : 403);
  if (anonymous) expect(response.headers()['www-authenticate']).toMatch(/^Basic/);
  const body = await response.text();
  expect(/password|authorities|ROLE_ADMIN|"username"/i.test(body)).toBe(false);
}
function snapshot(m) {
  try {
    return JSON.parse(execFileSync('python3', ['scripts/verify-browser-state.py', 'snapshot',
      path.join(path.dirname(process.env.GAKUSEI_BROWSER_MANIFEST), 'ownership.json'), m.state_path],
    { encoding: 'utf8', stdio: ['ignore','pipe','pipe'], timeout: 30000 }));
  } catch { return null; } // async event writes are polled by the caller, with a bound.
}
async function durable(m) {
  let result;
  await expect.poll(() => { result = snapshot(m); return result !== null; },
    { timeout: 30000, intervals: [200,500,1000] }).toBe(true);
  return result;
}
module.exports = { text, identity, login, logout, denied, durable };
