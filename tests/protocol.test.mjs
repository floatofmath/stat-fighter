import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import { createRequire } from 'node:module';
import { readFileSync } from 'node:fs';

const require = createRequire(import.meta.url);
const methods = require('../journey/methods.js');
const stats = require('../stats.js');
const protocol = require('../journey/protocol.js');
const context = { StatFighter: {} };
context.globalThis = context;
vm.runInNewContext(readFileSync(new URL('../journey/content.js', import.meta.url), 'utf8'), context);
const content = context.StatFighter.content;
const count = new Intl.NumberFormat('en-US');

function make(id, mode, extra = {}, reproducible = true) {
  const m = methods[id], raw = { ...m.defaults, mode, ...extra };
  const p = m.normalize(raw), r = m.solve(stats, p, id);
  const tables = m.resultTables ? m.resultTables(raw, p, r, stats) : [];
  return { m, p, r, text: protocol.text(m, raw, p, r, { dropout: raw.dropout, version: content.version, engine: stats.version, tables, disclaimer: content.disclaimer.copy, reproducible }) };
}
const placeholders = ['[primary endpoint]', '[Primary endpoint]', '[variable X]', '[pharmacokinetic parameter]'];

test('every method and input mode gives a complete protocol paragraph', () => {
  for (const [id, m] of Object.entries(methods)) for (const mode of m.modes) for (const dropout of ['0', '0.15']) {
    const { p, r, text } = make(id, mode.id, { dropout }), label = `${id}/${mode.id}/${dropout}`;
    assert.ok(text.length > 200, label);
    assert.ok(text.includes(count.format(r.total)), `${label}: total ${r.total}`);
    assert.ok(text.includes(String(Number(Number(p.alpha).toPrecision(4)))), `${label}: alpha`);
    assert.doesNotMatch(text, /undefined|NaN|\[object|\bnull\b(?!\s+hypothesis)/, label);
    assert.ok(text.endsWith(content.disclaimer.copy), `${label}: disclaimer last`);
    assert.ok(placeholders.some(x => text.includes(x)), `${label}: placeholder`);
    assert.ok(text.includes(`Stat Fighter ’89 version ${content.version}`), `${label}: software named`);
    if (m.dropout !== false && dropout !== '0') assert.match(text, /Allowing for 15% of participants without analysable data/, label);
    if (dropout === '0') assert.doesNotMatch(text, /Allowing for/, label);
  }
});

test('the R appendix is mentioned only when the R check reproduces the method', () => {
  assert.match(make('two-sample', 'effect', {}, true).text, /reproduced with the R code/);
  assert.doesNotMatch(make('two-sample', 'effect', {}, false).text, /reproduced with the R code/);
});

test('dropout sentence uses the arena enrol numbers', () => {
  const { p, r, text } = make('two-sample', 'means', { dropout: '0.2' });
  const e = protocol.enrolment(p, r, 0.2);
  assert.equal(e.total, 160);
  assert.ok(text.includes(`${count.format(e.total)} participants will be enrolled (80 + 80)`));
});

test('app version in content.js equals package.json', () => {
  assert.equal(content.version, JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf8')).version);
});

test('snapshot: Maverick, means mode', () => {
  assert.equal(make('two-sample', 'means', { dropout: '0.1' }).text, `The primary endpoint, [primary endpoint], will be compared between [test group] and [reference group] using a two-sample t-test with pooled variance at a two-sided significance level of 0.05. Assuming means of 105 and 100 [units] (difference 5) and a common standard deviation of 10 [source of the assumption], corresponding to a standardised effect of d = 0.5, 64 participants in [test group] and 64 in [reference group] (128 in total; allocation 1:1) provide at least 80.0% power (achieved: 80.1%). The calculation uses the noncentral t distribution and assumes normally distributed outcomes. Allowing for 10% of participants without analysable data, 144 participants will be enrolled (72 + 72). Calculations were performed with Stat Fighter ’89 version ${content.version} (engine ${stats.version}, method ${methods['two-sample'].version}) and can be reproduced with the R code in the appendix.

${content.disclaimer.copy}`);
});

test('snapshot: Switch, defaults', () => {
  assert.equal(make('tost-crossover', 'effect').text, `Average bioequivalence of [test] and [reference] for [pharmacokinetic parameter] will be assessed in a 2×2 crossover design on the log scale with two one-sided t-tests at α = 0.05, assuming no carry-over; bioequivalence is concluded if the 90% confidence interval for the geometric mean ratio lies within 80–125%. Assuming a true geometric mean ratio of 0.95 and a within-subject coefficient of variation of 30% [source of the assumption], 40 subjects (20 per sequence) provide at least 80.0% power (achieved: 81.6%). The calculation covers one parameter; joint power for several parameters (e.g. AUC and Cmax) is lower. Calculations were performed with Stat Fighter ’89 version ${content.version} (engine ${stats.version}, method ${methods['tost-crossover'].version}) and can be reproduced with the R code in the appendix.

${content.disclaimer.copy}`);
});

test('Bell reads every boundary from its own table', () => {
  const { text } = make('gsd-efficacy', 'effect');
  for (const z of ['2.9626', '2.3590', '2.0141', '0.00153', '0.00916', '0.02200']) assert.ok(text.includes(z), z);
  assert.ok(text.includes('after 86, 129 and 172 participants'));
});
