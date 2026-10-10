import '../resources/static/css/style.scss';
import { mountApp } from './shared/mountApp';
import { configureStore, history } from './configureStore';

import i18n from './shared/i18n';

// Get the application-wide store instance, prepopulating with state from the server where available.
// ! Don't have server-rendering yet, might add later
const initialState = window.initialReduxState;
const store = configureStore(initialState);

const indexRoot = document.getElementById('index_root');

mountApp(indexRoot, store, history, i18n);
