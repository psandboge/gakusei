import i18n from 'i18next';
import languageDetector from 'i18next-browser-languagedetector';
import resources from '../../resources/locales';

i18n.use(languageDetector).init({
  lng: i18n.languages,
  fallbackLng: 'se',
  defaultNS: 'translations',
  ns: ['translations'],
  debug: true,

  // we init with resources
  resources: resources,

  keySeparator: false, // we use content as keys

  detectBrowserLanguage: true
});

export default i18n;
