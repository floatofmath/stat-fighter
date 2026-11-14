import assert from 'node:assert/strict';
import { test } from 'node:test';
import { readFileSync } from 'node:fs';
import stats from '../stats.js';

const fixture = name => {
  const lines = readFileSync(new URL(`./reference/${name}.csv`, import.meta.url), 'utf8').trim().split('\n');
  const keys = lines.shift().split(',');
  return lines.map(line => Object.fromEntries(line.split(',').map((value, i) => [keys[i], value === '' ? null : Number.isNaN(Number(value)) ? value : Number(value)])));
};
const close = (actual, expected, label) => assert.ok(Math.abs(actual - expected) < 2e-9, `${label}: ${actual} vs ${expected}`);
const second = (n, ratio) => Math.max(2, Math.round(n * ratio));

for (const [i, r] of fixture('crossover').entries()) {
  test(`R crossover TOST reference ${i + 1}: CV ${r.cv}, GMR ${r.gmr}`, () => {
    const sigma = Math.sqrt(Math.log1p(r.cv ** 2));
    const p = { effect: Math.log(r.gmr) / sigma, lower: Math.log(r.lowerRatio) / sigma, upper: Math.log(r.upperRatio) / sigma, alpha: r.alpha, power: r.target };
    const out = stats.crossoverSampleSize(p);
    assert.deepEqual([out.n, out.total], [r.n, r.total]);
    close(out.power, r.achieved, 'achieved');
    if (r.previous !== null) { const prev = stats.crossoverPowerAt({ ...p, n: r.n - 1 }); close(prev.power, r.previous, 'previous'); assert.ok(prev.power < r.target); }
    else assert.equal(r.n, 2);
  });
}
test('crossover reproduces the published PowerTOST 2×2 example (N 40, power 0.815845)', () => {
  const sigma = Math.sqrt(Math.log1p(.09));
  const out = stats.crossoverSampleSize({ effect: Math.log(.95) / sigma, lower: Math.log(.8) / sigma, upper: Math.log(1.25) / sigma, alpha: .05, power: .8 });
  assert.equal(out.total, 40); assert.equal(Number(out.power.toFixed(6)), .815845);
});

for (const [i, r] of fixture('ancova').entries()) {
  test(`R ANCOVA reference ${i + 1}: d ${r.effect}, ρ ${r.correlation}, q ${r.covariates}, ratio ${r.ratio}`, () => {
    const p = { effect: r.effect, rSquared: r.correlation ** 2, covariates: r.covariates, ratio: r.ratio, alpha: r.alpha, power: r.target, alternative: r.alternative };
    const out = stats.ancovaSampleSize(p);
    assert.deepEqual([out.n, out.n2, out.total], [r.n, r.n2, r.total]);
    close(out.power, r.achieved, 'achieved');
    if (r.previous !== null) { const n = r.n - 1, prev = stats.ancovaPowerAt({ ...p, n, n2: second(n, r.ratio) }); close(prev.power, r.previous, 'previous'); assert.ok(prev.power < r.target); }
    else assert.equal(r.n, r.minimum);
  });
}

for (const [i, r] of fixture('welch').entries()) {
  test(`R Welch reference ${i + 1}: δ/SD₁ ${r.effect}, SD₂/SD₁ ${r.sdRatio}, ratio ${r.ratio}`, () => {
    const p = { effect: r.effect, sdRatio: r.sdRatio, ratio: r.ratio, alpha: r.alpha, power: r.target, alternative: r.alternative };
    const out = stats.welchSampleSize(p);
    assert.deepEqual([out.n, out.n2, out.total], [r.n, r.n2, r.total]);
    close(out.power, r.achieved, 'achieved');
    if (r.previous !== null) { const n = r.n - 1, prev = stats.welchPowerAt({ ...p, n, n2: second(n, r.ratio) }); close(prev.power, r.previous, 'previous'); assert.ok(prev.power < r.target); }
    else assert.equal(r.n, 2);
  });
}
test('Welch with equal SDs and equal groups reproduces the pooled t-test', () => {
  const pooled = stats.sampleSize('two-sample', { effect: .5, alpha: .05, power: .8, ratio: 1, alternative: 'two-sided' });
  const welch = stats.welchSampleSize({ effect: .5, sdRatio: 1, alpha: .05, power: .8, ratio: 1, alternative: 'two-sided' });
  assert.equal(welch.total, pooled.total); close(welch.power, pooled.power, 'power');
});

for (const [i, r] of fixture('ni-proportions').entries()) {
  test(`R Farrington–Manning reference ${i + 1}: ${r.hypothesis}, p ${r.p1}/${r.p2}, margin ${r.margin}`, () => {
    const delta0 = r.hypothesis === 'non-inferiority' ? -r.direction * r.margin : r.direction * r.margin;
    const p = { p1: r.p1, p2: r.p2, delta0, direction: r.direction, ratio: r.ratio, alpha: r.alpha, power: r.target };
    const out = stats.proportionsMarginSampleSize(p);
    assert.deepEqual([out.n, out.n2, out.total], [r.n, r.n2, r.total]);
    close(out.power, r.achieved, 'achieved');
    if (r.previous !== null) { const n = r.n - 1, prev = stats.proportionsMarginPowerAt({ ...p, n, n2: second(n, r.ratio) }); close(prev.power, r.previous, 'previous'); assert.ok(prev.power < r.target); }
    else assert.equal(r.n, 2);
  });
}
test('Farrington–Manning restricted MLE satisfies the null constraint and score equation', () => {
  for (const [p1, p2, n1, n2, d] of [[.8, .8, 100, 100, -.1], [.3, .45, 50, 120, .05], [.97, .97, 400, 200, -.02]]) {
    const [x, y] = stats.restrictedProportions(p1, p2, n1, n2, d);
    assert.ok(Math.abs(x - y - d) < 1e-15);
    const score = n1 * (p1 - x) / (x * (1 - x)) + n2 * (p2 - y) / (y * (1 - y));
    assert.ok(Math.abs(score) < 1e-6, String(score));
  }
  assert.deepEqual(stats.restrictedProportions(.6, .4, 10, 30, 0), [.45, .45]);
});

test('ANOVA fixed-size evaluator agrees with its solver', () => {
  const out = stats.anovaSampleSize({ groups: 3, effect: .25, alpha: .05, power: .8 });
  assert.equal(stats.anovaPowerAt({ groups: 3, effect: .25, alpha: .05, n: out.n }).power, out.power);
});

test('scanning solver separates the first and the stable sample size for saw-toothed power', () => {
  const tooth = [0, 0, .5, .7, .82, .79, .81, .78, .83, .84, .85, .86, .87, .88, .89, .9];
  const evaluate = n => ({ n, power: tooth[Math.min(n, tooth.length - 1)] });
  const { first, stable } = stats.scanSampleSize(.8, 40, evaluate, 2, 5);
  assert.equal(first.n, 4); assert.equal(stable.n, 8);
  assert.throws(() => stats.scanSampleSize(.95, 40, evaluate), RangeError);
});

test('enrolment event probability matches closed forms', () => {
  close(stats.eventProbability({ hazard: Math.log(2) / 12, accrual: 0, followUp: 12 }), .5, 'all followed 12 at median 12');
  const h = .1, A = 10, F = 5, expected = 1 - (Math.exp(-h * F) - Math.exp(-h * (A + F))) / (h * A);
  close(stats.eventProbability({ hazard: h, accrual: A, followUp: F }), expected, 'uniform accrual');
  assert.ok(stats.eventProbability({ hazard: h, dropoutHazard: .05, accrual: A, followUp: F }) < expected);
  assert.throws(() => stats.eventProbability({ hazard: 0, accrual: 1, followUp: 1 }), RangeError);
});
