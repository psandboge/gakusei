#!/usr/bin/env node
// Measure identical static artifact boundaries before/after framework conversion.
const fs = require('node:fs');
const path = require('node:path');
const zlib = require('node:zlib');
const crypto = require('node:crypto');
const root = path.resolve(process.argv[2] || '.tools/migration-parity/build');
function visit(directory) {
  return fs.readdirSync(directory, {withFileTypes:true}).flatMap(entry => {
    const file = path.join(directory, entry.name);
    if (entry.isDirectory()) return visit(file);
    if (!entry.isFile() || !/\.(js|css)$/.test(entry.name)) return [];
    const bytes = fs.readFileSync(file);
    return [{file:path.relative(root,file).split(path.sep).join('/'), raw:bytes.length,
      gzip:zlib.gzipSync(bytes,{level:9}).length,
      brotli:zlib.brotliCompressSync(bytes).length,
      sha256:crypto.createHash('sha256').update(bytes).digest('hex')}];
  });
}
const assets = visit(root).sort((a,b) => a.file.localeCompare(b.file));
if (!assets.length) throw new Error('No JavaScript or CSS assets found');
console.log(JSON.stringify({artifactRoot:path.basename(root),
  scope:'All emitted JS/CSS assets, including static styles. Excludes maps, fonts, images and HTML; totals are not initial-route transfer sizes.',
  compression:'gzip level9; Node default Brotli',assets,
  totals:assets.reduce((sum,a) => ({raw:sum.raw+a.raw,gzip:sum.gzip+a.gzip,brotli:sum.brotli+a.brotli}),{raw:0,gzip:0,brotli:0})},null,2));
