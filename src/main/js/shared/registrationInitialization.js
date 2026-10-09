import * as Lessons from './reducers/Lessons';

// Only transient store/session/operation identities; never persisted or cached success.
const stores = new WeakMap();
const tuple = getState => {
  const s = getState().security;
  return [s.loggedIn, s.loggedInUser];
};
function entry(getState) {
  let e = stores.get(getState);
  const [loggedIn, username] = tuple(getState);
  if (!e) {
    e = { epoch: 0, loggedIn, username, hold: null, blocked: false, flight: null, authTail: Promise.resolve() };
    stores.set(getState, e);
  } else if (e.loggedIn !== loggedIn || e.username !== username) {
    e.epoch++;
    e.loggedIn = loggedIn; e.username = username; e.flight = null;
  }
  return e;
}
export function synchronizeAuthentication(getState) { entry(getState); }
export function beginAuthentication(getState) {
  const e = entry(getState), token = {};
  e.epoch++; e.flight = null; e.hold = token;
  return token;
}
export function ownsAuthentication(getState, token) {
  return entry(getState).hold === token;
}
export function finishAuthentication(getState, token, confirmed = false) {
  const e = entry(getState);
  if (e.hold === token) { e.hold = null; e.blocked = confirmed ? false : e.blocked; }
}
export function markAuthenticationUncertain(getState, token) {
  if (ownsAuthentication(getState, token)) entry(getState).blocked = true;
}
// Called only for a completed/rejected fetch that was actually issued, before
// its serialized authTail chain releases. Publication/progress still belongs to
// the latest token, but an older issued mutation can change server identity.
export function markSupersededAuthenticationMutation(getState, token) {
  if (!ownsAuthentication(getState, token)) entry(getState).blocked = true;
}
// Admit newest UI owner synchronously; serialize entire issued mutation chain.
// Superseded unissued work is skipped. An issued response must settle before
// another mutation is issued; response guards alone cannot order server effects.
export function queueAuthentication(getState, token, work) {
  const e = entry(getState);
  const result = e.authTail.then(() => ownsAuthentication(getState, token) ? work() : undefined);
  e.authTail = result.then(() => undefined, () => undefined);
  return result;
}
export function markAuthenticationReadUncertain(getState) { entry(getState).blocked = true; }
export function beginAuthenticationRead(getState, token) {
  if (token) return authenticationReader(getState, token);
  const e = entry(getState), version = (e.readVersion || 0) + 1;
  e.readVersion = version;
  const current = authenticationReader(getState);
  return () => current() && entry(getState).readVersion === version;
}
export function confirmAuthenticationRead(getState) { entry(getState).blocked = false; }
// Ordinary username reads started before an auth operation cannot publish afterward.
export function authenticationReader(getState, token) {
  const e = entry(getState), epoch = e.epoch;
  return token ? () => ownsAuthentication(getState, token) :
    () => { const current = entry(getState); return !current.hold && current.epoch === epoch; };
}
const settle = promise => Promise.resolve(promise).then(
  value => ({ value }), error => ({ error })
);
export function initializeRegistration() {
  return (dispatch, getState) => {
    const e = entry(getState);
    if (['pending', 'failed'].includes(getState().security.identityStatus) || e.hold || e.blocked || !e.loggedIn || !e.username) return Promise.resolve();
    if (e.flight) return e.flight.promise;
    const flight = { epoch: e.epoch, username: e.username };
    const current = () => {
      const now = entry(getState);
      return !['pending', 'failed'].includes(getState().security.identityStatus) &&
        now.flight === flight && now.epoch === flight.epoch && !now.hold && !now.blocked &&
        now.loggedIn && now.username === flight.username;
    };
    const context = { username: flight.username, current };
    e.flight = flight;
    flight.promise = Promise.resolve().then(() => {
      if (!current()) return;
      return fetch('/api/checkNewUser', {
        method: 'post', credentials: 'same-origin', body: flight.username
      }).then(response => {
        if (!current()) return;
        if (response.status === 202) return;
        if (response.status !== 200) throw new Error('Registration check failed');
        // Both issued chains settle before cleanup, even if one rejects early.
        const additions = [['GENKI 01', 'guess'], ['KLL 01', 'kanji']].map(([name, type]) =>
          settle(Promise.resolve().then(() => current() && dispatch(Lessons.addStarredLesson(name, type, context))))
        );
        return Promise.all(additions).then(results => {
          const failed = results.find(result => Object.prototype.hasOwnProperty.call(result, 'error'));
          if (failed) throw failed.error;
        });
      });
    }).then(value => {
      if (e.flight === flight) e.flight = null;
      return value;
    }, error => {
      if (e.flight === flight) e.flight = null;
      throw error;
    });
    // Exactly one owner diagnostic/handler, including callers that ignore the return.
    flight.promise.catch(() => console.error('Registration initialization failed'));
    return flight.promise;
  };
}
