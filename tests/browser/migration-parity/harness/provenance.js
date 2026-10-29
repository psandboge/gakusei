const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const { execFileSync } = require('node:child_process');
const root = path.resolve(__dirname, '../../../..');
const baseline = '03ce2f38d3099e9ccd7dd09a430e023e9f4ce0d0';
const sha256 = data => crypto.createHash('sha256').update(data).digest('hex');
const git = args => execFileSync('git', args, {cwd:root});
const inputs = ['src', 'pom.xml', 'package.json', 'package-lock.json', 'webpack.config.js', 'webpack.partial.dev.js', 'webpack.partial.prod.js', '.babelrc', '.browserslistrc', 'postcss.config.js', 'mocha.bootstrap.js', 'scripts', 'tests/browser/migration-parity', 'tests/fixtures/migration-parity', 'playwright.parity.config.js'];
function snapshot() {
  const testedHead = git(['rev-parse','HEAD']).toString().trim();
  try { git(['merge-base','--is-ancestor',baseline,testedHead]); }
  catch { throw new Error('Parity HEAD is not a descendant of pinned PR7 baseline'); }
  // Product/build/dependency inputs must remain byte-for-byte at the baseline.
  const product = ['src','pom.xml','package-lock.json','webpack.config.js','webpack.partial.dev.js','webpack.partial.prod.js','.babelrc','.browserslistrc','postcss.config.js'];
  if (git(['ls-files','--others','--exclude-standard','--',...product]).length || git(['diff',baseline,'--',...product]).length) throw new Error('Product/build/lock source differs from PR7');
  const original = JSON.parse(git(['show',`${baseline}:package.json`]).toString());
  const current = JSON.parse(fs.readFileSync(path.join(root,'package.json')));
  delete original.scripts; delete current.scripts;
  if (JSON.stringify(original) !== JSON.stringify(current)) throw new Error('Package metadata/dependencies differ from PR7');
  const names = [...new Set(git(['ls-files','-z','--cached','--others','--exclude-standard','--',...inputs]).toString().split('\0').filter(Boolean))].sort();
  const files = names.map(name => ({path:name,sha256:fs.existsSync(path.join(root,name)) ? sha256(fs.readFileSync(path.join(root,name))) : null}));
  const diff = git(['diff','--binary',baseline,'--',...inputs]);
  return {baseline,testedHead,productSourceUnchanged:true,sourceDigest:sha256(JSON.stringify(files)),trackedDiffSha256:sha256(diff),files};
}
module.exports = {snapshot,root,sha256};
