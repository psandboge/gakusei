// Finite client recovery regression; injected endpoints, actual shell/login/store.
const React=require('react'),{act}=React;
const {createRoot}=require('react-dom/client');
const {Simulate}=require('react-dom/test-utils');
const {createStore,applyMiddleware,bindActionCreators}=require('redux');
const thunk=require('redux-thunk').default;
const {Provider,connect}=require('react-redux');
const {Router,Route,Switch}=require('react-router');
const {createMemoryHistory}=require('history');
const {REHYDRATE}=require('redux-persist/constants');
const {I18nextProvider}=require('react-i18next');
const i18n=require('./i18n').default;
const reducer=require('./reducers').default;
const Security=require('./reducers/Security');
const {routerMiddleware,LOCATION_CHANGE}=require('./routing');
const {initializeRegistration,authenticationReader}=require('./registrationInitialization');
const {AppScreen}=require('../screens/app/AppScreen');
const {loginScreen}=require('../screens/app/screens/login/loginScreen');
const {requireAuthentication}=require('./components/AuthenticatedComponent');
const el=React.createElement;
const defer=()=>{let resolve,reject;const promise=new Promise((y,n)=>{resolve=y;reject=n});return {promise,resolve,reject};};
const identity=loggedIn=>({status:200,text:()=>Promise.resolve(JSON.stringify({loggedIn,username:loggedIn?'RetrySubject':''}))});
const tick=(ms=0)=>new Promise(r=>setTimeout(r,ms));

describe('Residual R1 terminal recovery (owner-authorized fourth pass)',()=>{
 let previousFetch,store,history,unlisten,container,root,calls,reads,operations,identities,mutations;
 beforeEach(()=>{
  previousFetch=global.fetch;calls=[];reads=[];operations=[];identities=[];mutations=[];
  history=createMemoryHistory({initialEntries:['/login']});
  store=createStore(reducer,applyMiddleware(thunk,routerMiddleware(history)));
  unlisten=history.listen(location=>store.dispatch({type:LOCATION_CHANGE,payload:location}));
  store.dispatch({type:LOCATION_CHANGE,payload:history.location});
  store.dispatch({type:REHYDRATE,payload:{security:{loggedIn:false,loggedInUser:''}}});
  global.fetch=(url,options={})=>{
   const pathname=new URL(url,'http://localhost').pathname;calls.push({pathname,options});
   if(pathname==='/username'){const d=defer();identities.push(d);return d.promise;}
   if(['/auth','/registeruser','/logout'].includes(pathname)){const d=defer();mutations.push({pathname,d});return d.promise;}
   return Promise.resolve({status:pathname==='/api/checkNewUser'||pathname==='/api/checkUserLanguage'?202:200,json:()=>Promise.resolve([])});
  };
  container=document.createElement('div');document.body.appendChild(container);root=createRoot(container);
 });
 afterEach(async()=>{await act(async()=>root.unmount());container.remove();unlisten();global.fetch=previousFetch;});
 const count=pathname=>calls.filter(c=>c.pathname===pathname).length;
 async function mountShell(){
  const actions=d=>({...bindActionCreators(Security.actionCreators,d),
   fetchLoggedInUser:(...args)=>{const p=d(Security.fetchLoggedInUser(...args));reads.push(p);return p;},
   requestUserLogin:(...args)=>{const p=d(Security.requestUserLogin(...args));operations.push(p);return p;},
   requestUserRegister:(...args)=>{const p=d(Security.requestUserRegister(...args));operations.push(p);return p;}});
  const Shell=connect(s=>s.security,actions)(AppScreen),Login=connect(s=>s.security,actions)(loginScreen);
  const Protected=requireAuthentication(()=>el('span',null,'Private terminal tree'));
  await act(async()=>root.render(el(I18nextProvider,{i18n},el(Provider,{store},el(Router,{history},el(Shell,{t:k=>k,i18n:{language:'se'}},el(Switch,null,el(Route,{path:'/login',render:()=>el(Login,{t:k=>k,i18n:{language:'se'}})}),el(Route,{path:'/protected',component:Protected}))))))));
  expect(reads).to.have.length(1);expect(store.getState().security.identityStatus).to.equal('pending');
 }
 async function submit(operation){
  await act(async()=>{Simulate.change(container.querySelector('input[name=username]'),{target:{name:'username',value:'FixtureSubject'}});Simulate.change(container.querySelector('input[name=password]'),{target:{name:'password',value:'FixtureOnly'}});});
  const button=container.querySelector('button[name='+operation+']');expect(button.disabled).to.equal(false);
  await act(async()=>Simulate.click(button));
  await act(async()=>container.querySelector('form').dispatchEvent(new window.Event('submit',{bubbles:true,cancelable:true})));
 }
 async function settleStale(terminal){
  await act(async()=>{if(terminal==='success')identities[0].resolve({status:200,text:()=>Promise.resolve(JSON.stringify({loggedIn:true,username:'StaleSubject'}))});else identities[0].reject(Error('synthetic stale startup'));await reads[0];});
 }
 function retryButton(){return [...container.querySelectorAll('button')].find(b=>b.textContent==='Retry session check');}
 function assertRecovery(){
  expect(store.getState().security).to.include({loggedIn:false,loggedInUser:'',identityStatus:'failed',loginInProgress:false,registerInProgress:false});
  expect(authenticationReader(store.getState)()).to.equal(true);
  expect(container.querySelector('[role="status"]')).to.equal(null);
  expect(container.querySelector('[role="alert"]').textContent).to.contain('could not be confirmed');expect(retryButton()).to.exist;
  expect(container.textContent).not.to.contain('StaleSubject');expect(container.textContent).not.to.contain('Private terminal tree');
 }
 for(const [operation,status] of [['login',403],['register',406],['register',422]])
  for(const stale of ['success','rejection'])for(const order of ['before','after'])for(const loggedInRetry of [false,true]){
   it(operation+status+', stale '+stale+' '+order+', explicit retry '+(loggedInRetry?'authenticated':'anonymous'),async()=>{
    await mountShell();await submit(operation);expect(operations).to.have.length(1);expect(mutations).to.have.length(1);
    if(order==='before'){await settleStale(stale);expect(store.getState().security.identityStatus).to.equal('pending');expect(retryButton()).not.to.exist;}
    await act(async()=>{mutations[0].d.resolve({status});await operations[0];});
    expect(container.querySelector('[name="authFeedback"]').textContent).to.equal(store.getState().security.authResponse);
    if(order==='after')await settleStale(stale);
    assertRecovery();expect(count('/username')).to.equal(1);await store.dispatch(initializeRegistration());expect(count('/api/checkNewUser')).to.equal(0);expect(count('/api/userLessons/add')).to.equal(0);
    await act(async()=>retryButton().dispatchEvent(new window.MouseEvent('click',{bubbles:true})));
    expect(reads).to.have.length(2);expect(identities).to.have.length(2);expect(store.getState().security.identityStatus).to.equal('pending');
    await store.dispatch(initializeRegistration());expect(count('/api/checkNewUser')).to.equal(0);
    await act(async()=>{identities[1].resolve(identity(loggedInRetry));await reads[1];});
    expect(store.getState().security).to.include({identityStatus:'confirmed',loggedIn:loggedInRetry,loggedInUser:loggedInRetry?'RetrySubject':''});
    expect(container.querySelector('[role="alert"]')).to.equal(null);expect(count('/username')).to.equal(2);
    await act(async()=>history.push('/protected'));
    if(loggedInRetry)expect(container.textContent).to.contain('Private terminal tree');else{expect(container.textContent).not.to.contain('Private terminal tree');expect(history.location.pathname).to.equal('/login');}
    await store.dispatch(initializeRegistration());expect(count('/api/checkNewUser')).to.equal(loggedInRetry?1:0);
    if(loggedInRetry)expect(calls.find(c=>c.pathname==='/api/checkNewUser').options.body).to.equal('RetrySubject');
   });
  }
 it('superseded register refusal cannot fail or release newer pending login',async()=>{
  await mountShell();await submit('register');
  let newer;await act(async()=>{newer=store.dispatch(Security.requestUserLogin('new-owner','/'));});
  await act(async()=>{mutations[0].d.resolve({status:406});await operations[0];await tick();});
  expect(mutations).to.have.length(2);expect(mutations[1].pathname).to.equal('/auth');
  expect(store.getState().security).to.include({identityStatus:'pending',loginInProgress:true});expect(authenticationReader(store.getState)()).to.equal(false);expect(retryButton()).not.to.exist;
  await settleStale('success');expect(store.getState().security.identityStatus).to.equal('pending');
  await act(async()=>{mutations[1].d.resolve({status:403});await newer;});assertRecovery();expect(count('/username')).to.equal(1);
 });
 for(const [operation,status] of [['login',403],['register',406],['register',422]]){
  it('already confirmed '+operation+status+' preserves prior confirmed identity',async()=>{
   const read=store.dispatch(Security.fetchLoggedInUser());await tick();identities[0].resolve(identity(true));await read;
   const p=store.dispatch(operation==='login'?Security.requestUserLogin('fixture'):Security.requestUserRegister('fixture'));await tick();mutations[0].d.resolve({status});await p;
   expect(store.getState().security).to.include({identityStatus:'confirmed',loggedIn:true,loggedInUser:'RetrySubject',loginInProgress:false,registerInProgress:false});expect(count('/username')).to.equal(1);
  });
 }
 for(const operation of ['login','register']){
  it('confirmed '+operation+' completion preserves successful identity and transferred hold',async()=>{
   const p=store.dispatch(operation==='login'?Security.requestUserLogin('fixture'):Security.requestUserRegister('fixture'));await tick();
   if(operation==='register'){mutations[0].d.resolve({status:201});await tick(1550);expect(mutations).to.have.length(2);mutations[1].d.resolve({status:200});}
   else mutations[0].d.resolve({status:200});
   await tick();expect(identities).to.have.length(1);identities[0].resolve(identity(true));await p;
   expect(store.getState().security).to.include({identityStatus:'confirmed',loggedIn:true,loggedInUser:'RetrySubject',loginInProgress:false,registerInProgress:false});expect(authenticationReader(store.getState)()).to.equal(true);
   expect(count('/username')).to.equal(1);expect(count('/auth')).to.equal(1);expect(count('/registeruser')).to.equal(operation==='register'?1:0);
  });
 }
});
