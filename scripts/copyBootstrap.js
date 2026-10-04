const fs = require('fs');
const path = require('path');
for (const dir of ['css', 'fonts']) {
 const dst = path.join('src/main/resources/static/bootstrap', dir);
 fs.mkdirSync(dst, { recursive: true });
 fs.cpSync(path.join('node_modules/bootstrap/dist', dir), dst, { recursive: true });
}
fs.copyFileSync('node_modules/bootstrap/LICENSE', 'src/main/resources/static/bootstrap/LICENSE');
