import i18n from './i18n';
describe('Bundled translations', () => {
  it('resolves flat keys in the namespace used by React, with Swedish fallback', () => {
    expect(i18n.t('loginScreen.p1', { lng: 'se', ns: 'translations' })).to.contain('personuppgifter');
    expect(i18n.t('loginScreen.p1', { lng: 'unsupported', ns: 'translations' })).to.contain('personuppgifter');
  });
});
