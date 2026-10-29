const {test,expect}=require('../support/fixture');
const {lesson}=require('../../../fixtures/migration-parity/api');
for(const viewport of [{name:'desktop',width:1280,height:900},{name:'mobile',width:390,height:844}]){
  test(`P0-VISUAL-${viewport.name}: simulated fixed reference screenshots`,async({page,app},info)=>{
    await page.setViewportSize(viewport);
    await page.emulateMedia({reducedMotion:'reduce'});
    async function capture(name){await page.screenshot({path:info.outputPath(`${viewport.name}-${name}.png`),fullPage:true,animations:'disabled'});}
    await page.goto(app.origin+'/select/translate');
    const card=page.locator('.exercise').filter({has:page.getByRole('heading',{name:new RegExp('^'+lesson.name)})});
    await expect(card).toBeVisible(); await capture('selection');
    await card.locator('.exercise__actions button').click();
    const input=page.getByRole('textbox'); await input.fill('answer 1'); await input.press('Enter');
    await expect(page.getByRole('heading',{name:'Rätt!',exact:true})).toBeVisible(); await capture('text-feedback');
    await page.getByRole('button',{name:'Nästa fråga',exact:true}).click();
    await input.fill('wrong'); await input.press('Enter');
    await expect(page).toHaveURL(/\/finish\/translate$/); await capture('results');
    await page.goto(app.origin+'/select/kanji'); await card.locator('.exercise__actions button').click();
    await expect(page.locator('canvas')).toBeVisible(); await capture('handwriting');
  });
}
