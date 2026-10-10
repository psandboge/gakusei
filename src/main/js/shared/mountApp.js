import { createRoot } from 'react-dom/client';
import { I18nextProvider } from 'react-i18next';
import AppProvider from '../AppProvider';

export function mountApp(container, store, history, i18n) {
  const root = createRoot(container);
  root.render(<I18nextProvider i18n={i18n}><AppProvider store={store} history={history} /></I18nextProvider>);
  return root;
}
