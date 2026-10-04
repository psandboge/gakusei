import '../resources/static/css/style.scss';
import AppProvider from './AppProvider';
import { configureStore, history } from './configureStore';

import { I18nextProvider, translate } from 'react-i18next';
import i18n from './shared/i18n';

// Get the application-wide store instance, prepopulating with state from the server where available.
// ! Don't have server-rendering yet, might add later
const initialState = window.initialReduxState;
const store = configureStore(initialState);

const indexRoot = document.getElementById('index_root');

function doRender() {
  ReactDOM.render(
    <I18nextProvider i18n={i18n}>
      <AppProvider
        store={store}
        history={history}
      />
    </I18nextProvider>,
    indexRoot
  );
}

doRender();
