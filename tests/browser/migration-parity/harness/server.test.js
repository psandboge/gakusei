const { test } = require('node:test');
const assert = require('node:assert/strict');
const { createApp } = require('./server');
test('owned server rejects uncontracted APIs and records precise writes', async () => {
  const app = await createApp();
  try {
    assert.equal(new URL(app.origin).hostname, '127.0.0.1');
    assert.equal([52655,62508,62721,18082,18083,15432,15433].includes(Number(new URL(app.origin).port)),false);
    const missing = await fetch(`${app.origin}/api/never-fixtured`);
    assert.equal(missing.status,501);
    assert.deepEqual(app.unknown,['GET /api/never-fixtured']);
    app.respond('POST','/api/write', ({body,query}) => ({body:{body,query}}));
    const write = await fetch(`${app.origin}/api/write?lesson=synthetic`, {method:'POST',body:JSON.stringify({count:1})});
    assert.deepEqual(await write.json(),{body:{count:1},query:{lesson:'synthetic'}});
    assert.equal(app.requests.filter(x => x.path==='/api/write').length,1);
  } finally {await app.close();}
});
test('response barriers expose arrival before controlled release', async () => {
  const app = await createApp();
  try {
    const pending = app.defer('GET','/username');
    const read = fetch(`${app.origin}/username`);
    await pending.requested;
    pending.release({loggedIn:false});
    assert.deepEqual(await (await read).json(),{loggedIn:false});
  } finally {await app.close();}
});
