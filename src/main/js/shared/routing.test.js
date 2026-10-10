import React, { act } from 'react';
import { createRoot } from 'react-dom/client';
import { createStore, applyMiddleware } from 'redux';
import { Provider, connect } from 'react-redux';
import createMemoryHistory from 'history/createMemoryHistory';
import { ConnectedRouter, routerReducer, routerMiddleware, push, replace, go, goBack, goForward, CALL_HISTORY_METHOD } from './routing';

describe('React 18 routing bridge', () => {
  it('retains legacy payloads and consumes only history actions', () => {
    expect(push('/x', { a: 1 })).to.deep.equal({ type: CALL_HISTORY_METHOD, payload: { method: 'push', args: ['/x', { a: 1 }] } });
    expect(go(-2).payload).to.deep.equal({ method: 'go', args: [-2] });
    const h = createMemoryHistory();
    const seen = [];
    const middleware = routerMiddleware(h)({})(a => { seen.push(a); return 'forwarded'; });
    const unrelated = { type: 'OTHER' };
    expect(middleware(unrelated)).to.equal('forwarded');
    expect(seen).to.deep.equal([unrelated]);
    middleware(push('/x')); middleware(replace('/y'));
    expect(h.location.pathname).to.equal('/y');
    const state = routerReducer();
    expect(state).to.deep.equal({ location: null });
    expect(routerReducer(state, unrelated)).to.equal(state);
  });
  it('initializes real connected consumers and handles push/replace/back/forward with teardown', async () => {
    const history = createMemoryHistory({ initialEntries: ['/initial'] });
    const store = createStore(routerReducer, applyMiddleware(routerMiddleware(history)));
    const View = connect(s => ({ path: s.location.pathname }))(({ path }) => <span>{path}</span>);
    const element = document.createElement('div');
    document.body.appendChild(element);
    const root = createRoot(element);
    await act(async () => root.render(<Provider store={store}><ConnectedRouter store={store} history={history}><View /></ConnectedRouter></Provider>));
    expect(element.textContent).to.equal('/initial');
    await act(async () => { store.dispatch(push('/second')); store.dispatch(replace('/replaced')); });
    expect(element.textContent).to.equal('/replaced');
    await act(async () => store.dispatch(goBack()));
    expect(element.textContent).to.equal('/initial');
    await act(async () => store.dispatch(goForward()));
    expect(element.textContent).to.equal('/replaced');
    await act(async () => root.unmount());
    const before = store.getState();
    history.push('/after-unmount');
    expect(store.getState()).to.equal(before);
    element.remove();
  });
});
