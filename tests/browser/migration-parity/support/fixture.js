const base = require('@playwright/test');
const { createApp } = require('../harness/server');
const strings = require('../../../../src/main/resources/locales/se/translation.json').translations;
const test = base.test.extend({
  app: async ({}, use, testInfo) => {
    const app = await createApp();
    app.respond('GET','/username', () => ({body:{username:app.state.username, loggedIn:Boolean(app.state.username)}}));
    app.respond('GET','/api/settings', () => ({body:[]}));
    app.respond('GET','/api/announcement', () => ({body:[]}));
    app.respond('POST','/api/checkNewUser', () => ({status:202}));
    app.respond('POST','/api/checkUserLanguage', () => ({status:202}));
    app.respond('POST','/api/saveUserLanguage', ({body}) => { app.state.language=body.language; return {status:204}; });
    app.respond('POST','/auth', ({body}) => { app.state.username=new URLSearchParams(body).get('username') || 'P0Alice'; return {status:200}; });
    app.respond('POST','/logout', () => {app.state.username=''; return {status:204};});
    app.respond('POST','/registeruser', () => ({status:200}));
    require('../../../fixtures/migration-parity/api').install(app);
    try { await use(app); } finally {
      await app.close();
      const records = app.requests.map(record => ({ ...record,
        body:['/auth','/registeruser'].includes(record.path) ? '[synthetic authentication fields omitted]' : record.body
      }));
      await testInfo.attach('synthetic-api-ledger', { body:JSON.stringify(records,null,2), contentType:'application/json' });
    }
    base.expect(app.unknown, 'Every API request must have an explicit synthetic fixture').toEqual([]);
  },
  context: async ({browser,app}, use) => {
    const context = await browser.newContext({ serviceWorkers:'block', locale:'sv-SE', timezoneId:'Europe/Stockholm', viewport:{width:1280,height:900} });
    // All network traffic belongs to this test. Prevent third-party traffic and
    // accidental connections to existing application or database services.
    await context.route('**/*', route => {
      const url = new URL(route.request().url());
      if (url.origin === app.origin || ['data:','blob:'].includes(url.protocol)) return route.continue();
      app.unknown.push(`External request blocked: ${url.protocol}//${url.host}${url.pathname}`);
      return route.abort('blockedbyclient');
    });
    await use(context);
    await context.close();
  }
});
module.exports = { test, expect:base.expect, text:key => strings[key] };
