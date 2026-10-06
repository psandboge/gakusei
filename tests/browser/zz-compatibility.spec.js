const { test, expect } = require('@playwright/test');
const fs = require('node:fs');
const { manifest, state } = require('./validate-run');
const { text, logout, durable } = require('./helpers');
const { originalProof, specializedProof, specializedLogin, packagedFlag } = require('./specialized-learner');

test('owned anchor, chart, localization, icons and overlay lifecycle parity', async ({ page }, testInfo) => {
  const m = manifest(), s = state(m), diagnostics = [], errors = [];
  page.on('console', msg => diagnostics.push({ type: msg.type(), text: msg.text() }));
  page.on('pageerror', error => { errors.push(error.name); diagnostics.push({ type: 'pageerror', text: error.message }); });
  // Observe native listeners/drawing without reading or injecting application state.
  await page.addInitScript(() => {
    const listeners = new Map(), canvases = new Map();
    const add = EventTarget.prototype.addEventListener, remove = EventTarget.prototype.removeEventListener;
    EventTarget.prototype.addEventListener = function(type, callback, options) {
      if (this === window && ['scroll','hashchange'].includes(type) || this instanceof HTMLCanvasElement) {
        if (!listeners.has(this)) listeners.set(this, new Map());
        const types = listeners.get(this);
        if (!types.has(type)) types.set(type, new Set());
        types.get(type).add(callback);
      }
      return add.call(this, type, callback, options);
    };
    EventTarget.prototype.removeEventListener = function(type, callback, options) {
      const types = listeners.get(this); if (types && types.has(type)) types.get(type).delete(callback);
      return remove.call(this, type, callback, options);
    };
    for (const method of ['clearRect','fillText']) {
      const original = CanvasRenderingContext2D.prototype[method];
      CanvasRenderingContext2D.prototype[method] = function(...args) {
        if (!canvases.has(this.canvas)) canvases.set(this.canvas, { clears:0, percentTooltip:false });
        const metrics = canvases.get(this.canvas);
        if (method === 'clearRect') metrics.clears++;
        if (method === 'fillText' && /%$/.test(String(args[0]))) metrics.percentTooltip = true;
        return original.apply(this,args);
      };
    }
    window.nativeParity = { listeners, canvases };
  });
  const windowListeners = () => page.evaluate(() => {
    const types = window.nativeParity.listeners.get(window) || new Map();
    return {scroll:(types.get('scroll') || new Set()).size,hashchange:(types.get('hashchange') || new Set()).size};
  });
  originalProof(m, 'capture');
  try {
    // The retained server serves the anonymous start screen through '/', not direct '/start'.
    await page.goto(m.origin + '/');
    const anchor = page.locator('div.about-features.container');
    await expect(anchor).toBeVisible();
    expect(await anchor.evaluate(el => el.parentElement.tagName)).toBe('DIV');
    const mounted = await windowListeners();
    expect(mounted.scroll).toBeGreaterThan(0); expect(mounted.hashchange).toBeGreaterThan(0);
    await page.locator('a[href="#section1"]').click();
    await expect(page).toHaveURL(/#section1$/);
    await expect.poll(() => anchor.evaluate(el => Math.abs(el.getBoundingClientRect().top))).toBeLessThan(5);
    await page.setViewportSize({width:900,height:900});
    await page.evaluate(() => window.scrollTo(0,0));
    await expect.poll(() => new URL(page.url()).hash).toBe('');
    await page.locator('header').getByRole('link', {name:text('gakuseiNav.about'),exact:true}).click();
    await expect(page).toHaveURL(/\/about$/);
    const unmounted = await windowListeners();
    expect(unmounted.scroll).toBe(mounted.scroll - 1); expect(unmounted.hashchange).toBe(mounted.hashchange - 1);

    const specialized = await specializedLogin(page,m);
    const settingsResponse = page.waitForResponse(r => new URL(r.url()).pathname === '/api/settings');
    await page.goto(m.origin + '/home');
    const languages = await (await settingsResponse).json();
    const canvas = page.locator('main canvas');
    await expect(canvas).toBeVisible();
    await expect.poll(() => canvas.evaluate(el => [...el.getContext('2d').getImageData(0,0,el.width,el.height).data].some((v,i) => i%4===3 && v>0))).toBe(true);
    const oldCanvas = await canvas.elementHandle();
    const initialWidth = await canvas.evaluate(el => el.width);
    await page.setViewportSize({width:1280,height:900});
    await expect.poll(() => canvas.evaluate(el => el.width)).not.toBe(initialWidth);
    const box = await canvas.boundingBox();
    await page.mouse.move(box.x + box.width * .65, box.y + box.height * .6);
    await expect.poll(() => canvas.evaluate(el => window.nativeParity.canvases.get(el).percentTooltip)).toBe(true);
    const cleared = await canvas.evaluate(el => window.nativeParity.canvases.get(el).clears);
    for (const code of ['jp','se']) {
      const language = languages.find(item => item.language_code === code);
      expect(Boolean(language)).toBe(true);
      const menu = page.locator('header .glosorDropdown').filter({has:page.locator('img[alt="select language"]')});
      await menu.getByRole('button').click();
      await packagedFlag(page,m,code);
      const changed = page.waitForResponse(r => new URL(r.url()).pathname === '/api/saveUserLanguage');
      await menu.getByRole('menuitem').filter({hasText:language.language}).click();
      const response = await changed;
      expect(response.ok()).toBe(true);
      const payload = JSON.parse(response.request().postData());
      expect(payload.username === specialized.username && payload.language === code).toBe(true);
      const about = require('../../src/main/resources/locales/' + code + '/translation.json').translations['gakuseiNav.about'];
      await expect(page.locator('header .about')).toHaveText(about);
      specializedProof(m, 'language', code);
    }
    expect(await canvas.evaluate((el, old) => el === old, oldCanvas)).toBe(true);
    await expect.poll(() => canvas.evaluate(el => window.nativeParity.canvases.get(el).clears)).toBeGreaterThan(cleared);
    await page.locator('header .about a').click();
    await expect(page).toHaveURL(/\/about$/);
    expect(await oldCanvas.evaluate(el => el.isConnected)).toBe(false);
    expect(await oldCanvas.evaluate(el => [...(window.nativeParity.listeners.get(el) || new Map()).values()].reduce((n,set) => n+set.size,0))).toBe(0);
    await page.goto(m.origin + '/home'); await expect(page.locator('main canvas')).toBeVisible();
    await page.goto(m.origin + '/select/guess');
    const icon = page.locator('.exercise__actions svg').first();
    await expect(icon).toBeVisible(); expect(await icon.getAttribute('viewBox')).toBe('0 0 448 512');
    expect(await icon.locator('path').getAttribute('d')).toBe(require('@fortawesome/fontawesome-free-solid/faPlay').icon[4]);
    const badge = page.locator('.badge--type-todo, .badge--type-new').first();
    await expect(badge).toBeVisible(); await badge.hover();
    await expect(page.locator('.tooltip.in')).toBeVisible();
    await page.mouse.move(0,0); await expect(page.locator('.tooltip.in')).toHaveCount(0);
    await badge.hover(); await expect(page.locator('.tooltip.in')).toBeVisible();
    await page.locator('header .about a').click(); await expect(page.locator('.tooltip.in')).toHaveCount(0);
    expect(await durable(m)).toEqual(s.snapshot);
    await logout(page);
    specializedProof(m, 'finish');
    originalProof(m, 'verify');
    expect(errors).toEqual([]);
  } finally {
    // Full raw console evidence is private and excluded from the public collector.
    fs.writeFileSync(testInfo.outputPath('compatibility-console-private.json'), JSON.stringify(diagnostics), {mode:0o600});
    originalProof(m, 'verify');
  }
});
