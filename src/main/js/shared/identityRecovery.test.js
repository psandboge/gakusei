import React, { act } from 'react';
import { createRoot } from 'react-dom/client';
import { createStore, applyMiddleware } from 'redux';
import thunk from 'redux-thunk';
import { Provider, connect } from 'react-redux';
import { bindActionCreators } from 'redux';
import { AppScreen } from '../screens/app/AppScreen';
import { I18nextProvider } from 'react-i18next';
import i18n from './i18n';
import { Router, Route } from 'react-router';
import { createMemoryHistory } from 'history';
import { REHYDRATE } from 'redux-persist/constants';
import sinon from 'sinon';
import rootReducer from './reducers';
import * as Security from './reducers/Security';
import { routerMiddleware, LOCATION_CHANGE } from './routing';
import { initializeRegistration, beginAuthentication, finishAuthentication } from './registrationInitialization';
import { requireAuthentication } from './components/AuthenticatedComponent';

const defer = () => { let resolve, reject; const promise = new Promise((y,n) => { resolve=y; reject=n; }); return {promise,resolve,reject}; };
const reply = (loggedIn = true) => ({status:200,text:()=>Promise.resolve(JSON.stringify({loggedIn,username:loggedIn?'RestoredUser':''}))});
describe('Ordinary identity and route recovery (R1/R2)', () => {
 let store, history, root, container, previousFetch, calls;
 beforeEach(() => {
  history=createMemoryHistory({initialEntries:['/protected']});
  store=createStore(rootReducer,applyMiddleware(thunk,routerMiddleware(history)));
  history.listen(location=>store.dispatch({type:LOCATION_CHANGE,payload:location}));
  store.dispatch({type:LOCATION_CHANGE,payload:history.location});
  store.dispatch({type:REHYDRATE,payload:{security:{loggedIn:true,loggedInUser:'RestoredUser'}}});
  previousFetch=global.fetch; calls=[];
  container=document.createElement('div');document.body.appendChild(container);root=createRoot(container);
 });
 afterEach(async()=>{await act(async()=>root.unmount());container.remove();global.fetch=previousFetch;sinon.restore();});
 const renderGuard = async () => {
  const Protected=requireAuthentication(()=> <span>Authenticated private tree</span>);
  await act(async()=>root.render(<Provider store={store}><Router history={history}><Route path="/protected" component={Protected}/></Router></Provider>));
 };
 for(const caller of ['startup','verification']) for(const failure of ['http','body','json','transport']) {
  it(caller+' '+failure+' hides restored tree, blocks initialization and permits confirmed retry',async()=>{
   const pending=defer();
   global.fetch=(url)=>{calls.push(url);return pending.promise;};
   await renderGuard();expect(container.textContent).not.to.contain('Authenticated private tree');
   let read;
   await act(async()=>{read=store.dispatch(caller==='startup'?Security.fetchLoggedInUser():Security.verifyUserLoggedIn());});
   expect(read).to.have.property('then');
   await store.dispatch(initializeRegistration());expect(calls).to.deep.equal(['/username']);
   await act(async()=>{
    if(failure==='transport')pending.reject(Error('private transport'));
    else pending.resolve({status:failure==='http'?503:200,text:()=>failure==='body'?Promise.reject(Error('private body')):Promise.resolve('invalid json')});
    await read;
   });
   expect(store.getState().security).to.include({loggedIn:false,loggedInUser:'',identityStatus:'failed'});
   expect(container.textContent).not.to.contain('Authenticated private tree');expect(history.location.pathname).to.equal('/protected');
   await store.dispatch(initializeRegistration());expect(calls).to.deep.equal(['/username']);
   global.fetch=(url)=>{calls.push(url);return Promise.resolve(url==='/username'?reply():{status:202});};
   await act(async()=>store.dispatch(Security.fetchLoggedInUser()));
   expect(store.getState().security).to.include({loggedIn:true,loggedInUser:'RestoredUser',identityStatus:'confirmed'});
   expect(container.textContent).to.contain('Authenticated private tree');
   await store.dispatch(initializeRegistration());expect(calls).to.deep.equal(['/username','/username','/api/checkNewUser']);
  });
 }
 it('older ordinary failure cannot clear newer successful identity',async()=>{
  const first=defer();let count=0;global.fetch=()=>++count===1?first.promise:Promise.resolve(reply());
  const a=store.dispatch(Security.fetchLoggedInUser());await Promise.resolve();await store.dispatch(Security.fetchLoggedInUser());
  first.reject(Error('stale'));await a;expect(store.getState().security).to.include({loggedIn:true,identityStatus:'confirmed'});
 });
 it('older ordinary failure cannot clear newer owned operation',async()=>{
  const first=defer();global.fetch=()=>first.promise;const read=store.dispatch(Security.fetchLoggedInUser());await Promise.resolve();
  const token=beginAuthentication(store.getState);store.dispatch(Security.receiveLoggedInUser('NewOwner'));first.reject(Error('stale'));await read;
  expect(store.getState().security.loggedInUser).to.equal('NewOwner');finishAuthentication(store.getState,token);
 });
 it('R2 real reload consumer uses active bridge location',()=>{
  store.dispatch(Security.reloadCurrentRoute());expect(history.location.pathname).to.equal('/protected');expect(store.getState().security.currentPageName).to.equal('/protected');
 });
 it('R2 reload consumer has safe fallback before bridge initialization',()=>{
  const fresh=createStore(rootReducer,applyMiddleware(thunk,routerMiddleware(history)));fresh.dispatch(Security.reloadCurrentRoute());expect(history.location.pathname).to.equal('/');
 });
 it('R2 omitted logout redirect uses active route after successful logout',async()=>{
  global.fetch=()=>Promise.resolve({status:204});await store.dispatch(Security.requestUserLogout());
  expect(history.location.pathname).to.equal('/protected');expect(store.getState().security).to.include({loggedIn:false,identityStatus:'confirmed'});
 });
 it('R2 anonymous verification returns handled completion and reloads actual current state',async()=>{
  global.fetch=()=>Promise.resolve(reply(false));const reload=sinon.spy(history,'push');
  await store.dispatch(Security.verifyUserLoggedIn());expect(reload.calledOnce).to.equal(true);expect(history.location.pathname).to.equal('/protected');expect(store.getState().security.loggedIn).to.equal(false);
 });
 it('R2 authenticated verification does not reload',async()=>{
  global.fetch=()=>Promise.resolve(reply());const reload=sinon.spy(history,'push');await store.dispatch(Security.verifyUserLoggedIn());expect(reload.called).to.equal(false);
 });
 it('actual startup shell exposes bounded failure and retry without rendering protected children',async()=>{
  const pending=defer();let attempts=0;
  global.fetch=url=>url==='/username'?(++attempts===1?pending.promise:Promise.resolve(reply())):Promise.resolve({json:()=>Promise.resolve([])});
  const Shell=connect(s=>s.security,d=>bindActionCreators(Security.actionCreators,d))(AppScreen);
  const Protected=requireAuthentication(()=> <span>Private startup child</span>);
  await act(async()=>root.render(<I18nextProvider i18n={i18n}><Provider store={store}><Router history={history}><Shell t={k=>k} i18n={{language:'en'}}><Route path="/protected" component={Protected}/></Shell></Router></Provider></I18nextProvider>));
  expect(container.querySelector('[role="status"]').textContent).to.contain('Checking');
  expect(container.textContent).not.to.contain('Private startup child');expect(container.textContent).not.to.contain('RestoredUser');
  await act(async()=>{pending.resolve({status:503});await new Promise(r=>setTimeout(r,0));});
  expect(container.querySelector('[role="alert"]').textContent).to.contain('could not be confirmed');
  await act(async()=>{container.querySelector('[role="alert"] button').dispatchEvent(new window.MouseEvent('click',{bubbles:true}));await new Promise(r=>setTimeout(r,0));});
  expect(attempts).to.equal(2);expect(container.querySelector('[role="alert"]')).to.equal(null);expect(container.textContent).to.contain('Private startup child');
 });
 it('pending ordinary refresh blocks a previously admitted default check from issuing additions',async()=>{
  const check=defer(),read=defer();const added=[];
  global.fetch=url=>url==='/username'?Promise.resolve(reply()):check.promise;
  await store.dispatch(Security.fetchLoggedInUser());const flight=store.dispatch(initializeRegistration());await Promise.resolve();
  global.fetch=url=>{if(url==='/username')return read.promise;added.push(url);return Promise.resolve({status:200,ok:true,json:()=>Promise.resolve([])});};
  const refresh=store.dispatch(Security.fetchLoggedInUser());await Promise.resolve();check.resolve({status:200});await flight;
  expect(added).to.deep.equal([]);
  read.resolve(reply());await refresh;
 });

});
