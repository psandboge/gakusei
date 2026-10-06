import React, { act } from 'react';
import sinon from 'sinon';
import * as persistence from 'redux-persist';
import { createStore, applyMiddleware } from 'redux';
import createMemoryHistory from 'history/createMemoryHistory';
import { mountApp } from './shared/mountApp';
import { routerMiddleware } from './shared/routing';
import rootReducer from './shared/reducers';
import thunk from 'redux-thunk';
import i18n from './shared/i18n';

const wait = () => new Promise(resolve => setTimeout(resolve, 30));

describe('Actual AppProvider with React 18 root and persistence', () => {
  let container, root, history, store, stub, original, callbacks, active, writes, data, purges, pauseCalls;
  beforeEach(() => {
    window.localStorage.clear();
    container = document.createElement('div'); document.body.appendChild(container);
    history = createMemoryHistory({ initialEntries: ['/about'] });
    store = createStore(rootReducer, applyMiddleware(thunk, routerMiddleware(history)));
    active = 0; writes = 0; callbacks = []; purges = []; pauseCalls = 0;
    data = { 'reduxPersist:security': JSON.stringify({ loggedIn: false, loggedInUser: '', projectVersion: process.env.PROJECT_VERSION }),
      'reduxPersist:lessons': JSON.stringify({ smartLearning: false }) };
    const subscribe = store.subscribe;
    store.subscribe = cb => {
      active++;
      const stop = subscribe(cb);
      return () => { active--; stop(); };
    };
    original = persistence.persistStore;
    // Use the real persistStore implementation with controlled callback storage.
    stub = sinon.stub(persistence, 'persistStore').callsFake((facade, config, complete) => {
      let readStarted = false;
      const storage = {
        getAllKeys: cb => {
          if (!readStarted) {
            readStarted = true; callbacks.push(() => cb(null, Object.keys(data)));
          } else cb(null, Object.keys(data));
        },
        getItem: (key, cb) => cb(null, data[key]),
        setItem: (key, value, cb) => { writes++; data[key] = value; cb(null); },
        removeItem: (key, cb) => new Promise(resolve => purges.push(() => { delete data[key]; cb(null); resolve(); }))
      };
      const persistor = original(facade, { ...config, storage }, complete);
      const pause = persistor.pause;
      persistor.pause = () => { pauseCalls++; pause(); };
      return persistor;
    });
    sinon.stub(global, 'fetch').callsFake(url => Promise.resolve({ status: 200,
      text: () => Promise.resolve(JSON.stringify({ username: '', loggedIn: false })),
      json: () => Promise.resolve([]) }));
  });
  afterEach(async () => {
    if (root) await act(async () => root.unmount());
    root = null; sinon.restore(); container.remove();
  });
  const mount = async () => {
    await act(async () => { root = mountApp(container, store, history, i18n); await wait(); });
    // React commits after the act body; allow persistStore's deferred read.
    await act(async () => { await wait(); });
  };
  it('gates actual app commit on rehydration and retains stored state and routing blacklist', async () => {
    await mount();
    expect(container.textContent).to.equal(''); expect(active).to.equal(1);
    await act(async () => { callbacks.shift()(); await wait(); });
    expect(container.querySelector('main')).not.to.equal(null);
    expect(store.getState().lessons.smartLearning).to.equal(false);
    expect(store.getState().routing.location.pathname).to.equal('/about');
    expect(data).not.to.have.property('reduxPersist:routing');
  });
  it('waits for version purge resolution before showing the tree', async () => {
    data['reduxPersist:security'] = JSON.stringify({ purgeNeeded: true, projectVersion: 'old' });
    await mount();
    await act(async () => { callbacks.shift()(); await wait(); });
    expect(purges.length).to.equal(2); expect(container.textContent).to.equal('');
    await act(async () => { purges.splice(0).forEach(cb => cb()); await wait(); });
    expect(container.querySelector('main')).not.to.equal(null);
    expect(data).not.to.have.property('reduxPersist:security');
  });
  it('pauses late read completion and removes persistence subscriptions across repeated mounts', async () => {
    for (let n = 0; n < 3; n++) {
      await mount(); expect(active).to.equal(1);
      await act(async () => root.unmount()); root = null;
      expect(active).to.equal(0);
      await act(async () => { callbacks.shift()(); await wait(); });
      expect(pauseCalls).to.equal((n + 1) * 2);
      const before = writes;
      store.dispatch({ type: 'SET_PAGE', currentPageName: 'later' });
      await wait(); expect(writes).to.equal(before);
      expect(purges).to.have.length(0);
    }
  });
  it('keeps late purge completion from committing after unmount', async () => {
    data['reduxPersist:security'] = JSON.stringify({ purgeNeeded: true });
    await mount();
    await act(async () => { callbacks.shift()(); await wait(); });
    await act(async () => root.unmount()); root = null;
    await act(async () => { purges.splice(0).forEach(cb => cb()); await wait(); });
    expect(container.textContent).to.equal(''); expect(active).to.equal(0); expect(pauseCalls).to.equal(2);
  });
  it('handles error with undefined restored state and reports bounded failure without content', async () => {
    stub.restore();
    let complete;
    sinon.stub(persistence, 'persistStore').callsFake((facade, config, cb) => {
      complete = cb; return { pause: () => pauseCalls++ };
    });
    const diagnostic = sinon.spy(console, 'error');
    await mount();
    await act(async () => { await complete(new Error('private-value')); });
    expect(container.querySelector('[role="alert"]').textContent).to.equal('Application persistence failed');
    expect(container.querySelector('main')).to.equal(null);
    expect(diagnostic.calledWithExactly('Application persistence failed')).to.equal(true);
    expect(pauseCalls).to.equal(1);
  });
  it('blocks content when purge rejects', async () => {
    stub.restore(); let complete;
    sinon.stub(persistence, 'persistStore').callsFake((facade, config, cb) => {
      complete = cb; return { pause: () => pauseCalls++, purge: () => Promise.reject(new Error('private-value')) };
    });
    await mount();
    await act(async () => complete(null, { security: { purgeNeeded: true } }));
    expect(container.querySelector('[role="alert"]')).not.to.equal(null);
    expect(container.querySelector('main')).to.equal(null);
  });
});
