import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { readFileSync } from 'node:fs';

// No R needed: shape checks only. `npm run check:r` runs the code against R.
const require = createRequire(import.meta.url);
const methods = require('../journey/methods.js');
const stats = require('../stats.js');
const rcode = require('../journey/rcode.js');

function make(id, mode, extra = {}) {
  const m = methods[id], raw = { ...m.defaults, mode, ...extra };
  const p = m.normalize(raw), r = m.solve(stats, p, id);
  const tables = m.resultTables ? m.resultTables(raw, p, r, stats) : [];
  const enrol = tables.some(t => t.rows?.some(row => row[0] === 'Participants to enrol'));
  return { r, s: rcode.snippets(m, raw, p, r, { disclaimer: '[DISCLAIMER]', enrol, attackRate: raw.attackRate, nonEvaluable: raw.nonEvaluable }) };
}

test('every method and mode has verify and analysis code with an honest status', () => {
  for (const [id, m] of Object.entries(methods)) for (const mode of m.modes) {
    const { r, s } = make(id, mode.id), label = `${id}/${mode.id}`;
    assert.ok(s.verify.length > 100 && s.analysis.length > 50, label);
    for (const code of [s.verify, s.analysis]) assert.doesNotMatch(code, /undefined|NaN|\[object/, label);
    assert.match(s.verify, new RegExp(`App result: N = ${r.total},`), label);
    assert.match(s.verify, /\bsf_n <- /, label); assert.match(s.verify, /\bsf_power <- /, label);
    assert.ok(s.verify.split('\n')[1].includes('[DISCLAIMER]') && s.analysis.includes('[DISCLAIMER]'), label);
    assert.ok(['exact', 'close', 'formula'].includes(s.check), label);
    if (s.check !== 'exact') assert.ok(s.note.length > 20, `${label}: note`);
    if (s.check === 'formula') assert.match(s.verify, /set\.seed\(/, `${label}: simulation`);
    for (const pkg of s.packages) assert.ok(s.verify.includes(`library(${pkg})`) || s.verify.includes(`${pkg}::`), `${label}: ${pkg}`);
    assert.ok(s.status.length > 20, label);
  }
});

test('method-level check agrees with the default snippet', () => {
  for (const [id, m] of Object.entries(methods)) assert.equal(rcode.check(id), make(id, m.defaults.mode).s.check, id);
});

test('numbers keep full precision and no free text is interpolated', () => {
  const { s } = make('tost-lognormal', 'effect');
  assert.ok(s.verify.includes(String(Math.sqrt(Math.expm1(Math.log1p(0.09))))) || s.verify.includes('CV <- 0.3'));
  // A hostile string in a free-text-like slot never reaches the code: only numbers are read from inputs.
  const m = methods['two-sample'], raw = { ...m.defaults, mode: 'means', mean1: '105', mean2: '100' };
  const p = m.normalize(raw), r = m.solve(stats, p, 'two-sample');
  const code = rcode.snippets(m, { ...raw, note: '"); system("rm -rf /") #' }, p, r, {}).verify;
  assert.doesNotMatch(code, /system\(/);
});

test('the provenance file records a passing R check for every method', () => {
  const text = readFileSync(new URL('./reference/rcode-provenance.txt', import.meta.url), 'utf8');
  assert.match(text, /All \d+ cases passed\./);
  for (const id of Object.keys(methods)) assert.match(text, new RegExp(`^${id} `, 'm'), id);
});
