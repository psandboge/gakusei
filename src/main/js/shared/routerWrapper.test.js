import React, { act } from 'react';
import { createRoot } from 'react-dom/client';
import { Router, withRouter } from 'react-router-dom';
import { createMemoryHistory } from 'history';
import { LinkContainer } from 'react-router-bootstrap';
import { Nav, NavItem, MenuItem } from 'react-bootstrap';
import sinon from 'sinon';
import { GakuseiNav, Reducers as NavReducers } from '../screens/app/components/GakuseiNav';

describe('Router wrapper with retained Bootstrap children', () => {
  let container, root, history, previousFetch;
  beforeEach(() => {
    previousFetch = global.fetch;
    container = document.createElement('div'); document.body.appendChild(container);
    root = createRoot(container); history = createMemoryHistory({ initialEntries: ['/about/detail'] });
  });
  afterEach(async () => { await act(async () => root.unmount()); container.remove(); sinon.restore(); global.fetch = previousFetch; });
  const render = async element => act(async () => root.render(<Router history={history}>{element}</Router>));
  const click = async (selector, options = {}) => {
    const event = new window.MouseEvent('click', { bubbles: true, cancelable: true, button: 0, ...options });
    // Observe React's handling before preventing unsupported jsdom native navigation.
    let intercepted;
    const nativeDefault = e => { intercepted = e.defaultPrevented; e.preventDefault(); };
    document.addEventListener('click', nativeDefault, { once: true });
    await act(async () => container.querySelector(selector).dispatchEvent(event));
    document.removeEventListener('click', nativeDefault);
    if (options.button || options.metaKey || options.altKey || options.ctrlKey || options.shiftKey) expect(intercepted).to.equal(false);
    return event;
  };
  it('retains href, default and exact matching through push, replace, back and forward', async () => {
    await render(<Nav><LinkContainer to="/about"><NavItem className="prefix">About</NavItem></LinkContainer>
      <LinkContainer to="/about" exact activeClassName="chosen"><NavItem className="exact">Exact</NavItem></LinkContainer>
      <LinkContainer to="/about/" strict><NavItem className="strict">Strict</NavItem></LinkContainer></Nav>);
    expect(container.querySelector('.prefix a').getAttribute('href')).to.equal('/about');
    expect(container.querySelector('.prefix').classList.contains('active')).to.equal(true);
    expect(container.querySelector('.exact').classList.contains('chosen')).to.equal(false);
    await act(async () => history.push('/about'));
    expect(container.querySelector('.exact').classList.contains('chosen')).to.equal(true);
    expect(container.querySelector('.strict').classList.contains('active')).to.equal(false);
    await act(async () => history.replace('/other'));
    expect(container.querySelector('.prefix').classList.contains('active')).to.equal(false);
    await act(async () => history.goBack());
    expect(container.querySelector('.prefix').classList.contains('active')).to.equal(true);
    await act(async () => history.goForward());
    expect(container.querySelector('.prefix').classList.contains('active')).to.equal(false);
  });
  it('calls child before parent, respects prevention and intercepts only primary unmodified navigation', async () => {
    const calls = [];
    await render(<Nav><LinkContainer to="/next" onClick={() => calls.push('parent')}>
      <NavItem className="next" onClick={() => calls.push('child')}>Next</NavItem>
    </LinkContainer></Nav>);
    for (const options of [{metaKey:true}, {altKey:true}, {ctrlKey:true}, {shiftKey:true}, {button:1}, {button:2}]) {
      await click('.next a', options);
      expect(history.location.pathname).to.equal('/about/detail');
    }
    calls.length = 0;
    await click('.next a');
    expect(calls).to.deep.equal(['child', 'parent']);
    expect(history.location.pathname).to.equal('/next'); expect(history.action).to.equal('PUSH');
    await render(<ul><LinkContainer to="/replacement" replace><MenuItem className="replace">Replace</MenuItem></LinkContainer>
      <LinkContainer to="/blocked" onClick={() => calls.push('parent')}><MenuItem className="blocked" onClick={e => { calls.push('child'); e.preventDefault(); }}>Blocked</MenuItem></LinkContainer></ul>);
    await click('.replace a'); expect(history.location.pathname).to.equal('/replacement'); expect(history.action).to.equal('REPLACE');
    calls.length = 0; await click('.blocked a');
    expect(calls).to.deep.equal(['child', 'parent']); expect(history.location.pathname).to.equal('/replacement');
  });
  it('honors strict trailing slash and custom active matching', async () => {
    await render(<Nav><LinkContainer to="/about/" strict activeClassName="strict-active"><NavItem className="strict">Strict</NavItem></LinkContainer>
      <LinkContainer to="/elsewhere" isActive={(match, location) => location.pathname === '/about/detail'} activeClassName="custom-active"><NavItem className="custom">Custom</NavItem></LinkContainer></Nav>);
    expect(container.querySelector('.custom').classList.contains('custom-active')).to.equal(true);
    await act(async () => history.push('/about/'));
    expect(container.querySelector('.strict').classList.contains('strict-active')).to.equal(true);
    expect(container.querySelector('.custom').classList.contains('custom-active')).to.equal(false);
  });
  it('renders retained anonymous and se/jp authenticated callers with dropdown selection', async () => {
    global.fetch = sinon.stub().resolves({ json: () => Promise.resolve([]) });
    const NavWithRouter = withRouter(GakuseiNav);
    const actionProps = {};
    NavReducers.forEach(reducer => Object.keys(reducer.actionCreators).forEach(name => { actionProps[name] = () => {}; }));
    const nav = (loggedIn, language) => <NavWithRouter {...GakuseiNav.defaultProps} {...actionProps} loggedIn={loggedIn} loggedInUser={loggedIn ? 'OwnedTest' : ''} t={key => key} i18n={{language}} />;
    await render(nav(false, 'se'));
    expect(container.querySelector('.menu-button a').getAttribute('href')).to.equal('/login');
    expect(container.querySelector('.kanjiPlay')).to.equal(null);
    await render(nav(true, 'se'));
    expect(container.querySelector('.kanjiPlay a').getAttribute('href')).to.equal('/select/kanji');
    await click('.profile-button > a');
    expect(container.querySelector('.profile-button').classList.contains('open')).to.equal(true);
    await click('.settings a');
    expect(history.location.pathname).to.equal('/settings');
    expect(container.querySelector('.profile-button').classList.contains('open')).to.equal(false);
    await render(nav(true, 'jp'));
    expect(container.querySelector('.kanjiPlay')).to.equal(null);
    expect(container.querySelector('.quizPlay a').getAttribute('href')).to.equal('/select/quiz');
    await click('.glosorDropdown > a');
    await click('.guessPlay a');
    expect(history.location.pathname).to.equal('/select/guess');
    expect(container.querySelector('.glosorDropdown').classList.contains('open')).to.equal(false);
    await act(async () => root.unmount());
    root = createRoot(container);
    await render(nav(false, 'se'));
    expect(container.querySelector('.menu-button a').getAttribute('href')).to.equal('/login');
  });
  it('preserves existing login string and logout query-object href semantics', async () => {
    await render(<Nav><LinkContainer to="/login?from=about"><NavItem className="login">Login</NavItem></LinkContainer>
      <LinkContainer to={{pathname:'/logout',query:{currentUrl:'/about'}}}><NavItem className="logout">Logout</NavItem></LinkContainer></Nav>);
    expect(container.querySelector('.login a').getAttribute('href')).to.equal('/login?from=about');
    expect(container.querySelector('.logout a').getAttribute('href')).to.equal('/logout');
    await click('.login a'); expect(history.location.pathname).to.equal('/login'); expect(history.location.search).to.equal('?from=about');
    await click('.logout a'); expect(history.location.pathname).to.equal('/logout'); expect(history.location.search).to.equal('');
    expect(history.location.query).to.deep.equal({currentUrl:'/about'});
  });
});
