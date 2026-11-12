'use strict';

{
  const limits = {
    alpha: { min: 0.0001, max: 0.2 },
    power: { min: 0.5, max: 0.999 },
    effect: { min: 0.001, max: 5 },
    ratio: { min: 0.1, max: 10 },
    groups: { min: 2, max: 20 },
    total: 1_000_000,
  };

  const alternatives = new Set(['two-sided', 'greater', 'less']);
  const designs = new Set(['two-sample', 'paired', 'one-sample']);
  const rootTwoPi = Math.sqrt(2 * Math.PI);

  // Standard-normal upper tail. Use the erf series near zero and a
  // continued fraction for the complementary incomplete gamma function in the tail.
  function normalTail(x) {
    const abs = Math.abs(x);
    let tail = 0;
    if (abs < 2) {
      const square = abs * abs / 2;
      let term = abs;
      let sum = term;
      for (let k = 1; Math.abs(term) > 1e-16; k++) {
        term *= -square / k;
        sum += term / (2 * k + 1);
      }
      tail = 0.5 - sum / rootTwoPi;
    } else if (abs < 38) {
      const square = abs * abs / 2;
      let b = square + 0.5;
      let c = 1e100;
      let d = 1 / b;
      let fraction = d;
      for (let k = 1; k <= 200; k++) {
        const a = -k * (k - 0.5);
        b += 2;
        c = b + a / c;
        d = 1 / (b + a * d);
        const change = c * d;
        fraction *= change;
        if (Math.abs(change - 1) < 2e-15) break;
        if (k === 200) throw new Error('Normal tail integration did not converge.');
      }
      tail = Math.exp(-square) * abs / (2 * rootTwoPi) * fraction;
    }
    return x < 0 ? 1 - tail : tail;
  }

  // If V ~ chi-square(df), the conditional rejection probabilities are
  // normal tails given V. Integrate in z = sqrt(df / 2) * log(V / df),
  // where the density stays well scaled even for large df.
  function chiSquareQuadrature(df) {
    const shape = df / 2;
    const scale = Math.sqrt(shape);
    function logDensity(z) {
      const logRatio = z / scale;
      return shape * (logRatio - Math.expm1(logRatio));
    }

    function bound(direction) {
      let outer = 1;
      while (logDensity(direction * outer) > -44) outer *= 2;
      let inner = 0;
      for (let i = 0; i < 32; i++) {
        const mid = (inner + outer) / 2;
        if (logDensity(direction * mid) > -44) inner = mid;
        else outer = mid;
      }
      return direction * outer;
    }

    // Composite Simpson rule with finer spacing at low degrees of freedom.
    const lo = bound(-1);
    const hi = bound(1);
    const intervals = 2 * Math.ceil((hi - lo) / (df < 8 ? 0.08 : 0.16));
    const scales = new Float64Array(intervals + 1);
    const weights = new Float64Array(intervals + 1);
    let sum = 0;
    for (let i = 0; i <= intervals; i++) {
      const z = lo + i * (hi - lo) / intervals;
      const factor = i === 0 || i === intervals ? 1 : i % 2 ? 4 : 2;
      scales[i] = Math.exp(z / (2 * scale));
      weights[i] = factor * Math.exp(logDensity(z));
      sum += weights[i];
    }
    return { scales, weights, sum, lo, hi, normalizer: sum * (hi - lo) / intervals / 3 };
  }

  function rejectionPower(critical, ncp, twoSided, quadrature) {
    const { scales, weights, sum } = quadrature;
    let power = 0;
    for (let i = 0; i < scales.length; i++) {
      const threshold = critical * scales[i];
      const upper = normalTail(threshold - ncp);
      const lower = twoSided ? normalTail(threshold + ncp) : 0;
      power += weights[i] * (upper + lower);
    }
    return power / sum;
  }

  function criticalT(alphaTail, quadrature) {
    let lo = 0;
    let hi = 1;
    while (rejectionPower(hi, 0, false, quadrature) > alphaTail) hi *= 2;
    while (hi - lo > 2e-12 * (1 + lo)) {
      const mid = (lo + hi) / 2;
      if (rejectionPower(mid, 0, false, quadrature) > alphaTail) lo = mid;
      else hi = mid;
    }
    return (lo + hi) / 2;
  }

  function checkedNumber(name, value, label) {
    const { min, max } = limits[name];
    if (!Number.isFinite(value) || value < min || value > max) {
      throw new RangeError(`${label} must be between ${min} and ${max}.`);
    }
    return value;
  }

  function firstSampleSize(power, max, evaluate, minimum = 2) {
    let lower = minimum - 1;
    let upper = evaluate(minimum);
    while (upper.power < power && upper.n < max) {
      lower = upper.n;
      upper = evaluate(Math.min(max, upper.n * 2));
    }
    if (upper.power < power) {
      throw new RangeError('No sample size within the 1,000,000-unit limit reaches the requested power.');
    }
    while (upper.n - lower > 1) {
      const candidate = evaluate(Math.floor((lower + upper.n) / 2));
      if (candidate.power < power) lower = candidate.n;
      else upper = candidate;
    }
    return upper;
  }

  // Fixed integer allocations expose the same evaluator used by the solver.
  function tPowerAt(design, { alpha, effect, alternative, n, n2 = 0 }) {
    if (!designs.has(design)) throw new RangeError('Choose a supported t-test.');
    checkedNumber('alpha', alpha, 'Alpha');
    checkedNumber('effect', Number.isFinite(effect) ? Math.abs(effect) : NaN, 'Absolute effect size');
    if (!alternatives.has(alternative)) throw new RangeError('Choose an alternative hypothesis.');
    if ((alternative === 'greater' && effect < 0) || (alternative === 'less' && effect > 0)) {
      throw new RangeError('The effect size sign must match the direction of the alternative.');
    }
    const independent = design === 'two-sample';
    if (!Number.isInteger(n) || n < 2 || (independent && (!Number.isInteger(n2) || n2 < 2))) {
      throw new RangeError('Sample sizes must be whole numbers of at least two.');
    }
    n2 = independent ? n2 : 0;
    const total = n + n2;
    if (total > limits.total) throw new RangeError('Sample size exceeds the 1,000,000-unit limit.');
    return tPowerCore(design, { alpha, effect, alternative, n, n2 });
  }
  // Private evaluator: callers validate their own alpha, including Bonferroni's smaller threshold.
  function tPowerCore(design, { alpha, effect, alternative, n, n2 = 0 }) {
    const independent = design === 'two-sample', total = n + n2;
    const df = independent ? total - 2 : n - 1;
    const ncp = Math.abs(effect) * (independent ? 1 / Math.sqrt(1 / n + 1 / n2) : Math.sqrt(n));
    const quadrature = chiSquareQuadrature(df);
    const twoSided = alternative === 'two-sided';
    const critical = criticalT(twoSided ? alpha / 2 : alpha, quadrature);
    const achieved = rejectionPower(critical, ncp, twoSided, quadrature);
    if (!Number.isFinite(achieved)) throw new Error('Power calculation failed.');
    return { n, n2, total, df, power: Math.min(1, achieved) };
  }

  function sampleSize(design, { alpha, power, effect, alternative, ratio = 1 }) {
    if (!designs.has(design)) throw new RangeError('Choose a supported t-test.');
    checkedNumber('alpha', alpha, 'Alpha');
    checkedNumber('power', power, 'Target power');
    checkedNumber('effect', Number.isFinite(effect) ? Math.abs(effect) : NaN, 'Absolute effect size');
    if (!alternatives.has(alternative)) throw new RangeError('Choose an alternative hypothesis.');
    if ((alternative === 'greater' && effect < 0) || (alternative === 'less' && effect > 0)) {
      throw new RangeError('The effect size sign must match the direction of the alternative.');
    }

    const independent = design === 'two-sample';
    if (independent) checkedNumber('ratio', ratio, 'Allocation ratio');
    const secondGroup = (n) => independent ? Math.max(2, Math.round(n * ratio)) : 0;
    function evaluate(n) {
      return tPowerAt(design, { alpha, effect, alternative, n, n2: secondGroup(n) });
    }

    let max = limits.total;
    if (independent) {
      let lo = 2;
      while (lo < max) {
        const mid = Math.ceil((lo + max) / 2);
        if (mid + secondGroup(mid) > limits.total) max = mid - 1;
        else lo = mid;
      }
    }

    return firstSampleSize(power, max, evaluate);
  }

  // Lanczos approximation with g = 7. Compute the ratio Γ(b) / Γ(a + b)
  // without subtracting two large log-gamma values at high residual df.
  const lanczosCoefficients = [
    676.5203681218851, -1259.1392167224028, 771.3234287776531,
    -176.6150291621406, 12.507343278686905, -0.13857109526572012,
    9.984369578019572e-6, 1.5056327351493116e-7,
  ];

  function lanczosSum(z) {
    let sum = 0.9999999999998099;
    for (let i = 0; i < lanczosCoefficients.length; i++) {
      sum += lanczosCoefficients[i] / (z + i);
    }
    return sum;
  }

  function logBeta(a, b) {
    const logGammaA = Math.log(rootTwoPi * lanczosSum(a))
      + (a - 0.5) * Math.log(a + 6.5) - (a + 6.5);
    const offset = b + 6.5;
    return logGammaA + a - a * Math.log(offset) - (a + b - 0.5) * Math.log1p(a / offset)
      + Math.log(lanczosSum(b) / lanczosSum(a + b));
  }

  // Modified Lentz evaluation of the incomplete beta continued fraction.
  function betaFraction(x, a, b) {
    const nonzero = (value) => Math.abs(value) < 1e-100 ? 1e-100 : value;
    let c = 1;
    let d = 1 / nonzero(1 - (a + b) * x / (a + 1));
    let fraction = d;
    for (let m = 1; m <= 200; m++) {
      const even = m * (b - m) * x / ((a + 2 * m - 1) * (a + 2 * m));
      d = 1 / nonzero(1 + even * d);
      c = nonzero(1 + even / c);
      fraction *= c * d;

      const odd = -(a + m) * (a + b + m) * x / ((a + 2 * m) * (a + 2 * m + 1));
      d = 1 / nonzero(1 + odd * d);
      c = nonzero(1 + odd / c);
      const change = c * d;
      fraction *= change;
      if (Math.abs(change - 1) < 2e-15) return fraction;
    }
    throw new Error('F distribution calculation did not converge.');
  }

  function betaUpperTail(x, a, b, kernel) {
    if (x < (a + 1) / (a + b + 2)) return 1 - kernel * betaFraction(x, a, b) / a;
    return kernel * betaFraction(1 - x, b, a) / b;
  }

  // Evaluate the noncentral F tail as a Poisson mixture of beta upper tails.
  // Start the Poisson weights at the mode to keep them representable.
  function noncentralBetaUpperTail(x, a, b, kernel, centralTail, ncp) {
    const mean = ncp / 2;
    const mode = Math.floor(mean);
    const weights = [1];
    let weight = 1;
    for (let j = mode; j > 0; j--) {
      weight *= j / mean;
      weights.push(weight);
    }

    let tail = centralTail;
    let increment = kernel / a;
    let weightedTail = 0;
    let sum = 0;
    weight = weights.pop();
    for (let j = 0; ; j++) {
      weightedTail += weight * tail;
      sum += weight;
      const ratio = mean / (j + 1);
      if (ratio < 1 && weight * ratio < 1e-16 * (1 - ratio) * sum) break;
      weight = j < mode ? weights.pop() : weight * ratio;
      tail += increment;
      increment *= x * (a + b + j) / (a + j + 1);
    }
    return Math.min(1, weightedTail / sum);
  }

  function anovaSampleSize({ groups, effect, alpha, power }) {
    checkedNumber('groups', groups, 'Number of groups');
    if (!Number.isInteger(groups)) throw new RangeError('Number of groups must be a whole number.');
    checkedNumber('effect', effect, 'Cohen’s f');
    checkedNumber('alpha', alpha, 'Alpha');
    checkedNumber('power', power, 'Target power');

    return firstSampleSize(power, Math.floor(limits.total / groups), n => {
      const total = n * groups;
      return { n, total, power: fRejectionPower(groups - 1, total - groups, total * effect ** 2, alpha) };
    });
  }

  // Shared central cutoff / noncentral-F evaluator; ANOVA and regression supply their own designs.
  function fRejectionPower(df1, df2, noncentrality, alpha) {
    const a = df1 / 2, b = df2 / 2;
    const normalizer = logBeta(a, b);
    const kernelAt = x => Math.exp(a * Math.log(x) + b * Math.log1p(-x) - normalizer);
    let lo = 0, hi = 1;
    for (let i = 0; i < 64; i++) {
      const mid = (lo + hi) / 2;
      if (betaUpperTail(mid, a, b, kernelAt(mid)) > alpha) lo = mid;
      else hi = mid;
    }
    const x = (lo + hi) / 2, kernel = kernelAt(x);
    const achieved = noncentralBetaUpperTail(x, a, b, kernel, betaUpperTail(x, a, b, kernel), noncentrality);
    if (!Number.isFinite(achieved)) throw new Error('F power calculation failed.');
    return Math.max(0, Math.min(1, achieved));
  }

  function checkAssociationEffect(effect, max, label) {
    if (!Number.isFinite(effect) || Math.abs(effect) < 0.001 || Math.abs(effect) > max) throw new RangeError(`${label} must have magnitude from 0.001 to ${max}.`);
  }
  function checkPredictors(predictors) {
    if (!Number.isInteger(predictors) || predictors < 1 || predictors > 20) throw new RangeError('Number of predictors must be a whole number from 1 to 20, excluding the intercept.');
  }
  function correlationPowerAt({ n, effect, alpha, alternative }) {
    checkedNumber('alpha', alpha, 'Alpha');
    checkAssociationEffect(effect, 0.99, 'Population correlation');
    if (!alternatives.has(alternative)) throw new RangeError('Choose an alternative hypothesis.');
    if ((alternative === 'greater' && effect < 0) || (alternative === 'less' && effect > 0)) throw new RangeError('The correlation sign must match the chosen direction relative to zero.');
    if (!Number.isInteger(n) || n < 4 || n > limits.total) throw new RangeError('Correlation requires 4 to 1,000,000 complete bivariate observations.');
    const twoSided = alternative === 'two-sided', rho = Math.abs(effect);
    const critical = criticalT(twoSided ? alpha / 2 : alpha, chiSquareQuadrature(n - 2));
    // atanh(r_critical) = asinh(t_critical / sqrt(df)); avoids cancellation near |r|=1.
    const zCritical = Math.asinh(critical / Math.sqrt(n - 2));
    const zAlternative = Math.atanh(rho) + rho / (2 * (n - 1));
    const scale = Math.sqrt(n - 3);
    const achieved = normalTail((zCritical - zAlternative) * scale) + (twoSided ? normalTail((zCritical + zAlternative) * scale) : 0);
    return { n, total: n, df: n - 2, power: Math.max(0, Math.min(1, achieved)) };
  }
  function correlationSampleSize(parameters) {
    checkedNumber('power', parameters.power, 'Target power');
    return firstSampleSize(parameters.power, limits.total, n => correlationPowerAt({ ...parameters, n }), 4);
  }
  function regressionPowerAt({ n, predictors, effect, alpha }) {
    checkPredictors(predictors);
    checkedNumber('alpha', alpha, 'Alpha');
    checkedNumber('effect', effect, 'Cohen’s f²');
    if (!Number.isInteger(n) || n < predictors + 2 || n > limits.total) throw new RangeError('Sample size must exceed the predictor count by at least two and stay within 1,000,000 observations.');
    const df1 = predictors, df2 = n - predictors - 1;
    return { n, total: n, df1, df2, power: fRejectionPower(df1, df2, n * effect, alpha) };
  }
  function regressionSampleSize(parameters) {
    checkPredictors(parameters.predictors);
    checkedNumber('power', parameters.power, 'Target power');
    return firstSampleSize(parameters.power, limits.total, n => regressionPowerAt({ ...parameters, n }), parameters.predictors + 2);
  }

  function normalCritical(alpha) {
    let lo = 0, hi = 10;
    for (let i = 0; i < 64; i++) {
      const mid = (lo + hi) / 2;
      if (normalTail(mid) > alpha) lo = mid; else hi = mid;
    }
    return (lo + hi) / 2;
  }
  function normalPower(signal, alpha, twoSided) {
    const critical = normalCritical(alpha / (twoSided ? 2 : 1));
    return Math.min(1, normalTail(critical - signal) + (twoSided ? normalTail(critical + signal) : 0));
  }
  const expansionIds = new Set(['mann-whitney', 'signed-rank', 'proportions', 'chi-square', 'log-rank', 'bonferroni']);
  function checkExpansion(id, p) {
    if (!expansionIds.has(id)) throw new RangeError('Choose a supported planning method.');
    checkedNumber('alpha', p.alpha, 'Alpha');
    const max = ({'mann-whitney': .49, 'signed-rank': .49, proportions: 3, 'chi-square': 5, 'log-rank': Math.log(10), bonferroni: 5})[id];
    const magnitude = Math.abs(p.effect);
    if (!Number.isFinite(p.effect) || magnitude < .001 || magnitude > max + 1e-14 || (['chi-square','log-rank'].includes(id) && p.effect < 0)) throw new RangeError(`Effect magnitude must be 0.001–${max}.`);
    if (!['chi-square','log-rank'].includes(id)) {
      if (!alternatives.has(p.alternative)) throw new RangeError('Choose an alternative hypothesis.');
      if ((p.alternative === 'greater' && p.effect < 0) || (p.alternative === 'less' && p.effect > 0)) throw new RangeError('Effect sign must match the chosen direction.');
    }
    if (id === 'chi-square' && (!Number.isInteger(p.df) || p.df < 1 || p.df > 100)) throw new RangeError('Chi-square degrees of freedom must be an integer from 1 to 100.');
    if (id === 'log-rank' && (!Number.isFinite(p.allocation) || p.allocation < .1 || p.allocation > .9)) throw new RangeError('Allocation proportion must be 0.1–0.9.');
    if (id === 'bonferroni' && (!Number.isInteger(p.comparisons) || p.comparisons < 1 || p.comparisons > 100)) throw new RangeError('Family size must be an integer from 1 to 100.');
  }
  function logGamma(a) {
    return Math.log(rootTwoPi * lanczosSum(a)) + (a - .5) * Math.log(a + 6.5) - (a + 6.5);
  }
  // Regularized upper incomplete gamma: series below a+1, continued fraction above it.
  function gammaTail(a, x) {
    if (x === 0) return 1;
    const kernel = Math.exp(a * Math.log(x) - x - logGamma(a));
    if (x < a + 1) {
      let term = 1 / a, sum = term;
      for (let i = 1; i < 10000; i++) {
        term *= x / (a + i); sum += term;
        if (term < sum * 2e-15) return Math.max(0, 1 - kernel * sum);
      }
    } else {
      let b = x + 1 - a, c = 1e100, d = 1 / b, h = d;
      const nonzero = v => Math.abs(v) < 1e-100 ? 1e-100 : v;
      for (let i = 1; i < 10000; i++) {
        const an = -i * (i - a); b += 2;
        d = 1 / nonzero(an * d + b); c = nonzero(b + an / c);
        const delta = d * c; h *= delta;
        if (Math.abs(delta - 1) < 2e-15) return Math.min(1, kernel * h);
      }
    }
    throw new Error('Chi-square integration did not converge.');
  }
  function chiPower(n, effect, df, alpha) {
    let lo = 0, hi = df;
    while (gammaTail(df / 2, hi / 2) > alpha) hi *= 2;
    for (let i = 0; i < 64; i++) {
      const mid = (lo + hi) / 2;
      if (gammaTail(df / 2, mid / 2) > alpha) lo = mid; else hi = mid;
    }
    const x = (lo + hi) / 4, a = df / 2, mean = n * effect * effect / 2, mode = Math.floor(mean);
    // Normalize Poisson weights about their mode, avoiding underflow at large noncentrality.
    let sum = 1, weighted = gammaTail(a + mode, x), weight = 1;
    for (let j = mode; j > 0; j--) {
      weight *= j / mean; sum += weight; weighted += weight * gammaTail(a + j - 1, x);
      if (weight < sum * 1e-16) break;
    }
    weight = 1;
    for (let j = mode + 1; ; j++) {
      weight *= mean / j; sum += weight; weighted += weight * gammaTail(a + j, x);
      if (weight < sum * 1e-16) break;
    }
    return Math.max(0, Math.min(1, weighted / sum));
  }
  function expansionMinimum(id) { return id === 'bonferroni' ? 2 : id === 'chi-square' ? 2 : id === 'log-rank' ? 10 : 20; }
  function expansionPowerAt(id, p) {
    checkExpansion(id, p);
    const { n, effect, alpha } = p, pairedGroups = ['mann-whitney','proportions','bonferroni'].includes(id);
    const total = pairedGroups ? 2 * n : n;
    if (!Number.isInteger(n) || n < expansionMinimum(id) || total > limits.total) throw new RangeError('Sample size must be an admissible integer within the one-million-unit limit.');
    if (id === 'bonferroni') return { ...tPowerCore('two-sample', { ...p, alpha: alpha / p.comparisons, n2: n }), comparisonAlpha: alpha / p.comparisons };
    let achieved;
    if (id === 'chi-square') achieved = chiPower(n, effect, p.df, alpha);
    else {
      const signal = id === 'mann-whitney' ? Math.abs(effect) * Math.sqrt(6 * n)
        : id === 'signed-rank' ? Math.abs(effect) * Math.sqrt(3 * n)
        : id === 'proportions' ? Math.abs(effect) * Math.sqrt(n / 2)
        : effect * Math.sqrt(n * p.allocation * (1 - p.allocation));
      achieved = normalPower(signal, alpha, id === 'log-rank' || p.alternative === 'two-sided');
    }
    return { n, n2: pairedGroups ? n : 0, total, power: achieved };
  }
  function expansionSampleSize(id, p) {
    checkExpansion(id, p); checkedNumber('power', p.power, 'Target power');
    const pairedGroups = ['mann-whitney','proportions','bonferroni'].includes(id);
    return firstSampleSize(p.power, pairedGroups ? limits.total / 2 : limits.total, n => expansionPowerAt(id, { ...p, n }), expansionMinimum(id));
  }

  const marginMethods = new Set(['non-inferiority','tost','tost-lognormal']);
  function checkMarginDesign(id, p) {
    if (!marginMethods.has(id)) throw new RangeError('Choose a supported margin-based planning method.');
    checkedNumber('alpha', p.alpha, 'One-sided alpha');
    if (!Number.isFinite(p.effect) || Math.abs(p.effect) > 1000) throw new RangeError('Standardized expected difference must be between −1000 and 1000.');
    if (id === 'non-inferiority') {
      if (![1,-1].includes(p.direction)) throw new RangeError('Choose whether higher or lower outcomes are better.');
      if (!Number.isFinite(p.margin) || p.margin <= 0 || p.margin > 1000) throw new RangeError('Standardized allowed loss must be positive and at most 1000.');
      const distance = p.margin + p.direction * p.effect;
      if (!Number.isFinite(distance) || distance < .001 || distance > 2000) throw new RangeError('Expected outcome must be on the non-inferior side of the margin, with a standardized distance of at least 0.001.');
    } else {
      if (![p.lower,p.upper].every(Number.isFinite) || p.lower < -1000 || p.upper > 1000 || p.lower >= 0 || p.upper <= 0 || p.lower >= p.upper) throw new RangeError('Standardized equivalence bounds must straddle zero, be ordered, and be within −1000 to 1000.');
      if (p.effect - p.lower < .001 || p.upper - p.effect < .001) throw new RangeError('Expected difference must lie strictly inside both bounds, at least 0.001 SD from each.');
    }
  }
  function adaptiveIntegral(fn, lo, hi, tolerance = 2e-12) {
    if (hi <= lo) return 0;
    function refine(a,b,fa,fm,fb,estimate,tol,depth) {
      const m=(a+b)/2, lm=(a+m)/2, rm=(m+b)/2, fl=fn(lm), fr=fn(rm);
      const first=(m-a)*(fa+4*fl+fm)/6, second=(b-m)*(fm+4*fr+fb)/6;
      const change=first+second-estimate;
      if (Math.abs(change) <= 15*tol) return first+second+change/15;
      if (depth === 0) throw new Error('TOST power integration did not converge.');
      return refine(a,m,fa,fl,fm,first,tol/2,depth-1)+refine(m,b,fm,fr,fb,second,tol/2,depth-1);
    }
    // Split a long domain to avoid missing narrow, off-center mass with a single adaptive panel.
    const pieces=Math.ceil((hi-lo)/.5); let sum=0;
    for(let i=0;i<pieces;i++) {
      const a=lo+(hi-lo)*i/pieces,b=lo+(hi-lo)*(i+1)/pieces,m=(a+b)/2;
      const fa=fn(a),fm=fn(m),fb=fn(b);
      sum+=refine(a,b,fa,fm,fb,(b-a)*(fa+4*fm+fb)/6,tolerance/pieces,24);
    }
    return sum;
  }
  function marginPowerAt(id, p) {
    checkMarginDesign(id,p);
    const {n,effect,alpha}=p;
    if (!Number.isInteger(n) || n < 2 || n*2 > limits.total) throw new RangeError('Parallel groups need a whole size of at least 2 each, up to 1,000,000 total.');
    if (id === 'non-inferiority') return tPowerCore('two-sample',{n,n2:n,alpha,effect:p.margin+p.direction*effect,alternative:'greater'});
    const df=2*n-2, se=Math.sqrt(2/n), quadrature=chiSquareQuadrature(df), critical=criticalT(alpha,quadrature);
    const a=(effect-p.lower)/se,b=(p.upper-effect)/se, shape=df/2, scale=Math.sqrt(shape);
    // Both tests share their estimated variance. Condition on that variance and integrate
    // the interval event jointly; adding marginal noncentral-t powers is not exact TOST.
    const upperZ=Math.min(quadrature.hi,2*scale*Math.log((a+b)/(2*critical)));
    const integral=adaptiveIntegral(z=>{
      const logRatio=z/scale, s=Math.exp(logRatio/2);
      const conditional=Math.max(0,normalTail(critical*s-b)-normalTail(a-critical*s));
      return conditional*Math.exp(shape*(logRatio-Math.expm1(logRatio)));
    },quadrature.lo,upperZ);
    const achieved=Math.max(0,Math.min(1,integral/quadrature.normalizer));
    return {n,n2:n,total:2*n,df,power:achieved,confidence:1-2*alpha};
  }
  function marginSampleSize(id,p) {
    checkMarginDesign(id,p); checkedNumber('power',p.power,'Target power');
    return firstSampleSize(p.power,limits.total/2,n=>marginPowerAt(id,{...p,n}));
  }

  const stats = { version: '4', marginSampleSize, marginPowerAt, normalCdf: x => normalTail(-x), expansionSampleSize, expansionPowerAt, limits, sampleSize, anovaSampleSize, tPowerAt, correlationSampleSize, correlationPowerAt, regressionSampleSize, regressionPowerAt };
  if (typeof module === 'undefined') {
    globalThis.StatFighter = { stats };
  } else {
    module.exports = stats;
  }
}
