// Dev-only: runs every R snippet from journey/rcode.js with Rscript and compares it with the app.
//   npm run check:r
// Needs R with pwr, PowerTOST, gsDesign, MKpower, MESS (and MASS, survival). Not part of npm test.
// Writes the result table to tests/reference/rcode-provenance.txt and exits 1 on any failure.
import { createRequire } from 'node:module';
import { execFileSync } from 'node:child_process';
import { mkdtempSync, writeFileSync, rmSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import vm from 'node:vm';

const require = createRequire(import.meta.url);
const methods = require('../journey/methods.js');
const stats = require('../stats.js');
const rcode = require('../journey/rcode.js');
const context = { StatFighter: {} };
context.globalThis = context;
vm.runInNewContext(readFileSync(new URL('../journey/content.js', import.meta.url), 'utf8'), context);
const disclaimer = context.StatFighter.content.disclaimer.copy;

const dir = mkdtempSync(join(tmpdir(), 'sf-rcheck-'));
const runR = code => { const file = join(dir, 'snippet.R'); writeFileSync(file, code); return execFileSync('Rscript', ['--vanilla', file], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'], maxBuffer: 1 << 26 }); };

// Cases: defaults for every input mode, alpha 0.01 / power 0.9, a non-default allocation where the
// method has one, and a few direction and design variants.
const extra = {
  'two-sample': [{ ratio: '2' }, { alternative: 'greater' }, { mode: 'welch', sd2: '15', ratio: '1.5' }],
  ancova: [{ ratio: '2', covariates: '2' }],
  'ni-proportions': [{ ratio: '2' }, { benefit: 'lower', p1: '0.2', p2: '0.2' }, { hypothesis: 'superiority', p1: '0.9', p2: '0.7', margin: '0.05' }],
  'negative-binomial': [{ ratio: '2' }, { nullRatio: '1.15', rateRatio: '0.8' }],
  'vaccine-efficacy': [{ ratio: '2' }],
  'non-inferiority': [{ benefit: 'lower', effect: '0.1' }],
  'mann-whitney': [{ alternative: 'greater' }],
  proportions: [{ alternative: 'greater' }],
  correlation: [{ alternative: 'less', effect: '-0.3' }],
  'gsd-efficacy': [{ spending: 'power', spendingParameter: '2' }, { spending: 'hsd', spendingParameter: '-4', looks: '2' }, { spending: 'pocock' }],
  'gsd-futility': [{ futilitySpending: 'power', futilityParameter: '2' }],
  'log-rank': [{ allocation: '0.6', mode: 'hazard-ratio', hazardRatio: '0.6' }],
};
const cases = [];
for (const [id, m] of Object.entries(methods)) {
  for (const mode of m.modes) cases.push([id, { mode: mode.id }]);
  cases.push([id, { alpha: m.defaults.alpha === '0.025' ? '0.01' : '0.01', power: '0.9' }]);
  for (const x of extra[id] ?? []) cases.push([id, x]);
}

const rows = [], failures = [];
const fmt = x => x === undefined || Number.isNaN(x) ? '—' : String(Number(Number(x).toPrecision(6)));
for (const [id, change] of cases) {
  const m = methods[id], raw = { ...m.defaults, ...change };
  let p, r;
  try { p = m.normalize(raw); r = m.solve(stats, p, id); } catch (error) { failures.push(`${id} ${JSON.stringify(change)}: app rejected the case (${error.message})`); continue; }
  const tables = m.resultTables ? m.resultTables(raw, p, r, stats) : [];
  const appEnrol = tables.flatMap(t => t.rows ?? []).find(row => row[0] === 'Participants to enrol')?.[1];
  const s = rcode.snippets(m, raw, p, r, { disclaimer, enrol: appEnrol !== undefined, attackRate: raw.attackRate, nonEvaluable: raw.nonEvaluable });
  const label = `${id} ${Object.entries(change).map(([k, v]) => `${k}=${v}`).join(' ')}`;
  let out;
  const t0 = Date.now();
  try {
    out = runR(`${s.verify}\ncat("SF_CHECK", sf_n, sf_power, if (exists("sf_sim")) sf_sim else NA, if (exists("sf_enrol")) sf_enrol else NA, if (exists("sf_bounds")) paste(sf_bounds, collapse = ";") else "-", "\\n")\n`);
  } catch (error) { failures.push(`${label}: verify failed\n${error.stderr}`); continue; }
  const line = out.split('\n').find(l => l.startsWith('SF_CHECK'));
  const [, nR, powerR, simR, enrolR, boundsR] = line.trim().split(/\s+/);
  const dN = Number(nR) - r.total, dP = Number(powerR) - r.power, sim = Number(simR);
  const problems = [];
  if (s.check === 'close') { if (Math.abs(dN) > 1) problems.push(`N ${nR} vs ${r.total}`); if (Math.abs(dP) >= 0.01) problems.push(`power Δ ${dP}`); }
  else { if (dN !== 0) problems.push(`N ${nR} vs ${r.total}`); if (Math.abs(dP) >= 1e-4) problems.push(`power Δ ${dP}`); }
  if (s.check === 'formula' && !(Math.abs(sim - r.power) < s.simTolerance)) problems.push(`simulation ${sim} vs ${r.power}`);
  if (boundsR !== '-' && r.design) {
    const b = boundsR.split(';').map(Number), worst = Math.max(...b.map((x, i) => Math.abs(x - r.design.efficacy[i])));
    if (!(worst < 1e-3)) problems.push(`bounds Δ ${worst}`);
  }
  if (enrolR !== 'NA' && appEnrol !== undefined && Number(enrolR) !== Number(String(appEnrol).replace(/,/g, ''))) problems.push(`enrol ${enrolR} vs ${appEnrol}`);
  // The analysis code must parse and run on simulated data.
  try { runR(`set.seed(1)\nsuppressMessages({\n${s.simulate}\n${s.analysis}\n${s.exercise}\n})\ninvisible(NULL)\n`); } catch (error) { problems.push(`analysis failed: ${String(error.stderr).split('\n').filter(Boolean).slice(-2).join(' ')}`); }
  rows.push([label, s.check, r.total, nR, fmt(r.power), fmt(powerR), Number.isNaN(sim) ? '—' : fmt(sim), problems.length ? 'FAIL' : 'ok']);
  if (problems.length) failures.push(`${label}: ${problems.join('; ')}`);
  process.stdout.write(`${problems.length ? 'FAIL' : 'ok  '} ${label} (${Date.now() - t0} ms)${problems.length ? ` — ${problems.join('; ')}` : ''}\n`);
}
const versions = runR('for (p in c("pwr", "PowerTOST", "gsDesign", "MKpower", "MESS", "MASS", "survival")) cat(p, as.character(packageVersion(p)), "\\n"); cat(R.version.string, "\\n")').trim();
rmSync(dir, { recursive: true, force: true });
const widths = [0, 1, 2, 3, 4, 5, 6, 7].map(i => Math.max(...[['case', 'check', 'app N', 'R N', 'app power', 'R power', 'simulated', 'result'], ...rows].map(row => String(row[i]).length)));
const table = [['case', 'check', 'app N', 'R N', 'app power', 'R power', 'simulated', 'result'], ...rows].map(row => row.map((c, i) => String(c).padEnd(widths[i])).join('  ').trimEnd()).join('\n');
const text = `R cross-check of journey/rcode.js (scripts/check-rcode.mjs)\nRun: ${new Date().toLocaleDateString('sv-SE')}\n${versions}\n\nexact: same N, |Δpower| < 1e-4 · close: N within 1, |Δpower| < 0.01, bounds within 1e-3 · formula: restated formula exact and simulation within 0.02 (0.04 for Mann–Whitney, whose Noether formula is documented as conservative under a normal shift).\nEvery analysis snippet was also run on simulated data.\n\n${table}\n\n${failures.length ? `FAILURES (${failures.length}):\n${failures.join('\n')}` : `All ${rows.length} cases passed.`}\n`;
writeFileSync(new URL('../tests/reference/rcode-provenance.txt', import.meta.url), text);
console.log(`\n${failures.length ? `${failures.length} failure(s)` : `All ${rows.length} cases passed.`} Table written to tests/reference/rcode-provenance.txt.`);
if (failures.length) { console.log(failures.join('\n')); process.exit(1); }
