import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import { readFileSync } from 'node:fs';

// content.js is a browser script: run it with a StatFighter stub, as sw.test.mjs does for sw.js.
const load = file => readFileSync(new URL(`../${file}`, import.meta.url), 'utf8');
const context = { StatFighter: {} };
context.globalThis = context;
vm.runInNewContext(load('journey/content.js'), context);
const content = context.StatFighter.content;
const fighters = Object.entries(content.fighters);

const pool = (f, key) => [f[key], ...(f[key + 'More'] ?? [])].filter(Boolean);
const bubblePools = ['waiting', 'resultTitle'];

test('twenty-two fighters, each with rotating waiting, win and joke pools', () => {
  assert.equal(fighters.length, 22);
  for (const [id, f] of fighters) {
    for (const key of ['waitingMore', 'resultTitleMore', 'jokeMore']) assert.ok(Array.isArray(f[key]) && f[key].length, `${id}.${key}`);
    for (const key of [...bubblePools, 'joke']) {
      const lines = pool(f, key);
      assert.equal(new Set(lines).size, lines.length, `${id} ${key} pool has duplicates`);
    }
  }
});

test('bubble lines fit in 80 characters and jokes in 110', () => {
  for (const [id, f] of fighters) {
    for (const key of bubblePools) for (const line of pool(f, key)) assert.ok(line.length <= 80, `${id}: ${line}`);
    for (const line of pool(f, 'joke')) assert.ok(line.length <= 110, `${id}: ${line}`);
  }
  for (const line of [...content.cpu.taunts, ...content.cpu.defeats, ...content.lines.stale]) assert.ok(line.length <= 80, line);
});

test('The Null has enough taunts, and every stale line asks for a rematch', () => {
  assert.ok(content.cpu.taunts.length >= 10);
  assert.ok(content.cpu.defeats.length >= 3);
  assert.equal(new Set(content.cpu.taunts).size, content.cpu.taunts.length);
  for (const line of content.lines.stale) assert.match(line, /Rematch/);
  assert.ok(content.lines.taglines.length >= 2);
});

test('the disclaimer has short, full and copy forms, and index.html repeats them verbatim', () => {
  const { short, full, copy } = content.disclaimer;
  assert.ok(short && full && copy);
  const page = load('index.html');
  assert.ok(page.includes(short), 'footer short text');
  assert.ok(page.includes(full), 'About and warning full text');
  assert.ok(load('README.md').includes(full), 'README disclaimer');
});

test('Matchmaker rules point at real fighters and reach all twenty-two', async () => {
  const { createRequire } = await import('node:module');
  const methods = createRequire(import.meta.url)('../journey/methods.js');
  const mm = content.matchmaker;
  for (const rule of mm.rules) assert.ok(methods[rule.fighter] && content.fighters[rule.fighter], rule.fighter);
  const reached = new Set();
  const walk = (answers, depth = 0) => {
    const step = mm.step(answers);
    assert.ok(depth <= 3, JSON.stringify(answers));
    if (step.fighter) { reached.add(step.fighter); return; }
    if (step.none) return;
    assert.ok(step.options.length > 1 || step.ask !== 'design', `${step.ask} after ${JSON.stringify(answers)}`);
    for (const [id] of step.options) walk({ ...answers, [step.ask]: id }, depth + 1);
  };
  walk({});
  assert.deepEqual([...reached].sort(), Object.keys(methods).sort());
});

test('Matchmaker: worked paths, skips and dead ends', () => {
  const mm = content.matchmaker;
  assert.equal(mm.step({ goal: 'difference', outcome: 'continuous', design: 'two-groups' }).fighter, 'two-sample');
  assert.equal(mm.step({ goal: 'many' }).fighter, 'bonferroni');
  assert.equal(mm.step({ goal: 'early' }).ask, 'design');
  assert.equal(mm.step({ goal: 'difference', outcome: 'time' }).fighter, 'log-rank');
  assert.equal(mm.step({ goal: 'difference', outcome: 'binary' }).ask, 'design');
  assert.ok(mm.step({ goal: 'same', outcome: 'binary' }).none);
  assert.equal(mm.step({ goal: 'nonsense' }).ask, 'goal');
  assert.equal(mm.step({ goal: 'difference', outcome: 'continuous', design: 'bogus' }).ask, 'design');
});
