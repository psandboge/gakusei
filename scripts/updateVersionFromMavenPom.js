const fs = require('fs');
const xml2js = require('xml2js');
xml2js.parseString(fs.readFileSync('pom.xml', 'utf8'), (error, pom) => {
  if (error) throw error;
  const pkg = JSON.parse(fs.readFileSync('package.json', 'utf8'));
  const version = pom.project.version[0];
  if (pkg.version !== version) throw new Error(`package.json version ${pkg.version} must match pom.xml ${version}; update both and regenerate the lockfile`);
});
