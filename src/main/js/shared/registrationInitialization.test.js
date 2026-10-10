import { act } from 'react';
import sinon from 'sinon';
import { createStore, applyMiddleware, compose } from 'redux';
import thunk from 'redux-thunk';
import createMemoryHistory from 'history/createMemoryHistory';
import * as persistence from 'redux-persist';
import rootReducer from './reducers';
import * as Security from './reducers/Security';
import { initializeRegistration, beginAuthentication, finishAuthentication } from './registrationInitialization';
import { mountApp } from './mountApp';
import { routerMiddleware } from './routing';
import i18n from './i18n';

const deferred = () => {
  let resolve, reject;
  const promise = new Promise((yes, no) => { resolve = yes; reject = no; });
  return { promise, resolve, reject };
};
const tick = () => new Promise(resolve => setTimeout(resolve, 30));
const reply = (status, data = []) => ({ status, ok: status >= 200 && status < 300,
  json: () => Promise.resolve(data), text: () => Promise.resolve(JSON.stringify(data)) });

describe('Registration initialization session ownership (proposed)', () => {
  let store, history, calls, roots, containers, identity, queue, previousFetch;
  function makeStore() {
    const h = createMemoryHistory({ initialEntries: ['/about'] });
    const s = createStore(rootReducer, compose(applyMiddleware(thunk, routerMiddleware(h)), persistence.autoRehydrate()));
    s.dispatch(Security.receiveLoggedInUser('LearnerA'));
    return { s, h };
  }
  beforeEach(() => {
    window.localStorage.clear(); roots = []; containers = []; calls = []; queue = new Map();
    identity = { username: 'LearnerA', loggedIn: true };
    ({ s: store, h: history } = makeStore());
    // Keep real AppProvider rehydration gate; use a deferred terminal callback.
    sinon.stub(persistence, 'persistStore').callsFake((facade, config, cb) => {
      setTimeout(() => cb(null, {}), 0); return { pause() {}, purge: () => Promise.resolve() };
    });
    previousFetch = global.fetch;
    global.fetch = sinon.stub().callsFake((url, options = {}) => {
      const path = new URL(url, 'http://localhost').pathname;
      const call = { url, path, options }; calls.push(call);
      if (queue.has(path)) { const d = deferred(); call.d = d; queue.get(path).push(call); return d.promise; }
      if (path === '/username') return Promise.resolve(reply(200, identity));
      if (path === '/api/checkUserLanguage') return Promise.resolve({ status: 202 });
      if (path === '/api/lessons/favorite') return Promise.resolve(reply(200, { name: 'Favoriter', nuggetData: {} }));
      if (path === '/api/addressedQuestionsInLessons') return Promise.resolve(reply(200, {}));
      return Promise.resolve(reply(200));
    });
    queue.set('/api/checkNewUser', []);
    sinon.stub(console, 'error');
  });
  afterEach(async () => {
    await act(async () => roots.forEach(root => root.unmount()));
    containers.forEach(c => c.remove()); sinon.restore(); global.fetch = previousFetch;
  });
  async function mount(s = store, h = history) {
    const c = document.createElement('div'); containers.push(c); document.body.appendChild(c);
    await act(async () => { roots.push(mountApp(c, s, h, i18n)); await tick(); });
    await act(async () => { await tick(); });
    return c;
  }
  async function route(path) { await act(async () => { store.dispatch(Security.setPageByName(path)); await tick(); }); }
  function count(path) { return calls.filter(c => c.path === path).length; }
  async function complete(status = 202) {
    queue.get('/api/checkNewUser').filter(c => c.d).forEach(c => c.d.resolve(reply(status)));
    await act(async () => { await tick(); });
  }
  it('actual provider/router landing redirect and remount share one pending check and pair of defaults', async () => {
    await mount(); await route('/'); await route('/about'); await route('/select/guess');
    expect(count('/api/checkNewUser')).to.equal(1);
    await complete(200);
    expect(count('/api/userLessons/add')).to.equal(2);
    expect(calls.filter(c => c.path === '/api/userLessons/add').map(c => new URL(c.url,'http://localhost').searchParams.get('lessonName'))).to.deep.equal(['GENKI 01','KLL 01']);
    expect(history.location.pathname).to.equal('/select/guess');
  });
  it('202 performs no additions and releases for a later ordinary mount', async () => {
    const p = store.dispatch(initializeRegistration()); await tick(); await complete(); await p;
    expect(count('/api/userLessons/add')).to.equal(0);
    const q = store.dispatch(initializeRegistration()); await tick(); expect(count('/api/checkNewUser')).to.equal(2);
    await complete(); await q;
  });
  it('transport failure before server mutation permits a later retry, with one bounded owner diagnostic', async () => {
    const p = store.dispatch(initializeRegistration()); expect(store.dispatch(initializeRegistration())).to.equal(p);
    await tick(); queue.get('/api/checkNewUser')[0].d.reject(new Error('private'));
    await p.catch(() => {}); expect(console.error.calledOnceWithExactly('Registration initialization failed')).to.equal(true);
    const q = store.dispatch(initializeRegistration()); await tick(); expect(count('/api/checkNewUser')).to.equal(2);
    await complete(); await q;
  });
  it('first-add rejection retains the shared flight until the sibling chain settles', async () => {
    queue.set('/api/userLessons/add', []);
    const p = store.dispatch(initializeRegistration()); await tick(); await complete(200);
    const adds = queue.get('/api/userLessons/add'); expect(adds).to.have.length(2);
    adds[0].d.resolve(reply(500)); await tick();
    expect(store.dispatch(initializeRegistration())).to.equal(p);
    adds[1].d.resolve(reply(200)); await p.catch(() => {});
    const q = store.dispatch(initializeRegistration()); await tick(); expect(q).not.to.equal(p); await complete(); await q;
  });
  it('delayed scoped refresh JSON cannot publish after account change', async () => {
    queue.set('/api/userLessons', []);
    const p = store.dispatch(initializeRegistration()); await tick(); await complete(200);
    const json = deferred(); const refreshes = queue.get('/api/userLessons'); expect(refreshes).to.have.length(2);
    refreshes.forEach(c => c.d.resolve({ ok: true, status: 200, json: () => json.promise })); await tick();
    const before = store.getState().lessons.starredLessons;
    store.dispatch(Security.receiveLoggedInUser('LearnerB')); json.resolve([{ lesson: { name: 'stale' } }]); await p;
    expect(store.getState().lessons.starredLessons).to.equal(before);
  });
  it('unmount does not cancel work and distinct stores have independent flights', async () => {
    await mount(); await route('/select/guess'); await act(async () => roots.shift().unmount());
    const second = makeStore(); const p = second.s.dispatch(initializeRegistration()); await tick();
    expect(count('/api/checkNewUser')).to.equal(2); await complete(200); await p; expect(count('/api/userLessons/add')).to.equal(4);
  });
  it('routine same-user identity refresh leaves the pending promise intact', async () => {
    const p = store.dispatch(initializeRegistration()); await tick(); await store.dispatch(Security.fetchLoggedInUser());
    expect(store.dispatch(initializeRegistration())).to.equal(p); await complete(); await p;
  });
  it('actual held logout blocks remount admission and stale check side effects', async () => {
    queue.set('/logout', []); const p = store.dispatch(initializeRegistration()); await tick();
    const logout = store.dispatch(Security.requestUserLogout('/login')); await tick();
    await store.dispatch(initializeRegistration()); expect(count('/api/checkNewUser')).to.equal(1);
    await complete(200); await p; expect(count('/api/userLessons/add')).to.equal(0);
    queue.get('/logout')[0].d.resolve(reply(204)); await logout; expect(store.getState().security.loggedIn).to.equal(false);
  });
  it('same-name actual logout/login invalidates old work and admits only the confirmed new session', async () => {
    queue.set('/auth', []); const old = store.dispatch(initializeRegistration()); await tick();
    await store.dispatch(Security.requestUserLogout('/login'));
    const auth = store.dispatch(Security.requestUserLogin('username=LearnerA&password=test')); await tick();
    await store.dispatch(initializeRegistration()); expect(count('/api/checkNewUser')).to.equal(1);
    queue.get('/auth')[0].d.resolve(reply(200)); await auth; await complete(200); await old;
    expect(count('/api/userLessons/add')).to.equal(0);
    const next = store.dispatch(initializeRegistration()); await tick(); await complete(); await next;
    expect(count('/api/checkNewUser')).to.equal(2);
  });
  it('failed HTTP login preserves visible original feedback after owned progress completion', async () => {
    identity={username:'',loggedIn:false};store.dispatch(Security.receiveLoggedInUser(''));
    await mount();await route('/login');queue.set('/auth',[]);
    const login=store.dispatch(Security.requestUserLogin('username=Absent&password=InvalidDisposablePassword'));
    await tick();await act(async()=>{queue.get('/auth')[0].d.resolve(reply(403));await login;await tick();});
    const security=store.getState().security;
    expect(security.loginInProgress).to.equal(false);expect(security.registerInProgress).to.equal(false);
    expect(security.authSuccess).to.equal(false);expect(security.authResponse).to.be.a('string').and.not.to.equal('');
    const feedback=document.querySelector('[name="authFeedback"]');expect(feedback).not.to.equal(null);
    expect(feedback.textContent).to.equal(security.authResponse);
    expect(store.getState().security.loggedIn).to.equal(false);
  });
  it('stale auth failure cannot release a newer operation or publish a stale identity', async () => {
    queue.set('/auth', []);
    const first = store.dispatch(Security.requestUserLogin('first')); await tick();
    const second = store.dispatch(Security.requestUserLogin('second')); await tick();
    queue.get('/auth')[0].d.reject(new Error('private')); await first; await tick();
    await store.dispatch(initializeRegistration()); expect(count('/api/checkNewUser')).to.equal(0);
    identity = { username: 'LearnerB', loggedIn: true }; queue.get('/auth')[1].d.resolve(reply(200)); await second;
    const p = store.dispatch(initializeRegistration()); await tick(); expect(queue.get('/api/checkNewUser')[0].options.body).to.equal('LearnerB'); await complete(); await p;
  });
  it('old flight completion and hold release cannot remove a newer owned flight', async () => {
    const old = store.dispatch(initializeRegistration()); await tick(); const token = beginAuthentication(store.getState);
    const newToken = beginAuthentication(store.getState); finishAuthentication(store.getState, token);
    await store.dispatch(initializeRegistration()); expect(count('/api/checkNewUser')).to.equal(1);
    finishAuthentication(store.getState, newToken); const fresh = store.dispatch(initializeRegistration()); await tick();
    queue.get('/api/checkNewUser')[0].d.resolve(reply(202)); await old;
    expect(store.dispatch(initializeRegistration())).to.equal(fresh); await complete(); await fresh;
  });
  it('actual register delay transfers hold and failed HTTP/transport authentication releases it', async () => {
    queue.set('/registeruser', []); queue.set('/auth', []);
    const register = store.dispatch(Security.requestUserRegister('username=LearnerA&password=test')); await tick();
    queue.get('/registeruser')[0].d.resolve(reply(201)); await tick();
    await store.dispatch(initializeRegistration()); expect(count('/api/checkNewUser')).to.equal(0);
    await new Promise(resolve => setTimeout(resolve, 1550)); expect(queue.get('/auth')).to.have.length(1);
    queue.get('/auth')[0].d.resolve(reply(403)); await register;
    const p = store.dispatch(initializeRegistration()); await tick(); expect(count('/api/checkNewUser')).to.equal(1); await complete(); await p;
  });

  for (const refusal of [['login',403],['register',406],['register',422]]) {
    it('uncertain session survives '+refusal.join(' ')+' until a successful ordinary identity read', async () => {
      queue.set('/auth', []); queue.set('/username', []);
      const failed = store.dispatch(Security.requestUserLogin('failed')); await tick();
      queue.get('/auth')[0].d.reject(new Error('transport')); await tick();
      queue.get('/username')[0].d.reject(new Error('identity transport')); await failed;
      const path=refusal[0]==='login'?'/auth':'/registeruser'; queue.set(path, []);
      const refused=store.dispatch(refusal[0]==='login'?Security.requestUserLogin('refused'):Security.requestUserRegister('refused')); await tick();
      queue.get(path)[0].d.resolve(reply(refusal[1])); await refused;
      await store.dispatch(initializeRegistration()); expect(count('/api/checkNewUser')).to.equal(0);
      const read=store.dispatch(Security.fetchLoggedInUser()); await tick();
      queue.get('/username')[1].d.resolve(reply(200,identity)); await read;
      const init=store.dispatch(initializeRegistration()); await tick(); expect(count('/api/checkNewUser')).to.equal(1); await complete(); await init;
    });
  }
  for (const failure of ['http','text','json','transport']) {
    it('identity '+failure+' failure keeps admission closed; owned auth success reopens', async () => {
      queue.set('/auth', []); queue.set('/username', []);
      const p=store.dispatch(Security.requestUserLogin('A')); await tick(); queue.get('/auth')[0].d.resolve(reply(200)); await tick();
      const bad=queue.get('/username')[0];
      if(failure==='transport') bad.d.reject(new Error('transport'));
      else bad.d.resolve(failure==='http'?reply(503):{status:200,text:()=>failure==='text'?Promise.reject(new Error('text')):Promise.resolve('not JSON')});
      await tick(); queue.get('/username')[1].d.reject(new Error('failed recovery')); await p;
      await store.dispatch(initializeRegistration()); expect(count('/api/checkNewUser')).to.equal(0);
      const q=store.dispatch(Security.requestUserLogin('B')); await tick(); queue.get('/auth')[1].d.resolve(reply(200)); await tick();
      identity={username:'LearnerB',loggedIn:true}; queue.get('/username')[2].d.resolve(reply(200,identity)); await q;
      const init=store.dispatch(initializeRegistration()); await tick(); expect(queue.get('/api/checkNewUser')[0].options.body).to.equal('LearnerB'); await complete(); await init;
    });
  }
  it('same-turn superseded unissued mutation is skipped', async () => {
    queue.set('/auth', []);
    const a=store.dispatch(Security.requestUserLogin('A')), b=store.dispatch(Security.requestUserLogin('B')); await tick();
    expect(queue.get('/auth')).to.have.length(1); expect(queue.get('/auth')[0].options.body).to.equal('B');
    queue.get('/auth')[0].d.resolve(reply(403)); await Promise.all([a,b]);
    expect(store.getState().security.loginInProgress).to.equal(false);
  });
  for (const kinds of [['login','register'],['register','login'],['login','logout'],['register','logout'],['logout','login'],['logout','register']]) {
    for (const terminal of ['success','refusal','uncertain']) {
      it('progress transfers '+kinds.join(' -> ')+' at admission and settles on '+terminal, async () => {
        queue.set('/auth', []); queue.set('/registeruser', []); queue.set('/logout', []); queue.set('/username', []);
        const request=kind=>kind==='login'?Security.requestUserLogin('x'):kind==='register'?Security.requestUserRegister('x'):Security.requestUserLogout('/login');
        const path=kind=>kind==='login'?'/auth':kind==='register'?'/registeruser':'/logout';
        const a=store.dispatch(request(kinds[0])); await tick(); const b=store.dispatch(request(kinds[1]));
        expect(store.getState().security.loginInProgress).to.equal(kinds[1]==='login');
        expect(store.getState().security.registerInProgress).to.equal(kinds[1]==='register');
        expect(count(path(kinds[1]))).to.equal(0);
        queue.get(path(kinds[0]))[0].d.resolve(reply(200)); await a; await tick();
        const call=queue.get(path(kinds[1]))[0];
        if(terminal==='uncertain') call.d.reject(new Error('transport'));
        else call.d.resolve(reply(kinds[1]==='logout'?(terminal==='success'?204:403):kinds[1]==='register'?(terminal==='success'?201:422):terminal==='success'?200:403));
        await tick();
        if(terminal==='uncertain') { queue.get('/username')[0].d.reject(new Error('identity')); }
        else if(kinds[1]==='logout'&&terminal==='refusal') queue.get('/username')[0].d.resolve(reply(200,identity));
        else if(kinds[1]==='login'&&terminal==='success') queue.get('/username')[0].d.resolve(reply(200,identity));
        else if(kinds[1]==='register'&&terminal==='success') {
          await new Promise(resolve=>setTimeout(resolve,1550));
          queue.get('/auth')[queue.get('/auth').length-1].d.resolve(reply(200)); await tick();
          queue.get('/username')[0].d.resolve(reply(200,identity));
        }
        await b;
        expect(store.getState().security.loginInProgress).to.equal(false); expect(store.getState().security.registerInProgress).to.equal(false);
        if(terminal==='uncertain') { await store.dispatch(initializeRegistration()); expect(count('/api/checkNewUser')).to.equal(0); }
      });
    }
  }
  it('delayed successful older server mutation settles before newer issuance and cannot publish older identity', async () => {
    queue.set('/auth', []);
    const a=store.dispatch(Security.requestUserLogin('A')); await tick(); const b=store.dispatch(Security.requestUserLogin('B')); await tick();
    expect(count('/auth')).to.equal(1); identity={username:'LearnerA',loggedIn:true}; queue.get('/auth')[0].d.resolve(reply(200)); await a; await tick();
    expect(count('/username')).to.equal(0); expect(count('/auth')).to.equal(2);
    identity={username:'LearnerB',loggedIn:true}; queue.get('/auth')[1].d.resolve(reply(200)); await b;
    expect(store.getState().security.loggedInUser).to.equal('LearnerB');
  });
  for (const older of ['login-success','logout-success','login-transport','logout-transport']) {
    for (const refusal of [['login',403],['register',406],['register',422]]) {
      for (const recovery of ['ordinary','owned']) {
      it('issued superseded '+older+' -> '+refusal.join(' ')+' keeps admission closed until '+recovery+' identity confirmation', async () => {
        queue.set('/auth', []); queue.set('/logout', []); queue.set('/registeruser', []); queue.set('/username', []);
        const isLogout=older.startsWith('logout'), firstPath=isLogout?'/logout':'/auth';
        const first=store.dispatch(isLogout?Security.requestUserLogout('/login'):Security.requestUserLogin('username=LearnerB'));
        await tick(); expect(count(firstPath)).to.equal(1);
        const nextPath=refusal[0]==='login'?'/auth':'/registeruser';
        const second=store.dispatch(refusal[0]==='login'?Security.requestUserLogin('refused'):Security.requestUserRegister('refused'));
        expect(store.getState().security.loginInProgress).to.equal(refusal[0]==='login');
        expect(store.getState().security.registerInProgress).to.equal(refusal[0]==='register');
        await store.dispatch(initializeRegistration()); expect(count('/api/checkNewUser')).to.equal(0);
        if(older.endsWith('transport')) queue.get(firstPath)[0].d.reject(new Error('transport'));
        else {
          identity=isLogout?{username:'',loggedIn:false}:{username:'LearnerB',loggedIn:true};
          queue.get(firstPath)[0].d.resolve(reply(isLogout?204:200));
        }
        await first; await tick();
        expect(store.getState().security.loggedInUser).to.equal('LearnerA');
        expect(store.getState().security.loginInProgress).to.equal(refusal[0]==='login');
        expect(store.getState().security.registerInProgress).to.equal(refusal[0]==='register');
        const newest=queue.get(nextPath)[queue.get(nextPath).length-1];
        expect(newest.options.body).to.equal('refused'); newest.d.resolve(reply(refusal[1])); await second;
        expect(count('/username')).to.equal(0);
        expect(store.getState().security.loginInProgress).to.equal(false);
        expect(store.getState().security.registerInProgress).to.equal(false);
        await store.dispatch(initializeRegistration()); expect(count('/api/checkNewUser')).to.equal(0);
        // Failed confirmation must not erase the uncertainty, either.
        const failedRead=store.dispatch(Security.fetchLoggedInUser()); await tick();
        queue.get('/username')[0].d.reject(new Error('identity unavailable')); await failedRead.catch(()=>{});
        await store.dispatch(initializeRegistration()); expect(count('/api/checkNewUser')).to.equal(0);
        if(recovery==='ordinary') {
        const read=store.dispatch(Security.fetchLoggedInUser()); await tick();
        queue.get('/username')[1].d.resolve(reply(200,identity)); await read;
        const ordinary=store.dispatch(initializeRegistration()); await tick();
        if(identity.loggedIn) {
          expect(queue.get('/api/checkNewUser')[0].options.body).to.equal(identity.username);
          await complete();
        } else expect(count('/api/checkNewUser')).to.equal(0);
        await ordinary;
        }
        // A newer successful owned login must still reopen for its captured B.
        const login=store.dispatch(Security.requestUserLogin('username=LearnerB')); await tick();
        queue.get('/auth')[queue.get('/auth').length-1].d.resolve(reply(200)); await tick();
        identity={username:'LearnerB',loggedIn:true};
        queue.get('/username')[queue.get('/username').length-1].d.resolve(reply(200,identity)); await login;
        const init=store.dispatch(initializeRegistration()); await tick();
        const check=queue.get('/api/checkNewUser')[queue.get('/api/checkNewUser').length-1];
        expect(check.options.body).to.equal('LearnerB'); await complete(); await init;
        expect(store.getState().security.loginInProgress).to.equal(false);
        expect(store.getState().security.registerInProgress).to.equal(false);
      });
      }
    }
  }
  it('old ordinary identity JSON completion cannot clear newer uncertainty', async () => {
    queue.set('/username', []); queue.set('/auth', []);
    const read=store.dispatch(Security.fetchLoggedInUser()); await tick(); const body=deferred();
    queue.get('/username')[0].d.resolve({status:200,text:()=>body.promise}); await tick();
    const auth=store.dispatch(Security.requestUserLogin('B')); await tick(); queue.get('/auth')[0].d.reject(new Error('transport')); await tick();
    queue.get('/username')[1].d.reject(new Error('probe')); await auth;
    body.resolve(JSON.stringify({username:'LearnerOld',loggedIn:true})); await read;
    await store.dispatch(initializeRegistration()); expect(count('/api/checkNewUser')).to.equal(0); expect(store.getState().security.loggedInUser).to.equal('LearnerA');
  });
});
