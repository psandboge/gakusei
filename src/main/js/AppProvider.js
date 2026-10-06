/* eslint-disable react/forbid-prop-types */

import { Provider } from 'react-redux';
import { Route, Redirect } from 'react-router';
import { Switch, withRouter } from 'react-router-dom';
import { anchorate } from 'anchorate';
import { persistStore } from 'redux-persist';
import { ConnectedRouter } from './shared/routing';

import { requireAuthentication } from './shared/components/AuthenticatedComponent';

import AppScreen from './screens/app';
import aboutScreen from './screens/app/screens/about';
import grammarScreen from './screens/app/screens/grammar';
import finishScreen from './screens/app/screens/finish';
import homeScreen from './screens/app/screens/home';
import loginScreen from './screens/app/screens/login';
import logoutScreen from './screens/app/screens/logout';
import playScreen from './screens/app/screens/play';
import selectScreen from './screens/app/screens/select';
import startScreen from './screens/app/screens/start';
import Utility from './shared/util/Utility';
import { GakuseiNav, Reducers } from './screens/app/components/GakuseiNav';
import { translate, Trans } from 'react-i18next';
import settingsScreen from './screens/app/screens/settings/';

const AppScreenRoutered = withRouter(AppScreen);

export default class AppProvider extends React.Component {
  constructor(props) {
    super(props);
    this.state = { rehydrated: false, persistenceError: false };
    this.persistenceSubscriptions = [];
  }

  componentDidMount() {
    this.mounted = true;
    const store = this.props.store;
    // redux-persist 4 does not expose its subscription handle. Capture only
    // persistence subscriptions; Provider and Router use the original store.
    const persistenceStore = {
      getState: store.getState,
      dispatch: store.dispatch,
      subscribe: listener => {
        const unsubscribe = store.subscribe(listener);
        this.persistenceSubscriptions.push(unsubscribe);
        return unsubscribe;
      }
    };
    this.persistor = persistStore(persistenceStore, { blacklist: ['routing'] }, async (err, restoredState) => {
      // persistStore resumes before calling us, including after unmount.
      if (!this.mounted) {
        this.persistor.pause();
        return;
      }
      try {
        if (err) throw err;
        if (restoredState && restoredState.security && restoredState.security.purgeNeeded) {
          await this.persistor.purge();
        }
        if (this.mounted) this.setState({ rehydrated: true });
        else this.persistor.pause();
      } catch (error) {
        this.persistor.pause();
        // Bounded diagnostics: storage errors can contain private values.
        console.error('Application persistence failed');
        if (this.mounted) this.setState({ persistenceError: true });
      }
    });
  }

  componentWillUnmount() {
    this.mounted = false;
    if (this.persistor) this.persistor.pause();
    this.persistenceSubscriptions.splice(0).forEach(unsubscribe => unsubscribe());
  }

  componentDidUpdate() {
    anchorate(); // To have href's that can scroll to page sections
  }

  render() {
    if (this.state.rehydrated) {
      return (
        <Provider store={this.props.store}>
          <ConnectedRouter history={this.props.history} store={this.props.store}>
            <AppScreenRoutered>
              <Switch>
                <Route
                  path="/login"
                  component={loginScreen}
                />
                <Route
                  path="/logout"
                  component={logoutScreen}
                />
                <Route
                  path="/play/:type"
                  component={requireAuthentication(playScreen)}
                />
                <Route
                  path="/select/:type"
                  component={requireAuthentication(selectScreen)}
                />
                <Route
                  path="/grammar"
                  component={requireAuthentication(grammarScreen)}
                />
                <Route
                  path="/finish/:type"
                  component={requireAuthentication(finishScreen)}
                />
                <Route
                  path="/home"
                  component={requireAuthentication(homeScreen)}
                />
                <Route
                  path="/about"
                  component={aboutScreen}
                />
                <Route
                  path="/settings"
                  component={requireAuthentication(settingsScreen)}
                />
                <Route
                  path="/start"
                  component={startScreen}
                />
                <Route
                  exact
                  path="/"
                  component={requireAuthentication(selectScreen, startScreen)}
                />
                <Redirect
                  from="*"
                  to="/"
                />
              </Switch>
            </AppScreenRoutered>
          </ConnectedRouter>
        </Provider>
      );
    }
    return this.state.persistenceError ? <p role="alert">Application persistence failed</p> : null;
  }
}

AppProvider.propTypes = {
  store: PropTypes.object.isRequired
};
