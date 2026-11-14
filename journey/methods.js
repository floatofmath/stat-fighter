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
          return `DERIVED ${this.effectSymbol} = ${Number(effect.toPrecision(7))} · ${this.formulaFor?.(raw) ?? this.formula}`;
        } catch (error) { return error.message; }
      },
      inputFields(raw) {
        const mode = this.modes.find(mode => mode.id === raw.mode);
        if (!mode) return [];
        if (!mode.repeat) return mode.fields;
        const { count, prefix, min, max } = mode.repeat, n = Number(raw[count]);
        return [...mode.fields, ...Array.from({ length: Number.isInteger(n) && n >= min && n <= max ? n : 0 }, (_, i) => `${prefix}${i + 1}`)];
      },
      // A method may relabel or hide a field depending on other inputs (fieldFor); the arena and
      // the receipt both read fields through fieldView, and hidden design fields are skipped.
      fieldView(id, raw) { return { ...this.fields[id], ...(this.fieldFor?.(id, raw) ?? {}) }; },
      shownDesignFields(raw) { return this.designFields.filter(id => !this.fieldView(id, raw).hidden); },
      receipt(raw, parameters, result) {
        const rows = [['Input mode', this.modes.find(mode => mode.id === raw.mode).label]];
        for (const id of [...this.shownDesignFields(raw), ...this.inputFields(raw)]) rows.push([this.fieldView(id, raw).label, raw[id]]);
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
    // Dropout allowance is an optional display-only line on the result; the verified number never changes.
    if (method.dropout !== false) method.defaults = { ...method.defaults, dropout: '0' };
    methods[method.id] = method;
  }
  const tDefaults = { mode: 'effect', effect: '0.5', alpha: '0.05', power: '0.8', alternative: 'two-sided' };
  const tBase = {
    signed: true, effectSymbol: 'd', design: () => ({}),
    fields: { effect: numeric('Effect size · d', 'Signed difference ÷ the appropriate population SD.', { min: -5, max: 5 }) },
    solve: (stats, parameters, id) => stats.sampleSize(id, parameters),
    powerAt(stats, parameters, n) { return stats.tPowerAt(this.id, { ...parameters, n, n2: 0 }); },
    allocationRule: 'Smallest whole sample size that reaches target power. Complete, analyzable data; no dropout allowance.',
  };
  const secondGroup = (n, ratio) => Math.max(2, Math.round(n * ratio));
  register({
    ...tBase, id: 'two-sample', name: 'Two-sample t-test · pooled or Welch', unit: 'participants', totalLabel: 'TOTAL PARTICIPANTS',
    defaults: { ...tDefaults, mean1: '105', mean2: '100', sd: '10', sd1: '10', sd2: '10', ratio: '1' },
    modes: [{ id: 'effect', label: 'Effect size d', fields: ['effect'] }, { id: 'means', label: 'Means + SD', fields: ['mean1', 'mean2', 'sd'] }, { id: 'welch', label: 'Means + two SDs · Welch', fields: ['mean1', 'mean2', 'sd1', 'sd2'] }],
    fields: { ...tBase.fields,
      mean1: numeric('Group 1 mean', 'Expected population mean.'), mean2: numeric('Group 2 mean', 'Use the same units as Group 1.'), sd: sdField('Common SD'),
      sd1: sdField('Group 1 SD', 'Population SD in Group 1.'), sd2: sdField('Group 2 SD', 'Population SD in Group 2; may differ from Group 1.'),
      ratio: numeric('Allocation · n₂ / n₁', 'Group 2 relative to Group 1.', { min: 0.1, max: 10, presets: ['0.5', '1', '2'] }),
    },
    tuningFields: ['alpha', 'power', 'ratio'], effectErrorField: 'mean1', signConvention: 'Group 1 minus Group 2',
    formula: '(mean₁ − mean₂) / SD', formulaFor: raw => raw.mode === 'welch' ? '(mean₁ − mean₂) / SD₁ · Welch–Satterthwaite df' : '(mean₁ − mean₂) / SD', effectHint: 'Two independent groups. One common SD, or two SDs in Welch mode.',
    design(raw) {
      if (raw.mode !== 'welch') return {};
      const sd1 = positive(raw, 'sd1', 'Group 1 SD'), sd2 = positive(raw, 'sd2', 'Group 2 SD'), sdRatio = sd2 / sd1;
      if (!Number.isFinite(sdRatio) || sdRatio < 0.01 || sdRatio > 100) fail('sd2', 'The two SDs may differ by at most a factor of 100.');
      return { welch: true, sdRatio };
    },
    effect: raw => raw.mode === 'effect' ? number(raw, 'effect', 'effect size') : (number(raw, 'mean1', 'Group 1 mean') - number(raw, 'mean2', 'Group 2 mean')) / positive(raw, raw.mode === 'welch' ? 'sd1' : 'sd', raw.mode === 'welch' ? 'Group 1 SD' : 'Common SD'),
    solve: (stats, p) => p.welch ? stats.welchSampleSize(p) : stats.sampleSize('two-sample', p),
    powerAt: (stats, p, n) => (p.welch ? stats.welchPowerAt : q => stats.tPowerAt('two-sample', q))({ ...p, n, n2: secondGroup(n, p.ratio) }),
    allocations: r => [['Group 1', r.n], ['Group 2', r.n2]],
    additionalReceipt: (raw, p, r) => p.welch ? [['Variance model', 'Welch–Satterthwaite, unequal SDs · approximate'], ['SD₂ / SD₁', p.sdRatio], ['Welch df at this size', r.df.toFixed(4)]] : [['Variance model', 'Pooled, common SD']],
    allocationRule: 'Smallest integer Group 1 size that reaches target power. Group 2 = max(2, round(Group 1 × ratio)), with half ties rounded up.',
    assumptions: 'Independent observations and groups and normally distributed outcomes within each group. Effect and means modes assume a common population SD and plan the pooled-variance Student t-test. Welch mode plans Welch’s unequal-variance test approximately: a noncentral t with Satterthwaite degrees of freedom computed from your planning SDs. Results count complete, analyzable participants; dropout is not included.',
    help: { sd1: ['Group SDs for Welch', 'Enter each group’s anticipated population SD in the outcome’s units. Welch mode standardizes by the Group 1 SD and uses Satterthwaite degrees of freedom; with equal SDs and equal groups it reproduces the pooled test.'], sd2: ['Group 2 SD', 'The anticipated population SD in Group 2, in the same units as Group 1. Unequal SDs combined with unequal allocation are exactly where Welch matters.'] },
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
    powerAt: (stats, parameters, n) => stats.anovaPowerAt({ ...parameters, n }),
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
    powerAt: (stats, parameters, n) => stats.correlationPowerAt({ ...parameters, n }),
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
    powerAt: (stats, parameters, n) => stats.regressionPowerAt({ ...parameters, n }),
    notice: 'Overall-model planning, not power for a particular coefficient, predictor block, or logistic regression.',
    calculationNote: 'Cohen fixed-model convention: numerator df = p, residual df = N − p − 1, noncentrality = N × f²; one fitted intercept.',
    allocationRule: 'Smallest whole N reaching target overall-model power. N must be at least p + 2 so residual df is positive.',
    assumptions: 'A correctly specified ordinary least-squares linear model with one intercept, independent normally distributed errors of common variance, and a full-rank predictor design. The overall F-test compares all p slopes with zero using the Cohen fixed-model N × f² convention. Count slope degrees of freedom, not merely named variables. This does not power an individual coefficient, an incremental predictor block, a binary outcome or a random-X design-specific analysis. Complete observations only; no dropout allowance.',
    help: {
      effect: ['Cohen’s f² for the whole model', 'For the overall test versus an intercept-only model, f² = R² / (1 − R²). This is not Cohen’s f and is not incremental ΔR². Supported f²: 0.001–5. Choose an anticipated effect supported by your study context.'],
    },
  });
  const engine = typeof module !== 'undefined' ? require('../stats.js') : globalThis.StatFighter.stats;
  const fmtCount = value => new Intl.NumberFormat('en-US').format(value);
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
    powerAt(stats, parameters, n) { return stats.expansionPowerAt(this.id, { ...parameters, n }); },
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
    defaults: { mode: 'effect', effect: String(Math.abs(Math.log(.7))), hazardRatio: '.7', allocation: '.5', alpha: '.05', power: '.8', controlMedian: '12', accrual: '12', followUp: '12', loss: '0.05' },
    // Events are the verified answer. Enrolment is an optional, separately labelled second step.
    dropout: false, extraTitle: 'ENROLMENT · OPTIONAL SECOND STEP', extraFields: ['controlMedian', 'accrual', 'followUp', 'loss'],
    resultTables(raw, p, r, stats) {
      const rows = [];
      try {
        const median = number(raw, 'controlMedian', 'Group 2 median time'), accrual = number(raw, 'accrual', 'Accrual period'), followUp = number(raw, 'followUp', 'Additional follow-up'), loss = number(raw, 'loss', 'Loss to follow-up');
        if (median <= 0) fail('controlMedian', 'Group 2 median time must be positive.');
        if (accrual < 0 || followUp < 0 || accrual + followUp <= 0) fail('accrual', 'Accrual and follow-up must be non-negative, with some follow-up time.');
        if (loss < 0 || loss >= 1) fail('loss', 'Loss to follow-up per time unit must be from 0 to below 1.');
        const hr = raw.mode === 'hazard-ratio' ? Number(raw.hazardRatio) : Math.exp(-p.effect), control = Math.LN2 / median, dropoutHazard = -Math.log1p(-loss);
        const p1 = stats.eventProbability({ hazard: hr * control, dropoutHazard, accrual, followUp }), p2 = stats.eventProbability({ hazard: control, dropoutHazard, accrual, followUp });
        const overall = p.allocation * p1 + (1 - p.allocation) * p2, total = Math.ceil(r.total / overall - 1e-9);
        rows.push(['Hazard ratio used · Group 1 / Group 2', Number(hr.toPrecision(6))], ['P(event observed) · Group 1', p1.toFixed(4)], ['P(event observed) · Group 2', p2.toFixed(4)], ['Weighted event probability', overall.toFixed(4)], ['Participants to enrol', fmtCount(total)], ['Group 1 / Group 2 (approx.)', `${fmtCount(Math.round(total * p.allocation))} / ${fmtCount(total - Math.round(total * p.allocation))}`]);
      } catch (error) { rows.push(['Enrolment not calculated', error.message]); }
      return [{ title: 'Enrolment from events', rows, note: 'Exponential event and loss times, uniform accrual, then additional follow-up for everyone. Effect-size mode assumes Group 1 has the lower hazard. A planning approximation; the event count above is unchanged.' }];
    },
    modes: [{ id: 'effect', label: 'Absolute log hazard ratio', fields: ['effect'] }, { id: 'hazard-ratio', label: 'Hazard ratio', fields: ['hazardRatio'] }],
    designFields: ['allocation'], fields: { effect: numeric('Absolute log hazard ratio', 'Magnitude of natural log(HR), not HR itself.', { min: .001, max: Math.log(10) }), hazardRatio: numeric('Hazard ratio · Group 1 / Group 2', 'Constant proportional-hazards ratio, 0.1–10 excluding 1.', { min: .1, max: 10 }), allocation: numeric('Group 1 allocation proportion', 'Fraction randomized to Group 1; 0.5 means equal allocation.', { min: .1, max: .9 }), controlMedian: numeric('Group 2 median time to event', 'In your chosen time unit, e.g. months.', { min: 0 }), accrual: numeric('Accrual period', 'Time to recruit everyone, same unit.', { min: 0 }), followUp: numeric('Additional follow-up', 'Time after the last enrolment, same unit.', { min: 0 }), loss: numeric('Loss to follow-up per time unit', 'Decimal: 0.05 means 5% lost per unit.', { min: 0, max: .99 }) },
    design(raw) { const allocation=number(raw,'allocation','Group 1 allocation proportion'); if(allocation<.1||allocation>.9)fail('allocation','Allocation proportion must be 0.1–0.9.');return { allocation }; },
    effectRange: { min: .001, max: Math.log(10), label: 'Absolute log hazard ratio' }, effectErrorField: 'hazardRatio',
    effect(raw) { if(raw.mode==='effect')return number(raw,'effect','Absolute log hazard ratio');const hr=positive(raw,'hazardRatio','Hazard ratio');if(hr<.1||hr>10)fail('hazardRatio','Hazard ratio must be 0.1–10.');return Math.abs(Math.log(hr)); },
    effectHint: 'Two-sided comparison against HR = 1. Output counts events, not participants.', formula: '|ln(HR)|',
    allocations: r => [['Observed events',r.n]], allocationRule: 'Smallest whole event count under the Schoenfeld normal approximation; minimum 10 events. This does not determine enrollment or follow-up.',
    notice: 'EVENTS, not participants. Two-sided Schoenfeld approximation; recruitment requires a separate accrual, censoring and follow-up model.',
    calculationNote: 'Normal log-rank shift = |ln(HR)|√[Dq(1−q)] for D events and allocation q. Both rejection tails count. No enrollment conversion is implied.',
    assumptions: 'Two independent randomized groups, proportional hazards, fixed allocation, independent non-informative censoring and a prespecified event. The Schoenfeld event approximation can be inaccurate far from HR=1 or with unequal allocation. It does not model accrual, event-time distribution, competing risks, crossing hazards, loss to follow-up, interim looks or covariates. Required observed events are not required participants; minimum 10 is a numerical policy, not an accuracy guarantee.',
    help: { controlMedian: ['Group 2 median time', 'The anticipated median time to the event in Group 2 (the comparator), in any time unit. Group 2 hazard = ln 2 / median, assumed constant. Use the same unit for accrual, follow-up and loss.'], accrual: ['Accrual period', 'How long recruitment takes, with participants arriving uniformly over that time. Zero means everyone starts together.'], followUp: ['Additional follow-up', 'Time from the last enrolment to the final analysis. Everyone is followed for at least this long.'], loss: ['Loss to follow-up', 'The proportion of participants lost per time unit, converted to a constant dropout hazard. 0.05 per month means about 5% lost each month. Lost participants contribute no observed event.'], effect: ['Absolute natural log hazard ratio', 'Enter |ln(HR)|. HR=0.7 gives approximately 0.356675. This is a two-sided comparison with null HR=1; reciprocal HR has identical planning power.'], hazardRatio: ['Anticipated hazard ratio', 'Specify a constant Group 1 / Group 2 hazard ratio. A hazard ratio is not a risk ratio or median-survival ratio. 0.1–10, excluding values whose absolute log is below 0.001.'], allocation: ['Randomization fraction', 'The proportion assigned to Group 1, not the proportion experiencing an event. The event-information approximation is Dq(1−q).'], verification: ['Event-model verification', 'Independent R normal-distribution reference values check event counts, achieved approximate power and the preceding count. This verifies implementation of the stated approximation, not its accuracy for a particular survival design.'] },
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
    powerAt(stats,p,n) { return stats.marginPowerAt(this.id,{...p,n}); },
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

  // ---- Arcade wave: Anchor, Switch, Parry ----

  register({
    ...tBase,
    id: 'ancova',
    name: 'ANCOVA · two groups with baseline covariates · approximate',
    unit: 'participants',
    totalLabel: 'TOTAL PARTICIPANTS',
    defaults: { ...tDefaults, mean1: '105', mean2: '100', sd: '10', covariates: '1', correlation: '.5', ratio: '1' },
    modes: [
      { id: 'effect', label: 'Effect size d', fields: ['effect'] },
      { id: 'means', label: 'Means + SD', fields: ['mean1', 'mean2', 'sd'] },
    ],
    designFields: ['covariates', 'correlation'],
    tuningFields: ['alpha', 'power', 'ratio'],
    fields: {
      ...tBase.fields,
      effect: numeric('Effect size · d', 'Adjusted mean difference ÷ the unadjusted outcome SD.', { min: -5, max: 5 }),
      mean1: numeric('Group 1 mean', 'Expected population mean.'),
      mean2: numeric('Group 2 mean', 'Use the same units as Group 1.'),
      sd: sdField('Outcome SD', 'Unadjusted within-group SD of the outcome.'),
      covariates: numeric('Number of covariates', '1–10 baseline covariates in the model; each costs one degree of freedom.', { min: 1, max: 10, step: '1' }),
      correlation: numeric('Covariate–outcome correlation · ρ', 'With one baseline, its correlation with the outcome; with several, the multiple correlation R.', { min: 0, max: .99, presets: ['.3', '.5', '.7'] }),
      ratio: numeric('Allocation · n₂ / n₁', 'Group 2 relative to Group 1.', { min: 0.1, max: 10, presets: ['0.5', '1', '2'] }),
    },
    design(raw) {
      const covariates = whole(raw, 'covariates', 'Number of covariates', 1, 10);
      const correlation = number(raw, 'correlation', 'Covariate–outcome correlation');
      if (correlation < 0 || correlation > .99) fail('correlation', 'Covariate–outcome correlation must be from 0 to 0.99.');
      return { covariates, rSquared: correlation * correlation };
    },
    effectErrorField: 'mean1',
    signConvention: 'Group 1 minus Group 2',
    formula: '(mean₁ − mean₂) / SD',
    effectHint: 'Two randomized groups. The baseline soaks up outcome variance; the effect is still in unadjusted SD units.',
    effect: raw => raw.mode === 'effect' ? number(raw, 'effect', 'effect size') : (number(raw, 'mean1', 'Group 1 mean') - number(raw, 'mean2', 'Group 2 mean')) / positive(raw, 'sd', 'Outcome SD'),
    solve: (stats, p) => stats.ancovaSampleSize(p),
    powerAt: (stats, p, n) => stats.ancovaPowerAt({ ...p, n, n2: secondGroup(n, p.ratio) }),
    allocations: r => [['Group 1', r.n], ['Group 2', r.n2]],
    notice: 'Approximate ANCOVA planning: the residual SD shrinks by √(1 − ρ²) and each covariate costs one degree of freedom. Slightly optimistic for small trials.',
    calculationNote: 'Noncentral t: df = N − 2 − q, noncentrality = |d| / √(1 − ρ²) / √(1/n₁ + 1/n₂). Ignores the extra variance from estimating the covariate slopes; R simulation puts the overstatement near half a percentage point of power at n ≈ 20–50 per group.',
    additionalReceipt: (raw, p) => [['Covariate R²', Number(p.rSquared.toPrecision(10))], ['Variance factor 1 − R²', Number((1 - p.rSquared).toPrecision(10))], ['Effective d after adjustment', Number((Math.abs(p.effect) / Math.sqrt(1 - p.rSquared)).toPrecision(10))]],
    allocationRule: 'Smallest integer Group 1 size that reaches the approximate target power. Group 2 = max(2, round(Group 1 × ratio)), half ties up; the model must leave at least one error degree of freedom.',
    assumptions: 'Two randomized independent groups, normally distributed outcomes, a linear relationship between the prespecified baseline covariates and the outcome that is the same in both groups (no treatment-by-covariate interaction), and a common residual SD. The correlation is a planning value from earlier data; covariates measured after randomization are not allowed. The power model is the usual approximation that reduces the variance by 1 − ρ² and the degrees of freedom by the number of covariates. Complete, analyzable participants; no dropout allowance.',
    advice: p => p.rSquared > .64 ? ['A correlation above 0.8 is rare outside lab measurements. If ρ is optimistic, the trial is too small.'] : [],
    help: {
      correlation: ['Covariate–outcome correlation', 'The correlation between the baseline measurement and the outcome within each group, from earlier studies. With several covariates use the multiple correlation R. It is squared internally: ρ = 0.5 removes a quarter of the outcome variance. Supported 0 to 0.99.'],
      covariates: ['Number of covariates', 'Count the baseline covariates in the analysis model, excluding the treatment indicator and intercept. A categorical covariate with L levels counts L − 1. Each one costs a degree of freedom.'],
      effect: ['Effect size for ANCOVA', 'The expected adjusted difference in means divided by the unadjusted outcome SD, the same d you would give Maverick. Anchor applies the covariate adjustment for you; do not divide by √(1 − ρ²) yourself.'],
    },
  });

  const crossoverLogSD = cv => Math.sqrt(Math.log1p(cv * cv));
  register({
    ...marginBase,
    id: 'tost-crossover',
    name: '2×2 crossover TOST · average bioequivalence',
    unit: 'subjects',
    totalLabel: 'TOTAL SUBJECTS',
    effectSymbol: 'ln(T/R)/σw',
    effectErrorField: 'gmr',
    defaults: { mode: 'effect', gmr: '.95', cv: '.3', lowerRatio: '.8', upperRatio: '1.25', logDifference: String(Math.log(.95)), logSD: String(crossoverLogSD(.3)), alpha: '.05', power: '.8' },
    designFields: ['lowerRatio', 'upperRatio'],
    modes: [
      { id: 'effect', label: 'Geometric mean ratio + within-subject CV', fields: ['gmr', 'cv'] },
      { id: 'log', label: 'Log difference + within log SD', fields: ['logDifference', 'logSD'] },
    ],
    fields: {
      lowerRatio: numeric('Lower T/R equivalence ratio', 'Prespecified ratio bound. 0.80 is an editable conventional example.', { min: .01, max: 100 }),
      upperRatio: numeric('Upper T/R equivalence ratio', 'Prespecified ratio bound. 1.25 is an editable conventional example.', { min: .01, max: 100 }),
      gmr: numeric('Expected geometric mean ratio · T/R', 'Anticipated Test/Reference geometric-mean ratio.', { min: .01, max: 100 }),
      cv: numeric('Within-subject CV', 'Decimal: 0.30 means 30%. Intra-subject variability from a crossover, not total CV.', { min: .01, max: 2 }),
      logDifference: numeric('Expected natural-log mean difference', 'ln(geometric mean ratio).'),
      logSD: numeric('Within-subject SD on natural-log scale', 'σw = √ln(1 + CVw²); the residual SD of the crossover model.', { min: crossoverLogSD(.01), max: crossoverLogSD(2) }),
      alpha: marginAlpha,
    },
    design(raw) {
      const lowerRatio = number(raw, 'lowerRatio', 'Lower T/R bound'), upperRatio = number(raw, 'upperRatio', 'Upper T/R bound');
      if (lowerRatio < .01 || upperRatio > 100 || lowerRatio >= 1 || upperRatio <= 1 || lowerRatio >= upperRatio) fail('lowerRatio', 'Ratio bounds must straddle 1, be ordered, and be within 0.01–100.');
      let sigma;
      if (raw.mode === 'effect') {
        const cv = number(raw, 'cv', 'Within-subject CV');
        if (cv < .01 || cv > 2) fail('cv', 'Within-subject CV must be 0.01–2 as a decimal (1%–200%).');
        sigma = crossoverLogSD(cv);
      } else {
        sigma = positive(raw, 'logSD', 'Within-subject log SD');
        if (sigma < crossoverLogSD(.01) || sigma > crossoverLogSD(2)) fail('logSD', 'Log SD must correspond to a within-subject CV between 0.01 and 2.');
      }
      return { lower: Math.log(lowerRatio) / sigma, upper: Math.log(upperRatio) / sigma, sigma };
    },
    effect(raw, { sigma }) {
      let delta;
      if (raw.mode === 'effect') {
        const gmr = number(raw, 'gmr', 'Expected geometric mean ratio');
        if (gmr < .01 || gmr > 100) fail('gmr', 'Expected geometric mean ratio must be 0.01–100.');
        delta = Math.log(gmr);
      } else delta = number(raw, 'logDifference', 'Expected log mean difference');
      return delta / sigma;
    },
    validateParameters(p, raw) {
      if (p.effect - p.lower < .001 || p.upper - p.effect < .001) fail(raw.mode === 'effect' ? 'gmr' : 'logDifference', 'Expected geometric mean ratio must lie inside both ratio limits, with at least 0.001 log-SD clearance from each.');
    },
    derive(raw) {
      try {
        const p = this.normalize(raw);
        return `ln(T/R) = ${Number((p.effect * p.sigma).toPrecision(7))} · σw = ${Number(p.sigma.toPrecision(7))} · ${(100 * (1 - 2 * p.alpha)).toFixed(2)}% CI for T/R must fit inside (${raw.lowerRatio}, ${raw.upperRatio})`;
      } catch (e) { return e.message; }
    },
    solve: (stats, p) => stats.crossoverSampleSize(p),
    powerAt: (stats, p, n) => stats.crossoverPowerAt({ ...p, n }),
    allocations: r => [['Sequence TR', r.n], ['Sequence RT', r.n2]],
    allocationRule: 'Smallest balanced design reaching target power: an equal whole number of subjects in each sequence (TR and RT), at least 2 each. Counts subjects completing both periods.',
    notice: 'CROSSOVER: use the within-subject CV from a previous crossover, not total CV. Each subject receives both Test and Reference.',
    calculationNote: 'Exact joint TOST power for the 2×2×2 crossover on the log scale (conditional-normal / chi-square integration, equivalent to Owen’s Q): se = σw√(2/N), df = N − 2, σw = √ln(1 + CVw²). Matches PowerTOST’s published 2×2 example (CV 0.30, GMR 0.95 → N 40).',
    assumptions: 'A balanced two-sequence, two-period crossover with log-normal pharmacokinetic outcomes, no carry-over and no sequence effect, a common within-subject log-scale variance for Test and Reference, and complete data for every subject. T/R is a ratio of geometric means; both one-sided tests use the entered alpha and the 1 − 2α confidence interval must lie inside the prespecified limits. This plans average bioequivalence for one endpoint; it is not a replicate design, reference-scaled limits, or joint AUC/Cmax power, and the default limits do not establish regulatory suitability.',
    receipt(raw, p, r) { return [...marginBase.receipt.call(this, raw, p, r), ['Analysis design', '2×2 crossover, balanced sequences'], ['Expected geometric mean ratio', Math.exp(p.effect * p.sigma)], ['Within-subject natural-log SD', p.sigma], ['Equivalent within-subject CV', Math.sqrt(Math.expm1(p.sigma * p.sigma))], ['Error df', r.df]]; },
    advice: p => Math.sqrt(Math.expm1(p.sigma * p.sigma)) > .5 ? ['Within-subject CV above 50% makes this a highly variable drug. Reference-scaled limits or a replicate design may be the honest route.'] : [],
    help: {
      gmr: ['Expected geometric mean ratio', 'Enter a ratio such as 0.95, not 95. It is exp(mean ln(Test) − mean ln(Reference)). It must lie inside both prespecified limits; a ratio exactly at 1 is optimistic.'],
      cv: ['Within-subject CV', 'Enter a decimal: 0.30 means 30%. Use the intra-subject CV from a previous crossover, usually derived from the residual mean square. Total (between-subject) CV is larger and belongs to Ratio, the parallel-group fighter. Conversion: σw = √ln(1 + CVw²).'],
      lowerRatio: ['Prespecified ratio limits', 'Limits apply to the geometric mean Test/Reference ratio. 0.80 and 1.25 are the conventional average-bioequivalence example; they are editable and not automatically suitable for every product or jurisdiction.'],
      upperRatio: ['Upper Test/Reference ratio limit', 'A positive ratio above the lower limit and the expected ratio. Natural logs are used internally.'],
      logDifference: ['Natural-log expected difference', 'mean ln(Test) − mean ln(Reference) = ln(GMR). The default ratio 0.95 gives about −0.0512933.'],
      logSD: ['Within-subject log SD', 'The residual SD of the crossover model on the natural-log scale, σw = √ln(1 + CVw²). Not ln(CV).'],
      alpha: ['TOST one-sided alpha', 'Both tests use alpha. At 0.05 the corresponding two-sided confidence interval is 90%, and it must lie wholly within the ratio limits.'],
    },
  });

  // Parry: risk difference p1 − p2 (Test minus Reference) against a prespecified null boundary.
  const parryProportions = raw => {
    if (raw.mode === 'proportions') return [probability(raw, 'p1', 'Test proportion'), probability(raw, 'p2', 'Reference proportion')];
    const reference = probability(raw, 'reference', 'Reference proportion'), test = reference + number(raw, 'difference', 'Expected difference');
    if (!(test > 0 && test < 1)) fail('difference', 'Reference proportion plus the expected difference must stay strictly between zero and one.');
    return [test, reference];
  };
  register({
    id: 'ni-proportions',
    name: 'Non-inferiority · two proportions · Farrington–Manning',
    marginPlanning: true,
    signed: false,
    unit: 'participants',
    totalLabel: 'TOTAL PARTICIPANTS',
    effectSymbol: 'p₁ − p₂',
    defaults: { mode: 'proportions', p1: '.8', p2: '.8', reference: '.8', difference: '0', hypothesis: 'non-inferiority', benefit: 'higher', margin: '.1', alpha: '.025', power: '.8', ratio: '1' },
    modes: [
      { id: 'proportions', label: 'Two proportions', fields: ['p1', 'p2'] },
      { id: 'difference', label: 'Reference + expected difference', fields: ['reference', 'difference'] },
    ],
    designFields: ['hypothesis', 'benefit', 'margin'],
    tuningFields: ['alpha', 'power', 'ratio'],
    fields: {
      hypothesis: { label: 'Hypothesis', hint: 'Non-inferiority defends a loss of at most Δ; superiority by a margin must win by more than Δ (Δ = 0 is plain superiority).', options: [{ value: 'non-inferiority', label: 'Non-inferiority' }, { value: 'superiority', label: 'Superiority by a margin' }] },
      benefit: { label: 'Beneficial direction', hint: 'Response rates: higher is better. Event or failure rates: lower is better.', options: [{ value: 'higher', label: 'Higher proportion is better' }, { value: 'lower', label: 'Lower proportion is better' }] },
      margin: numeric('Margin · Δ (risk difference)', 'Prespecified, in proportion units: 0.10 means 10 percentage points.', { min: 0, max: .5, presets: ['.05', '.1', '.15'] }),
      p1: numeric('Expected Test proportion · p₁', 'Strictly between 0 and 1.', { min: 0, max: 1 }),
      p2: numeric('Expected Reference proportion · p₂', 'Same event definition as Test.', { min: 0, max: 1 }),
      reference: numeric('Expected Reference proportion · p₂', 'Strictly between 0 and 1.', { min: 0, max: 1 }),
      difference: numeric('Expected difference · p₁ − p₂', 'Test minus Reference; zero is common for non-inferiority.', { min: -1, max: 1 }),
      alpha: numeric('One-sided alpha', '0.025 is the usual regulatory one-sided level.', { min: .0001, max: .2, presets: ['.01', '.025', '.05'] }),
      ratio: numeric('Allocation · n_R / n_T', 'Reference group size relative to Test.', { min: 0.1, max: 10, presets: ['0.5', '1', '2'] }),
    },
    design(raw) {
      if (!['non-inferiority', 'superiority'].includes(raw.hypothesis)) fail('hypothesis', 'Choose non-inferiority or superiority by a margin.');
      if (!['higher', 'lower'].includes(raw.benefit)) fail('benefit', 'Choose whether higher or lower proportions are better.');
      const margin = number(raw, 'margin', 'Margin');
      if (margin < 0 || margin > .5) fail('margin', 'Margin must be from 0 to 0.5 in proportion units.');
      if (raw.hypothesis === 'non-inferiority' && margin <= 0) fail('margin', 'A non-inferiority margin must be greater than zero.');
      const direction = raw.benefit === 'higher' ? 1 : -1;
      const [p1, p2] = parryProportions(raw);
      return { hypothesis: raw.hypothesis, margin, direction, delta0: (raw.hypothesis === 'non-inferiority' ? -1 : 1) * direction * margin, p1, p2 };
    },
    effect: (raw, design) => design.p1 - design.p2,
    effectRange: { min: -1, max: 1, label: 'Expected difference' },
    effectErrorField: 'p1',
    validateParameters(p, raw) {
      if (p.direction * (p.effect - p.delta0) < .001) fail(raw.mode === 'proportions' ? 'p1' : 'difference', `The expected difference must be on the winning side of the null boundary ${p.delta0 >= 0 ? '+' : ''}${Number(p.delta0.toPrecision(6))}, by at least 0.001.`);
    },
    derive(raw) {
      try {
        const p = this.normalize(raw);
        return `H₀: p₁ − p₂ ${p.direction === 1 ? '≤' : '≥'} ${Number(p.delta0.toPrecision(6))} · Expected p₁ − p₂ = ${Number(p.effect.toPrecision(6))} (p₁ ${Number(p.p1.toPrecision(6))}, p₂ ${Number(p.p2.toPrecision(6))})`;
      } catch (e) { return e.message; }
    },
    effectHint: 'One one-sided risk-difference comparison against a prespecified boundary.',
    formula: 'p₁ − p₂',
    solve: (stats, p) => stats.proportionsMarginSampleSize(p),
    powerAt: (stats, p, n) => stats.proportionsMarginPowerAt({ ...p, n, n2: secondGroup(n, p.ratio) }),
    allocations: r => [['Test group', r.n], ['Reference group', r.n2]],
    allocationRule: 'Smallest integer Test group size reaching the approximate target power. Reference = max(2, round(Test × ratio)), half ties up.',
    notice: 'Farrington–Manning score test with a normal approximation. Rates near 0 or 1, or small groups, need an exact check.',
    calculationNote: 'Power = Φ((s(p₁ − p₂ − δ₀) − z₁₋α√V₀) / √V₁), with V₀ from the restricted maximum-likelihood proportions under p₁ − p₂ = δ₀ and V₁ from the expected proportions; s = +1 when higher is better. The same approximation as gsDesign::nBinomial.',
    receipt(raw, p, r) {
      return [
        ['Input mode', this.modes.find(m => m.id === raw.mode).label],
        ...[...this.designFields, ...this.inputFields(raw)].map(id => [this.fields[id].label, raw[id]]),
        ['Expected p₁ / p₂', `${p.p1} / ${p.p2}`],
        ['Null boundary δ₀ for p₁ − p₂', p.delta0],
        ['Restricted MLE under H₀', r.restricted.map(v => v.toFixed(6)).join(' / ')],
        ['One-sided alpha', p.alpha],
        ['Requested n_R / n_T', p.ratio], ['Actual n_R / n_T', (r.n2 / r.n).toFixed(4)],
        ['Calculation model', this.calculationNote],
      ];
    },
    assumptions: 'Two independent groups with Bernoulli outcomes and the same event definition, a prespecified margin on the risk-difference scale, and a one-sided test at the entered alpha. The Farrington–Manning score test uses the restricted maximum-likelihood proportions under the null boundary; power is a large-sample normal approximation. Non-inferiority needs an assay-sensitivity and constancy argument that no calculator can supply. Rare events, rates close to 0 or 1, ratio or odds-ratio margins, clustering and pairing need another model. Complete, analyzable participants; no dropout allowance.',
    advice: p => [p.p1, p.p2].some(v => v < .05 || v > .95) ? ['A rate below 5% or above 95% strains the normal approximation. Check this design with exact or simulated power.'] : [],
    help: {
      hypothesis: ['Non-inferiority or superiority', 'Non-inferiority: H₀ says Test is worse than Reference by Δ or more. Superiority by a margin: H₀ says Test is not better by more than Δ; with Δ = 0 this is ordinary one-sided superiority, and with Δ > 0 it is “super-superiority”.'],
      benefit: ['Which way is better?', 'For cure or response rates higher is better, so a loss is a negative p₁ − p₂. For infection, failure or adverse-event rates lower is better and the boundary flips sign.'],
      margin: ['Risk-difference margin', 'Δ is in proportion units: 0.10 means ten percentage points. Choose it before the trial from clinical judgement and the historical effect of the Reference.'],
      p1: ['Expected proportions', 'Anticipated population proportions, as decimals. Non-inferiority trials often assume p₁ = p₂.'],
      p2: ['Reference proportion', 'The anticipated proportion with the Reference treatment, using the same event definition as Test.'],
      reference: ['Reference proportion', 'The anticipated proportion with the Reference treatment. The Test proportion is this plus the expected difference.'],
      difference: ['Expected difference', 'Test minus Reference, in proportion units. Zero means you expect the treatments to be equally good.'],
      ratio: ['Allocation ratio', 'Reference group size divided by Test group size. Reference = max(2, round(Test × ratio)).'],
    },
  });

  // ---- Last wave: Jab, Scatter, Bell, Towel ----

  register({
    id: 'vaccine-efficacy',
    name: 'Vaccine efficacy · exact conditional test on cases',
    marginPlanning: true,
    signed: false,
    unit: 'cases',
    totalLabel: 'TOTAL CASES',
    scoreLabel: 'REQUIRED CASES',
    missionLabel: 'CASE-DRIVEN MISSION',
    waitingAction: 'Find the case target.',
    effectSymbol: 'VE',
    defaults: { mode: 'efficacy', ve: '.6', ve0: '.3', rr: '.4', rr0: '.7', alpha: '.025', power: '.9', ratio: '1', attackRate: '.02', nonEvaluable: '.1' },
    modes: [
      { id: 'efficacy', label: 'Vaccine efficacy', fields: ['ve', 've0'] },
      { id: 'risk', label: 'Relative risk (1 − VE)', fields: ['rr', 'rr0'] },
    ],
    tuningFields: ['alpha', 'power', 'ratio'],
    fields: {
      ve: numeric('Expected vaccine efficacy · VE', 'True efficacy you plan for: 0.60 means 60% fewer cases.', { min: 0, max: 1, presets: ['.5', '.6', '.8'] }),
      ve0: numeric('Null efficacy · VE₀', '0 for plain superiority; 0.30 is the usual regulatory lower bound.', { min: -1, max: 1, presets: ['0', '.3'] }),
      rr: numeric('Expected relative risk · vaccine / placebo', 'Attack-rate ratio, 1 − VE.', { min: 0, max: 1 }),
      rr0: numeric('Null relative risk', '1 − VE₀; 0.70 for a 30% efficacy bound.', { min: 0, max: 2 }),
      alpha: numeric('One-sided alpha', '0.025 one-sided is the usual regulatory level.', { min: .0001, max: .2, presets: ['.01', '.025', '.05'] }),
      ratio: numeric('Allocation · vaccine : placebo', '1 means 1:1; 2 means twice as many vaccinated.', { min: .1, max: 10, presets: ['1', '2', '3'] }),
      attackRate: numeric('Placebo attack rate over follow-up', 'Proportion of placebo participants expected to become cases.', { min: 0, max: 1 }),
      nonEvaluable: numeric('Non-evaluable fraction', 'Proportion of enrolled not in the efficacy analysis.', { min: 0, max: .9 }),
    },
    design(raw) {
      let ve, ve0;
      if (raw.mode === 'efficacy') { ve = number(raw, 've', 'Expected efficacy'); ve0 = number(raw, 've0', 'Null efficacy'); }
      else { ve = 1 - number(raw, 'rr', 'Expected relative risk'); ve0 = 1 - number(raw, 'rr0', 'Null relative risk'); }
      const field = raw.mode === 'efficacy' ? ['ve', 've0'] : ['rr', 'rr0'];
      if (!(ve > 0 && ve < 1)) fail(field[0], raw.mode === 'efficacy' ? 'Expected efficacy must be strictly between 0 and 1.' : 'Expected relative risk must be strictly between 0 and 1.');
      if (!(ve0 >= -1) || ve - ve0 < .001) fail(field[1], 'The null bound must be below the expected efficacy (above the expected relative risk) and at least −1 in efficacy terms.');
      return { ve, ve0 };
    },
    effect: (raw, design) => design.ve,
    effectRange: { min: -1, max: 1, label: 'Vaccine efficacy' },
    effectErrorField: 've',
    derive(raw) {
      try {
        const p = this.normalize(raw), share = v => p.ratio * (1 - v) / (p.ratio * (1 - v) + 1);
        return `H₀: VE ≤ ${Number(p.ve0.toPrecision(6))} · vaccine share of cases π = ${share(p.ve).toFixed(4)} expected, ${share(p.ve0).toFixed(4)} under H₀`;
      } catch (e) { return e.message; }
    },
    effectHint: 'Count cases, not people: the trial stops when enough cases have accrued.',
    formula: 'VE = 1 − attack rate ratio',
    solve: (stats, p) => stats.vaccineSampleSize(p),
    powerAt: (stats, p, n) => stats.vaccinePowerAt({ ...p, n }),
    allocations: r => [['Win if vaccine cases ≤', r.critical], ['Placebo cases at least', r.total - r.critical]],
    dropout: false,
    extraTitle: 'FROM CASES TO PARTICIPANTS',
    extraFields: ['attackRate', 'nonEvaluable'],
    resultTables(raw, p, r) {
      const rows = [
        ['Success boundary', `≤ ${r.critical} of ${r.total} cases in the vaccine arm`],
        ['Observed VE at the boundary', `${(r.boundaryVE * 100).toFixed(1)}%`],
        ['Type I error at this size', r.size.toFixed(5)],
        ['Smallest total reaching the target', r.first === r.total ? `${r.first} (power stays above target)` : `${r.first} (${(r.firstPower * 100).toFixed(2)}%), but power dips below target again before ${r.total}`],
      ];
      const conversion = [];
      try {
        const attack = number(raw, 'attackRate', 'Placebo attack rate'), lost = number(raw, 'nonEvaluable', 'Non-evaluable fraction');
        if (!(attack > 0 && attack < 1)) fail('attackRate', 'Placebo attack rate must be strictly between 0 and 1.');
        if (lost < 0 || lost >= .9) fail('nonEvaluable', 'Non-evaluable fraction must be from 0 to below 0.9.');
        const perPerson = (p.ratio * attack * (1 - p.ve) + attack) / (1 + p.ratio), evaluable = Math.ceil(r.total / perPerson - 1e-9), enrolled = Math.ceil(evaluable / (1 - lost) - 1e-9);
        const vaccinated = Math.round(enrolled * p.ratio / (1 + p.ratio));
        conversion.push(['Expected cases per evaluable participant', perPerson.toFixed(5)], ['Evaluable participants', fmtCount(evaluable)], ['Participants to enrol', fmtCount(enrolled)], ['Vaccine / placebo (approx.)', `${fmtCount(vaccinated)} / ${fmtCount(enrolled - vaccinated)}`]);
      } catch (error) { conversion.push(['Participants not calculated', error.message]); }
      return [{ title: 'Case boundary', rows }, { title: 'Participants for the case target', rows: conversion, note: 'Assumes the planned attack rate over the whole follow-up and the planned efficacy. The case total above is the verified number.' }];
    },
    calculationNote: `Exact binomial: given T cases the vaccine-arm count is Bin(T, π), π = r(1 − VE)/(r(1 − VE) + 1). Reject H₀: VE ≤ VE₀ when vaccine cases ≤ c, c the largest count with P(X ≤ c | VE₀) ≤ α. Power is saw-toothed in T; the answer is the smallest T after which power stays at or above target for the next 100 totals.`,
    allocationRule: 'Smallest total case count after which exact power stays at or above the target for the next 100 case totals. The plain first crossing is shown separately because exact power can dip again.',
    notice: 'CASE-DRIVEN: the answer is a number of cases. Convert to participants in the second step below the result.',
    assumptions: 'Randomized vaccine and placebo arms with a fixed allocation, a common case definition, and cases arising independently, so that conditional on the total number of cases the vaccine-arm count is binomial (Chan and Bohidar 1998). The test is exact for that conditional model. VE₀ = 0.3 gives the usual super-superiority design for regulatory vaccine trials; VE₀ = 0 is plain superiority. Converting cases to participants needs a planned attack rate and follow-up, which carry their own uncertainty. No interim analyses or stratification.',
    help: {
      ve: ['Expected vaccine efficacy', 'The efficacy you plan for: 1 − (attack rate vaccinated ÷ attack rate placebo). 0.6 means 60% fewer cases. Planning with an optimistic VE makes the trial too small.'],
      ve0: ['Null efficacy bound', 'H₀ says VE ≤ VE₀. 0 is ordinary superiority; regulators often require the lower confidence bound of VE to exceed 0.3, which corresponds to VE₀ = 0.3.'],
      rr: ['Relative risk', 'Attack rate in the vaccine arm divided by placebo, equal to 1 − VE.'],
      rr0: ['Null relative risk', 'The relative risk under H₀, 1 − VE₀.'],
      ratio: ['Allocation', 'Vaccinated participants per placebo participant. More vaccinated participants means more of the cases come from placebo, which costs cases.'],
      attackRate: ['Placebo attack rate', 'Proportion of placebo participants who become cases during follow-up. Lower attack rates need many more participants for the same case count.'],
      nonEvaluable: ['Non-evaluable fraction', 'Participants enrolled but excluded from the efficacy population (protocol deviations, early infection). The enrolment line divides by 1 minus this fraction.'],
    },
  });

  register({
    id: 'negative-binomial',
    name: 'Negative binomial rate ratio · approximate',
    marginPlanning: true,
    signed: false,
    unit: 'participants',
    totalLabel: 'TOTAL PARTICIPANTS',
    effectSymbol: 'RR',
    defaults: { mode: 'ratio', rate0: '.8', rateRatio: '.75', rate0b: '.8', rate1: '.6', dispersion: '.5', followUp: '1', nullRatio: '1', alpha: '.025', power: '.9', ratio: '1' },
    modes: [
      { id: 'ratio', label: 'Control rate + rate ratio', fields: ['rate0', 'rateRatio'] },
      { id: 'rates', label: 'Two event rates', fields: ['rate0b', 'rate1'] },
    ],
    designFields: ['dispersion', 'followUp', 'nullRatio'],
    tuningFields: ['alpha', 'power', 'ratio'],
    fields: {
      rate0: numeric('Control event rate', 'Events per participant per time unit, e.g. 0.8 exacerbations per year.', { min: 0 }),
      rateRatio: numeric('Expected rate ratio · treatment / control', 'Below 1 means fewer events on treatment.', { min: .01, max: 100, presets: ['.6', '.75', '.85'] }),
      rate0b: numeric('Control event rate', 'Events per participant per time unit.', { min: 0 }),
      rate1: numeric('Treatment event rate', 'Same time unit as control.', { min: 0 }),
      dispersion: numeric('Dispersion · k', 'Variance = μ + kμ². 0 is Poisson; 0.3–1 is common for exacerbations.', { min: 0, max: 20, presets: ['0', '.5', '1'] }),
      followUp: numeric('Follow-up per participant', 'Common exposure time, in the rate’s time unit.', { min: 0 }),
      nullRatio: numeric('Null rate ratio · RR₀', '1 for superiority; above 1 (e.g. 1.15) for non-inferiority.', { min: .01, max: 100, presets: ['1', '1.15', '1.25'] }),
      alpha: numeric('One-sided alpha', '0.025 one-sided matches a two-sided 0.05 superiority test.', { min: .0001, max: .2, presets: ['.01', '.025', '.05'] }),
      ratio: numeric('Allocation · n_treatment / n_control', 'Treatment group size relative to control.', { min: .1, max: 10, presets: ['0.5', '1', '2'] }),
    },
    design(raw) {
      const dispersion = number(raw, 'dispersion', 'Dispersion'), followUp = number(raw, 'followUp', 'Follow-up'), nullRatio = number(raw, 'nullRatio', 'Null rate ratio');
      if (dispersion < 0 || dispersion > 20) fail('dispersion', 'Dispersion must be from 0 to 20.');
      if (!(followUp > 0) || followUp > 1000) fail('followUp', 'Follow-up must be positive.');
      if (nullRatio < .01 || nullRatio > 100) fail('nullRatio', 'Null rate ratio must be between 0.01 and 100.');
      let rate0, rateRatio;
      if (raw.mode === 'ratio') { rate0 = positive(raw, 'rate0', 'Control event rate'); rateRatio = positive(raw, 'rateRatio', 'Rate ratio'); }
      else { rate0 = positive(raw, 'rate0b', 'Control event rate'); rateRatio = positive(raw, 'rate1', 'Treatment event rate') / rate0; }
      if (rate0 > 1000) fail(raw.mode === 'ratio' ? 'rate0' : 'rate0b', 'Control event rate must be at most 1000 per time unit.');
      if (rateRatio < .01 || rateRatio > 100) fail(raw.mode === 'ratio' ? 'rateRatio' : 'rate1', 'The rate ratio must be between 0.01 and 100.');
      return { rate0, rateRatio, dispersion, followUp, nullRatio };
    },
    effect: (raw, design) => design.rateRatio,
    effectRange: { min: .01, max: 100, label: 'Rate ratio' },
    effectErrorField: 'rateRatio',
    validateParameters(p, raw) {
      if (Math.log(p.nullRatio) - Math.log(p.rateRatio) < .001) fail(raw.mode === 'ratio' ? 'rateRatio' : 'rate1', 'The expected rate ratio must be below the null rate ratio: Scatter plans for fewer events on treatment.');
    },
    derive(raw) {
      try { const p = this.normalize(raw); return `H₀: RR ≥ ${p.nullRatio} · expected RR = ${Number(p.rateRatio.toPrecision(6))} · ${Number((p.rate0 * p.followUp).toPrecision(6))} vs ${Number((p.rate0 * p.rateRatio * p.followUp).toPrecision(6))} events per participant`; }
      catch (e) { return e.message; }
    },
    effectHint: 'Recurrent events per participant: exacerbations, relapses, infections.',
    formula: 'treatment rate / control rate',
    solve: (stats, p) => stats.rateRatioSampleSize(p),
    powerAt: (stats, p, n) => stats.rateRatioPowerAt({ ...p, n, n2: secondGroup(n, p.ratio) }),
    allocations: r => [['Control', r.n], ['Treatment', r.n2]],
    notice: 'Over-dispersed counts: the dispersion k matters as much as the rate ratio. Approximate planning on the log rate ratio.',
    calculationNote: 'Wald test on log RR with the variance at the planned rates: Var = (1/(μ₀t) + k)/n₀ + (1/(μ₁t) + k)/n₁ (Zhu and Lakatos 2014, method 1; Keene et al. 2007). One-sided H₀: RR ≥ RR₀. R glm.nb simulations agree to within about one percentage point of power.',
    allocationRule: 'Smallest integer control group size reaching the approximate target power. Treatment = max(2, round(control × ratio)), half ties up.',
    assumptions: 'Independent participants, event counts following a negative binomial distribution with a common dispersion k in both groups, and the same follow-up time for everyone. The rate ratio compares mean event rates. The answer comes from a normal approximation for the log rate ratio with the variance evaluated at the planned rates; it is less reliable with very few events. Variable follow-up, dropout and covariate adjustment need a more detailed model.',
    advice: p => p.rate0 * p.followUp < .3 ? ['Fewer than 0.3 expected control events per participant: the normal approximation gets shaky. Consider longer follow-up.'] : [],
    help: {
      dispersion: ['Dispersion k', 'Over-dispersion: the variance of a participant’s count is μ + kμ². k = 0 is Poisson. Estimate it from a previous trial with the same endpoint and follow-up; values between 0.3 and 1 are common for COPD and asthma exacerbations.'],
      nullRatio: ['Null rate ratio', 'H₀ says RR ≥ RR₀. 1 is ordinary superiority. A value above 1, such as 1.15, plans a non-inferiority trial; a value below 1 asks for a win by a margin.'],
      rateRatio: ['Rate ratio', 'Treatment event rate divided by control. 0.75 means 25% fewer events.'],
      rate0: ['Control event rate', 'Mean events per participant per time unit in the control group, from earlier data.'],
      followUp: ['Follow-up', 'How long each participant is observed, in the same time unit as the rate. Longer follow-up gives more events per participant.'],
      rate0b: ['Control event rate', 'Mean events per participant per time unit in the control group. This mode has its own draft, separate from the rate-ratio mode.'],
      rate1: ['Treatment event rate', 'Mean events per participant per time unit on treatment, in the same unit as control. The rate ratio is treatment ÷ control.'],
    },
  });

  // Bell and Towel share the design fields; Towel adds non-binding futility.
  const spendingOptions = [{ value: 'obf', label: 'Lan–DeMets O’Brien–Fleming type' }, { value: 'pocock', label: 'Lan–DeMets Pocock type' }, { value: 'power', label: 'Kim–DeMets power family (ρ)' }, { value: 'hsd', label: 'Hwang–Shih–DeCani (γ)' }];
  const spendingNames = Object.fromEntries(spendingOptions.map(o => [o.value, o.label]));
  const sequentialFields = {
    looks: { label: 'Number of looks', hint: 'Interim analyses plus the final one.', options: [{ value: '2', label: '2 looks · one interim' }, { value: '3', label: '3 looks · two interims' }] },
    t1: numeric('First interim · information fraction', 'Share of the final information at the first look, e.g. 0.5.', { min: .05, max: .95, presets: ['.33', '.5', '.67'] }),
    t2: numeric('Second interim · information fraction', 'Used only with three looks. Must lie after the first.', { min: .1, max: .95, presets: ['.67', '.75'] }),
    spending: { label: 'Efficacy spending function', hint: 'How the one-sided alpha is spent across looks.', options: spendingOptions },
    spendingParameter: numeric('Efficacy spending parameter', 'Shown only for the power family (ρ) and Hwang–Shih–DeCani (γ).', { min: -40, max: 40 }),
    futilitySpending: { label: 'Futility (beta) spending function', hint: 'How the type II error is spent on futility stops.', options: spendingOptions },
    futilityParameter: numeric('Futility spending parameter', 'Shown only for the power family (ρ) and Hwang–Shih–DeCani (γ).', { min: -40, max: 40 }),
    effect: numeric('Standardized effect · d', 'Two equal groups, normal outcome: mean difference ÷ SD.', { min: -5, max: 5 }),
    hazardRatio: numeric('Hazard ratio', 'Event-driven design with equal allocation; the size is a number of events.', { min: .1, max: 10 }),
    fixedSize: numeric('Fixed-design sample size', 'From any fighter: the size that gives your target power without interim looks.', { min: 1 }),
    alpha: numeric('One-sided alpha', '0.025 one-sided is the regulatory default.', { min: .0001, max: .2, presets: ['.01', '.025', '.05'] }),
  };
  const sequentialBase = {
    marginPlanning: true,
    signed: false,
    distinctModes: true,
    unit: 'participants or events',
    totalLabel: 'MAXIMUM SIZE AT THE FINAL LOOK',
    scoreLabel: 'MAXIMUM SAMPLE SIZE',
    missionLabel: 'INTERIM LOOK MISSION',
    effectSymbol: 'θ',
    modes: [
      { id: 'effect', label: 'Effect size d · two groups', fields: ['effect'] },
      { id: 'hazard', label: 'Hazard ratio · events', fields: ['hazardRatio'] },
      { id: 'fixed', label: 'Fixed-design size from another fighter', fields: ['fixedSize'] },
    ],
    tuningFields: ['alpha', 'power'],
    fields: sequentialFields,
    effectRange: { min: -1e7, max: 1e7, label: 'Fixed-design size' },
    effectErrorField: 'effect',
    design(raw, futility) {
      if (!['2', '3'].includes(raw.looks)) fail('looks', 'Choose two or three looks.');
      const t1 = number(raw, 't1', 'First interim fraction'), t2 = raw.looks === '3' ? number(raw, 't2', 'Second interim fraction') : NaN;
      if (t1 < .05 || t1 > .95) fail('t1', 'The first interim must be between 5% and 95% of the information.');
      if (raw.looks === '3' && (t2 < .1 || t2 > .95 || t2 - t1 < .05)) fail('t2', 'The second interim must come at least 5% of the information after the first, and before 95%.');
      // The Lan–DeMets families take no parameter; their (hidden) parameter field is not validated.
      const parameter = (family, key) => { if (!['power', 'hsd'].includes(family)) return 0; const value = number(raw, key, family === 'power' ? 'ρ' : 'γ'); if (family === 'power' && (value < .1 || value > 10)) fail(key, 'The power-family ρ must be from 0.1 to 10.'); if (family === 'hsd' && (value < -40 || value > 40)) fail(key, 'γ must be from −40 to 40.'); return value; };
      if (!spendingNames[raw.spending]) fail('spending', 'Choose an efficacy spending function.');
      const out = { fractions: raw.looks === '2' ? [t1, 1] : [t1, t2, 1], spending: raw.spending, spendingParameter: parameter(raw.spending, 'spendingParameter'), futility: Boolean(futility) };
      if (futility) {
        if (!spendingNames[raw.futilitySpending]) fail('futilitySpending', 'Choose a futility spending function.');
        Object.assign(out, { futilitySpending: raw.futilitySpending, futilityParameter: parameter(raw.futilitySpending, 'futilityParameter') });
      }
      return out;
    },
    // The "effect" here is the fixed-design size each mode implies; normalize adds alpha and power.
    effect(raw) {
      if (raw.mode === 'fixed') { const n = positive(raw, 'fixedSize', 'Fixed-design size'); if (n > 1e6) fail('fixedSize', 'Fixed-design size must be at most 1,000,000.'); return n; }
      if (raw.mode === 'effect') { const d = number(raw, 'effect', 'Effect size'); if (Math.abs(d) < .001 || Math.abs(d) > 5) fail('effect', 'The absolute effect size must be from 0.001 to 5.'); return d; }
      const hr = positive(raw, 'hazardRatio', 'Hazard ratio'); if (hr < .1 || hr > 10 || Math.abs(Math.log(hr)) < .001) fail('hazardRatio', 'Hazard ratio must be 0.1–10 and not 1.'); return hr;
    },
    validateParameters(p, raw) {
      const z = engine.normalCritical(p.alpha) + engine.normalCritical(1 - p.power);
      p.input = p.effect; p.mode = raw.mode;
      p.fixedSize = raw.mode === 'fixed' ? p.effect : raw.mode === 'effect' ? 4 * z * z / (p.effect * p.effect) : 4 * z * z / Math.log(p.effect) ** 2;
      p.evenTotal = raw.mode === 'effect';
      if (p.fixedSize > 1e6) fail(raw.mode === 'fixed' ? 'fixedSize' : raw.mode === 'effect' ? 'effect' : 'hazardRatio', 'The design would exceed the 1,000,000-unit limit.');
    },
    derive(raw) {
      try { const p = this.normalize(raw); return `FIXED-DESIGN SIZE ${Number(p.fixedSize.toPrecision(7))} · LOOKS AT ${p.fractions.map(x => `${Math.round(x * 100)}%`).join(' / ')} · ${spendingNames[p.spending]}`; }
      catch (e) { return e.message; }
    },
    // ρ or γ appears only for the family that uses it, labelled for that family; the second
    // interim appears only with three looks.
    fieldFor(id, raw) {
      if (id === 't2' && raw.looks !== '3') return { hidden: true };
      const family = { spendingParameter: raw.spending, futilityParameter: raw.futilitySpending }[id];
      if (!family) return null;
      const side = id === 'spendingParameter' ? 'Efficacy' : 'Futility';
      if (family === 'power') return { label: `${side} spending · ρ`, hint: side === 'Efficacy' ? '0.1 to 10. ρ = 3 behaves like O’Brien–Fleming, ρ = 1 like Pocock.' : '0.1 to 10. Larger ρ makes early futility stops rarer.', min: .1, max: 10 };
      if (family === 'hsd') return { label: `${side} spending · γ`, hint: side === 'Efficacy' ? '−40 to 40. γ = −4 behaves like O’Brien–Fleming, γ = 1 like Pocock.' : '−40 to 40. γ = −2 is a common, moderately aggressive choice.', min: -40, max: 40 };
      return { hidden: true };
    },
    // Switching family loads that family's usual parameter, so a γ never lands in a ρ field.
    refreshOn: ['looks', 'spending', 'futilitySpending'],
    fieldChanged(id, draft) {
      const key = { spending: 'spendingParameter', futilitySpending: 'futilityParameter' }[id];
      const usual = { power: { spendingParameter: '3', futilityParameter: '2' }, hsd: { spendingParameter: '-4', futilityParameter: '-2' } }[draft[id]];
      if (key && usual) draft[key] = usual[key];
    },
    effectHint: 'The size without interim looks; interim looks inflate it slightly.',
    formula: '',
    solve: (stats, p) => stats.sequentialSampleSize(p),
    powerAt: (stats, p, n) => stats.sequentialPowerAt({ ...p, n }),
    allocations: r => r.looks.map((n, k) => [k === r.looks.length - 1 ? 'Final look' : `Look ${k + 1}`, n]),
    rounds: r => r.looks.map((n, k) => `${k === r.looks.length - 1 ? 'FINAL' : `ROUND ${k + 1}`}<b>Z ≥ ${r.design.efficacy[k].toFixed(2)}</b>`),
    resultTables(raw, p, r) {
      const d = r.design, K = d.fractions.length, futility = Boolean(d.futility);
      const rows = d.fractions.map((t, k) => [k === K - 1 ? 'Final' : `${k + 1}`, `${(t * 100).toFixed(1)}%`, fmtCount(r.looks[k]), d.efficacy[k].toFixed(4), engine.normalCdf(-d.efficacy[k]).toFixed(5), d.alphaSpent[k].toFixed(5), ...(futility ? [d.futility[k].toFixed(4), d.betaSpent[k].toFixed(5)] : []), `${(d.stopH1[k] * 100).toFixed(1)}%`, `${(d.stopH0[k] * 100).toFixed(1)}%`]);
      const unit = p.mode === 'hazard' ? 'events' : p.mode === 'effect' ? 'participants' : 'units';
      return [
        { title: 'Boundaries per look', columns: ['Look', 'Information', `Cumulative ${unit}`, 'Efficacy Z ≥', 'Nominal p', 'α spent', ...(futility ? ['Futility Z <', 'β spent'] : []), 'Stop | H1', 'Stop | H0'], rows },
        { title: 'Design summary', rows: [['Fixed-design size', Number(p.fixedSize.toPrecision(7))], ['Inflation factor', d.inflation.toFixed(4)], ['Maximum size', fmtCount(r.total)], ['Expected size under H1', fmtCount(Math.round(d.expectedH1 * r.total))], ['Expected size under H0', fmtCount(Math.round(d.expectedH0 * r.total))], ['Efficacy spending', `${spendingNames[p.spending]}${['power', 'hsd'].includes(p.spending) ? ` (${p.spendingParameter})` : ''}`], ...(futility ? [['Futility spending (non-binding)', `${spendingNames[p.futilitySpending]}${['power', 'hsd'].includes(p.futilitySpending) ? ` (${p.futilityParameter})` : ''}`]] : [])], note: 'Expected sizes count a stop at an interim as that look’s cumulative size, with futility stops obeyed.' },
      ];
    },
    additionalReceipt: (raw, p) => [['Fixed-design size', p.fixedSize], ['Unit', p.mode === 'hazard' ? 'events' : p.mode === 'effect' ? 'participants, two equal groups' : 'as for the fixed design']],
    allocationRule: 'Maximum size = inflation factor × fixed-design size, rounded up (to an even total for two equal groups). Interim sizes are the information fractions of the maximum, rounded up.',
    help: {
      looks: ['Number of looks', 'Two looks is one interim analysis plus the final; three is two interims plus the final. Every extra look inflates the maximum size a little but adds a chance to stop early.'],
      t1: ['Information fraction', 'The share of the final information available at the interim: participants with an outcome for a mean comparison, or events for a survival endpoint. 0.5 means halfway.'],
      t2: ['Second interim', 'Used only with three looks. It must come at least 5% of the information after the first interim.'],
      spending: ['Spending functions', 'O’Brien–Fleming type spends almost nothing early, so early stops need overwhelming evidence and the final bound stays close to the fixed design. Pocock type spends evenly and stops earlier more often, at the price of a larger maximum. The power family (ρ) and Hwang–Shih–DeCani (γ) interpolate: ρ = 3 or γ = −4 behave like O’Brien–Fleming, ρ = 1 or γ = 1 like Pocock.'],
      spendingParameter: ['Spending parameter', 'The power family takes ρ (0.1 to 10) and Hwang–Shih–DeCani takes γ (−40 to 40). Larger ρ or more negative γ spends less alpha early. The O’Brien–Fleming and Pocock types have no parameter, so the field is hidden for them.'],
      futilitySpending: ['Futility spending', 'How the type II error is spent on futility stops. Non-binding: the efficacy bounds are computed as if futility stops might be ignored, which is the regulatory default.'],
      futilityParameter: ['Futility parameter', 'ρ or γ for the futility family. γ = −2 is a common, moderately aggressive choice.'],
      effect: ['Standardized effect', 'Mean difference ÷ SD for two equal groups with a normal outcome. The fixed-design size uses the normal approximation 4(z_α + z_β)²/d².'],
      hazardRatio: ['Hazard ratio', 'For an event-driven design with equal allocation. The size is a number of events: 4(z_α + z_β)²/ln(HR)² without interim looks.'],
      fixedSize: ['Fixed-design size', 'Bring the answer from any other fighter: the size that gives your target power with a single analysis. Bell inflates it for the interim looks. It is assumed to have exactly the target power.'],
    },
    assumptions: 'One-sided testing of a normally distributed statistic whose information grows in proportion to the sample size or event count (canonical joint distribution; Jennison and Turnbull 2000). Effect-size mode plans two equal groups with a known-variance normal approximation; hazard-ratio mode plans events for a log-rank test with equal allocation (Schoenfeld). Fixed mode takes a fixed-design size from another fighter and assumes it has exactly the target power. Information fractions are planned; analyses that happen at other times need the boundaries recomputed by the same spending function.',
  };
  const defaultsSequential = { mode: 'effect', effect: '.5', hazardRatio: '.7', fixedSize: '128', looks: '3', t1: '.5', t2: '.75', spending: 'obf', spendingParameter: '-4', alpha: '.025', power: '.9' };
  register({
    ...sequentialBase,
    id: 'gsd-efficacy',
    name: 'Group sequential design · efficacy stopping',
    defaults: defaultsSequential,
    designFields: ['looks', 't1', 't2', 'spending', 'spendingParameter'],
    design: raw => sequentialBase.design(raw, false),
    notice: 'Interim looks can stop the trial early for efficacy. Boundaries come from an alpha-spending function so the overall one-sided error stays at α.',
    calculationNote: 'Efficacy bounds from Lan–DeMets alpha spending; power and boundaries by recursive numerical integration over the joint normal distribution of the sequential Z statistics (Jennison and Turnbull, chapter 19). Matches R mvtnorm references to 1e-6.',
  });
  register({
    ...sequentialBase,
    id: 'gsd-futility',
    name: 'Group sequential design · efficacy and non-binding futility',
    defaults: { ...defaultsSequential, futilitySpending: 'hsd', futilityParameter: '-2' },
    designFields: ['looks', 't1', 't2', 'spending', 'spendingParameter', 'futilitySpending', 'futilityParameter'],
    design: raw => sequentialBase.design(raw, true),
    notice: 'NON-BINDING futility: efficacy bounds ignore the futility stops, so the trial keeps its α even if a futility stop is overruled.',
    calculationNote: 'Efficacy bounds from alpha spending, ignoring futility. Futility bounds from beta spending under the alternative, the final one equal to the final efficacy bound; the drift is chosen so the total type II error with futility obeyed equals β. Recursive numerical integration; matches R mvtnorm references to 1e-6.',
  });

  // ---- Up/down stepping for number fields ----
  // One rule for every field instead of a step per field. Proportions (a field bounded by 0 and 1)
  // step along a 1–2–5 ladder of the distance to the nearer end (plus 0.025, 0.15 and 0.25), so an
  // attack rate moves 0.001 → 0.002 → 0.005, alpha 0.01 → 0.02 → 0.025 → 0.05, and power
  // 0.8 → 0.85 → 0.9 → 0.95 → 0.975 → 0.98 → 0.99.
  // Everything else steps by roughly 5–10% of its size on round values (0.7 → 0.75, 128 → 130),
  // and whole-number fields by at least 1. Typing still accepts any value.
  const ladder = [];
  for (let e = -6; e <= -1; e++) for (const m of [1, 2, 5]) ladder.push(Number((m * 10 ** e).toPrecision(6)));
  ladder.push(.025, .15, .25);
  const tidy = x => Number(x.toPrecision(12));
  const niceStep = a => { const e = Math.floor(Math.log10(a)), m = a / 10 ** e; return tidy((m < 2 - 1e-9 ? .1 : m < 5 - 1e-9 ? .2 : .5) * 10 ** e); };
  // A round 1–2–5 value at or below a: the first step away from zero, and where steps toward zero snap to it.
  const niceRound = a => { const e = Math.floor(Math.log10(a)), m = a / 10 ** e; return tidy((m >= 5 ? 5 : m >= 2 ? 2 : 1) * 10 ** e); };
  function stepValue(value, direction, f = {}) {
    const v = Number(value), up = direction > 0, min = f.min ?? -Infinity, max = f.max ?? Infinity;
    if (String(value).trim() === '' || !Number.isFinite(v)) return null;
    const clamp = x => Math.min(max, Math.max(min, x));
    if (v < min) return up ? min : null;
    if (v > max) return up ? null : max;
    const integer = String(f.step) === '1', zeroStep = niceRound(Number.isFinite(max - min) ? (max - min) / 100 : .1);
    let next;
    if (!integer && min >= 0 && max <= 1) {
      const points = [...new Set(ladder.flatMap(d => [d, tidy(1 - d)]))].filter(x => x >= min && x <= max).sort((a, b) => a - b);
      next = up ? points.find(x => x > v + 1e-12) ?? max : points.findLast(x => x < v - 1e-12) ?? min;
    } else if (v === 0 || (Math.abs(v) < 1e-9)) {
      next = (up ? 1 : -1) * Math.max(integer ? 1 : 0, zeroStep);
    } else {
      const a = Math.abs(v), outward = (v > 0) === up;
      // Moving toward zero uses the step of the decade below, so 1 → 0.95 rather than 1 → 0.9.
      let s = niceStep(outward ? a : a * (1 - 1e-9));
      if (integer) s = Math.max(1, Math.round(s));
      let mag = outward ? tidy((Math.floor(a / s + 1e-9) + 1) * s) : tidy((Math.ceil(a / s - 1e-9) - 1) * s);
      next = Math.sign(v) * Math.max(0, mag);
      // Fields that allow zero reach it instead of shrinking forever.
      if (!outward && min <= 0 && mag < zeroStep) next = 0;
    }
    next = clamp(tidy(next));
    return next === v ? null : next;
  }
  Object.defineProperty(methods, 'stepValue', { value: stepValue, enumerable: false });

  if (typeof module !== 'undefined') module.exports = methods;
  else globalThis.StatFighter.methods = methods;
}
