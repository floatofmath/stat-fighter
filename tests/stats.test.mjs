import assert from 'node:assert/strict';
import { test } from 'node:test';
import stats from '../stats.js';

const { anovaSampleSize, sampleSize } = stats;

const defaults = { alpha: 0.05, power: 0.8, effect: 0.5, alternative: 'two-sided', ratio: 1 };

// R stats::power.t.test(strict = TRUE) for balanced designs, and R qt()/pt()
// for integer unequal allocations. See PLAN.md for the reference equations.
const references = [
  ['balanced two-sided', 'two-sample', {}, 64, 64, 0.80145955792228],
  ['balanced greater', 'two-sample', { alternative: 'greater' }, 51, 51, 0.80589859909403],
  ['paired two-sided', 'paired', {}, 34, 0, 0.80777750127944],
  ['one-sample two-sided', 'one-sample', {}, 34, 0, 0.80777750127944],
  ['one-sample less', 'one-sample', { effect: -0.5, alternative: 'less' }, 27, 0, 0.81183155170825],
  ['unequal 2:1 allocation', 'two-sample', { alpha: 0.025, power: 0.9, effect: 0.3, ratio: 2 }, 208, 416, 0.900457410436155],
  ['unequal 0.34 allocation, less', 'two-sample', { alpha: 0.01, power: 0.95, effect: -0.7, alternative: 'less', ratio: 0.34 }, 128, 44, 0.950244309202115],
  ['rounded allocation near target', 'two-sample', { ratio: 1.33 }, 56, 74, 0.800044921270047],
  ['rounds half up', 'two-sample', { effect: 0.6, ratio: 0.1 }, 245, 25, 0.812600999082695],
  ['low alpha and high power', 'two-sample', { alpha: 0.0001, power: 0.999, effect: 0.02 }, 243664, 243664, 0.999000032980378],
  ['minimum df', 'one-sample', { alpha: 0.2, power: 0.5, effect: 5, alternative: 'greater' }, 2, 0, 0.999967651361673],
  ['low alpha with a large effect', 'paired', { alpha: 0.0001, power: 0.75, effect: 5 }, 7, 0, 0.942614570594591],
  ['high df and negative two-sided effect', 'one-sample', { effect: -0.003 }, 872098, 0, 0.800000210054179],
  ['upper allocation bound', 'two-sample', { alpha: 0.2, power: 0.51, effect: 5, alternative: 'greater', ratio: 10 }, 2, 20, 0.999999997350592],
  ['paired less with high power', 'paired', { alpha: 0.005, power: 0.997, effect: -1.3, alternative: 'less' }, 21, 0, 0.997883025761483],
];

for (const [label, design, input, n, n2, expectedPower] of references) {
  test(label, () => {
    const parameters = { ...defaults, ...input };
    const result = sampleSize(design, parameters);
    assert.deepEqual([result.n, result.n2, result.total], [n, n2, n + n2]);
    assert.ok(Math.abs(result.power - expectedPower) < 2e-9, `Achieved power was ${result.power}`);
    assert.ok(result.power >= parameters.power);
  });
}

test('group two has a minimum of two observations', () => {
  const parameters = { ...defaults, alpha: 0.2, effect: 5, ratio: 0.1 };
  assert.equal(sampleSize('two-sample', parameters).n2, 2);
});

test('a target above the achieved power advances the whole sample size', () => {
  const parameters = { ...defaults, power: 0.801459558 };
  assert.equal(sampleSize('two-sample', parameters).n, 65);
});

test('rejects invalid parameters and one-sided sign mismatches', () => {
  for (const bad of [
    { alpha: 0 },
    { power: Infinity },
    { power: 1 },
    { effect: 0 },
    { effect: '0.5' },
    { effect: 0.0009 },
    { effect: 5.1 },
    { ratio: 11 },
    { alternative: 'unknown' },
    { alternative: 'less' },
    { alternative: 'greater', effect: -0.5 },
  ]) {
    assert.throws(() => sampleSize('two-sample', { ...defaults, ...bad }), RangeError);
  }
  assert.throws(() => sampleSize('unknown', defaults), RangeError);
});

test('reports when the target exceeds the total sample size limit', () => {
  assert.throws(() => sampleSize('two-sample', { ...defaults, effect: 0.001 }), /1,000,000-unit limit/);
});

// R qf()/pf() reference powers at the selected and previous group sizes.
const anovaReferences = [
  ['default', 3, 0.25, 0.05, 0.8, 53, 0.804887285363470, 0.796732861719933],
  ['Cohen exercise 8.10', 4, 0.28, 0.05, 0.8, 36, 0.803027838150748, 0.790276743997917],
  ['two groups', 2, 0.25, 0.05, 0.8, 64, 0.801459558534876, 0.795168338670635],
  ['low alpha and high power', 20, 0.02, 0.0001, 0.999, 10351, 0.999001258285683, 0.998999872870543],
  ['large sample', 3, 0.005, 0.05, 0.8, 128464, 0.800001581461699, 0.799998308894379],
  ['minimum group size', 20, 5, 0.2, 0.5, 2, 1],
  ['seven groups', 7, 0.1, 0.01, 0.95, 388, 0.950305485693832, 0.949649122048737],
];

for (const [label, groups, effect, alpha, power, n, expected, preceding] of anovaReferences) {
  test(`ANOVA: ${label}`, () => {
    const parameters = { groups, effect, alpha, power };
    const result = anovaSampleSize(parameters);
    assert.deepEqual([result.n, result.total], [n, n * groups]);
    assert.ok(Math.abs(result.power - expected) < 2e-9, `Achieved power was ${result.power}`);
    assert.ok(result.power >= power);
    if (preceding !== undefined) {
      const previous = anovaSampleSize({ ...parameters, power: preceding - 2e-9 });
      assert.equal(previous.n, n - 1);
      assert.ok(Math.abs(previous.power - preceding) < 2e-9);
    }
  });
}

test('ANOVA rejects invalid inputs and unreachable power', () => {
  const parameters = { groups: 3, effect: 0.25, alpha: 0.05, power: 0.8 };
  for (const invalid of [
    { groups: 1 }, { groups: 3.5 }, { groups: 21 }, { effect: 0 }, { effect: -0.25 },
    { effect: 5.01 }, { alpha: 0 }, { power: 1 },
  ]) {
    assert.throws(() => anovaSampleSize({ ...parameters, ...invalid }), RangeError);
  }
  assert.throws(() => anovaSampleSize({ ...parameters, effect: 0.001 }), /1,000,000-unit limit/);
});
