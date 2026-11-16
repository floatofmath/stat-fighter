import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { readFileSync } from 'node:fs';

const require = createRequire(import.meta.url);
const convert = require('../journey/convert.js');
const stats = require('../stats.js');
const methods = require('../journey/methods.js');

const run = (tool, mode, values) => Object.fromEntries(convert.byId[tool].compute(mode, values).rows.map(([, value, key]) => [key, value]));
const near = (actual, expected, tol = 1e-9, label = '') => assert.ok(Math.abs(actual - expected) <= tol * Math.max(1, Math.abs(expected)), `${label} ${actual} vs ${expected}`);

test('tCritical matches the t quantile', () => {
  near(stats.tCritical(0.025, 10), 2.228139, 1e-6);
});

test('hand-checked anchors', () => {
  near(run('lognormal', 'mean-cv', { mean: 1, cv: 0.3 }).sigma, 0.2935604, 1e-7);
  const ln = run('lognormal', 'mean-sd', { mean: 100, sd: 30 });
  near(ln.gmean, 95.78263, 1e-7); near(ln.mu, 4.562081, 1e-7);
  const sv = run('survival', 'median-hr', { median0: 12, hr: 0.7, time: 12, shape: 1 });
  near(sv.median1, 17.142857, 1e-8); near(sv.s0, 0.5); near(sv.s1, 0.6155722, 1e-7);
  near(run('survival', 'survs', { time: 7, s0: 0.5, s1: 0.6155722, shape: 1 }).hr, 0.7, 1e-6);
  near(run('survival', 'survs', { time: 30, s0: 0.5, s1: 0.6155722, shape: 1 }).hr, 0.7, 1e-6);
  near(run('survival', 'median-hr', { median0: 12, hr: 0.7, time: 12, shape: 2 }).median1, 14.342743, 1e-7);
  near(run('paired', 'sds', { sd1: 10, sd2: 10, rho: 0.5 }).sdDiff, 10);
  near(run('effect', 'd', { d: 0.5 }).theta, 0.6381632, 1e-7);
  near(run('effect', 'r2', { r2: 0.15 / 1.15 }).f2, 0.15);
  const rk = run('risk', 'or', { p0: 0.2, or: 2 });
  near(rk.p1, 1 / 3); near(rk.nnt, 7.5);
  near(run('counts', 'rate-period', { rate: 0.02, period: 2 }).risk, 0.03921056, 1e-7);
  const nb = run('counts', 'mean-var', { mean: 2, variance: 4 });
  near(nb.k, 0.5); near(nb.theta, 2);
  near(run('spread', 'iqr', { iqr: 13.49 }).sd, 10);
  near(run('spread', 'se-n', { se: 2, n: 25 }).sd, 10);
  near(run('spread', 'pooled', { sd1: 10, n1: 11, sd2: 10, n2: 21 }).sd, 10);
});

test('round trips: outputs of one mode fed into another return the inputs', () => {
  const a = run('lognormal', 'mean-sd', { mean: 100, sd: 30 });
  for (const [mode, values] of [['mean-cv', { mean: a.mean, cv: a.cv }], ['gmean-cv', { gmean: a.gmean, cv: a.cv }], ['gmean-gsd', { gmean: a.gmean, gsd: a.gsd }], ['log', { mu: a.mu, sigma: a.sigma }]]) {
    const b = run('lognormal', mode, values); near(b.mean, 100, 1e-12, mode); near(b.sd, 30, 1e-12, mode);
  }
  const s = run('spread', 'mean-cv', { mean: 50, cv: 0.2 });
  near(run('spread', 'se-n', { se: s.sd / Math.sqrt(40), n: 40 }).sd, s.sd);
  const t = stats.tCritical(0.025, 39), half = t * s.sd / Math.sqrt(40);
  const ci = run('spread', 'ci', { lower: 50 - half, upper: 50 + half, n: 40, level: 0.95 });
  near(ci.sd, s.sd, 1e-9); near(ci.mean, 50); near(ci.cv, 0.2, 1e-9);
  const p = run('paired', 'sds-diff', { sd1: 8, sd2: 12, rho: 0.3, difference: 4 });
  near(p.dz * p.sdDiff, 4);
  const r2 = run('effect', 'r2', { r2: 0.2 });
  near(run('effect', 'f2', { f2: r2.f2 }).r2, 0.2); near(run('effect', 'eta2', { eta2: 0.2 }).f, r2.f);
  near(run('effect', 'means-sd', { mean1: 105, mean2: 100, sd: 10 }).d, 0.5);
  const rk = run('risk', 'or', { p0: 0.25, or: 1.8 });
  near(run('risk', 'rr', { p0: 0.25, rr: rk.rr }).p1, rk.p1); near(run('risk', 'two', { p0: 0.25, p1: rk.p1 }).or, 1.8);
  for (const shape of [1, 1.7]) {
    const sv = run('survival', 'median-hr', { median0: 10, hr: 0.6, time: 8, shape });
    for (const [mode, values] of [['medians', { median0: 10, median1: sv.median1, time: 8, shape }], ['surv-hr', { time: 8, s0: sv.s0, hr: 0.6, shape }], ['survs', { time: 8, s0: sv.s0, s1: sv.s1, shape }]]) {
      const b = run('survival', mode, values); near(b.hr, 0.6, 1e-12, mode); near(b.median0, 10, 1e-12, mode); near(b.median1, sv.median1, 1e-12, mode);
    }
  }
  const c = run('counts', 'rate-period', { rate: 0.3, period: 1.5 });
  near(run('counts', 'risk-period', { risk: c.risk, period: 1.5 }).rate, 0.3);
  near(run('counts', 'theta', { theta: run('counts', 'k', { k: 0.8 }).theta }).k, 0.8);
  near(run('counts', 'rr', { rr: run('counts', 've', { ve: 0.65 }).rr }).ve, 0.65);
});

test('invalid input throws a RangeError naming the field', () => {
  const bad = [
    ['lognormal', 'mean-sd', { mean: 100, sd: -3 }, 'sd'], ['spread', 'ci', { lower: 5, upper: 4, n: 10, level: 0.95 }, 'upper'],
    ['spread', 'se-n', { se: 1, n: 1.5 }, 'n'], ['risk', 'two', { p0: 0.2, p1: 1 }, 'p1'], ['risk', 'rr', { p0: 0.6, rr: 2 }, 'rr'],
    ['counts', 'mean-var', { mean: 4, variance: 2 }, 'variance'], ['counts', 'risk-period', { risk: 1, period: 1 }, 'risk'],
    ['paired', 'sds', { sd1: 10, sd2: 10, rho: 1 }, 'rho'], ['survival', 'survs', { time: 1, s0: 0.5, s1: 1.2, shape: 1 }, 's1'],
    ['effect', 'r2', { r2: 1 }, 'r2'], ['lognormal', 'gmean-gsd', { gmean: 1, gsd: 0.9 }, 'gsd'], ['lognormal', 'mean-sd', { mean: NaN, sd: 1 }, 'mean'],
  ];
  for (const [tool, mode, values, field] of bad) {
    assert.throws(() => convert.byId[tool].compute(mode, values), error => error instanceof RangeError && error.field === field, `${tool}/${mode} → ${field}`);
  }
});

test('every tool has fields for its inputs, an example per field, and a note', () => {
  for (const tool of convert.tools) for (const mode of tool.modes) {
    for (const id of mode.inputs) assert.ok(tool.fields[id]?.label && tool.fields[id].example !== '', `${tool.id}.${id}`);
    const out = tool.compute(mode.id, Object.fromEntries(mode.inputs.map(id => [id, Number(tool.fields[id].example)])));
    assert.ok(out.note && out.rows.length, `${tool.id}/${mode.id}`);
    for (const [label, value] of out.rows) assert.ok(Number.isFinite(value), `${tool.id}/${mode.id} ${label}`);
  }
});

test('arena links point at real method fields and real tool outputs', () => {
  for (const [methodId, fields] of Object.entries(convert.links)) for (const [fieldId, [toolId, key]] of Object.entries(fields)) {
    const m = methods[methodId];
    assert.ok(m && (Object.hasOwn(m.defaults, fieldId)), `${methodId}.${fieldId}`);
    const mode = convert.modeFor(toolId, key), tool = convert.byId[toolId];
    const out = tool.compute(mode, Object.fromEntries(tool.modes.find(x => x.id === mode).inputs.map(id => [id, Number(tool.fields[id].example)])));
    assert.ok(out.rows.some(row => row[2] === key), `${toolId}:${key}`);
    assert.deepEqual(convert.target(`${methodId}.${fieldId}`), { method: methodId, field: fieldId, tool: toolId, key });
  }
  for (const bad of ['two-sample.effect', 'nope.sd', 'two-sample', '../x.sd', 'two-sample.sd.x', '', null, 'two-sample.__proto__', 'constructor.sd']) assert.equal(convert.target(bad), null, String(bad));
});

test('R cross-check: every case in tests/reference/convert.csv agrees', () => {
  const lines = readFileSync(new URL('./reference/convert.csv', import.meta.url), 'utf8').trim().split('\n');
  const head = lines.shift().split(',');
  assert.ok(lines.length >= 30);
  for (const line of lines) {
    const row = Object.fromEntries(line.split(',').map((v, i) => [head[i], v]));
    const values = JSON.parse(row.inputs.replaceAll(';', ',').replaceAll("'", '"'));
    near(run(row.tool, row.mode, values)[row.key], Number(row.expected), 1e-9, `${row.tool}/${row.mode}/${row.key}`);
  }
});
