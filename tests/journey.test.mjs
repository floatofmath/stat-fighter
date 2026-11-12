import assert from 'node:assert/strict';
import { test } from 'node:test';
import { readFileSync } from 'node:fs';
import methods from '../journey/methods.js';
import stats from '../stats.js';
const method = methods['two-sample'];
const base = { ...method.defaults };
test('equivalent effect and means modes give identical canonical inputs and results', () => {
  const a = method.normalize(base), b = method.normalize({ ...base, mode: 'means' });
  assert.deepEqual(a, b);
  assert.deepEqual(stats.sampleSize('two-sample', a), stats.sampleSize('two-sample', b));
  assert.equal(stats.sampleSize('two-sample', b).total, 128);
});
test('means conversion preserves sign, unit scaling and inactive mode draft', () => {
  const raw = { ...base, mode: 'means', mean1: '10', mean2: '20', sd: '20', alternative: 'less', effect: '3' };
  const copy = { ...raw };
  assert.equal(method.normalize(raw).effect, -0.5);
  assert.deepEqual(raw, copy);
  assert.equal(method.normalize({ ...raw, mean1: '100', mean2: '200', sd: '200' }).effect, -0.5);
  assert.equal(method.normalize({ ...raw, mode: 'effect', alternative: 'greater' }).effect, 3);
});
test('reject empty fields, invalid SD, overflow, missing modes and sign mismatch', () => {
  for (const change of [{ effect: '' }, { alpha: '' }, { power: '1' }, { ratio: '0' }, { alternative: 'less' }, { mode: 'unknown' }, { mode: 'means', sd: '0' }, { mode: 'means', mean1: '' }, { mode: 'means', mean1: '1e308', mean2: '-1e308' }]) {
    assert.throws(() => method.normalize({ ...base, ...change }), RangeError);
  }
});
const csv = readFileSync(new URL('./reference/two-sample.csv', import.meta.url), 'utf8').trim().split('\n');
const keys = csv.shift().split(',');
for (const [index, row] of csv.entries()) {
  const v = Object.fromEntries(row.split(',').map((value, i) => [keys[i], keys[i] === 'alternative' ? value : value === '' ? null : Number(value)]));
  test(`independent R allocation and predecessor ${index + 1}`, () => {
    const parameters = { effect: v.effect, alpha: v.alpha, power: v.target, ratio: v.ratio, alternative: v.alternative };
    const result = stats.sampleSize('two-sample', parameters);
    assert.deepEqual([result.n, result.n2], [v.n, v.n2]);
    assert.ok(Math.abs(result.power - v.achieved) < 2e-9);
    const fixed = stats.tPowerAt('two-sample', { ...parameters, n: v.n, n2: v.n2 });
    assert.equal(result.power, fixed.power);
    assert.ok(fixed.power >= v.target);
    if (v.previous !== null) {
      const n = v.n - 1;
      const preceding = stats.tPowerAt('two-sample', { ...parameters, n, n2: Math.max(2, Math.round(n * v.ratio)) });
      assert.ok(Math.abs(preceding.power - v.previous) < 2e-9);
      assert.ok(preceding.power < v.target);
    } else assert.equal(v.n, 2);
  });
}
test('fixed-N two-sided symmetry and paired / one-sample consistency', () => {
  const p = { ...method.normalize(base), n: 34, n2: 34 };
  assert.equal(stats.tPowerAt('two-sample', p).power, stats.tPowerAt('two-sample', { ...p, effect: -p.effect }).power);
  assert.deepEqual(stats.tPowerAt('paired', p), stats.tPowerAt('one-sample', p));
  assert.throws(() => stats.tPowerAt('two-sample', { ...p, n: 1 }), RangeError);
});
