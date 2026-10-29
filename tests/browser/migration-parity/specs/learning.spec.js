const { test, expect, text } = require('../support/fixture');
const { lesson } = require('../../../fixtures/migration-parity/api');
const events = app => app.requests.filter(r => r.path === '/api/events2').flatMap(r => typeof r.body === 'string' ? JSON.parse(r.body) : r.body || []);
async function start(page, app, mode) {
  await page.goto(app.origin + '/select/' + mode);
  const exercise = page.locator('.exercise').filter({ has: page.getByRole('heading', { name: new RegExp("^" + lesson.name) }) });
  await expect(exercise).toBeVisible();
  // Replay is intentionally unavailable with repetition enabled in PR7.
  if (['guess','translate','flashcards','kanji'].includes(mode)) {
    const toggle = page.getByText(text('selectScreen.getLessons.smartLearaning'), {exact:true}).locator('..');
    const control = toggle.getByText(text('selectScreen.getLessons.on'), {exact:true}).locator('../..');
    await control.click();
    await expect(control.getByRole('checkbox')).toHaveValue('false');
  }
  await exercise.locator('.exercise__actions').getByRole('button').click();
  await expect(page).toHaveURL(new RegExp('/play/' + mode + '$'));
}
for (const mode of ['guess','quiz','flashcards','translate','grammar','kanji']) {
  test(`P0-MODE-${mode}: simulated API short lesson, finish and replay`, async ({page, app}) => {
    await start(page, app, mode);
    for (let n=1; n<=2; n++) {
      await expect(page.getByText(new RegExp(`Fråga ${n} / 2`))).toBeVisible();
      if (['translate','grammar'].includes(mode)) {
        const input = page.getByRole('textbox');
        await input.fill(n === 1 ? `answer ${n}` : 'deliberately incorrect');
        await input.press('Enter');
        await expect(page.getByRole('heading', {name: n===1 ? 'Rätt!' : `Fel, rätt svar: answer ${n}`, exact:true})).toBeVisible();
        await expect(input).toBeDisabled();
        if(n===1) await page.getByRole('button',{name:'Nästa fråga',exact:true}).click();
      } else if (mode === 'flashcards') {
        await page.getByRole('button',{name:text('cards.flashcard.turnCard'),exact:true}).click();
        await expect(page.locator('.flip-container__back .question__text')).toHaveText(`answer ${n}`);
        await page.locator(`[name="answerbutton-${n}"]`).click();
      } else if (mode === 'kanji') {
        await expect(page.locator('canvas')).toBeVisible();
        await page.locator('[name="dunnobutton"]').click();
      } else {
        const choice = page.locator('button.answer-button[name^="answer"]').filter({hasText: n===1 ? 'answer 1' : 'wrong 2a'});
        await choice.click();
        await expect(choice).toBeDisabled();
        await expect(choice).toHaveClass(n===1 ? /btn-success/ : /btn-danger/);
      }
    }
    await expect(page).toHaveURL(new RegExp('/finish/'+mode+'$'));
    await expect(page.locator('.list-group-item-success')).toHaveCount(mode==='kanji' ? 0 : 1);
    await expect(page.locator('.list-group-item-danger')).toHaveCount(mode==='kanji' ? 2 : 1);
    const answered = events(app).filter(e=>e.type==='answeredCorrectly');
    expect(answered.map(e=>e.data)).toEqual(mode==='kanji' ? [false,false] : [true,false]);
    expect(answered.map(e=>e.nuggetid)).toEqual([9001,9002]);
    expect(answered.every(e=>e.username==='P0Alice')).toBe(true);
    // PR7 queues finish records until the next flush; replay must flush each once.
    if (['quiz','grammar'].includes(mode)) {
      // PR7 does not expose a repetition toggle here, but the stored default
      // still disables replay. Preserve this observed policy explicitly.
      await expect(page.locator('.tryAgainButton')).toBeDisabled();
      await page.locator('.backToSelectScreenButton').click();
      await expect(page).toHaveURL(new RegExp('/select/'+mode+'$'));
      await page.locator('.exercise').filter({has:page.getByRole('heading',{name:new RegExp('^'+lesson.name)})}).locator('.exercise__actions button').click();
    } else await page.locator('.tryAgainButton').click();
    await expect(page).toHaveURL(new RegExp('/play/'+mode+'$'));
    expect(events(app).filter(e=>e.gamemode==='finish' && e.type==='userAnswer')).toHaveLength(2);
    expect(events(app).filter(e=>e.type==='answeredCorrectly')).toHaveLength(2);
    if(mode==='kanji') expect(app.requests.filter(r=>r.path==='/api/kanji-drawings')).toHaveLength(2);
  });
}
test('P0-FOCUS: simulated API Enter, actual focus, disabled input, reset and transition navigation', async ({page, app}) => {
  await start(page,app,'translate');
  const input = page.getByRole('textbox');
  await expect(input).toBeFocused();
  await input.fill('answer 1');
  await input.press('Enter');
  const next = page.getByRole('button',{name:'Nästa fråga',exact:true});
  await expect(next).toBeFocused();
  await expect(input).toBeDisabled();
  expect(events(app).filter(e=>e.type==='answeredCorrectly')).toHaveLength(1);
  await next.press('Enter');
  await expect(input).toHaveValue('');
  await expect(input).toBeFocused();
  await input.fill('wrong');
  await input.press('Enter');
  await page.getByRole('link',{name:text('gakuseiNav.about'),exact:true}).click();
  await expect(page).toHaveURL(/\/about$/);
  // Observe beyond PR7's documented 2000 ms final-answer timer (200 ms margin).
  await page.waitForTimeout(2200);
  await expect(page).toHaveURL(/\/about$/);
});
test('P0-DUPLICATE: rapid double activation and disabled choice produce one outcome per question',async({page,app})=>{
  await start(page,app,'guess');
  for(const n of [1,2]){
    await expect(page.getByText(new RegExp(`Fråga ${n} / 2`))).toBeVisible();
    const choice=page.locator('button.answer-button[name^="answer"]').filter({hasText:`answer ${n}`});
    // One bounded native double click deliberately challenges feedback admission.
    await choice.click({clickCount:2,delay:0});
    await expect(choice).toBeDisabled();
    await choice.click({force:true});
    expect(events(app).filter(e=>e.type==='answeredCorrectly').map(e=>[e.nuggetid,e.data])).toEqual(
      [1,2].slice(0,n).map(i=>[9000+i,true]));
  }
  await expect(page).toHaveURL(/\/finish\/guess$/);
  expect(events(app).filter(e=>e.type==='answeredCorrectly')).toHaveLength(2);
});
