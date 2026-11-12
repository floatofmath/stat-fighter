'use strict';
{
  const fail = (field, message) => { const error = new RangeError(message); error.field = field; throw error; };
  const number = (raw, key, label) => {
    if (raw[key] == null || !String(raw[key]).trim() || !Number.isFinite(Number(raw[key]))) fail(key, `Enter a finite number for ${label}.`);
    return Number(raw[key]);
  };
  const positive = (raw, key, label) => {
    const value = number(raw, key, label);
    if (value <= 0) fail(key, `${label} must be greater than zero.`);
    return value;
  };
  const numeric = (label, hint, extra = {}) => ({ label, hint, step: 'any', ...extra });
  const commonFields = {
    alpha: numeric('Alpha · α', '0.05 means a 5% Type I error rate.', { min: 0.0001, max: 0.2, presets: ['0.01', '0.05', '0.1'] }),
    power: numeric('Target power', '0.80 means 80% power.', { min: 0.5, max: 0.999, presets: ['0.8', '0.9', '0.95'] }),
  };
  const sdField = (label = 'Population SD', hint = 'Positive population standard deviation.') => numeric(label, hint, { min: 0 });
  const methods = {};
  function register(spec) {
    const method = {
      version: '1', objectives: ['sample-size'], designFields: [], tuningFields: ['alpha', 'power'],
      ...spec,
      fields: { ...commonFields, ...spec.fields },
      normalize(raw) {
        if (!this.modes.some(mode => mode.id === raw.mode)) fail('mode', 'Choose an input mode.');
        const design = this.design(raw);
        const effect = this.effect(raw, design);
        const range = this.effectRange ?? { min: 0.001, max: 5, label: this.signed ? 'The absolute effect size' : 'Cohen’s f' };
        const magnitude = this.signed ? Math.abs(effect) : effect;
        if (!Number.isFinite(effect) || magnitude < range.min || magnitude > range.max) {
          fail(raw.mode === 'effect' ? 'effect' : this.effectErrorField, `${range.label} must be between ${range.min} and ${range.max}.`);
        }
        const parameters = { ...design, effect };
        for (const id of this.tuningFields) {
          const f = this.fields[id], value = number(raw, id, f.label);
          if (value < f.min || value > f.max) fail(id, `${f.label} must be between ${f.min} and ${f.max}.`);
          parameters[id] = value;
        }
        if (this.signed) {
          if (!['two-sided', 'greater', 'less'].includes(raw.alternative)) fail('alternative', 'Choose an alternative hypothesis.');
          if ((raw.alternative === 'greater' && effect < 0) || (raw.alternative === 'less' && effect > 0)) fail('alternative', `The effect sign must match the chosen direction: ${this.signConvention}.`);
          parameters.alternative = raw.alternative;
        }
        if (this.validateParameters) this.validateParameters(parameters, raw);
        return parameters;
      },
      derive(raw) {
        if (raw.mode === 'effect') return this.effectHint;
        try {
          const effect = this.effect(raw, this.design(raw));
          if (!Number.isFinite(effect)) return 'Check the effect inputs.';
          return `DERIVED ${this.effectSymbol} = ${Number(effect.toPrecision(7))} · ${this.formula}`;
        } catch (error) { return error.message; }
      },
      inputFields(raw) {
        const mode = this.modes.find(mode => mode.id === raw.mode);
        if (!mode) return [];
        if (!mode.repeat) return mode.fields;
        const { count, prefix, min, max } = mode.repeat, n = Number(raw[count]);
        return [...mode.fields, ...Array.from({ length: Number.isInteger(n) && n >= min && n <= max ? n : 0 }, (_, i) => `${prefix}${i + 1}`)];
      },
      receipt(raw, parameters, result) {
        const rows = [['Input mode', this.modes.find(mode => mode.id === raw.mode).label]];
        for (const id of [...this.designFields, ...this.inputFields(raw)]) rows.push([this.fields[id].label, raw[id]]);
        rows.push([`Effect ${this.effectSymbol} / alpha`, `${parameters.effect} / ${parameters.alpha}`]);
        if (this.signed) rows.push(['Alternative', parameters.alternative]);
        if (this.calculationNote) rows.push(['Calculation model', this.calculationNote]);
        if (parameters.ratio !== undefined) rows.push(['Requested n₂ / n₁', parameters.ratio], ['Actual n₂ / n₁', (result.n2 / result.n).toFixed(4)]);
        if (this.additionalReceipt) rows.push(...this.additionalReceipt(raw, parameters, result));
        return rows;
      },
    };
    if (spec.derive) method.derive = spec.derive;
    if (spec.receipt) method.receipt = spec.receipt;
    methods[method.id] = method;
  }
  const tDefaults = { mode: 'effect', effect: '0.5', alpha: '0.05', power: '0.8', alternative: 'two-sided' };
  const tBase = {
    signed: true, effectSymbol: 'd', design: () => ({}),
    fields: { effect: numeric('Effect size · d', 'Signed difference ÷ the appropriate population SD.', { min: -5, max: 5 }) },
    solve: (stats, parameters, id) => stats.sampleSize(id, parameters),
    allocationRule: 'Smallest whole sample size that reaches target power. Complete, analyzable data; no dropout allowance.',
  };
  register({
    ...tBase, id: 'two-sample', name: 'Pooled two-sample t-test', unit: 'participants', totalLabel: 'TOTAL PARTICIPANTS',
    defaults: { ...tDefaults, mean1: '105', mean2: '100', sd: '10', ratio: '1' },
    modes: [{ id: 'effect', label: 'Effect size d', fields: ['effect'] }, { id: 'means', label: 'Means + SD', fields: ['mean1', 'mean2', 'sd'] }],
    fields: { ...tBase.fields,
      mean1: numeric('Group 1 mean', 'Expected population mean.'), mean2: numeric('Group 2 mean', 'Use the same units as Group 1.'), sd: sdField('Common SD'),
      ratio: numeric('Allocation · n₂ / n₁', 'Group 2 relative to Group 1.', { min: 0.1, max: 10, presets: ['0.5', '1', '2'] }),
    },
    tuningFields: ['alpha', 'power', 'ratio'], effectErrorField: 'mean1', signConvention: 'Group 1 minus Group 2',
    formula: '(mean₁ − mean₂) / SD', effectHint: 'Two independent groups. One common SD.',
    effect: raw => raw.mode === 'effect' ? number(raw, 'effect', 'effect size') : (number(raw, 'mean1', 'Group 1 mean') - number(raw, 'mean2', 'Group 2 mean')) / positive(raw, 'sd', 'Common SD'),
    allocations: r => [['Group 1', r.n], ['Group 2', r.n2]],
    allocationRule: 'Smallest integer Group 1 size that reaches target power. Group 2 = max(2, round(Group 1 × ratio)), with half ties rounded up.',
    assumptions: 'Independent observations and groups, normally distributed outcomes within each group, and a common population SD. This is the pooled-variance Student t-test, not Welch’s test. Results count complete, analyzable participants; dropout is not included.',
  });
  // Nova proves that repeatable editors can be declared by a method without router branches.
  const groupDefaults = Object.fromEntries(Array.from({ length: 20 }, (_, i) => [`groupMean${i + 1}`, String([95, 100, 105][i] ?? 100)]));
  const groupFields = Object.fromEntries(Array.from({ length: 20 }, (_, i) => [`groupMean${i + 1}`, numeric(`Group ${i + 1} mean`, 'Expected mean, in the same units as the common SD.') ]));
  register({
    id: 'anova', name: 'Balanced one-way ANOVA', signed: false, effectSymbol: 'f', unit: 'participants', totalLabel: 'TOTAL PARTICIPANTS',
    defaults: { mode: 'effect', effect: '0.25', groups: '3', sd: '16.32993161855452', ...groupDefaults, alpha: '0.05', power: '0.8' },
    modes: [{ id: 'effect', label: 'Cohen’s f', fields: ['effect'] }, { id: 'means', label: 'Group means + SD', fields: ['sd'], repeat: { count: 'groups', prefix: 'groupMean', min: 2, max: 20 } }],
    designFields: ['groups'], fields: {
      groups: numeric('Number of groups', '2–20 groups, with equal sample sizes.', { min: 2, max: 20, step: '1' }),
      effect: numeric('Effect size · Cohen’s f', 'Population SD of expected group means ÷ common within-group SD.', { min: 0.001, max: 5 }),
      sd: sdField('Common within-group SD', 'One population SD, assumed common to all groups.'), ...groupFields,
    },
    design(raw) { const groups = number(raw, 'groups', 'number of groups'); if (!Number.isInteger(groups) || groups < 2 || groups > 20) fail('groups', 'Number of groups must be a whole number between 2 and 20.'); return { groups }; },
    effect(raw, { groups }) {
      if (raw.mode === 'effect') return number(raw, 'effect', 'Cohen’s f');
      const sd = positive(raw, 'sd', 'Common within-group SD');
      const values = Array.from({ length: groups }, (_, i) => number(raw, `groupMean${i + 1}`, `Group ${i + 1} mean`));
      // Center/scale before squaring to avoid overflow and improve translation/unit invariance.
      const offsets = values.map(value => (value - values[0]) / sd);
      const center = offsets.reduce((sum, value) => sum + value / groups, 0);
      return Math.hypot(...offsets.map(value => value - center)) / Math.sqrt(groups);
    },
    formula: 'population SD of group means / within-group SD', effectHint: 'Omnibus F-test. Equal group sizes; no direction or pairwise comparison is implied.', effectErrorField: 'groupMean1',
    allocations: (r, p) => [['Per group', r.n], ['Groups', p.groups]],
    solve: (stats, parameters) => stats.anovaSampleSize(parameters),
    allocationRule: 'Smallest whole sample size per group that reaches target power. Every group receives the same number of participants.',
    assumptions: 'Independent observations, normally distributed outcomes within groups, a common within-group population SD, and equal group sizes. Power applies to the overall F-test, not every pairwise comparison. Means use equal weights and a population divisor of k, not k−1. Results count complete, analyzable participants; dropout is not included.',
  });
  register({
    ...tBase, effectSymbol: 'dᶻ', id: 'paired', name: 'Paired t-test', unit: 'pairs', totalLabel: 'COMPLETE PAIRS',
    defaults: { ...tDefaults, difference: '5', sdDifference: '10' },
    modes: [{ id: 'effect', label: 'Effect size dᶻ', fields: ['effect'] }, { id: 'differences', label: 'Difference + SD', fields: ['difference', 'sdDifference'] }],
    fields: { ...tBase.fields, effect: numeric('Effect size · dᶻ', 'Mean paired difference ÷ SD of paired differences.', { min: -5, max: 5 }), difference: numeric('Mean paired difference', 'Expected after minus before, or your predefined pair order.'), sdDifference: sdField('SD of paired differences', 'SD of the within-pair differences, not a marginal SD or standard error.') },
    effectErrorField: 'difference', signConvention: 'the predefined paired difference', formula: 'mean difference / SD of differences', effectHint: 'One complete pair per unit. Use the SD of the paired differences.',
    effect: raw => raw.mode === 'effect' ? number(raw, 'effect', 'effect size') : number(raw, 'difference', 'mean paired difference') / positive(raw, 'sdDifference', 'SD of paired differences'),
    allocations: r => [['Complete pairs', r.n], ['Measurements', 2 * r.n]],
    assumptions: 'Within-pair differences are normally distributed and independent across pairs. Enter the SD of the differences; a single measurement’s SD is not interchangeable. Each complete pair contributes both measurements. Results count pairs, not twice as many independent participants; dropout is not included.',
  });
  register({
    ...tBase, id: 'one-sample', name: 'One-sample t-test', unit: 'observations', totalLabel: 'OBSERVATIONS',
    defaults: { ...tDefaults, mean: '105', reference: '100', sd: '10' },
    modes: [{ id: 'effect', label: 'Effect size d', fields: ['effect'] }, { id: 'means', label: 'Mean + reference + SD', fields: ['mean', 'reference', 'sd'] }],
    fields: { ...tBase.fields, mean: numeric('Expected population mean', 'Anticipated mean of the population being sampled.'), reference: numeric('Fixed reference mean', 'Known benchmark, in the same measurement units.'), sd: sdField() },
    effectErrorField: 'mean', signConvention: 'population mean minus reference mean', formula: '(mean − reference) / SD', effectHint: 'One sampled population. One fixed reference value.',
    effect: raw => raw.mode === 'effect' ? number(raw, 'effect', 'effect size') : (number(raw, 'mean', 'population mean') - number(raw, 'reference', 'reference mean')) / positive(raw, 'sd', 'Population SD'),
    allocations: r => [['Observations', r.n]],
    assumptions: 'Independent, normally distributed observations and a fixed reference mean. Enter the population SD, not a standard error. If the reference comes from a separate sample with uncertainty, choose a two-sample method. Results count complete, analyzable observations; dropout is not included.',
  });
  register({
    id: 'correlation', name: 'Pearson correlation · approximate', signed: true, effectSymbol: 'ρ', unit: 'complete X/Y observations', totalLabel: 'COMPLETE X/Y OBSERVATIONS',
    defaults: { mode: 'effect', effect: '0.3', covariance: '3', sdX: '2', sdY: '5', alpha: '0.05', power: '0.8', alternative: 'two-sided' },
    modes: [{ id: 'effect', label: 'Population ρ', fields: ['effect'] }, { id: 'covariance', label: 'Covariance + SDs', fields: ['covariance', 'sdX', 'sdY'] }],
    design: () => ({}), fields: {
      effect: numeric('Population correlation · ρ', 'Signed Pearson correlation under the alternative; null ρ = 0.', { min: -0.99, max: 0.99 }),
      covariance: numeric('Population covariance', 'Expected covariance of X and Y, in their product units.'),
      sdX: sdField('Population SD of X'), sdY: sdField('Population SD of Y'),
    },
    effectRange: { min: 0.001, max: 0.99, label: 'Absolute population correlation' },
    effectErrorField: 'covariance', signConvention: 'the correlation relative to zero',
    effect: raw => raw.mode === 'effect' ? number(raw, 'effect', 'population correlation') : number(raw, 'covariance', 'population covariance') / positive(raw, 'sdX', 'Population SD of X') / positive(raw, 'sdY', 'Population SD of Y'),
    formula: 'covariance(X,Y) / (SDₓ × SDᵧ)', effectHint: 'Independent bivariate observations. Test Pearson correlation against zero.',
    allocations: r => [['Complete X/Y records', r.n]],
    solve: (stats, parameters) => stats.correlationSampleSize(parameters),
    notice: 'Approximate planning: bias-corrected Fisher-z with a t-based cutoff, testing null ρ = 0.',
    calculationNote: 'Fisher-z approximation with alternative bias correction and central-t critical correlation, aligned with pwr.r.test. Not an exact correlation-distribution calculation.',
    allocationRule: 'Smallest integer number of independent complete X/Y observations reaching the approximate target power; minimum 4.',
    assumptions: 'Independent observations of two continuously measured, jointly bivariate-normal variables. Pearson correlation tests linear association against null ρ = 0; it does not establish causation. Power uses a Fisher-z approximation with a t-based cutoff and an alternative bias correction. Absolute ρ: 0.001–0.99. This is not Spearman, partial correlation, repeated-measures correlation or a nonzero-null test. Complete X/Y data only; no dropout allowance.',
    help: {
      effect: ['Population Pearson correlation', 'Enter the anticipated signed population correlation, not a value estimated from the study you are planning. Zero is the null. Supported absolute ρ: 0.001–0.99. The planning calculation is approximate and assumes independent bivariate-normal observations.'],
      alternative: ['Direction of correlation', 'Two-sided detects either positive or negative Pearson correlation. Greater means ρ > 0; less means ρ < 0. The expected correlation sign must agree. The null is always ρ = 0.'],
    },
  });
  register({
    id: 'regression', name: 'Multiple linear regression · overall F-test', signed: false, effectSymbol: 'f²', unit: 'observations', totalLabel: 'OBSERVATIONS',
    defaults: { mode: 'effect', effect: '0.15', rSquared: '0.13043478260869565', predictors: '3', alpha: '0.05', power: '0.8' },
    modes: [{ id: 'effect', label: 'Cohen’s f²', fields: ['effect'] }, { id: 'r-squared', label: 'Model R²', fields: ['rSquared'] }],
    designFields: ['predictors'], fields: {
      predictors: numeric('Predictor degrees of freedom', '1–20 slope parameters, excluding the intercept; count dummy/interaction terms separately.', { min: 1, max: 20, step: '1' }),
      effect: numeric('Effect size · Cohen’s f²', 'Overall model signal relative to unexplained variance: R² / (1 − R²).', { min: 0.001, max: 5 }),
      rSquared: numeric('Anticipated model R²', 'Proportion of outcome variance explained by the complete predictor set; use unadjusted R².', { min: 0, max: 0.8333333333333333 }),
    },
    effectRange: { min: 0.001, max: 5, label: 'Cohen’s f²' }, effectErrorField: 'rSquared',
    design(raw) { const predictors = number(raw, 'predictors', 'predictor degrees of freedom'); if (!Number.isInteger(predictors) || predictors < 1 || predictors > 20) fail('predictors', 'Predictor degrees of freedom must be a whole number from 1 to 20, excluding the intercept.'); return { predictors }; },
    effect(raw) {
      if (raw.mode === 'effect') return number(raw, 'effect', 'Cohen’s f²');
      const value = number(raw, 'rSquared', 'model R²');
      if (value <= 0 || value >= 1) fail('rSquared', 'Model R² must be greater than zero and below one.');
      const converted = value / (1 - value);
      return Math.abs(converted - 5) < 1e-13 ? 5 : converted;
    },
    formula: 'R² / (1 − R²)', effectHint: 'Test the complete slope set against an intercept-only model. Include all slope degrees of freedom.',
    allocations: (r, p) => [['Observations', r.n], ['Predictor df', p.predictors]],
    solve: (stats, parameters) => stats.regressionSampleSize(parameters),
    notice: 'Overall-model planning, not power for a particular coefficient, predictor block, or logistic regression.',
    calculationNote: 'Cohen fixed-model convention: numerator df = p, residual df = N − p − 1, noncentrality = N × f²; one fitted intercept.',
    allocationRule: 'Smallest whole N reaching target overall-model power. N must be at least p + 2 so residual df is positive.',
    assumptions: 'A correctly specified ordinary least-squares linear model with one intercept, independent normally distributed errors of common variance, and a full-rank predictor design. The overall F-test compares all p slopes with zero using the Cohen fixed-model N × f² convention. Count slope degrees of freedom, not merely named variables. This does not power an individual coefficient, an incremental predictor block, a binary outcome or a random-X design-specific analysis. Complete observations only; no dropout allowance.',
    help: {
      effect: ['Cohen’s f² for the whole model', 'For the overall test versus an intercept-only model, f² = R² / (1 − R²). This is not Cohen’s f and is not incremental ΔR². Supported f²: 0.001–5. Choose an anticipated effect supported by your study context.'],
    },
  });
  const engine = typeof module !== 'undefined' ? require('../stats.js') : globalThis.StatFighter.stats;
  const whole = (raw, id, label, min, max) => {
    const value = number(raw, id, label);
    if (!Number.isInteger(value) || value < min || value > max) fail(id, `${label} must be a whole number from ${min} to ${max}.`);
    return value;
  };
  const probability = (raw, id, label) => {
    const value = number(raw, id, label);
    if (value <= 0 || value >= 1) fail(id, `${label} must be strictly between zero and one.`);
    return value;
  };
  const expansionBase = {
    design: () => ({}), unit: 'participants', totalLabel: 'TOTAL PARTICIPANTS',
    solve: (stats, parameters, id) => stats.expansionSampleSize(id, parameters),
    allocations: r => [['Group 1', r.n], ['Group 2', r.n2]],
    allocationRule: 'Smallest balanced integer size under the stated planning approximation. At least 20 per group; complete observations only.',
  };
  const rankFields = {
    effect: numeric('Centered probability · θ − 0.5', 'Signed displacement from the null probability of one half.', { min: -.49, max: .49 }),
    probability: numeric('Alternative probability · θ', 'Enter a probability from 0.01 to 0.99, excluding 0.5.', { min: .01, max: .99 }),
  };
  const rankBase = {
    ...expansionBase, signed: true, effectSymbol: 'θ−½',
    defaults: { mode: 'effect', effect: '.2', probability: '.7', alpha: '.05', power: '.8', alternative: 'two-sided' },
    effectRange: { min: .001, max: .49, label: 'Absolute centered probability' },
    fields: rankFields, effectErrorField: 'probability',
    effect: raw => raw.mode === 'effect' ? number(raw, 'effect', 'centered probability') : probability(raw, 'probability', 'Alternative probability') - .5,
    formula: 'θ − 0.5', signConvention: 'the specified probability minus 0.5',
    notice: 'Large-sample planning approximation with null variance; no tie or continuity correction. Not exact rank-test power.',
  };
  register({
    ...rankBase, id: 'mann-whitney', name: 'Mann–Whitney · Noether approximation',
    modes: [{ id: 'effect', label: 'Centered probability', fields: ['effect'] }, { id: 'probability', label: 'P(X₁ > X₂)', fields: ['probability'] }],
    effectHint: 'θ = P(X₁ > X₂) for continuous independent observations. Equal group sizes.',
    calculationNote: 'Noether large-sample null-variance approximation: normal shift = |θ−½|√(6n), where n is the size of each of two groups. Both rejection tails count for two-sided planning.',
    assumptions: 'Two independent groups with continuous outcomes and no ties. θ is the probability that a random Group 1 observation exceeds a random Group 2 observation. Null θ = 0.5. The approximation uses null variance under the alternative and is most credible near the null with large samples; a minimum of 20 per group is a policy, not an accuracy guarantee. Different distribution shapes, ties and strong effects require design-specific simulation. It is not generally a test of medians.',
    help: { effect: ['Centered superiority probability', 'θ = P(X₁ > X₂). The effect entered here is θ−0.5. Positive means Group 1 tends to be larger. For θ=0.7, enter 0.2. Continuous outcomes, no ties; approximate planning only.'], probability: ['Probability of superiority', 'Compare independently drawn observations: θ=P(X₁>X₂). This is not the fraction above a fixed cutpoint. Supported θ 0.01–0.99 excluding a 0.001 neighborhood of 0.5.'], alternative: ['Direction of superiority', 'Greater means θ>0.5; less means θ<0.5. Two-sided counts either departure from half. The sign of θ−0.5 must agree.'] },
  });
  register({
    ...rankBase, id: 'signed-rank', name: 'Wilcoxon signed-rank · Noether approximation', unit: 'complete pairs', totalLabel: 'COMPLETE PAIRS',
    defaults: { ...rankBase.defaults, difference: '0.37080715859355795', sdDifference: '1' },
    modes: [{ id: 'effect', label: 'Centered Walsh probability', fields: ['effect'] }, { id: 'normal-shift', label: 'Normal difference model', fields: ['difference', 'sdDifference'] }],
    fields: { ...rankFields, effect: numeric('Walsh probability · θ − 0.5', 'θ = P(D₁ + D₂ > 0) for independent paired differences; not P(D > 0).', { min: -.49, max: .49 }), difference: numeric('Mean paired difference', 'Normal-location model: expected difference, in measurement units.'), sdDifference: sdField('SD of paired differences') },
    effectErrorField: 'difference', effectHint: 'θ = P(D₁ + D₂ > 0), using two independent paired differences. This is not P(D > 0).',
    effect(raw) { return raw.mode === 'effect' ? number(raw, 'effect', 'centered Walsh probability') : engine.normalCdf(Math.SQRT2 * number(raw, 'difference', 'mean difference') / positive(raw, 'sdDifference', 'SD of differences')) - .5; },
    formula: 'Φ(√2 × mean difference / SD of differences) − 0.5',
    allocations: r => [['Complete pairs', r.n], ['Measurements', 2 * r.n]],
    allocationRule: 'Smallest whole number of complete pairs under the approximation; minimum 20 pairs. Each contributes two measurements.',
    calculationNote: 'Noether-style large-sample null-variance approximation: normal shift = |θ−½|√(3n), θ=P(D₁+D₂>0). Normal entry additionally assumes Gaussian paired differences. Not exact signed-rank power.',
    assumptions: 'Independent complete paired differences from a continuous symmetric location family, with no zero differences or tied absolute differences. Null is symmetry about zero. θ=P(D₁+D₂>0) for independent differences; it is not P(D>0). The leading-term null-variance approximation omits finite-n terms and uses null variance under the alternative. Normal entry assumes Gaussian differences. Minimum 20 pairs does not guarantee approximation accuracy; simulate ties, skew, strong effects and small-sample designs separately.',
    help: { effect: ['Walsh-sum probability', 'θ=P(D₁+D₂>0) for two independent differences from your paired-difference population. Enter θ−0.5. This is not the simple sign probability P(D>0). Normal difference mode derives θ=Φ(√2 mean(D)/SD(D)).'], difference: ['Normal difference model', 'This conversion assumes normal differences. Enter their anticipated population mean and SD, not a marginal measurement SD. It does not make the planning calculation exact.'], alternative: ['Signed-rank direction', 'Greater means a positive symmetric location shift (θ>0.5); less means negative. Two-sided includes both rejection tails.'] },
  });
  register({
    ...expansionBase, id: 'proportions', name: 'Two proportions · arcsine approximation', signed: true, effectSymbol: 'h',
    defaults: { mode: 'effect', effect: '0.20135792079033066', proportion1: '.6', proportion2: '.5', alpha: '.05', power: '.8', alternative: 'two-sided' },
    modes: [{ id: 'effect', label: 'Cohen’s h', fields: ['effect'] }, { id: 'proportions', label: 'Two proportions', fields: ['proportion1','proportion2'] }],
    fields: { effect: numeric('Effect size · Cohen’s h', 'Signed arcsine-transformed difference, Group 1 minus Group 2.', { min: -3, max: 3 }), proportion1: numeric('Group 1 proportion', 'Anticipated event proportion, strictly between 0 and 1.', { min: 0, max: 1 }), proportion2: numeric('Group 2 proportion', 'Same binary outcome and coding in both groups.', { min: 0, max: 1 }) },
    effectRange: { min: .001, max: 3, label: 'Absolute Cohen’s h' }, effectErrorField: 'proportion1', signConvention: 'Group 1 proportion minus Group 2 proportion',
    effect: raw => raw.mode === 'effect' ? number(raw, 'effect', 'Cohen’s h') : 2 * (Math.asin(Math.sqrt(probability(raw, 'proportion1', 'Group 1 proportion'))) - Math.asin(Math.sqrt(probability(raw, 'proportion2', 'Group 2 proportion')))),
    effectHint: 'Two independent binary-outcome groups, equal sample sizes.', formula: '2 asin(√p₁) − 2 asin(√p₂)',
    notice: 'Normal approximation after the arcsine transformation. No continuity correction; not Fisher’s exact test.',
    calculationNote: 'Cohen h normal approximation: normal shift = |h|√(n/2), equal n per group; two-sided includes both rejection tails.',
    assumptions: 'Independent Bernoulli outcomes with a fixed event definition and equal independent group sizes. Approximate normal power for an arcsine transformation, not a pooled-score, exact binomial or Fisher test. Rare outcomes and near-boundary proportions need an exact or simulation-based design check. Minimum 20 per group does not ensure enough events/non-events. No clustering, pairing or dropout adjustment.',
    help: { effect: ['Cohen’s h', 'h=2asin(√p₁)−2asin(√p₂), in radians. A raw difference of 0.1 is not generally h=0.1. The normal approximation can be poor for rare events.'], proportion1: ['Anticipated event proportions', 'Use decimals, e.g. 0.6 for 60%. Both groups must use the same binary event. Neither value may be zero or one, and the implied |h| must be 0.001–3.'], proportion2: ['Group 2 event proportion', 'Enter the anticipated population event probability for Group 2, with the same event coding as Group 1.'] },
  });
  const cells = ['cell11','cell12','cell21','cell22'];
  register({
    ...expansionBase, id: 'chi-square', name: 'Chi-square · noncentral χ² approximation', signed: false, effectSymbol: 'w', unit: 'observations', totalLabel: 'TOTAL OBSERVATIONS',
    defaults: { mode: 'effect', effect: '.2', df: '1', cell11: '.3', cell12: '.2', cell21: '.2', cell22: '.3', alpha: '.05', power: '.8' },
    modes: [{ id: 'effect', label: 'Cohen’s w + df', fields: ['effect'] }, { id: 'table', label: '2 × 2 joint probabilities', fields: cells }],
    designFields: ['df'], fields: { df: numeric('Chi-square degrees of freedom', '1–100; must be 1 for the 2 × 2 independence mode.', { min: 1, max: 100, step: '1' }), effect: numeric('Effect size · Cohen’s w', '√Σ[(alternative − null)² / null] over cells.', { min: .001, max: 5 }), ...Object.fromEntries(cells.map((id,i)=>[id,numeric(`Joint probability · row ${Math.floor(i/2)+1}, column ${i%2+1}`, 'Four positive joint probabilities must sum to one.', { min: 0, max: 1 })])) },
    design(raw) { const df = whole(raw,'df','Degrees of freedom',1,100); if (raw.mode === 'table' && df !== 1) fail('df','A 2 × 2 independence table requires df = 1.'); return { df }; },
    effectRange: { min: .001, max: 5, label: 'Cohen’s w' }, effectErrorField: 'cell11',
    effect(raw) {
      if (raw.mode === 'effect') return number(raw,'effect','Cohen’s w');
      const values = cells.map(id=>probability(raw,id,'Joint cell probability'));
      if (Math.abs(values.reduce((a,b)=>a+b,0)-1) > 1e-10) fail('cell11','The four joint probabilities must sum to one.');
      const [a,b,c,d]=values, expected=[(a+b)*(a+c),(a+b)*(b+d),(c+d)*(a+c),(c+d)*(b+d)];
      return Math.sqrt(values.reduce((sum,v,i)=>sum+(v-expected[i])**2/expected[i],0));
    },
    effectHint: 'Goodness of fit or independence: supply the appropriate w and df. Asymptotic planning.', formula: '√Σ[(joint probability − row margin × column margin)² / expected]',
    allocations: (r,p) => [['Observations',r.n],['Degrees of freedom',p.df]],
    allocationRule: 'Smallest whole total N reaching approximate target power; minimum 2. Check every expected cell count separately before using this design.',
    notice: 'Asymptotic chi-square planning. Expected cell counts are not checked from w and df alone.',
    calculationNote: 'Upper-tail noncentral χ² power with specified df and noncentrality N × w²; central χ² cutoff. No Yates correction or exact-table test.',
    assumptions: 'Independent multinomial observations, fixed categories and an adequately large expected count in every cell. Specify correct df: k−1−estimated parameters for goodness of fit, or (rows−1)(columns−1) for independence. The table mode tests independence using alternative margins; it does not accept raw counts. With sparse cells use an appropriate exact or simulation method. The noncentral χ² approximation does not provide exact finite-sample power.',
    help: { effect: ['Cohen’s w', 'w² is the sum of (alternative probability − null probability)² / null probability. Supply all scientific assumptions externally in direct-w mode.'], df: ['Degrees of freedom', 'For independence use (rows−1)(columns−1). For goodness of fit subtract estimated null parameters from k−1. For the 2 × 2 probability editor set df=1.'], ...Object.fromEntries(cells.map(id=>[id,['Joint cell probabilities','Enter positive population probabilities, not counts or row percentages. All four sum to one. Row and column margins define the independence null; w is derived from the departures.']])) },
  });
  register({
    ...expansionBase, id: 'log-rank', name: 'Log-rank · Schoenfeld event approximation', signed: false, effectSymbol: '|log HR|', unit: 'observed events', totalLabel: 'OBSERVED EVENTS', scoreLabel: 'REQUIRED EVENT COUNT', missionLabel: 'EVENT PLANNING MISSION', waitingAction: 'Find the event target.',
    defaults: { mode: 'effect', effect: String(Math.abs(Math.log(.7))), hazardRatio: '.7', allocation: '.5', alpha: '.05', power: '.8' },
    modes: [{ id: 'effect', label: 'Absolute log hazard ratio', fields: ['effect'] }, { id: 'hazard-ratio', label: 'Hazard ratio', fields: ['hazardRatio'] }],
    designFields: ['allocation'], fields: { effect: numeric('Absolute log hazard ratio', 'Magnitude of natural log(HR), not HR itself.', { min: .001, max: Math.log(10) }), hazardRatio: numeric('Hazard ratio · Group 1 / Group 2', 'Constant proportional-hazards ratio, 0.1–10 excluding 1.', { min: .1, max: 10 }), allocation: numeric('Group 1 allocation proportion', 'Fraction randomized to Group 1; 0.5 means equal allocation.', { min: .1, max: .9 }) },
    design(raw) { const allocation=number(raw,'allocation','Group 1 allocation proportion'); if(allocation<.1||allocation>.9)fail('allocation','Allocation proportion must be 0.1–0.9.');return { allocation }; },
    effectRange: { min: .001, max: Math.log(10), label: 'Absolute log hazard ratio' }, effectErrorField: 'hazardRatio',
    effect(raw) { if(raw.mode==='effect')return number(raw,'effect','Absolute log hazard ratio');const hr=positive(raw,'hazardRatio','Hazard ratio');if(hr<.1||hr>10)fail('hazardRatio','Hazard ratio must be 0.1–10.');return Math.abs(Math.log(hr)); },
    effectHint: 'Two-sided comparison against HR = 1. Output counts events, not participants.', formula: '|ln(HR)|',
    allocations: r => [['Observed events',r.n]], allocationRule: 'Smallest whole event count under the Schoenfeld normal approximation; minimum 10 events. This does not determine enrollment or follow-up.',
    notice: 'EVENTS, not participants. Two-sided Schoenfeld approximation; recruitment requires a separate accrual, censoring and follow-up model.',
    calculationNote: 'Normal log-rank shift = |ln(HR)|√[Dq(1−q)] for D events and allocation q. Both rejection tails count. No enrollment conversion is implied.',
    assumptions: 'Two independent randomized groups, proportional hazards, fixed allocation, independent non-informative censoring and a prespecified event. The Schoenfeld event approximation can be inaccurate far from HR=1 or with unequal allocation. It does not model accrual, event-time distribution, competing risks, crossing hazards, loss to follow-up, interim looks or covariates. Required observed events are not required participants; minimum 10 is a numerical policy, not an accuracy guarantee.',
    help: { effect: ['Absolute natural log hazard ratio', 'Enter |ln(HR)|. HR=0.7 gives approximately 0.356675. This is a two-sided comparison with null HR=1; reciprocal HR has identical planning power.'], hazardRatio: ['Anticipated hazard ratio', 'Specify a constant Group 1 / Group 2 hazard ratio. A hazard ratio is not a risk ratio or median-survival ratio. 0.1–10, excluding values whose absolute log is below 0.001.'], allocation: ['Randomization fraction', 'The proportion assigned to Group 1, not the proportion experiencing an event. The event-information approximation is Dq(1−q).'], verification: ['Event-model verification', 'Independent R normal-distribution reference values check event counts, achieved approximate power and the preceding count. This verifies implementation of the stated approximation, not its accuracy for a particular survival design.'] },
  });
  register({
    ...expansionBase, id: 'bonferroni', name: 'Bonferroni · pooled two-sample family planning', signed: true, effectSymbol: 'd',
    defaults: { ...tDefaults, comparisons: '5', mean1: '105', mean2: '100', sd: '10' },
    modes: [{ id: 'effect', label: 'Effect size d', fields: ['effect'] }, { id: 'means', label: 'Means + common SD', fields: ['mean1','mean2','sd'] }],
    designFields: ['comparisons'], fields: { ...tBase.fields, comparisons: numeric('Number of tests in the family', '1–100 prespecified comparisons, with equal Bonferroni alpha allocation.', { min: 1, max: 100, step: '1' }), mean1: numeric('Group 1 mean','Anticipated population mean.'), mean2: numeric('Group 2 mean','Same units as Group 1.'), sd: sdField('Common SD'), alpha: numeric('Familywise alpha · α', 'Family error budget; each comparison uses α / number of tests.', { min:.0001,max:.2,presets:['.01','.05','.1'] }), power: numeric('Marginal target power', 'Power for this specified comparison at α/m; not power to reject all or any tests.', { min:.5,max:.999,presets:['.8','.9','.95'] }) },
    design: raw => ({ comparisons: whole(raw,'comparisons','Family size',1,100) }),
    effectRange: { min:.001,max:5,label:'Absolute Cohen’s d' }, effectErrorField:'mean1', signConvention:'Group 1 mean minus Group 2 mean',
    effect: raw => raw.mode==='effect'?number(raw,'effect','Cohen’s d'):(number(raw,'mean1','Group 1 mean')-number(raw,'mean2','Group 2 mean'))/positive(raw,'sd','Common SD'),
    effectHint:'One planned comparison in a prespecified family. Equal independent groups.', formula:'(mean₁ − mean₂) / common SD',
    allocationRule:'Smallest balanced group size giving the specified comparison its marginal target power at family alpha/m. The two groups are shared across endpoints; the total is not multiplied by m.',
    powerLabel: 'MARGINAL ACHIEVED POWER', additionalReceipt: (raw,p,r) => [['Familywise alpha',p.alpha],['Bonferroni per-comparison alpha',r.comparisonAlpha],['Power objective','Marginal power for one specified comparison']],
    notice:'Marginal power at Bonferroni α/m. This does not calculate joint power, Holm power, or graphical testing procedures.',
    calculationNote:'Pooled noncentral t power, df=2n−2, noncentrality=|d|√(n/2), per-comparison alpha=family alpha/m. Results concern one specified comparison.',
    assumptions:'A prespecified family of m hypotheses sharing an overall familywise alpha budget, with equal Bonferroni thresholds. Each powered comparison is a pooled two-sample t-test with independent groups, normal outcomes, common population SD and equal group sizes. Bonferroni error control does not require independent tests; marginal power does not determine the chance of rejecting all or any members. For endpoints of different effects, plan each separately and choose a defensible recruitment design. This is not a p-value adjustment tool or a graphical procedure.',
    help:{ comparisons:['Prespecified family size','Count every hypothesis in the family, including unpowered or secondary members if included in this error budget. Each receives family α/m. Do not multiply the shared participant total by m.'], alpha:['Familywise alpha','Bonferroni gives each of m tests alpha/m. The smallest supported internal threshold is 0.000001. No assumption of independence among test statistics is needed for the union-bound family error control.'], power:['Marginal power','The target applies to one comparison at its Bonferroni threshold. It does not guarantee this power for every endpoint unless each endpoint has the specified effect, or guarantee a chance of rejecting all or any tests.'] },
  });
  const marginBase = {
    marginPlanning: true, signed: false, unit: 'participants', totalLabel: 'TOTAL PARTICIPANTS', effectSymbol: 'δ/σ',
    effectRange: { min: -1000, max: 1000, label: 'Standardized expected difference' }, effectErrorField: 'mean1',
    solve: (stats,p,id) => stats.marginSampleSize(id,p),
    allocations: r => [['Test group',r.n],['Reference group',r.n2]],
    allocationRule: 'Smallest equal integer size per parallel group meeting target power; at least 2 per group. Counts complete analyzable participants, with no dropout allowance.',
    receipt(raw,p,r) {
      return [['Input mode',this.modes.find(m=>m.id===raw.mode).label],
        ...[...this.designFields,...this.inputFields(raw)].map(id=>[this.fields[id].label,raw[id]]),
        ['Canonical expected difference / SD',p.effect],
        ...(p.margin !== undefined ? [['Allowed loss / SD',p.margin],['Benefit direction',p.direction===1?'Higher is better':'Lower is better'],['Null boundary / SD',-p.direction*p.margin]] : [['Lower bound / SD',p.lower],['Upper bound / SD',p.upper],['Confidence interval level',`${((1-2*p.alpha)*100).toFixed(2)}%`]]),
        ['Alpha per one-sided test',p.alpha],['Calculation model',this.calculationNote]];
    },
  };
  const differenceFields = {
    effect: numeric('Expected difference · δ / σ', 'Anticipated Test minus Reference mean in common-SD units. Zero is allowed.', { min:-1000,max:1000 }),
    mean1: numeric('Expected Test mean','Anticipated population mean in outcome units.'),
    mean2: numeric('Expected Reference mean','Use the same measurement units as Test.'),
    sd: sdField('Common population SD','Common between-participant SD on the analysis scale; not a standard error.'),
  };
  const marginAlpha = numeric('Alpha per one-sided test','TOST uses this alpha for each component; do not divide it by two.', { min:.0001,max:.2,presets:['.025','.05','.1'] });
  const stdDifference = raw => raw.mode==='effect'?number(raw,'effect','Expected standardized difference'):(number(raw,'mean1','Test mean')-number(raw,'mean2','Reference mean'))/positive(raw,'sd','Common population SD');
  const scaleFor = raw => raw.mode==='effect'?1:positive(raw,'sd','Common population SD');
  const effectFieldFor = raw => raw.mode==='effect'?'effect':'mean1';
  register({
    ...marginBase, id:'non-inferiority', name:'Non-inferiority · parallel pooled t-test',
    defaults:{mode:'effect',effect:'0',margin:'.5',marginRaw:'.5',mean1:'100',mean2:'100',sd:'1',benefit:'higher',alpha:'.025',power:'.8'},
    designFields:['benefit'], modes:[{id:'effect',label:'Difference + margin in SD units',fields:['effect','margin']},{id:'means',label:'Means + SD + raw margin',fields:['mean1','mean2','sd','marginRaw']}],
    fields:{...differenceFields,benefit:{label:'Beneficial outcome direction',hint:'Choose before observing data. Difference is always Test minus Reference.',options:[{value:'higher',label:'Higher is better'},{value:'lower',label:'Lower is better'}]},margin:numeric('Allowed loss · Δ / σ','Positive prespecified non-inferiority margin in common-SD units.',{min:0,max:1000}),marginRaw:numeric('Allowed loss · Δ','Positive prespecified margin, in the same original units as the means and SD.',{min:0}),alpha:numeric('One-sided alpha','0.025 is a common planning choice; use your prespecified Type I error level.',{min:.0001,max:.2,presets:['.01','.025','.05']})},
    design(raw){if(!['higher','lower'].includes(raw.benefit))fail('benefit','Choose whether higher or lower outcomes are beneficial.');const key=raw.mode==='effect'?'margin':'marginRaw';const margin=positive(raw,key,'Allowed loss')/scaleFor(raw);if(!Number.isFinite(margin)||margin>1000)fail(key,'The allowed loss divided by SD must be positive and at most 1000.');return {margin,direction:raw.benefit==='higher'?1:-1};},
    effect:stdDifference,
    validateParameters(p,raw){if(p.margin+p.direction*p.effect<.001)fail(effectFieldFor(raw),'Expected Test minus Reference difference must be on the non-inferior side of the boundary, at least 0.001 SD inside it.');},
    derive(raw){try{const p=this.normalize(raw),boundary=-p.direction*p.margin;return `H₀: δ/σ ${p.direction===1?'≤':'≥'} ${Number(boundary.toPrecision(7))} · Expected δ/σ = ${Number(p.effect.toPrecision(7))}`;}catch(e){return e.message;}},
    effectHint:'Plan one one-sided comparison to a prespecified non-inferiority boundary.',formula:'(Test mean − Reference mean) / common SD',
    notice:'A positive allowed-loss margin is prespecified. Higher-is-better tests δ > −Δ; lower-is-better tests δ < +Δ. This is not equivalence.',
    calculationNote:'Exact pooled normal-model noncentral-t power: df=2n−2, noncentrality=(Δ/σ + direction×δ/σ)√(n/2), one-sided alpha. Equal independent parallel groups.',
    assumptions:'Independent normal outcomes with one common population variance and equal parallel groups. δ=mean(Test)−mean(Reference). Specify a positive scientifically justified allowed loss Δ and the beneficial direction before data collection. Higher-is-better: H0 δ≤−Δ; lower-is-better: H0 δ≥+Δ. The expected difference must be on the non-inferior side. This plans power, not an analysis or a conclusion of non-inferiority, and does not cover binary/survival outcomes, unequal variances, crossover designs or assay-sensitivity/constancy justification.',
    help:{effect:['Expected difference, not distance from the margin','Enter anticipated (Test−Reference)/common SD. Zero is valid. The positive margin and beneficial direction determine the null boundary; do not add the margin yourself.'],benefit:['Choose the beneficial direction','Higher is better means a loss is a negative Test−Reference difference, with null boundary −Δ. Lower is better means a loss is positive, with boundary +Δ. This is a design choice, not a test selected after viewing data.'],margin:['Prespecified allowed loss','Δ is positive and supplied in SD units in this mode. Choose a scientifically justified margin in advance. It is not an effect-size convention or an estimated standard error.'],marginRaw:['Allowed loss in outcome units','Supply the prespecified positive Δ in the same measurement units as both means and the common SD. The app standardizes Δ internally.'],alpha:['One-sided non-inferiority alpha','The one-sided test uses the entered alpha once. No automatic halving is applied. The default is 0.025; choose the prespecified value for your design.']},
  });
  register({
    ...marginBase, id:'tost', name:'TOST equivalence · parallel pooled t-tests',
    defaults:{mode:'effect',effect:'0',lower:'-.5',upper:'.5',mean1:'100',mean2:'100',sd:'1',lowerRaw:'-.5',upperRaw:'.5',alpha:'.05',power:'.8'},
    modes:[{id:'effect',label:'Difference + bounds in SD units',fields:['effect','lower','upper']},{id:'means',label:'Means + SD + raw bounds',fields:['mean1','mean2','sd','lowerRaw','upperRaw']}],
    fields:{...differenceFields,lower:numeric('Lower equivalence bound · L / σ','Prespecified lower Test−Reference limit in common-SD units.',{min:-1000,max:1000}),upper:numeric('Upper equivalence bound · U / σ','Prespecified upper limit; asymmetric bounds are allowed.',{min:-1000,max:1000}),lowerRaw:numeric('Lower equivalence bound · L','Prespecified Test−Reference limit in original outcome units.'),upperRaw:numeric('Upper equivalence bound · U','Same original units as the means and common SD.'),alpha:marginAlpha},
    design(raw){const scale=scaleFor(raw),lo=raw.mode==='effect'?'lower':'lowerRaw',hi=raw.mode==='effect'?'upper':'upperRaw',lower=number(raw,lo,'Lower equivalence bound')/scale,upper=number(raw,hi,'Upper equivalence bound')/scale;if(!Number.isFinite(lower)||!Number.isFinite(upper)||lower< -1000||upper>1000||lower>=0||upper<=0||lower>=upper)fail(lo,'Bounds must straddle zero, be ordered, and have standardized values between −1000 and 1000.');return {lower,upper};},
    effect:stdDifference,
    validateParameters(p,raw){if(p.effect-p.lower<.001||p.upper-p.effect<.001)fail(effectFieldFor(raw),'Expected difference must be inside both equivalence bounds, at least 0.001 SD from each.');},
    derive(raw){try{const p=this.normalize(raw);return `EXPECTED δ/σ = ${Number(p.effect.toPrecision(7))} · BOUNDS (${Number(p.lower.toPrecision(7))}, ${Number(p.upper.toPrecision(7))}) · ${(100*(1-2*p.alpha)).toFixed(2)}% CI must fit inside both bounds`;}catch(e){return e.message;}},
    notice:'TOST requires both one-sided tests to pass. Alpha 0.05 per test corresponds to a 90% confidence interval wholly inside the equivalence bounds.',
    calculationNote:'Joint TOST power under the equal-variance normal model, computed by conditional-normal / chi-square integration with the shared pooled variance; df=2n−2. Not a sum or product of marginal test powers.',
    assumptions:'Two independent normal populations with a common unknown variance, equal parallel allocation, and prespecified lower and upper equivalence limits for mean(Test)−mean(Reference). Both one-sided tests use the entered alpha; the associated confidence level is 1−2alpha. Expected difference must lie inside the bounds for this sample-size search. Zero expected difference is valid. No Welch, paired, crossover, binary-outcome or multi-endpoint analysis is implied. This plans power for declaring equivalence, not proof that observed means are identical.',
    help:{effect:['Expected standardized difference','Anticipated (Test−Reference)/common population SD; zero and either sign are allowed inside the equivalence interval. This is not distance to the nearer margin.'],lower:['Lower equivalence bound','Prespecify the smallest scientifically acceptable Test−Reference difference, in SD units. Need L<expected difference<U; bounds may be asymmetric.'],upper:['Upper equivalence bound','Prespecify the largest acceptable Test−Reference difference in SD units. Both one-sided tests must pass, using the same estimated SD.'],lowerRaw:['Raw equivalence bounds','Specify lower and upper limits in the same original measurement units as Test mean, Reference mean and common SD. Each input mode retains its own bounds.'],upperRaw:['Upper raw equivalence limit','Use original outcome units. The confidence interval must lie wholly below this bound and above the lower bound.'],alpha:['TOST alpha and confidence interval','Each component uses alpha, not alpha/2. At alpha=0.05, TOST is equivalent to a 90% two-sided confidence interval contained entirely within (L,U). Joint power is the probability of satisfying both conditions.']},
  });
  register({
    ...marginBase, id:'tost-lognormal', name:'Log-normal TOST · parallel bioequivalence',effectSymbol:'ln(T/R)/σlog',effectErrorField:'gmr',
    defaults:{mode:'effect',gmr:'.95',cv:'.3',lowerRatio:'.8',upperRatio:'1.25',logDifference:String(Math.log(.95)),logSD:String(Math.sqrt(Math.log1p(.3**2))),alpha:'.05',power:'.8'},
    designFields:['lowerRatio','upperRatio'],modes:[{id:'effect',label:'Geometric mean ratio + total CV',fields:['gmr','cv']},{id:'log',label:'Log difference + log SD',fields:['logDifference','logSD']}],
    fields:{lowerRatio:numeric('Lower T/R equivalence ratio','Prespecified ratio bound. 0.80 is an editable conventional example.',{min:.01,max:100}),upperRatio:numeric('Upper T/R equivalence ratio','Prespecified ratio bound. 1.25 is an editable conventional example.',{min:.01,max:100}),gmr:numeric('Expected geometric mean ratio · T/R','Anticipated Test/Reference geometric-mean ratio, not arithmetic mean ratio.',{min:.01,max:100}),cv:numeric('Common total between-subject CV','Decimal: 0.30 means 30%. Parallel-group variability, not crossover within-subject CV.',{min:.01,max:2}),logDifference:numeric('Expected natural-log mean difference','mean[ln(Test)] − mean[ln(Reference)] = ln(geometric mean ratio).'),logSD:numeric('Common SD on natural-log scale','Between-subject population SD of log outcomes; not raw SD, log(CV), or standard error.',{min:Math.sqrt(Math.log1p(.01**2)),max:Math.sqrt(Math.log1p(2**2))}),alpha:marginAlpha},
    design(raw){const lowerRatio=number(raw,'lowerRatio','Lower T/R bound'),upperRatio=number(raw,'upperRatio','Upper T/R bound');if(lowerRatio<.01||upperRatio>100||lowerRatio>=1||upperRatio<=1||lowerRatio>=upperRatio)fail('lowerRatio','Ratio bounds must straddle 1, be ordered, and be within 0.01–100.');let sigma;if(raw.mode==='effect'){const cv=number(raw,'cv','Total between-subject CV');if(cv<.01||cv>2)fail('cv','Total CV must be 0.01–2 as a decimal (1%–200%).');sigma=Math.sqrt(Math.log1p(cv*cv));}else{sigma=positive(raw,'logSD','Log-scale SD');if(sigma<Math.sqrt(Math.log1p(.01**2))||sigma>Math.sqrt(Math.log1p(4)))fail('logSD','Log SD must correspond to a total CV between 0.01 and 2.');}return {lower:Math.log(lowerRatio)/sigma,upper:Math.log(upperRatio)/sigma,sigma};},
    effect(raw,{sigma}){let delta;if(raw.mode==='effect'){const gmr=number(raw,'gmr','Expected geometric mean ratio');if(gmr<.01||gmr>100)fail('gmr','Expected geometric mean ratio must be 0.01–100.');delta=Math.log(gmr);}else delta=number(raw,'logDifference','Expected log mean difference');return delta/sigma;},
    validateParameters(p,raw){if(p.effect-p.lower<.001||p.upper-p.effect<.001)fail(raw.mode==='effect'?'gmr':'logDifference','Expected geometric mean ratio must lie inside both ratio limits, with at least 0.001 log-SD clearance from each.');},
    derive(raw){try{const p=this.normalize(raw);return `ln(T/R) = ${Number((p.effect*p.sigma).toPrecision(7))} · σlog = ${Number(p.sigma.toPrecision(7))} · ${(100*(1-2*p.alpha)).toFixed(2)}% CI for T/R must fit inside (${raw.lowerRatio}, ${raw.upperRatio})`;}catch(e){return e.message;}},
    notice:'PARALLEL groups: use total between-subject CV. The default 0.80–1.25 ratio limits are editable planning examples. This is one endpoint’s average-bioequivalence power.',
    calculationNote:'Natural-log pooled TOST with joint conditional-normal / chi-square integration; σlog=√ln(1+CV²), δ=ln(GMR), L=ln(lower ratio), U=ln(upper ratio), df=2n−2. Equal independent parallel groups.',
    assumptions:'Positive log-normal outcomes, independent parallel Test and Reference groups of equal size, and a common total between-subject log-scale variance. CV is entered as a decimal and converted using sigmaLog=sqrt(ln(1+CV²)). T/R is a ratio of geometric means; exponentiating the 1−2alpha confidence interval for the log mean difference gives the ratio interval. Both one-sided tests must pass within prespecified limits. This plans average bioequivalence for one endpoint; it does not determine joint AUC/Cmax power or a regulatory conclusion. No crossover, replicate design, within-subject CV, reference scaling, unequal variances, interim analyses or dropout adjustment.',
    receipt(raw,p,r){return [...marginBase.receipt.call(this,raw,p,r),['Analysis design','Two independent parallel groups, equal allocation'],['Expected geometric mean ratio',Math.exp(p.effect*p.sigma)],['Common natural-log SD',p.sigma],['Equivalent total CV',Math.sqrt(Math.expm1(p.sigma*p.sigma))]];},
    help:{gmr:['Expected Test/Reference geometric mean ratio','Enter a ratio such as 0.95, not 95 or a 5% difference. It is exp(mean ln(Test)−mean ln(Reference)), not generally the ratio of arithmetic means. It must lie inside both prespecified limits.'],cv:['Total CV for a parallel trial','Enter a decimal: 0.30 means 30%. Use common total between-subject variability. Crossover within-subject CV is not interchangeable. Conversion: sigmaLog=sqrt(ln(1+CV²)). Supported total CV 0.01–2.'],lowerRatio:['Prespecified ratio limits','Limits apply to the geometric mean Test/Reference ratio. Default 0.80 and 1.25 illustrate conventional average-bioequivalence planning; they are editable and are not automatically suitable for every drug, endpoint or jurisdiction.'],upperRatio:['Upper Test/Reference ratio limit','Use a positive ratio above the lower limit and expected ratio. Natural logs are used internally. Bounds need not be reciprocal.'],logDifference:['Natural-log expected difference','Enter mean ln(Test)−mean ln(Reference), equal to ln(GMR). Do not use log10. The default ratio 0.95 gives about −0.0512933.'],logSD:['Natural-log population SD','Common between-subject SD of the log-transformed outcome. CV and log-SD modes have separate drafts. It is sqrt(ln(1+CV²)), not ln(CV).'],alpha:['TOST one-sided alpha','Both tests use alpha. At 0.05 the corresponding two-sided confidence interval is 90%, and it must be wholly within the ratio limits. No extra division by two is applied.']},
  });
  if (typeof module !== 'undefined') module.exports = methods;
  else globalThis.StatFighter.methods = methods;
}
