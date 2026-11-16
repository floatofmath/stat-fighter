'use strict';
// Protocol-ready text for the sample size section of a protocol or SAP. Every number comes from
// the user's inputs (raw), the method's parameters (p), the verified result (r), the method's own
// allocations or result tables. Allowed arithmetic: subtracting two inputs, proportion → percent,
// 1 − 2α. Placeholders in [brackets] are what the app cannot know. No jokes here, ever.
{
  const count = new Intl.NumberFormat('en-US');
  const num = x => String(Number(Number(x).toPrecision(4)));
  const pc = x => num(100 * Number(x));
  const power = x => (100 * x).toFixed(1);
  const N = x => count.format(x);
  const list = items => items.length < 2 ? items.join('') : `${items.slice(0, -1).join(', ')} and ${items.at(-1)}`;
  const SOURCE = '[source of the assumption]';

  // Dropout allowance, shared with the arena's enrol line so both always agree.
  function enrolment(p, r, d) {
    const up = v => Math.ceil(v / (1 - d) - 1e-9);
    if (r.n2) { const a = up(r.n), b = up(r.n2); return { total: a + b, detail: `${N(a)} + ${N(b)}` }; }
    if (p.groups) { const a = up(r.n); return { total: a * p.groups, detail: `${N(a)} × ${p.groups} groups` }; }
    return { total: up(r.total), detail: '' };
  }

  const sided = p => p.alternative === 'two-sided' ? 'two-sided' : 'one-sided';
  const level = p => `a ${sided(p)} significance level of ${num(p.alpha)}`;
  const provide = (p, r, marginal = false) => `provide at least ${power(p.power)}% ${marginal ? 'marginal ' : ''}power (achieved: ${power(r.power)}%).`;
  const twoGroups = (p, r) => `${N(r.n)} participants in [test group] and ${N(r.n2)} in [reference group] (${N(r.total)} in total; allocation 1:${num(p.ratio)})`;
  const perGroup = r => `${N(r.n)} participants per group (${N(r.total)} in total)`;
  const allocated = (m, p, r) => m.allocations(r, p).map(([, v]) => v);
  const row = (tables, label) => { for (const t of tables ?? []) for (const x of t.rows ?? []) if (x[0] === label) return x[1]; return undefined; };
  const table = (tables, title) => (tables ?? []).find(t => t.title === title);
  const receipt = (m, raw, p, r, label) => m.receipt(raw, p, r).find(([l]) => l === label)?.[1];
  const meansSd = (raw, d) => `Assuming means of ${num(raw.mean1)} and ${num(raw.mean2)} [units] (difference ${num(raw.mean1 - raw.mean2)}) and a common standard deviation of ${num(raw.sd)} ${SOURCE}, corresponding to a standardised effect of d = ${num(d)},`;
  const normalT = 'The calculation uses the noncentral t distribution and assumes normally distributed outcomes.';
  const marginCaveat = 'The margin must be justified clinically and statistically [justification of the margin].';

  // Each template returns the method sentences: hypothesis and test, assumptions + result, caveat.
  const templates = {
    'two-sample'(m, raw, p, r) {
      const welch = raw.mode === 'welch';
      const test = welch ? 'Welch’s unequal-variance t-test' : 'a two-sample t-test with pooled variance';
      const assume = raw.mode === 'means' ? meansSd(raw, p.effect)
        : welch ? `Assuming means of ${num(raw.mean1)} and ${num(raw.mean2)} [units] (difference ${num(raw.mean1 - raw.mean2)}) and standard deviations of ${num(raw.sd1)} in [test group] and ${num(raw.sd2)} in [reference group] ${SOURCE}, corresponding to a standardised effect of d = ${num(p.effect)} relative to the first standard deviation,`
        : `Assuming a standardised mean difference (Cohen’s d) of ${num(p.effect)} ${SOURCE},`;
      return [`The primary endpoint, [primary endpoint], will be compared between [test group] and [reference group] using ${test} at ${level(p)}.`,
        `${assume} ${twoGroups(p, r)} ${provide(p, r)}`,
        welch ? 'Power uses a noncentral t approximation with Satterthwaite degrees of freedom.' : normalT];
    },
    paired(m, raw, p, r) {
      const assume = raw.mode === 'differences'
        ? `Assuming a mean paired difference of ${num(raw.difference)} [units] and a standard deviation of the paired differences of ${num(raw.sdDifference)} ${SOURCE} (dz = ${num(p.effect)}),`
        : `Assuming a standardised paired effect of dz = ${num(p.effect)} ${SOURCE},`;
      return [`The within-pair difference in [primary endpoint] will be tested against zero with a paired t-test at ${level(p)}.`,
        `${assume} ${N(r.n)} complete pairs ${provide(p, r)}`,
        'The calculation uses the noncentral t distribution and assumes normally distributed paired differences.'];
    },
    'one-sample'(m, raw, p, r) {
      const means = raw.mode === 'means';
      return [`The mean of [primary endpoint] will be compared with the fixed reference value ${means ? num(raw.reference) : '[reference value]'} using a one-sample t-test at ${level(p)}.`,
        `${means ? `Assuming a true mean of ${num(raw.mean)} [units] and a standard deviation of ${num(raw.sd)} ${SOURCE} (d = ${num(p.effect)}),` : `Assuming a standardised difference from the reference value of d = ${num(p.effect)} ${SOURCE},`} ${N(r.n)} evaluable observations ${provide(p, r)}`,
        normalT];
    },
    anova(m, raw, p, r) {
      const means = Array.from({ length: p.groups }, (_, i) => num(raw[`groupMean${i + 1}`]));
      return [`[Primary endpoint] will be compared across ${p.groups} groups with a one-way analysis of variance (overall F-test) at a significance level of ${num(p.alpha)}.`,
        `${raw.mode === 'means' ? `Assuming group means of ${list(means)} [units] and a common within-group standard deviation of ${num(raw.sd)} ${SOURCE} (Cohen’s f = ${num(p.effect)}),` : `Assuming Cohen’s f = ${num(p.effect)} ${SOURCE},`} ${perGroup(r)} ${provide(p, r)}`,
        'Power refers to the overall F-test, not to individual pairwise comparisons.'];
    },
    ancova(m, raw, p, r) {
      const q = p.covariates === 1 ? 'one baseline covariate' : `${p.covariates} baseline covariates`;
      const assume = raw.mode === 'means' ? meansSd(raw, p.effect).slice(0, -1) : `Assuming a standardised mean difference (Cohen’s d) of ${num(p.effect)} ${SOURCE}`;
      return [`[Primary endpoint] will be compared between [test group] and [reference group] by analysis of covariance adjusting for ${q}, at ${level(p)}.`,
        `${assume} and a correlation of ${num(Math.sqrt(p.rSquared))} between the covariate${p.covariates === 1 ? '' : 's'} and the outcome, ${twoGroups(p, r)} ${provide(p, r)}`,
        'The calculation reduces the residual standard deviation by √(1 − ρ²) and is an approximation that is slightly optimistic in small trials.'];
    },
    correlation(m, raw, p, r) {
      return [`The Pearson correlation between [variable X] and [variable Y] will be tested against zero (${sided(p)}, α = ${num(p.alpha)}).`,
        `${raw.mode === 'covariance' ? `Assuming a covariance of ${num(raw.covariance)} with standard deviations of ${num(raw.sdX)} and ${num(raw.sdY)} ${SOURCE} (ρ = ${num(p.effect)}),` : `Assuming a true correlation of ${num(p.effect)} ${SOURCE},`} ${N(r.n)} complete observations ${provide(p, r)}`,
        'Power uses the Fisher z approximation.'];
    },
    regression(m, raw, p, r) {
      return [`The overall F-test of a linear regression of [primary endpoint] with ${p.predictors} predictor degree${p.predictors === 1 ? '' : 's'} of freedom will be performed at a significance level of ${num(p.alpha)}.`,
        `${raw.mode === 'r-squared' ? `Assuming a model R² of ${num(raw.rSquared)} ${SOURCE} (Cohen’s f² = ${num(p.effect)}),` : `Assuming Cohen’s f² = ${num(p.effect)} ${SOURCE},`} ${N(r.n)} observations ${provide(p, r)}`,
        'Power refers to the test of all predictors jointly.'];
    },
    'mann-whitney'(m, raw, p, r) {
      return [`[Primary endpoint] will be compared between [test group] and [reference group] with the Wilcoxon–Mann–Whitney test (${sided(p)}, α = ${num(p.alpha)}).`,
        `Assuming a probability of ${num(p.effect + 0.5)} that a randomly chosen participant in [test group] has a higher value than one in [reference group] ${SOURCE}, ${perGroup(r)} ${provide(p, r)}`,
        'Power uses Noether’s large-sample approximation and assumes continuous data without ties.'];
    },
    'signed-rank'(m, raw, p, r) {
      const assume = raw.mode === 'normal-shift'
        ? `Assuming normally distributed paired differences with mean ${num(raw.difference)} and standard deviation ${num(raw.sdDifference)} [units] ${SOURCE}, so that the probability that the sum of two independent paired differences is positive is ${num(p.effect + 0.5)},`
        : `Assuming a probability of ${num(p.effect + 0.5)} that the sum of two independent paired differences is positive ${SOURCE},`;
      return [`The within-pair differences in [primary endpoint] will be tested with the Wilcoxon signed-rank test (${sided(p)}, α = ${num(p.alpha)}).`,
        `${assume} ${N(r.n)} complete pairs ${provide(p, r)}`,
        'Power uses Noether’s large-sample approximation and assumes continuous data without ties.'];
    },
    proportions(m, raw, p, r) {
      return [`The proportion of participants with [primary endpoint] will be compared between [test group] and [reference group] (${sided(p)}, α = ${num(p.alpha)}).`,
        `${raw.mode === 'proportions' ? `Assuming proportions of ${pc(raw.proportion1)}% and ${pc(raw.proportion2)}% ${SOURCE} (Cohen’s h = ${num(p.effect)}),` : `Assuming Cohen’s h = ${num(p.effect)} ${SOURCE},`} ${perGroup(r)} ${provide(p, r)}`,
        'Power uses the normal approximation after the arcsine transformation, without continuity correction.'];
    },
    'chi-square'(m, raw, p, r) {
      return [`The association between [primary endpoint] and [grouping variable] will be tested with a chi-square test with ${p.df} degree${p.df === 1 ? '' : 's'} of freedom at a significance level of ${num(p.alpha)}.`,
        `${raw.mode === 'table' ? `Assuming joint cell probabilities of ${list(['cell11', 'cell12', 'cell21', 'cell22'].map(k => num(raw[k])))} ${SOURCE} (Cohen’s w = ${num(p.effect)}),` : `Assuming an effect size of Cohen’s w = ${num(p.effect)} ${SOURCE},`} ${N(r.total)} observations ${provide(p, r)}`,
        'All expected cell counts should be checked to be adequate.'];
    },
    'ni-proportions'(m, raw, p, r) {
      const favour = raw.benefit === 'lower' ? 'lower' : 'higher', [nT, nR] = allocated(m, p, r);
      const claim = p.hypothesis === 'superiority'
        ? `The trial will test whether the proportion of participants with [primary endpoint] in [test group] is superior to that in [reference group] by more than ${pc(p.margin)} percentage points (risk difference; ${favour} proportions are favourable).`
        : `The trial will test whether the proportion of participants with [primary endpoint] in [test group] is non-inferior to that in [reference group], with a non-inferiority margin of ${pc(p.margin)} percentage points (risk difference; ${favour} proportions are favourable).`;
      return [claim, `The test is one-sided at α = ${num(p.alpha)} using the Farrington–Manning score statistic.`,
        `Assuming true proportions of ${pc(p.p1)}% in [test group] and ${pc(p.p2)}% in [reference group] ${SOURCE}, ${N(nT)} participants in [test group] and ${N(nR)} in [reference group] (${N(r.total)} in total; allocation 1:${num(p.ratio)}) ${provide(p, r)}`,
        marginCaveat];
    },
    'log-rank'(m, raw, p, r, x) {
      const hr = raw.mode === 'hazard-ratio' ? `a hazard ratio of ${num(raw.hazardRatio)}` : `a hazard ratio of ${num(Math.exp(-p.effect))} (or its reciprocal)`;
      const out = [`[Primary endpoint] (time to event) will be compared between [test group] and [reference group] with a two-sided log-rank test at α = ${num(p.alpha)}.`,
        `Assuming ${hr} ${SOURCE} under proportional hazards and ${pc(p.allocation)}% of participants allocated to [test group], ${N(r.total)} events are required for ${power(p.power)}% power (achieved: ${power(r.power)}%; Schoenfeld approximation).`];
      const enrol = row(x.tables, 'Participants to enrol');
      if (enrol !== undefined) out.push(`With a median time to event of ${num(raw.controlMedian)} [time units] in [reference group], uniform accrual over ${num(raw.accrual)} [time units], ${num(raw.followUp)} [time units] of additional follow-up and ${pc(raw.loss)}% loss to follow-up per [time unit], approximately ${enrol} participants need to be enrolled to observe these events (exponential model).`);
      out.push('The event count is the primary planning quantity; enrolment should be monitored against the observed number of events.');
      return out;
    },
    'vaccine-efficacy'(m, raw, p, r, x) {
      const out = [`Vaccine efficacy (VE) against [primary endpoint] will be tested against the null hypothesis VE ≤ ${pc(p.ve0)}% with an exact conditional binomial test (one-sided α = ${num(p.alpha)}), conditional on the total number of cases.`,
        `Assuming a true VE of ${pc(p.ve)}% ${SOURCE} and a vaccine:placebo allocation of ${num(p.ratio)}:1, ${N(r.total)} cases ${provide(p, r)}`,
        `Success requires at most ${N(r.critical)} cases in the vaccine group.`];
      const enrol = row(x.tables, 'Participants to enrol');
      if (enrol !== undefined) out.push(`With a placebo attack rate of ${pc(raw.attackRate)}% over follow-up and ${pc(raw.nonEvaluable)}% of participants not evaluable, approximately ${enrol} participants will be enrolled.`);
      return out;
    },
    'negative-binomial'(m, raw, p, r) {
      const [n0, n1] = allocated(m, p, r);
      return [`The rate of [primary endpoint] will be compared between [test group] and [reference group] with a negative binomial model (one-sided α = ${num(p.alpha)}; null hypothesis rate ratio ≥ ${num(p.nullRatio)}).`,
        `Assuming an event rate of ${num(p.rate0)} per [time unit] in [reference group], a rate ratio of ${num(p.rateRatio)} ${SOURCE}, a dispersion parameter of ${num(p.dispersion)} (variance = μ + kμ²) and ${num(p.followUp)} [time units] of follow-up per participant, ${N(n0)} participants in [reference group] and ${N(n1)} in [test group] (${N(r.total)} in total) ${provide(p, r)}`,
        'Power uses a Wald approximation on the log rate ratio (Zhu and Lakatos 2014).'];
    },
    bonferroni(m, raw, p, r) {
      const assume = raw.mode === 'means'
        ? `assuming means of ${num(raw.mean1)} and ${num(raw.mean2)} [units] and a common standard deviation of ${num(raw.sd)} ${SOURCE} (d = ${num(p.effect)}),`
        : `assuming a standardised mean difference (Cohen’s d) of ${num(p.effect)} ${SOURCE},`;
      return [`[Primary endpoint] will be compared between [test group] and [reference group] in ${p.comparisons} prespecified comparisons, each tested at α/${p.comparisons} = ${num(r.comparisonAlpha)} (Bonferroni; familywise α = ${num(p.alpha)}, ${sided(p)}).`,
        `For the comparison powered here, ${assume} ${perGroup(r)} ${provide(p, r, true)}`,
        'Power is for this single comparison, not for all comparisons jointly.'];
    },
    'non-inferiority'(m, raw, p, r) {
      const means = raw.mode === 'means', favour = raw.benefit === 'lower' ? 'lower' : 'higher';
      const margin = means ? `${num(raw.marginRaw)} [units]` : `${num(p.margin)} standard deviations`;
      const assume = means
        ? `Assuming means of ${num(raw.mean1)} in [test group] and ${num(raw.mean2)} in [reference group] [units] (difference ${num(raw.mean1 - raw.mean2)}) and a common standard deviation of ${num(raw.sd)} ${SOURCE},`
        : `Assuming a true standardised difference (test minus reference) of ${num(raw.effect)} ${SOURCE},`;
      return [`The trial will test whether [test group] is non-inferior to [reference group] on [primary endpoint] (${favour} values are favourable) with a non-inferiority margin of ${margin}.`,
        `The test is a one-sided two-sample t-test at α = ${num(p.alpha)} (equivalently, the ${num(100 * (1 - 2 * p.alpha))}% two-sided confidence interval for the difference must exclude the margin).`,
        `${assume} ${perGroup(r)} ${provide(p, r)}`, marginCaveat];
    },
    tost(m, raw, p, r) {
      const means = raw.mode === 'means';
      const bounds = means ? `(${num(raw.lowerRaw)}, ${num(raw.upperRaw)}) [units]` : `(${num(raw.lower)}, ${num(raw.upper)}) standard deviations`;
      const assume = means
        ? `Assuming means of ${num(raw.mean1)} in [test group] and ${num(raw.mean2)} in [reference group] [units] (difference ${num(raw.mean1 - raw.mean2)}) and a common standard deviation of ${num(raw.sd)} ${SOURCE},`
        : `Assuming a true standardised difference (test minus reference) of ${num(raw.effect)} ${SOURCE},`;
      return [`Equivalence of [test group] and [reference group] on [primary endpoint] will be assessed with two one-sided t-tests (TOST), each at α = ${num(p.alpha)}; equivalence is concluded if the ${num(100 * r.confidence)}% confidence interval for the mean difference lies entirely within ${bounds}.`,
        `${assume} ${perGroup(r)} ${provide(p, r)}`,
        'Power is the joint probability that both one-sided tests reject, under a normal model with a common standard deviation.'];
    },
    'tost-lognormal'(m, raw, p, r) {
      return [`Average bioequivalence of [test] and [reference] for [pharmacokinetic parameter] will be assessed in a parallel-group design on the log scale with two one-sided t-tests at α = ${num(p.alpha)}; bioequivalence is concluded if the ${num(100 * r.confidence)}% confidence interval for the geometric mean ratio lies within ${pc(raw.lowerRatio)}–${pc(raw.upperRatio)}%.`,
        `Assuming a true geometric mean ratio of ${num(receipt(m, raw, p, r, 'Expected geometric mean ratio'))} and a total (between-subject) coefficient of variation of ${pc(receipt(m, raw, p, r, 'Equivalent total CV'))}% ${SOURCE}, ${perGroup(r)} ${provide(p, r)}`,
        'The calculation covers one parameter; joint power for several parameters (e.g. AUC and Cmax) is lower.'];
    },
    'tost-crossover'(m, raw, p, r) {
      return [`Average bioequivalence of [test] and [reference] for [pharmacokinetic parameter] will be assessed in a 2×2 crossover design on the log scale with two one-sided t-tests at α = ${num(p.alpha)}, assuming no carry-over; bioequivalence is concluded if the ${num(100 * r.confidence)}% confidence interval for the geometric mean ratio lies within ${pc(raw.lowerRatio)}–${pc(raw.upperRatio)}%.`,
        `Assuming a true geometric mean ratio of ${num(receipt(m, raw, p, r, 'Expected geometric mean ratio'))} and a within-subject coefficient of variation of ${pc(receipt(m, raw, p, r, 'Equivalent within-subject CV'))}% ${SOURCE}, ${N(r.total)} subjects (${N(r.n)} per sequence) ${provide(p, r)}`,
        'The calculation covers one parameter; joint power for several parameters (e.g. AUC and Cmax) is lower.'];
    },
  };

  // Bell and Towel share one template; every boundary is read from the method's own tables.
  function sequential(m, raw, p, r, x) {
    const names = Object.fromEntries(m.fields.spending.options.map(o => [o.value, o.label.replace(/ \([ργ]\)$/, '')]));
    const param = (fn, value) => fn === 'power' ? ` (ρ = ${num(value)})` : fn === 'hsd' ? ` (γ = ${num(value)})` : '';
    const looks = table(x.tables, 'Boundaries per look'), summary = table(x.tables, 'Design summary');
    const col = name => looks.rows.map(rw => rw[looks.columns.indexOf(name)]);
    const unit = raw.mode === 'effect' ? 'participants' : raw.mode === 'hazard' ? 'events' : '[units]';
    const what = raw.mode === 'effect' ? 'number of participants' : raw.mode === 'hazard' ? 'number of events' : 'size';
    const fixed = num(row(x.tables, 'Fixed-design size'));
    const start = raw.mode === 'effect' ? `Assuming a standardised mean difference of ${num(raw.effect)} ${SOURCE}`
      : raw.mode === 'hazard' ? `Assuming a hazard ratio of ${num(raw.hazardRatio)} ${SOURCE}`
      : `Starting from a fixed-design size of ${fixed} [units]`;
    const out = [`The comparison of [primary endpoint] between [test group] and [reference group] uses a group sequential design with ${p.fractions.length} analyses at ${list(p.fractions.map(f => `${pc(f)}%`))} of the maximum information. Efficacy boundaries are derived from a ${names[p.spending]}${param(p.spending, p.spendingParameter)} alpha-spending function (one-sided overall α = ${num(p.alpha)}).`];
    if (p.futility) out.push(`Non-binding futility boundaries are derived from a ${names[p.futilitySpending]}${param(p.futilitySpending, p.futilityParameter)} beta-spending function.`);
    out.push(`${start}, the maximum ${what} is ${N(r.total)} for ${power(p.power)}% power (achieved: ${power(r.power)}%; inflation factor ${row(x.tables, 'Inflation factor')} over the fixed design of ${fixed}).`,
      `Analyses are planned after ${list(r.looks.map(N))} ${unit}. The efficacy boundaries on the Z scale are ${list(col('Efficacy Z ≥'))} (nominal one-sided p-values ${list(col('Nominal p'))})${p.futility ? `; the futility boundaries are ${list(col('Futility Z <'))}` : ''}.`,
      `The expected size is ${row(x.tables, 'Expected size under H1')} under the alternative and ${row(x.tables, 'Expected size under H0')} under the null hypothesis.`,
      `If the actual information fractions differ from those planned, boundaries will be recalculated with the same spending function${p.futility ? 's' : ''}.`);
    return out;
  }
  templates['gsd-efficacy'] = sequential;
  templates['gsd-futility'] = sequential;

  // extras: { dropout, version, engine, tables, disclaimer, reproducible }
  function text(m, raw, p, r, extras = {}) {
    const template = templates[m.id];
    if (!template) throw new Error(`No protocol template for ${m.id}.`);
    const out = [...template(m, raw, p, r, extras)];
    const d = Number(extras.dropout);
    if (m.dropout !== false && Number.isFinite(d) && d > 0 && d < 0.9) {
      const e = enrolment(p, r, d);
      out.push(`Allowing for ${pc(d)}% of participants without analysable data, ${N(e.total)} participants will be enrolled${e.detail ? ` (${e.detail})` : ''}.`);
    }
    out.push(`Calculations were performed with Stat Fighter ’89 version ${extras.version} (engine ${extras.engine}, method ${m.version})${extras.reproducible ? ' and can be reproduced with the R code in the appendix' : ''}.`);
    return `${out.join(' ')}\n\n${extras.disclaimer}`;
  }

  const protocol = { text, enrolment, templates };
  if (typeof module !== 'undefined') module.exports = protocol;
  else globalThis.StatFighter.protocol = protocol;
}
