const { test, expect, text } = require('../support/fixture');
const { lesson } = require('../../../fixtures/migration-parity/api');
const exercise = page => page.locator('.exercise').filter({has:page.getByRole('heading',{name:new RegExp('^'+lesson.name)})});
async function fillLogin(page, name) {
  await page.getByPlaceholder(text('loginScreen.Form.placeholderName')).fill(name);
  await page.getByPlaceholder(text('loginScreen.Form.placehoolderPassword')).fill('SyntheticPassword');
}
async function visibleIdentity(page, name) {
  await expect(page.locator('.profile-button')).toContainText(name);
}
async function logout(page) {
  await page.locator('.profile-button').getByRole('button').click();
  await page.getByRole('link',{name:text('gakuseiNav.logout'),exact:true}).click();
  await expect(page.locator('.profile-button')).toHaveCount(0);
}
test('P0-SESSION: simulated API invalid login, login, logout, refresh and account switch', async ({page,app})=>{
  app.state.username='';
  app.respond('POST','/auth',({body,state})=>{
    const username=new URLSearchParams(body).get('username');
    if(username==='Invalid') return {status:403};
    state.username=username; return {status:200};
  });
  await page.goto(app.origin+'/login');
  await fillLogin(page,'Invalid');
  await page.getByRole('button',{name:text('loginScreen.login.login'),exact:true}).click();
  await expect(page.locator('[name="authFeedback"]')).toContainText('Felaktiga uppgifter');
  await fillLogin(page,'P0Alice');
  await page.getByRole('button',{name:text('loginScreen.login.login'),exact:true}).click();
  await visibleIdentity(page,'P0Alice');
  await page.reload(); await visibleIdentity(page,'P0Alice');
  await logout(page); await page.reload();
  await expect(page.locator('.profile-button')).toHaveCount(0);
  await page.goto(app.origin+'/login'); await fillLogin(page,'P0Bob');
  await page.getByRole('button',{name:text('loginScreen.login.login'),exact:true}).click();
  await visibleIdentity(page,'P0Bob');
  await expect(page.getByText('P0Alice',{exact:true})).toHaveCount(0);
});
test('P0-IDENTITY-RECOVERY: simulated failed identity is fail closed and explicitly retried', async ({page,app})=>{
  app.respond('GET','/username',()=>({status:503,body:{}}));
  await page.goto(app.origin+'/select/guess');
  await expect(page.getByRole('alert')).toContainText('Your session could not be confirmed');
  await expect(page.locator('.exercise')).toHaveCount(0);
  app.respond('GET','/username',()=>({body:{username:'P0Alice',loggedIn:true}}));
  await page.getByRole('button',{name:'Retry session check'}).click();
  await visibleIdentity(page,'P0Alice');
  await expect(exercise(page)).toBeVisible();
});
test('P0-IDENTITY-DELAY: simulated pending identity cannot reveal account-owned lessons', async ({page,app})=>{
  const delayed=app.defer('GET','/username');
  await page.goto(app.origin+'/select/guess'); await delayed.requested;
  await expect(page.getByRole('status')).toHaveText('Checking your session…');
  await expect(page.locator('.exercise')).toHaveCount(0);
  await page.getByRole('link',{name:text('gakuseiNav.about'),exact:true}).click();
  delayed.release({username:'P0Bob',loggedIn:true});
  await visibleIdentity(page,'P0Bob');
  await expect(page).toHaveURL(/\/about$/);
  expect(app.requests.filter(r=>r.query && r.query.username==='P0Alice')).toHaveLength(0);
});
test('P0-REGISTRATION: simulated registration initializes defaults once', async ({page,app})=>{
  app.state.username='';
  app.respond('POST','/registeruser',()=>({status:201}));
  let newUser=true;
  app.respond('POST','/api/checkNewUser',()=>{const status=newUser?200:202;newUser=false;return {status};});
  await page.goto(app.origin+'/login'); await fillLogin(page,'P0New');
  await page.getByRole('button',{name:text('loginScreen.login.register'),exact:true}).click();
  await visibleIdentity(page,'P0New');
  await expect.poll(()=>app.requests.filter(r=>r.path==='/api/checkNewUser').length).toBe(1);
  const defaultNames=['GENKI 01','KLL 01'];
  const additions=()=>app.requests.filter(r=>r.path==='/api/userLessons/add');
  await expect.poll(()=>additions().map(r=>r.query.lessonName).sort()).toEqual(defaultNames);
  await expect.poll(()=>app.state.favorites.slice().sort()).toEqual(defaultNames);
  expect(additions().every(r=>r.method==='POST' && r.query.username==='P0New' && r.status===200)).toBe(true);
  // Wait for both initialization refresh chains before ending this lifecycle.
  await expect.poll(()=>app.requests.filter(r=>r.path==='/api/lessons/favorite' && r.query.username==='P0New' && r.status===200).length).toBeGreaterThanOrEqual(3);
  await page.reload(); await visibleIdentity(page,'P0New');
  await expect.poll(()=>app.requests.filter(r=>r.path==='/api/checkNewUser' && r.status===202).length).toBe(1);
  expect(additions().map(r=>r.query.lessonName).sort()).toEqual(defaultNames);
  expect(app.state.favorites.slice().sort()).toEqual(defaultNames);
});
test('P0-IDENTITY-SUPERSEDED: simulated old identity cannot overwrite a newer UI account login',async({page,app})=>{
  const old=app.defer('GET','/username');
  await page.goto(app.origin+'/login'); await old.requested;
  app.respond('GET','/username',()=>({body:{username:app.state.username,loggedIn:true}}));
  await fillLogin(page,'P0Bob');
  await page.getByRole('button',{name:text('loginScreen.login.login'),exact:true}).click();
  await visibleIdentity(page,'P0Bob'); await expect(exercise(page)).toBeVisible();
  const response=page.waitForResponse(r=>r.url()===app.origin+'/username');
  old.release({username:'P0Alice',loggedIn:true});
  await (await response).finished();
  await page.evaluate(()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve))));
  await visibleIdentity(page,'P0Bob');
  expect(app.requests.filter(r=>r.query.username==='P0Alice')).toHaveLength(0);
  await expect(page.getByText('P0Alice',{exact:true})).toHaveCount(0);
});
test('P0-AUTH-SUPERSEDED: simulated issued login settles before newer account mutation',async({page,app})=>{
  app.state.username='';
  const first=app.defer('POST','/auth');
  await page.goto(app.origin+'/login'); await fillLogin(page,'P0Alice');
  await page.getByRole('button',{name:text('loginScreen.login.login'),exact:true}).click(); await first.requested;
  app.respond('POST','/auth',({body,state})=>{state.username=new URLSearchParams(body).get('username');return {status:200};});
  await fillLogin(page,'P0Bob');
  await page.getByRole('button',{name:text('loginScreen.login.login'),exact:true}).click();
  // A browser round trip lets the second UI operation be observed before release.
  await expect(page.getByPlaceholder(text('loginScreen.Form.placeholderName'))).toHaveValue('P0Bob');
  expect(app.requests.filter(r=>r.path==='/auth')).toHaveLength(1);
  app.state.username='P0Alice'; first.release({},200);
  await visibleIdentity(page,'P0Bob');
  expect(app.requests.filter(r=>r.path==='/auth')).toHaveLength(2);
  expect(app.requests.filter(r=>r.path==='/api/userLessons' && r.query.username==='P0Alice')).toHaveLength(0);
});
test('P0-ACCOUNT-READ: simulated old account catalog read across logout and account switch cannot publish',async({page,app})=>{
  const old=app.defer('GET','/api/userLessons');
  await page.goto(app.origin+'/select/guess'); await old.requested;
  await visibleIdentity(page,'P0Alice');
  await logout(page);
  app.respond('GET','/api/userLessons',()=>({body:[]}));
  // Stay in the same document/store: a full navigation would discard the old read.
  await page.getByRole('link',{name:text('gakuseiNav.signIn'),exact:true}).click();
  await fillLogin(page,'P0Bob');
  await page.getByRole('button',{name:text('loginScreen.login.login'),exact:true}).click();
  await visibleIdentity(page,'P0Bob');
  await expect(exercise(page)).toBeVisible();
  const response=page.waitForResponse(r=>r.url().includes('/api/userLessons?username=P0Alice'));
  old.release([{lesson:{id:9001,name:'Migration P0'}}]);
  await (await response).finished();
  await page.evaluate(()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve))));
  await expect(exercise(page).locator('.toggle-icon-button')).not.toHaveClass(/--active/);
  await visibleIdentity(page,'P0Bob');
});
