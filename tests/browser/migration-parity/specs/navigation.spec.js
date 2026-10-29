const {test,expect,text}=require('../support/fixture');
const {lesson}=require('../../../fixtures/migration-parity/api');
const legacy=require('../../../fixtures/migration-parity/legacy-state.json');
const exercise=page=>page.locator('.exercise').filter({has:page.getByRole('heading',{name:new RegExp('^'+lesson.name)})});
test('P0-PREFERENCES: simulated favorites, repetition request, direct links and browser history',async({page,app})=>{
  await page.goto(app.origin+'/select/guess');
  const card=exercise(page); await expect(card).toBeVisible();
  await card.locator('.toggle-icon-button').click();
  await expect(card.locator('.toggle-icon-button')).toHaveClass(/--active/);
  expect(app.requests.filter(r=>r.path==='/api/userLessons/add')).toHaveLength(1);
  await page.reload(); await expect(exercise(page).locator('.toggle-icon-button')).toHaveClass(/--active/);
  await page.getByRole('link',{name:text('gakuseiNav.about'),exact:true}).click();
  await expect(page).toHaveURL(/\/about$/); await page.goBack();
  await expect(page).toHaveURL(/\/select\/guess$/); await expect(exercise(page)).toBeVisible();
  await page.goForward(); await expect(page).toHaveURL(/\/about$/);
  await page.goto(app.origin+'/play/translate'); await expect(page).toHaveURL(/\/select\/translate$/);
  await page.goto(app.origin+'/finish/guess'); await expect(page).toHaveURL(/\/select\/guess$/);
  await exercise(page).locator('.toggle-icon-button').click();
  await expect(exercise(page).locator('.toggle-icon-button')).not.toHaveClass(/--active/);
  expect(app.requests.filter(r=>r.path==='/api/userLessons/remove')).toHaveLength(1);
});
for(const version of ['obsolete','current']) test(`P0-LEGACY-${version}: simulated stored identity and lesson preferences require server confirmation`,async({page,app})=>{
  app.state.username='P0Bob';
  const state=JSON.parse(JSON.stringify(legacy));
  if(version==='current') state.security.projectVersion=require('../../../../package.json').version;
  await page.addInitScript(state=>{
    // This is documented browser storage, not framework/component injection.
    localStorage.setItem('reduxPersist:security',JSON.stringify(state.security));
    localStorage.setItem('reduxPersist:lessons',JSON.stringify(state.lessons));
  },state);
  const delayed=app.defer('GET','/username');
  await page.goto(app.origin+'/select/guess'); await delayed.requested;
  await expect(page.locator('.profile-button')).toHaveCount(0);
  await expect(page.locator('.exercise')).toHaveCount(0);
  delayed.release({username:'P0Bob',loggedIn:true});
  await expect(page.locator('.profile-button')).toContainText('P0Bob');
  await expect(page.getByText('P0OldPrivateFavorite',{exact:true})).toHaveCount(0);
  await expect(exercise(page)).toBeVisible();
  // PR7 deliberately discards persisted lesson preferences; record that baseline.
  await exercise(page).locator('.exercise__actions button').click();
  const request=app.requests.find(r=>r.path==='/api/questions');
  expect(request.query.questionType).toBe('reading');
  expect(request.query.answerType).toBe('swedish');
  expect(request.query.spacedRepetition).toBe('true');
  expect(request.query.username).toBe('P0Bob');
});
test('P0-LANGUAGE-CACHE: simulated language save payload and browser locale cache survive reload',async({page,app})=>{
  app.respond('GET','/api/settings',()=>({body:[
    {language_code:'se',language:'Svenska',flag_svg:'/img/flags/flags.svg'},
    {language_code:'en',language:'English',flag_svg:'/img/flags/flags.svg'}
  ]}));
  app.respond('POST','/api/checkUserLanguage',()=>({body:app.state.language||'se',raw:true,headers:{'Content-Type':'text/plain'}}));
  await page.goto(app.origin+'/select/guess');
  await page.locator('.glosorDropdown').getByRole('button').click();
  await page.getByRole('menuitem',{name:'English'}).click();
  await expect.poll(()=>app.state.language).toBe('en');
  const save=app.requests.find(r=>r.path==='/api/saveUserLanguage');
  expect(save.body).toEqual({username:'P0Alice',language:'en'});
  // New page startup confirms identity; language preference is retained by i18next's browser storage.
  await page.reload();
  await expect(page.locator('.profile-button')).toContainText('P0Alice');
  await expect(page.getByRole('link',{name:'About Gakusei',exact:true})).toBeVisible();
  expect(app.requests.filter(r=>r.path==='/api/checkUserLanguage')).toHaveLength(0);
});
test('P0-LANGUAGE-SERVER: simulated UI login restores server locale without detector cache',async({page,app})=>{
  app.state.username=''; app.state.language='en';
  app.respond('POST','/api/checkUserLanguage',()=>({body:app.state.language,raw:true,headers:{'Content-Type':'text/plain'}}));
  await page.goto(app.origin+'/login');
  // Remove only the detector cache; retain unrelated origin/browser storage.
  await page.evaluate(()=>{localStorage.removeItem('i18nextLng');document.cookie='i18next=; Max-Age=0; Path=/';});
  await page.reload();
  await expect(page.getByRole('link',{name:text('gakuseiNav.about'),exact:true})).toBeVisible();
  await page.getByPlaceholder(text('loginScreen.Form.placeholderName')).fill('P0Alice');
  await page.getByPlaceholder(text('loginScreen.Form.placehoolderPassword')).fill('SyntheticPassword');
  const language=page.waitForResponse(r=>r.url()===app.origin+'/api/checkUserLanguage');
  await page.getByRole('button',{name:text('loginScreen.login.login'),exact:true}).click();
  const response=await language;
  expect(response.status()).toBe(200); expect(await response.text()).toBe('en');
  const reads=app.requests.filter(r=>r.path==='/api/checkUserLanguage');
  expect(reads).toHaveLength(1); expect(reads[0].body).toBe('P0Alice');
  await expect(page.locator('.profile-button')).toContainText('P0Alice');
  await expect(page.getByRole('link',{name:'About Gakusei',exact:true})).toBeVisible();
});
