const { test, expect } = require('@playwright/test');
const crypto = require('node:crypto');
const { manifest, state, atomic } = require('./validate-run');
const { text, identity, login, logout, denied, durable } = require('./helpers');
const questionText = q => q.question[0] + (q.question[1] && q.question[1] !== q.question[0] ? ` 「${q.question[1]}」` : '');
const normalize = s => s.replace(/\u00ad/g, '').replace(/\s+/g, ' ').trim();
async function select(page, m, mode = 'guess') {
  await page.goto(m.origin + '/select/' + mode);
  await expect(page.getByRole('heading', { name: /genki 15/ })).toBeVisible();
  return page.locator('.exercise').filter({ has: page.getByRole('heading', { name: /^genki 15/ }) });
}
test('real learner journey and same-learner durable phase proof', async ({ page }) => {
  const m = manifest();
  if (m.phase !== 'journey') {
    const s = state(m);
    await login(page, m, s);
    expect(await durable(m)).toEqual(s.snapshot);
    await select(page, m);
    await page.reload();
    await identity(page, s.username);
    expect(await durable(m)).toEqual(s.snapshot);
    // Run the admin authorization assertion after all durable phases, so a
    // retained security defect cannot erase restart/reseed evidence.
    if (m.phase === 'after-reseed') await denied(page, false);
    await logout(page);
    return;
  }
  const s = { run_id: m.run_id, nonce: m.nonce, origin: m.origin,
    username: 'Browser' + m.run_id.slice(0,20), password: crypto.randomBytes(18).toString('hex'),
    lesson: m.fixture.lesson, category: m.fixture.category, submissions: [] };
  await page.goto(m.origin + '/login');
  await page.getByPlaceholder(text('loginScreen.Form.placeholderName')).fill(s.username);
  await page.getByPlaceholder(text('loginScreen.Form.placehoolderPassword')).fill(s.password);
  await page.getByRole('button', { name: text('loginScreen.login.register'), exact: true }).click();
  await expect.poll(async () => (await (await page.request.get(new URL('/username', page.url()).href)).json()).loggedIn).toBe(true);
  await identity(page, s.username);
  await expect(page.locator('.profile-button')).toBeVisible();
  await logout(page);
  await login(page, m, s);
  const exercise = await select(page, m);
  await page.getByRole('radio', { name: /Japanska.*Svenska/ }).check();
  // This legacy toggle has no role/aria state. Its visible active/inactive labels
  // and the UI-generated questions request jointly prove state without editing UI.
  const toggle = page.getByText(text('selectScreen.getLessons.smartLearaning'), { exact: true }).locator('..');
  const switchControl = toggle.getByText(text('selectScreen.getLessons.on'), { exact: true }).locator('../..');
  await expect(switchControl.getByRole('checkbox')).toHaveValue('true');
  await switchControl.click();
  await expect(switchControl.getByRole('checkbox')).toHaveValue('false');
  await switchControl.click();
  await expect(switchControl.getByRole('checkbox')).toHaveValue('true');
  const responsePromise = page.waitForResponse(r => new URL(r.url()).pathname === '/api/questions');
  await exercise.locator('.exercise__actions').getByRole('button').click();
  const response = await responsePromise;
  const url = new URL(response.url());
  expect(url.searchParams.get('spacedRepetition')).toBe('true');
  expect(url.searchParams.get('questionType')).toBe('reading');
  expect(url.searchParams.get('answerType')).toBe('swedish');
  expect(url.searchParams.get('lessonName')).toBe('genki 15');
  const questions = await response.json();
  expect(questions.length).toBeGreaterThan(1);
  for (let i = 0; i < questions.length; i++) {
    await expect(page.getByText(new RegExp(`Fråga ${i + 1} / ${questions.length}`))).toBeVisible();
    const visible = normalize(await page.locator('.question__text').innerText());
    const matches = questions.filter(q => visible === normalize(questionText(q)));
    expect(matches.length).toBe(1);
    const q = matches[0];
    const fixture = m.fixture.nuggets.find(n => n.id === q.questionNuggetId);
    expect(Boolean(fixture)).toBe(true);
    expect(q.question[0]).toBe(fixture.reading);
    expect(q.correctAlternative[0][0]).toBe(fixture.swedish);
    const correctText = normalize(q.correctAlternative[0][0]);
    const choices = page.locator('button.answer-button[name^="answer"]');
    await expect(choices).toHaveCount(4);
    const texts = (await choices.allTextContents()).map(normalize);
    const correctIndex = texts.findIndex(t => t === correctText || t.startsWith(correctText + ' '));
    expect(correctIndex).toBeGreaterThanOrEqual(0);
    const correct = i % 2 === 0;
    const chosen = correct ? correctIndex : texts.findIndex((_, index) => index !== correctIndex);
    await choices.nth(chosen).click();
    await expect(choices.nth(correctIndex)).toHaveClass(/btn-success/);
    if (!correct) await expect(choices.nth(chosen)).toHaveClass(/btn-danger/);
    s.submissions.push({ question_nugget_id: q.questionNuggetId,
      correct_alternative_nugget_id: q.questionNuggetId, nugget_id: q.questionNuggetId,
      question: q.question[0], correct_text: q.correctAlternative[0][0], chosen_text: texts[chosen], correct });
  }
  await expect(page).toHaveURL(/\/finish\/guess$/);
  const correctCount = s.submissions.filter(x => x.correct).length;
  await expect(page.locator('h3').filter({ hasText: text('aboutGakusei.finishScreen.rightAnswer') }))
    .toContainText(`${correctCount} ${text('aboutGakusei.finishScreen.witch')}${questions.length}`);
  await expect(page.locator('.list-group-item-success')).toHaveCount(correctCount);
  await expect(page.locator('.list-group-item-danger')).toHaveCount(questions.length - correctCount);
  for (const item of s.submissions) {
    const escape = value => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const row = page.locator('.list-group-item-success, .list-group-item-danger').filter({
      has: page.locator('.question__text').filter({ hasText: new RegExp('^' + escape(item.question) + '(?:\\s|$)') }) });
    await expect(row).toContainText(item.correct_text);
    await expect(row).toContainText(item.chosen_text);
  }
  atomic(m.state_path, s);
  s.snapshot = await durable(m);
  for (const row of s.snapshot.progress) {
    expect(row.retention_date).toBeTruthy();
    expect(row.retention_factor).toBeGreaterThanOrEqual(1.3);
    expect(row.retention_interval).toBeGreaterThan(0);
    if (!row.latest_result) expect(row.retention_interval).toBe(0.04167);
  }
  atomic(m.state_path, s);
  await page.reload();
  await identity(page, s.username);
  // Lesson state is in-memory: a reload returns to selection; SQL is durable.
  await expect(page).toHaveURL(/\/select\/guess$/);
  expect(await durable(m)).toEqual(s.snapshot);
  await logout(page);
  await login(page, m, s);
  expect(await durable(m)).toEqual(s.snapshot);
});

test('seeded flashcard reveal and translation input smoke without answer writes', async ({ page }) => {
  const m = manifest(), s = state(m);
  await login(page, m, s);
  for (const mode of ['flashcards', 'translate']) {
    const exercise = await select(page, m, mode);
    const toggle = page.getByText(text('selectScreen.getLessons.smartLearaning'), { exact: true }).locator('..');
    const control = toggle.getByText(text('selectScreen.getLessons.on'), { exact: true }).locator('../..');
    await expect(control.getByRole('checkbox')).toHaveValue('true');
    await control.click();
    await expect(control.getByRole('checkbox')).toHaveValue('false');
    const pending = page.waitForResponse(r => new URL(r.url()).pathname === '/api/questions');
    await exercise.locator('.exercise__actions').getByRole('button').click();
    const response = await pending;
    expect(new URL(response.url()).searchParams.get('lessonType')).toBe(mode);
    const questions = await response.json();
    expect(questions.length).toBeGreaterThan(0);
    if (mode === 'flashcards') {
      const front = page.locator('.flip-container__front .question__text');
      await expect(front).toBeVisible();
      // Read only DOM text; no store injection or programmatic answer creation.
      const rendered = normalize(await front.innerText());
      const matching = questions.filter(q => rendered === normalize(questionText(q)));
      expect(matching.length).toBe(1);
      await page.getByRole('button', { name: text('cards.flashcard.turnCard'), exact: true }).click();
      await expect(page.locator('.flip-container__content')).toHaveClass(/--flipped/);
      await expect(page.locator('.flip-container__back .question__text')).toContainText(matching[0].correctAlternative[0][0]);
    } else {
      await expect(page.getByRole('textbox')).toBeVisible();
      await expect(page.getByRole('button', { name: 'Kontrollera svar', exact: true })).toBeEnabled();
      const rendered = normalize(await page.locator('.question__text').innerText());
      expect(questions.some(q => rendered === normalize(questionText(q)))).toBe(true);
    }
    await page.reload();
    await expect(page).toHaveURL(new RegExp(`/select/${mode}$`));
    await identity(page, s.username);
  }
  expect(await durable(m)).toEqual(s.snapshot);
  await logout(page);
});
