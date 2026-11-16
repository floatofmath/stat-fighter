'use strict';
// Training Room: conversions between what a study report gives you and what a fighter asks for.
// Pure functions, no DOM. Nothing here is a sample size, and nothing is rounded: the screen formats.
// compute(modeId, values) takes numbers and throws a RangeError with a `field` on bad input,
// the same convention as journey/methods.js.
{
  const stats = typeof module !== 'undefined' ? require('../stats.js') : globalThis.StatFighter.stats;

  const fail = (field, message) => { const error = new RangeError(message); error.field = field; throw error; };
  // Field kinds: finite number, > 0, proportion strictly inside (0, 1), correlation in [−1, 1],
  // proportion in [0, 1), > 1, whole number ≥ 2.
  const checks = {
    number: () => true,
    positive: v => v > 0,
    nonneg: v => v >= 0,
    prob: v => v > 0 && v < 1,
    corr: v => v >= -1 && v <= 1,
    unit: v => v >= 0 && v < 1,
    above1: v => v > 1,
    count: v => Number.isInteger(v) && v >= 2,
  };
  const messages = {
    positive: 'must be greater than zero', nonneg: 'must be zero or more', prob: 'must be strictly between 0 and 1',
    corr: 'must be between −1 and 1', unit: 'must be from 0 to below 1', above1: 'must be greater than 1', count: 'must be a whole number of at least 2',
  };
  function reader(tool, values) {
    return id => {
      const f = tool.fields[id], v = values[id];
      if (typeof v !== 'number' || !Number.isFinite(v)) fail(id, `Enter a finite number for ${f.label}.`);
      if (!checks[f.kind ?? 'number'](v)) fail(id, `${f.label} ${messages[f.kind]}.`);
      return v;
    };
  }
  const field = (label, hint, kind = 'number', example = '') => ({ label, hint, kind, example });
  const normalCdf = stats.normalCdf;

  // ---- Log-normal: arithmetic ↔ geometric ↔ log scale ----
  const lognormal = {
    id: 'lognormal', title: 'Log-normal scales',
    blurb: 'Arithmetic mean and SD, CV, geometric mean and SD, and the log-scale parameters of one log-normal variable.',
    modes: [
      { id: 'mean-sd', label: 'Mean + SD', inputs: ['mean', 'sd'] },
      { id: 'mean-cv', label: 'Mean + CV', inputs: ['mean', 'cv'] },
      { id: 'gmean-cv', label: 'Geometric mean + CV', inputs: ['gmean', 'cv'] },
      { id: 'gmean-gsd', label: 'Geometric mean + geometric SD', inputs: ['gmean', 'gsd'] },
      { id: 'log', label: 'Log mean + log SD', inputs: ['mu', 'sigma'] },
    ],
    fields: {
      mean: field('Arithmetic mean', 'On the original scale.', 'positive', '100'),
      sd: field('Arithmetic SD', 'On the original scale.', 'positive', '30'),
      cv: field('Coefficient of variation', 'SD ÷ mean, as a decimal: 0.3, not 30.', 'positive', '0.3'),
      gmean: field('Geometric mean', 'Also the median of a log-normal variable.', 'positive', '100'),
      gsd: field('Geometric SD', 'A multiplicative factor greater than 1.', 'above1', '1.35'),
      mu: field('Log-scale mean μ', 'Mean of ln(x).', 'number', '4.6'),
      sigma: field('Log-scale SD σ', 'SD of ln(x). Not ln(SD).', 'positive', '0.3'),
    },
    compute(mode, values) {
      const get = reader(this, values);
      let mu, sigma;
      if (mode === 'mean-sd' || mode === 'mean-cv') {
        const mean = get('mean'), cv = mode === 'mean-sd' ? get('sd') / mean : get('cv');
        sigma = Math.sqrt(Math.log1p(cv * cv)); mu = Math.log(mean) - sigma * sigma / 2;
      } else if (mode === 'gmean-cv') { const g = get('gmean'), cv = get('cv'); sigma = Math.sqrt(Math.log1p(cv * cv)); mu = Math.log(g); }
      else if (mode === 'gmean-gsd') { mu = Math.log(get('gmean')); sigma = Math.log(get('gsd')); }
      else if (mode === 'log') { mu = get('mu'); sigma = get('sigma'); }
      else fail('mode', 'Unknown mode.');
      const v = sigma * sigma, cv = Math.sqrt(Math.expm1(v)), mean = Math.exp(mu + v / 2);
      return {
        rows: [
          ['Arithmetic mean', mean, 'mean'], ['Arithmetic SD', mean * cv, 'sd'], ['Coefficient of variation (CV)', cv, 'cv'],
          ['Geometric mean = median', Math.exp(mu), 'gmean'], ['Geometric SD', Math.exp(sigma), 'gsd'],
          ['Log-scale mean μ', mu, 'mu'], ['Log-scale SD σ', sigma, 'sigma'], ['Log-scale variance σ²', v, 'logVar'],
        ],
        note: 'Assumes the variable is log-normal: σ = √ln(1 + CV²), geometric mean = e^μ, mean = e^(μ + σ²/2).',
      };
    },
  };

  // ---- Spread: get an SD from what a paper reports ----
  const spread = {
    id: 'spread', title: 'Standard deviation',
    blurb: 'Recover an SD from a CV, a standard error, a confidence interval, two group SDs or an IQR.',
    modes: [
      { id: 'mean-cv', label: 'Mean + CV', inputs: ['mean', 'cv'] },
      { id: 'se-n', label: 'SE + n', inputs: ['se', 'n'] },
      { id: 'ci', label: 'CI of a mean + n', inputs: ['lower', 'upper', 'n', 'level'] },
      { id: 'pooled', label: 'Two SDs (pooled)', inputs: ['sd1', 'n1', 'sd2', 'n2'] },
      { id: 'iqr', label: 'IQR (rough)', inputs: ['iqr'] },
    ],
    fields: {
      mean: field('Mean', 'Must be positive for a CV.', 'positive', '50'),
      cv: field('Coefficient of variation', 'SD ÷ mean, as a decimal.', 'positive', '0.2'),
      se: field('Standard error of the mean', 'SE = SD ÷ √n.', 'positive', '1.5'),
      n: field('Sample size n', 'Number of observations behind the SE or interval.', 'count', '40'),
      lower: field('Lower confidence limit', 'Of the mean.', 'number', '45'),
      upper: field('Upper confidence limit', 'Of the mean.', 'number', '55'),
      level: field('Confidence level', 'As a decimal: 0.95.', 'prob', '0.95'),
      sd1: field('SD of group 1', '', 'positive', '10'),
      n1: field('n of group 1', '', 'count', '30'),
      sd2: field('SD of group 2', '', 'positive', '12'),
      n2: field('n of group 2', '', 'count', '30'),
      iqr: field('Interquartile range', 'Q3 − Q1.', 'positive', '13.5'),
    },
    compute(mode, values) {
      const get = reader(this, values), rows = [];
      let sd, note = 'An SD recovered from summary statistics is only as good as the report it came from.';
      if (mode === 'mean-cv') { const mean = get('mean'), cv = get('cv'); sd = cv * mean; }
      else if (mode === 'se-n') { const se = get('se'), n = get('n'); sd = se * Math.sqrt(n); }
      else if (mode === 'ci') {
        const lower = get('lower'), upper = get('upper'), n = get('n'), level = get('level');
        if (!(upper > lower)) fail('upper', 'The upper limit must be above the lower limit.');
        sd = Math.sqrt(n) * (upper - lower) / (2 * stats.tCritical((1 - level) / 2, n - 1));
        rows.push(['Mean (interval midpoint)', (lower + upper) / 2, 'mean']);
        note = 'Assumes a symmetric t interval for a mean from roughly normal data: SD = √n·(U − L) / (2·t₁₋α/₂,ₙ₋₁).';
      } else if (mode === 'pooled') {
        const s1 = get('sd1'), n1 = get('n1'), s2 = get('sd2'), n2 = get('n2');
        sd = Math.sqrt(((n1 - 1) * s1 * s1 + (n2 - 1) * s2 * s2) / (n1 + n2 - 2));
        note = 'Pooled SD assumes both groups share one population SD; with very different SDs, use Welch mode instead.';
      } else if (mode === 'iqr') { sd = get('iqr') / 1.349; note = 'Normal data only: SD ≈ IQR / 1.349 is wrong for skewed data.'; }
      else fail('mode', 'Unknown mode.');
      rows.unshift(['Standard deviation (SD)', sd, 'sd'], ['Variance', sd * sd, 'variance']);
      if (mode === 'mean-cv') rows.push(['Coefficient of variation (CV)', values.cv, 'cv']);
      if (mode === 'ci') rows.push(['Coefficient of variation (CV)', sd / ((values.lower + values.upper) / 2), 'cv']);
      if (mode === 'se-n' || mode === 'ci') rows.push(['Standard error (SE)', sd / Math.sqrt(values.n), 'se']);
      // A CV only makes sense for a positive mean.
      return { rows: rows.filter(([, v, key]) => key !== 'cv' || v > 0), note };
    },
  };

  // ---- Paired: SD of differences from two SDs and their correlation ----
  const paired = {
    id: 'paired', title: 'Paired differences',
    blurb: 'The SD of within-pair differences from the SDs before and after and their correlation.',
    modes: [
      { id: 'sds', label: 'Two SDs + correlation', inputs: ['sd1', 'sd2', 'rho'] },
      { id: 'sds-diff', label: '… + mean difference', inputs: ['sd1', 'sd2', 'rho', 'difference'] },
    ],
    fields: {
      sd1: field('SD before (or condition 1)', '', 'positive', '10'),
      sd2: field('SD after (or condition 2)', '', 'positive', '10'),
      rho: field('Correlation ρ between the two', 'Between −1 and 1.', 'corr', '0.5'),
      difference: field('Mean paired difference', 'After − before, or as your test defines it.', 'number', '5'),
    },
    compute(mode, values) {
      const get = reader(this, values);
      if (mode !== 'sds' && mode !== 'sds-diff') fail('mode', 'Unknown mode.');
      const s1 = get('sd1'), s2 = get('sd2'), rho = get('rho');
      const sdDiff = Math.sqrt(Math.max(0, s1 * s1 + s2 * s2 - 2 * rho * s1 * s2));
      if (!(sdDiff > 0)) fail('rho', 'These values give differences with no variation. Lower the correlation.');
      const rows = [['SD of the differences', sdDiff, 'sdDiff']];
      if (mode === 'sds-diff') rows.push(['Standardised effect dz', get('difference') / sdDiff, 'dz']);
      return { rows, note: 'Exact for any distribution: Var(X₁ − X₂) = s₁² + s₂² − 2ρs₁s₂. The correlation must come from paired data.' };
    },
  };

  // ---- Effect sizes ----
  const effect = {
    id: 'effect', title: 'Effect sizes',
    blurb: 'Cohen’s d, the probability of superiority, R², f² and f.',
    modes: [
      { id: 'means-sd', label: 'Two means + SD → d', inputs: ['mean1', 'mean2', 'sd'] },
      { id: 'd', label: 'd → probability of superiority', inputs: ['d'] },
      { id: 'r2', label: 'R² → f²', inputs: ['r2'] },
      { id: 'f2', label: 'f² → R²', inputs: ['f2'] },
      { id: 'eta2', label: 'η² → f', inputs: ['eta2'] },
    ],
    fields: {
      mean1: field('Mean of group 1', '', 'number', '105'),
      mean2: field('Mean of group 2', '', 'number', '100'),
      sd: field('Common SD', '', 'positive', '10'),
      d: field('Cohen’s d', 'Standardised mean difference.', 'number', '0.5'),
      r2: field('R²', 'Proportion of variance explained, from 0 to below 1.', 'unit', '0.13'),
      f2: field('Cohen’s f²', '', 'nonneg', '0.15'),
      eta2: field('η² (eta squared)', 'From 0 to below 1.', 'unit', '0.06'),
    },
    compute(mode, values) {
      const get = reader(this, values);
      if (mode === 'means-sd' || mode === 'd') {
        const d = mode === 'd' ? get('d') : (get('mean1') - get('mean2')) / get('sd');
        return { rows: [['Cohen’s d', d, 'd'], ['Probability of superiority θ = P(X₁ > X₂)', normalCdf(d / Math.SQRT2), 'theta']],
          note: 'θ = Φ(d/√2) assumes two normal distributions with one common SD.' };
      }
      let r2;
      if (mode === 'r2') r2 = get('r2');
      else if (mode === 'eta2') r2 = get('eta2');
      else if (mode === 'f2') { const f2 = get('f2'); r2 = f2 / (1 + f2); }
      else fail('mode', 'Unknown mode.');
      const f2 = r2 / (1 - r2);
      return { rows: [[mode === 'eta2' ? 'η²' : 'R²', r2, 'r2'], ['Cohen’s f²', f2, 'f2'], ['Cohen’s f', Math.sqrt(f2), 'f']],
        note: 'f² = R²/(1 − R²) and f = √(η²/(1 − η²)) are identities; they assume nothing about the data.' };
    },
  };

  // ---- Risks: odds ratio, risk ratio, difference, NNT, Cohen's h ----
  const risk = {
    id: 'risk', title: 'Risks and ratios',
    blurb: 'Treatment risk from a control risk and an odds ratio or risk ratio, plus difference, NNT and Cohen’s h.',
    modes: [
      { id: 'or', label: 'Control risk + odds ratio', inputs: ['p0', 'or'] },
      { id: 'rr', label: 'Control risk + risk ratio', inputs: ['p0', 'rr'] },
      { id: 'two', label: 'Two risks', inputs: ['p0', 'p1'] },
    ],
    fields: {
      p0: field('Control risk p₀', 'Proportion with the event in the reference group.', 'prob', '0.2'),
      p1: field('Treatment risk p₁', 'Proportion with the event in the test group.', 'prob', '0.3'),
      or: field('Odds ratio', 'Treatment odds ÷ control odds.', 'positive', '2'),
      rr: field('Risk ratio', 'Treatment risk ÷ control risk.', 'positive', '1.5'),
    },
    compute(mode, values) {
      const get = reader(this, values), p0 = get('p0');
      let p1;
      if (mode === 'or') { const or = get('or'); p1 = or * p0 / (1 - p0 + or * p0); }
      else if (mode === 'rr') { p1 = get('rr') * p0; if (!(p1 < 1)) fail('rr', 'This risk ratio gives a treatment risk of 1 or more.'); }
      else if (mode === 'two') p1 = get('p1');
      else fail('mode', 'Unknown mode.');
      const diff = p1 - p0, rows = [
        ['Treatment risk p₁', p1, 'p1'], ['Risk difference p₁ − p₀', diff, 'rd'], ['Risk ratio', p1 / p0, 'rr'],
        ['Odds ratio', p1 / (1 - p1) / (p0 / (1 - p0)), 'or'],
      ];
      if (diff !== 0) rows.push(['Number needed to treat', 1 / Math.abs(diff), 'nnt']);
      rows.push(['Cohen’s h', 2 * Math.asin(Math.sqrt(p1)) - 2 * Math.asin(Math.sqrt(p0)), 'h']);
      return { rows, note: 'Identities between risks; no model is assumed. NNT is 1/|p₁ − p₀| and is not rounded.' };
    },
  };

  // ---- Survival: medians, hazard ratios and survival at a time point ----
  const survival = {
    id: 'survival', title: 'Survival and hazards',
    blurb: 'Hazard ratio, medians and survival at a time point, under exponential or Weibull survival with proportional hazards.',
    modes: [
      { id: 'median-hr', label: 'Control median + HR', inputs: ['median0', 'hr', 'time', 'shape'] },
      { id: 'medians', label: 'Two medians', inputs: ['median0', 'median1', 'time', 'shape'] },
      { id: 'surv-hr', label: 'Control survival at t + HR', inputs: ['time', 's0', 'hr', 'shape'] },
      { id: 'survs', label: 'Two survival proportions at t', inputs: ['time', 's0', 's1', 'shape'] },
    ],
    fields: {
      median0: field('Control median time', 'Any time unit, used throughout.', 'positive', '12'),
      median1: field('Treatment median time', 'Same time unit.', 'positive', '17'),
      hr: field('Hazard ratio', 'Treatment hazard ÷ control hazard.', 'positive', '0.7'),
      time: field('Time point t', 'Where survival is read off.', 'positive', '12'),
      s0: field('Control survival at t', 'Proportion still event-free at t.', 'prob', '0.5'),
      s1: field('Treatment survival at t', 'Proportion still event-free at t.', 'prob', '0.6'),
      shape: field('Weibull shape k', '1 = exponential (constant hazard). Both arms share it.', 'positive', '1'),
    },
    compute(mode, values) {
      const get = reader(this, values), k = get('shape'), t = get('time');
      let m0, hr;
      if (mode === 'median-hr') { m0 = get('median0'); hr = get('hr'); }
      else if (mode === 'medians') { m0 = get('median0'); hr = (m0 / get('median1')) ** k; }
      else if (mode === 'surv-hr' || mode === 'survs') {
        const s0 = get('s0');
        m0 = t * (Math.LN2 / -Math.log(s0)) ** (1 / k);
        hr = mode === 'surv-hr' ? get('hr') : Math.log(get('s1')) / Math.log(s0);
      } else fail('mode', 'Unknown mode.');
      const m1 = m0 * hr ** (-1 / k), S = m => Math.exp(-Math.LN2 * (t / m) ** k);
      const rows = [['Hazard ratio', hr, 'hr'], ['Control median', m0, 'median0'], ['Treatment median', m1, 'median1'],
        ['Control survival at t', S(m0), 's0'], ['Treatment survival at t', S(m1), 's1']];
      if (k === 1) {
        const l0 = Math.LN2 / m0, l1 = Math.LN2 / m1;
        rows.push(['Control hazard per time unit', l0, 'lambda0'], ['Treatment hazard per time unit', l1, 'lambda1'], ['Control mean survival', 1 / l0, 'mean0'], ['Treatment mean survival', 1 / l1, 'mean1']);
      }
      return { rows, note: k === 1
        ? 'Exponential survival (constant hazards): λ = ln2/median, S(t) = e^(−λt), HR = median₀/median₁.'
        : 'Weibull survival with a common shape k (proportional hazards): S(t) = exp(−ln2·(t/median)^k), median₁ = median₀·HR^(−1/k).' };
    },
  };

  // ---- Counts: rates, probabilities, dispersion, vaccine efficacy ----
  const counts = {
    id: 'counts', title: 'Rates and counts',
    blurb: 'Event rate ↔ probability over a period, negative binomial dispersion, and vaccine efficacy ↔ relative risk.',
    modes: [
      { id: 'rate-period', label: 'Rate + period → probability', inputs: ['rate', 'period'] },
      { id: 'risk-period', label: 'Probability + period → rate', inputs: ['risk', 'period'] },
      { id: 'mean-var', label: 'Mean + variance → dispersion', inputs: ['mean', 'variance'] },
      { id: 'k', label: 'Dispersion k → R’s θ', inputs: ['k'] },
      { id: 'theta', label: 'R’s θ → dispersion k', inputs: ['theta'] },
      { id: 've', label: 'Vaccine efficacy → RR', inputs: ['ve'] },
      { id: 'rr', label: 'RR → vaccine efficacy', inputs: ['rr'] },
    ],
    fields: {
      rate: field('Event rate λ', 'Events per person per time unit.', 'positive', '0.02'),
      period: field('Period t', 'Same time unit as the rate.', 'positive', '2'),
      risk: field('Probability over the period', 'Proportion with at least one event by time t.', 'prob', '0.04'),
      mean: field('Mean count per person', '', 'positive', '2'),
      variance: field('Variance of the counts', 'Must be at least the mean.', 'positive', '4'),
      k: field('Dispersion k', 'Variance = μ + kμ². Zero means Poisson.', 'positive', '0.5'),
      theta: field('R’s θ (size)', 'MASS::glm.nb and MKpower use θ = 1/k.', 'positive', '2'),
      ve: field('Vaccine efficacy', 'As a decimal: 0.6 means 60%.', 'number', '0.6'),
      rr: field('Relative risk (vaccine ÷ placebo)', '', 'positive', '0.4'),
    },
    compute(mode, values) {
      const get = reader(this, values);
      if (mode === 'rate-period') { const rate = get('rate'), t = get('period'); return { rows: [['Probability over the period', -Math.expm1(-rate * t), 'risk'], ['Event rate λ', rate, 'rate']], note: 'Assumes a constant event rate (Poisson process): p = 1 − e^(−λt).' }; }
      if (mode === 'risk-period') { const p = get('risk'), t = get('period'); return { rows: [['Event rate λ', -Math.log1p(-p) / t, 'rate'], ['Probability over the period', p, 'risk']], note: 'Assumes a constant event rate (Poisson process): λ = −ln(1 − p)/t.' }; }
      const nbNote = 'Negative binomial with variance = μ + kμ²; R’s θ (size) is 1/k.';
      if (mode === 'mean-var') {
        const m = get('mean'), v = get('variance');
        if (v < m) fail('variance', 'The variance is below the mean: these counts are underdispersed, and a negative binomial model does not fit.');
        const k = (v - m) / (m * m), rows = [['Dispersion k', k, 'k']];
        if (k > 0) rows.push(['R’s θ (size) = 1/k', 1 / k, 'theta']);
        return { rows, note: `${nbNote} Variance equal to the mean gives k = 0, the Poisson case.` };
      }
      if (mode === 'k') { const k = get('k'); return { rows: [['Dispersion k', k, 'k'], ['R’s θ (size) = 1/k', 1 / k, 'theta']], note: nbNote }; }
      if (mode === 'theta') { const th = get('theta'); return { rows: [['Dispersion k', 1 / th, 'k'], ['R’s θ (size) = 1/k', th, 'theta']], note: nbNote }; }
      const veNote = 'VE = 1 − RR, where RR is the vaccine-to-placebo risk (or rate) ratio.';
      if (mode === 've') { const ve = get('ve'); if (!(ve < 1)) fail('ve', 'Vaccine efficacy must be below 1.'); return { rows: [['Vaccine efficacy', ve, 've'], ['Relative risk', 1 - ve, 'rr']], note: veNote }; }
      if (mode === 'rr') { const rr = get('rr'); return { rows: [['Vaccine efficacy', 1 - rr, 've'], ['Relative risk', rr, 'rr']], note: veNote }; }
      fail('mode', 'Unknown mode.');
    },
  };

  const tools = [lognormal, spread, paired, effect, risk, survival, counts];
  const byId = Object.fromEntries(tools.map(tool => [tool.id, tool]));

  // Arena fields that open the Training Room: method id → field id → [tool id, output key].
  const sd = ['spread', 'sd'];
  const links = {
    'two-sample': { sd, sd1: sd, sd2: sd }, 'one-sample': { sd }, anova: { sd }, ancova: { sd }, bonferroni: { sd }, 'non-inferiority': { sd }, tost: { sd },
    paired: { sdDifference: ['paired', 'sdDiff'] }, 'signed-rank': { sdDifference: ['paired', 'sdDiff'] },
    'mann-whitney': { probability: ['effect', 'theta'] },
    'tost-lognormal': { cv: ['lognormal', 'cv'], logSD: ['lognormal', 'sigma'] },
    'tost-crossover': { cv: ['lognormal', 'cv'], logSD: ['lognormal', 'sigma'] },
    'log-rank': { hazardRatio: ['survival', 'hr'], controlMedian: ['survival', 'median0'] },
    'gsd-efficacy': { hazardRatio: ['survival', 'hr'] }, 'gsd-futility': { hazardRatio: ['survival', 'hr'] },
    'negative-binomial': { dispersion: ['counts', 'k'] },
    'vaccine-efficacy': { attackRate: ['counts', 'risk'] },
    'ni-proportions': { p1: ['risk', 'p1'] },
  };
  // A `to=` value from the URL, validated strictly against the links table.
  const target = to => {
    const match = /^([a-z0-9-]+)\.([A-Za-z0-9]+)$/.exec(String(to ?? ''));
    if (!match || !Object.hasOwn(links, match[1]) || !Object.hasOwn(links[match[1]], match[2])) return null;
    const [tool, key] = links[match[1]][match[2]];
    return { method: match[1], field: match[2], tool, key };
  };
  // The first mode whose inputs give a tool's output key, used when a link opens the room.
  const modeFor = (toolId, key) => byId[toolId].modes.find(mode => { try { return byId[toolId].compute(mode.id, Object.fromEntries(mode.inputs.map(id => [id, Number(byId[toolId].fields[id].example)]))).rows.some(row => row[2] === key); } catch { return false; } })?.id ?? byId[toolId].modes[0].id;

  const convert = { tools, byId, links, target, modeFor };
  if (typeof module !== 'undefined') module.exports = convert;
  else globalThis.StatFighter.convert = convert;
}
