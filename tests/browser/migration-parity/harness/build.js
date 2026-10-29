const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const webpack = require('webpack');
const { execFileSync } = require('node:child_process');
const root = path.resolve(__dirname, '../../../..');
const run = process.env.GAKUSEI_PARITY_RUN_ID;
if (!run || !/^[0-9]+-[0-9]+$/.test(run)) throw new Error('Build requires an owned parity run identifier');
const output = path.join(root, '.tools/migration-parity/runs', run, 'build');
async function build() {
  execFileSync('npm', ['run', 'prepare:assets'], { cwd: root, stdio: 'inherit' });
  if (fs.existsSync(output)) throw new Error('Refusing to replace an existing parity build');
  fs.mkdirSync(output, { recursive: true });
  fs.cpSync(path.join(root, 'src/main/resources/static'), output, { recursive: true, filter: p => !p.startsWith(path.join(root, 'src/main/resources/static/js')) });
  fs.cpSync(path.join(root, 'src/main/resources/locales'), path.join(output, 'locales'), { recursive: true });
  const config = require(path.join(root, 'webpack.config'))({}, { mode: 'production' });
  config.output = { ...config.output, path: path.join(output, 'js'), clean: true };
  const html = config.plugins.find(p => p.constructor.name === 'HtmlWebpackPlugin');
  html.userOptions.filename = '../index.html';
  await new Promise((resolve, reject) => webpack(config, (err, stats) => {
    if (err || stats.hasErrors()) return reject(err || new Error(stats.toString({ all: false, errors: true })));
    console.log(stats.toString({ all: false, timings: true, assets: true, warnings: true })); resolve();
  }));
  const files = fs.readdirSync(path.join(output, 'js')).filter(f => f.endsWith('.js')).map(name => {
    const data = fs.readFileSync(path.join(output, 'js', name));
    return { name, bytes: data.length, gzipBytes: require('node:zlib').gzipSync(data).length, sha256: crypto.createHash('sha256').update(data).digest('hex') };
  });
  const provenance=require('./provenance').snapshot();
  const before=JSON.parse(fs.readFileSync(path.join(output,'../source-before.json')));
  if(before.sourceDigest!==provenance.sourceDigest) throw new Error('Source changed before build completed');
  fs.writeFileSync(path.join(output, 'bundle-manifest.json'), JSON.stringify({ node:process.versions.node, react:require(path.join(root,'node_modules/react/package.json')).version, projectVersion:require(path.join(root,'package.json')).version, sourceCommit:provenance.baseline, testedHead:provenance.testedHead, sourceDigest:provenance.sourceDigest, productSourceUnchanged:provenance.productSourceUnchanged, files }, null, 2));
}
module.exports = build;
if (require.main === module) build().catch(e => { console.error(e); process.exitCode = 1; });
