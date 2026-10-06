import React from 'react';
import { Router } from 'react-router';

// Action/state contract of react-router-redux 5.0.0-alpha.9 (MIT).
export const CALL_HISTORY_METHOD = '@@router/CALL_HISTORY_METHOD';
export const LOCATION_CHANGE = '@@router/LOCATION_CHANGE';
const historyAction = method => (...args) => ({ type: CALL_HISTORY_METHOD, payload: { method, args } });
export const push = historyAction('push');
export const replace = historyAction('replace');
export const go = historyAction('go');
export const goBack = historyAction('goBack');
export const goForward = historyAction('goForward');
export const routerActions = { push, replace, go, goBack, goForward };
export function routerReducer(state = { location: null }, { type, payload } = {}) {
  return type === LOCATION_CHANGE ? { ...state, location: payload } : state;
}
export const routerMiddleware = history => () => next => action => {
  if (action.type !== CALL_HISTORY_METHOD) return next(action);
  history[action.payload.method](...action.payload.args);
};

export class ConnectedRouter extends React.Component {
  constructor(props) {
    super(props);
    this.state = { ready: false };
  }
  componentDidMount() {
    const { history, store } = this.props;
    const update = location => store.dispatch({ type: LOCATION_CHANGE, payload: location });
    this.unsubscribe = history.listen(update);
    update(history.location);
    // Children start only after initial routing state is available.
    this.setState({ ready: true });
  }
  componentWillUnmount() {
    this.unsubscribe();
  }
  render() {
    return this.state.ready ? <Router history={this.props.history}>{this.props.children}</Router> : null;
  }
}
