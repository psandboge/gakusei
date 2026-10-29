const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
const { randomInt } = require('node:crypto');
const run = process.env.GAKUSEI_PARITY_RUN_ID;
if (run && !/^[0-9]+-[0-9]+$/.test(run)) throw new Error('Invalid parity run identifier');
const build = path.resolve(__dirname, '../../../../.tools/migration-parity',run ? `runs/${run}/build` : 'build');
const forbidden = new Set([52655,62508,62721,18082,18083,15432,15433]);
const mime = { '.html':'text/html', '.js':'application/javascript', '.css':'text/css', '.json':'application/json', '.svg':'image/svg+xml', '.png':'image/png', '.woff':'font/woff', '.woff2':'font/woff2', '.ttf':'font/ttf', '.xml':'application/xml' };
async function createApp() {
  const handlers = new Map();
  const app = { requests: [], unknown: [], state: { username: '', favorites: [] }, respond(method, pathname, handler) { handlers.set(`${method.toUpperCase()} ${pathname}`, handler); } };
  app.defer = (method, pathname) => {
    let release, requested;
    const ready = new Promise(resolve => { requested = resolve; });
    const response = new Promise(resolve => { release = (body, status = 200, headers = {}) => resolve({body,status,headers}); });
    app.respond(method, pathname, request => { requested(request); return response; });
    return { requested: ready, release };
  };
  const server = http.createServer(async (req, res) => {
    const url = new URL(req.url, 'http://127.0.0.1');
    const chunks = []; for await (const chunk of req) chunks.push(chunk);
    const raw = Buffer.concat(chunks).toString();
    let body = raw; try { body = JSON.parse(raw); } catch {}
    const record = { method:req.method, path:url.pathname, query:Object.fromEntries(url.searchParams), body, status:null };
    const handler = handlers.get(`${req.method} ${url.pathname}`);
    if (handler) {
      app.requests.push(record);
      try {
        const result = await handler({ ...record, state:app.state, headers:req.headers });
        const answer = result || { status:204 };
        record.status = answer.status || 200;
        res.writeHead(record.status, { 'Content-Type':'application/json', 'Cache-Control':'no-store', 'Set-Cookie':'XSRF-TOKEN=synthetic-parity-token; Path=/; SameSite=Lax', ...answer.headers });
        res.end(answer.body === undefined ? '' : answer.raw ? String(answer.body) : JSON.stringify(answer.body));
      } catch (error) { app.unknown.push(`${req.method} ${url.pathname}: handler error`); res.writeHead(500); res.end(); }
      return;
    }
    if (url.pathname.startsWith('/api/') || ['/username','/auth','/logout','/registeruser'].includes(url.pathname)) {
      record.status=501; app.requests.push(record); app.unknown.push(`${req.method} ${url.pathname}`); res.writeHead(501); res.end('{"error":"Unscripted fixture endpoint"}'); return;
    }
    let relative = decodeURIComponent(url.pathname).replace(/^\/+/, '');
    let file = path.resolve(build, relative);
    if (!file.startsWith(build + path.sep) && file !== build) { res.writeHead(403); res.end(); return; }
    if (!path.extname(relative)) file = path.join(build,'index.html');
    if (!fs.existsSync(file) || !fs.statSync(file).isFile()) { res.writeHead(404); res.end(); return; }
    res.writeHead(200, { 'Content-Type':mime[path.extname(file)] || 'application/octet-stream', 'Cache-Control':'no-store' });
    fs.createReadStream(file).pipe(res);
  });
  // Select and exclude protected ports BEFORE listen; never inspect existing services.
  let port;
  do { port = randomInt(20000, 65000); } while (forbidden.has(port));
  await new Promise((resolve,reject) => { server.once('error',reject); server.listen(port,'127.0.0.1',resolve); });
  app.origin = `http://127.0.0.1:${port}`;
  app.close = () => new Promise(resolve => { server.close(resolve); server.closeAllConnections(); });
  return app;
}
module.exports = { createApp };
