const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const { execFileSync } = require('node:child_process');
const { expect } = require('@playwright/test');
const { text, identity } = require('./helpers');
const { atomic, state } = require('./validate-run');

function phaseMilliseconds(m, cap) {
  expect(Number.isFinite(m.phase_deadline_epoch_ms)).toBe(true);
  const left = Math.floor(m.phase_deadline_epoch_ms - Date.now());
  if (left < 1) throw new Error('Owned browser phase deadline expired');
  return Math.min(left, cap);
}
function nativeProof(m, mode, operation, code) {
  const record = path.join(path.dirname(process.env.GAKUSEI_BROWSER_MANIFEST), 'ownership.json');
  const args = ['scripts/verify-browser-state.py', mode, record, operation];
  if (code !== undefined) args.push(code);
  try {
    const result = JSON.parse(execFileSync('python3', args,
      {encoding:'utf8',stdio:['ignore','pipe','pipe'],timeout:phaseMilliseconds(m,30000)}));
    expect(result.passed).toBe(true);
  } catch { throw new Error('Native private account proof failed'); }
}
function originalProof(m, operation) { nativeProof(m, 'original-proof', operation); }
function specializedProof(m, operation, code) { nativeProof(m, 'specialized-proof', operation, code); }

async function specializedLogin(page, m) {
  const original = state(m);
  const file = path.join(path.dirname(m.state_path), 'specialized-learner-private.json');
  let specialized;
  if (m.phase === 'journey') {
    expect(fs.existsSync(file)).toBe(false);
    specialized = {run_id:m.run_id,nonce:m.nonce,origin:m.origin,
      username:'Spec'+m.run_id.slice(0,20),password:crypto.randomBytes(18).toString('hex')};
    atomic(file,specialized); // Privacy scanner knows generated credentials even after an early failure.
  } else {
    expect(fs.lstatSync(file).isSymbolicLink()).toBe(false);
    expect(fs.statSync(file).mode & 0o077).toBe(0);
    specialized = JSON.parse(fs.readFileSync(file,'utf8'));
  }
  expect(specialized.run_id === m.run_id && specialized.nonce === m.nonce && specialized.origin === m.origin).toBe(true);
  expect(/^[A-Za-z0-9]{2,32}$/.test(specialized.username) && specialized.username !== original.username).toBe(true);
  expect(typeof specialized.password === 'string' && specialized.password.length >= 2 && specialized.password.length <= 100).toBe(true);
  // Use the retained protected-home redirect and actual form registration/authentication.
  // The independent original root-registration pageerror remains a separate, preserved gate.
  await page.goto(m.origin+'/home');
  await page.getByPlaceholder(text('loginScreen.Form.placeholderName')).fill(specialized.username);
  await page.getByPlaceholder(text('loginScreen.Form.placehoolderPassword')).fill(specialized.password);
  const endpoint = m.phase === 'journey' ? '/registeruser' : '/auth';
  const submitted = page.waitForResponse(r=>new URL(r.url()).pathname===endpoint && r.request().method()==='POST');
  await page.getByRole('button',{name:text(m.phase === 'journey' ? 'loginScreen.login.register' : 'loginScreen.login.login'),exact:true}).click();
  expect((await submitted).ok()).toBe(true);
  await expect.poll(async()=> (await (await page.request.get(m.origin+'/username')).json()).loggedIn).toBe(true);
  await identity(page,specialized.username);
  await expect(page).toHaveURL(/\/home$/);
  await expect(page.locator('.profile-button')).toBeVisible();
  specializedProof(m,m.phase === 'journey' ? 'registered' : 'authenticated');
  return specialized;
}
async function packagedFlag(page, m, code) {
  const asset = m.packaged_flags[code];
  expect(asset.path).toBe(code === 'jp' ? '/img/flags/japan-flag.svg' : '/img/flags/sweden-flag.svg');
  const image = page.locator('header .dropdown-menu img[alt="flag"][src="'+asset.path+'"]');
  await expect(image).toBeVisible();
  await expect(image).toHaveAttribute('src',asset.path);
  const decoded = await image.evaluate(async img => {
    await img.decode();
    return {complete:img.complete,width:img.naturalWidth,height:img.naturalHeight};
  });
  expect(decoded.complete && decoded.width > 0 && decoded.height > 0).toBe(true);
  const response = await page.request.get(m.origin + asset.path,{timeout:phaseMilliseconds(m,15000)});
  expect(response.ok()).toBe(true);
  expect(response.headers()['content-type']).toMatch(/^image\/svg\+xml/);
  expect(crypto.createHash('sha256').update(await response.body()).digest('hex')).toBe(asset.sha256);
  const file = path.join(m.output_dir,'flag-resources-private.json');
  const observations = fs.existsSync(file) ? JSON.parse(fs.readFileSync(file,'utf8')) : [];
  observations.push({code,...asset,decoded,fetched:true});
  if (code === 'jp') {
    const selector = m.packaged_flags.selector;
    const title = page.locator('header img[alt="select language"]');
    await expect(title).toHaveAttribute('src',selector.path);
    const titleDecoded = await title.evaluate(async img => {await img.decode();return img.complete && img.naturalWidth>0 && img.naturalHeight>0;});
    expect(titleDecoded).toBe(true);
    const fetched = await page.request.get(m.origin+selector.path,{timeout:phaseMilliseconds(m,15000)});
    expect(fetched.ok()).toBe(true);
    expect(crypto.createHash('sha256').update(await fetched.body()).digest('hex')).toBe(selector.sha256);
    observations.push({code:'selector',...selector,decoded:true,fetched:true});
  }
  atomic(file,observations);
}
module.exports = { originalProof, specializedProof, specializedLogin, packagedFlag, phaseMilliseconds };
