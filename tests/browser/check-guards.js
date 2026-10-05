// Offline negative proof: none of these cases may reach browser creation/network.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { manifest, state } = require('./validate-run');
const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'gakusei-browser-guards-'));
fs.chmodSync(dir, 0o700);
try {
  delete process.env.GAKUSEI_BROWSER_MANIFEST;
  assert.throws(manifest, /Owned manifest required/);
  const file = path.join(dir, 'manifest.json');
  process.env.GAKUSEI_BROWSER_MANIFEST = file;
  for (const body of ['{', JSON.stringify({ run_id: 'f'.repeat(24), nonce: 'foreign',
    origin: 'http://127.0.0.1:18082', phase: 'journey' })]) {
    fs.writeFileSync(file, body, { mode: 0o600 });
    assert.throws(manifest, /validation failed before browser access/);
  }
  const m = { run_id: 'a'.repeat(24), nonce: 'b'.repeat(48), origin: 'http://127.0.0.1:12345',
    state_path: path.join(dir, 'learner.json'), fixture: { nuggets: [{ id: 'fixture' }] } };
  assert.throws(() => state(m), /Original private learner state/);
  fs.writeFileSync(m.state_path, '{', { mode: 0o600 });
  assert.throws(() => state(m), /Original private learner state/);
  fs.writeFileSync(m.state_path, JSON.stringify({ run_id: 'wrong', nonce: m.nonce,
    origin: m.origin, username: 'Disposable', password: 'PrivateDummy', lesson: 'genki 15',
    category: 2, snapshot: {}, submissions: [{ nugget_id: 'fixture', correct: true,
      question_nugget_id: 'fixture', correct_alternative_nugget_id: 'fixture' }] }), { mode: 0o600 });
  assert.throws(() => state(m), /Original private learner state/);
  console.log('PASS: missing/malformed/foreign manifests and missing/malformed/wrong-run learner state rejected offline');
} finally { fs.rmSync(dir, { recursive: true, force: true }); }
