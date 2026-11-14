import assert from 'node:assert/strict';
import { test } from 'node:test';
import { readFileSync } from 'node:fs';
import stats from '../stats.js';

const fixture = name => {
  const lines = readFileSync(new URL(`./reference/${name}.csv`, import.meta.url), 'utf8').trim().split('\n');
  const keys = lines.shift().split(',');
  return lines.map(line => Object.fromEntries(line.split(',').map((value, i) => [keys[i], value === '' ? null : Number.isNaN(Number(value)) ? value : Number(value)])));
};
const close = (actual, expected, label, tolerance = 2e-9) => assert.ok(Math.abs(actual - expected) < tolerance, `${label}: ${actual} vs ${expected}`);

test('binomial CDF agrees with closed forms', () => {
  close(stats.binomialCdf(0, 10, .3), .7 ** 10, 'P(X=0)');
  close(stats.binomialCdf(3, 3, .4), 1, 'all');
  close(stats.binomialCdf(2, 4, .5), 11 / 16, 'half');
});

for (const [i, r] of fixture('vaccine').entries()) {
  test(`R exact vaccine-efficacy reference ${i + 1}: VE ${r.ve} vs ${r.ve0}, ratio ${r.ratio}`, () => {
    const p = { ve: r.ve, ve0: r.ve0, ratio: r.ratio, alpha: r.alpha, power: r.target };
    const out = stats.vaccineSampleSize(p);
    assert.deepEqual([out.total, out.critical, out.first], [r.total, r.critical, r.first]);
    close(out.power, r.achieved, 'achieved'); close(out.size, r.size, 'size'); close(out.firstPower, r.firstPower, 'first power');
    close(out.boundaryVE, r.boundaryVE, 'boundary VE', 1e-12);
    if (r.previous !== null) close(stats.vaccinePowerAt({ ...p, n: r.total - 1 }).power, r.previous, 'previous');
    assert.ok(out.size <= r.alpha);
  });
}

for (const [i, r] of fixture('negative-binomial').entries()) {
  test(`R negative binomial reference ${i + 1}: μ0 ${r.mu0}, RR ${r.rr}, k ${r.k}, RR0 ${r.rr0}`, () => {
    const p = { rate0: r.mu0, rateRatio: r.rr, dispersion: r.k, followUp: r.t, nullRatio: r.rr0, ratio: r.ratio, alpha: r.alpha, power: r.target };
    const out = stats.rateRatioSampleSize(p);
    assert.deepEqual([out.n, out.n2, out.total], [r.n, r.n2, r.total]);
    close(out.power, r.achieved, 'achieved');
    if (r.previous !== null) { const n = r.n - 1; close(stats.rateRatioPowerAt({ ...p, n, n2: Math.max(2, Math.round(n * r.ratio)) }).power, r.previous, 'previous'); }
  });
}

for (const [i, r] of fixture('group-sequential').entries()) {
  test(`R group sequential reference ${i + 1}: ${r.type}, ${r.looks} looks, ${r.family}${r.type === 'futility' ? '/' + r.lfamily : ''}, β ${r.beta}`, () => {
    const fractions = r.looks === 2 ? [r.t1, 1] : [r.t1, r.t2, 1];
    const p = { fractions, alpha: r.alpha, power: 1 - r.beta, spending: r.family, spendingParameter: r.par, futility: r.type === 'futility', futilitySpending: r.lfamily, futilityParameter: r.lpar, fixedSize: r.nfixed, evenTotal: true };
    const d = stats.sequentialDesign(p), tol = 1e-6;
    d.efficacy.forEach((b, k) => close(b, r[`b${k + 1}`], `efficacy ${k + 1}`, tol));
    if (r.type === 'futility') d.futility.forEach((a, k) => close(a, r[`a${k + 1}`], `futility ${k + 1}`, tol));
    close(d.inflation, r.inflation, 'inflation', tol);
    d.stopH1.forEach((s, k) => close(s, r[`h1stop${k + 1}`], `stop H1 ${k + 1}`, tol));
    d.stopH0.forEach((s, k) => close(s, r[`h0stop${k + 1}`], `stop H0 ${k + 1}`, tol));
    close(d.expectedH1, r.expectedH1, 'expected H1', tol); close(d.expectedH0, r.expectedH0, 'expected H0', tol);
    const out = stats.sequentialSampleSize(p);
    assert.equal(out.total, r.total); close(out.power, r.achieved, 'achieved', tol);
  });
}

test('one-look spending reduces to the fixed design', () => {
  for (const [family, parameter] of [['obf', 0], ['pocock', 0], ['power', 2], ['hsd', -4]]) close(stats.spending(1, .025, family, parameter), .025, family, 1e-12);
  const d = stats.sequentialDesign({ fractions: [.95, 1], alpha: .025, power: .9, spending: 'power', spendingParameter: 1, futility: false, fixedSize: 100 });
  assert.ok(d.inflation > 1 && d.inflation < 1.3);
});
