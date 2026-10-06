const { chromium } = require('playwright');
const { expect } = require('@playwright/test');
const fs = require('node:fs');
const path = require('node:path');
const { manifest } = require('./validate-run');
const m = manifest(); // Live PID/service/private path gate precedes all browser/network access.
(async()=>{
 const browser=await chromium.launch(),diagnostics=[],errors=[];
 try {
  const page=await browser.newPage({locale:'sv-SE',viewport:{width:1280,height:900}});
  page.on('console',msg=>diagnostics.push({type:msg.type(),text:msg.text()}));
  page.on('pageerror',error=>{errors.push(error.name);diagnostics.push({type:'pageerror',text:error.message});});
  await page.goto(m.origin+'/');
  const response=await page.request.get(m.origin+'/api/settings');expect(response.status()).toBe(200);expect(await response.json()).toEqual([]);
  const menu=page.locator('header .glosorDropdown').filter({has:page.locator('img[alt="select language"]')});
  await expect(menu).toBeVisible();await expect(menu).toHaveClass(/\bdisabled\b/);
  await expect(menu.locator(':scope > .dropdown-toggle')).toHaveAttribute('tabindex','-1');
  const box=await menu.locator('img').boundingBox();await page.mouse.click(box.x+box.width/2,box.y+box.height/2);
  await expect(menu).not.toHaveClass(/\bopen\b/);expect(errors).toEqual([]);
  console.log('PASS native prefixture empty settings and disabled menu');
 } finally {
  fs.writeFileSync(path.join(m.output_dir,'empty-language-private.json'),JSON.stringify({diagnostics,errors}),{mode:0o600});await browser.close();
 }
})().catch(error=>{fs.writeFileSync(path.join(m.output_dir,'empty-language-failure-private.json'),JSON.stringify({name:error.name,message:error.message,stack:error.stack}),{mode:0o600});console.error(error.name+': prefixture language probe failed; private evidence retained');process.exitCode=1;});
