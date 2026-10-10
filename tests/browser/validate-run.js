const fs = require('node:fs');
const path = require('node:path');
const { execFileSync } = require('node:child_process');
function manifest() {
  const file = process.env.GAKUSEI_BROWSER_MANIFEST;
  if (!file || !path.isAbsolute(file)) throw new Error('Owned manifest required');
  // Python verifies the tracked live Java PID, Compose service and private paths.
  let m;
  try {
    m = JSON.parse(execFileSync('python3', ['scripts/verify-browser-state.py', 'validate-manifest', file],
      { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'], timeout: 30000 }));
  } catch { throw new Error('Owned manifest validation failed before browser access'); }
  if (!/^[a-f0-9]{24}$/.test(m.run_id) || m.run_id !== path.basename(path.dirname(file)) || !/^[a-f0-9]{48}$/.test(m.nonce) ||
      m.phase !== process.env.GAKUSEI_BROWSER_PHASE ||
      m.output_dir !== process.env.GAKUSEI_BROWSER_OUTPUT_DIR ||
      !['journey','after-restart','after-reseed'].includes(m.phase) ||
      !/^http:\/\/127\.0\.0\.1:\d+$/.test(m.origin) ||
      [18082,18083,15432,15433].includes(Number(new URL(m.origin).port))) throw new Error('Run identity mismatch');
  if (m.phase !== 'journey') state(m);
  return m;
}
function state(m) {
  try {
    if (fs.statSync(m.state_path).mode & 0o077) throw new Error();
    const s = JSON.parse(fs.readFileSync(m.state_path, 'utf8'));
    if (s.run_id !== m.run_id || s.nonce !== m.nonce || s.origin !== m.origin ||
        !/^[A-Za-z0-9]{2,32}$/.test(s.username) || typeof s.password !== 'string' ||
        s.password.length < 2 || s.lesson !== 'genki 15' || s.category !== 2 ||
        !Array.isArray(s.submissions) || !s.submissions.length || !s.snapshot ||
        !s.submissions.every(x => typeof x.correct === 'boolean' &&
          m.fixture.nuggets.some(n => n.id === x.nugget_id) && x.question_nugget_id &&
          x.correct_alternative_nugget_id === x.nugget_id)) throw new Error();
    return s;
  } catch { throw new Error('Original private learner state missing or invalid'); }
}
function atomic(file, value) {
  const tmp = file + '.tmp';
  fs.writeFileSync(tmp, JSON.stringify(value), { mode: 0o600 });
  fs.renameSync(tmp, file);
}
module.exports = () => { manifest(); };
module.exports.manifest = manifest;
module.exports.state = state;
module.exports.atomic = atomic;
