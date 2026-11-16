'use strict';
// R code for every fighter: `verify` re-derives the app's sample size and power with an independent
// R package (or a base-R restatement plus a simulation), `analysis` shows the matching analysis of
// real data. Only numbers and fixed keywords are interpolated; numbers keep full precision. The
// verify code leaves sf_n (total in the app's units, using the app's rounding rule) and sf_power
// (power at the app's own sizes) for scripts/check-rcode.mjs. No jokes in here.
{
  const R = x => String(Number(x));
  const alt = a => ({ 'two-sided': 'two.sided', greater: 'greater', less: 'less' }[a] ?? 'two.sided');
  // Date and versions from tests/reference/rcode-provenance.txt (npm run check:r).
  const checkedOn = '2026-11-17';
  const versions = { pwr: '1.3.0', PowerTOST: '1.5.7', gsDesign: '3.11.0', MKpower: '1.1', MESS: '0.6.0', MASS: '7.3.65', survival: '3.8.6' };

  // Shared R helpers: the app's "smallest size reaching the target" search, stepping from a guess.
  const searchR = `sf_search <- function(power_at, start, lo = 2) {
  n <- max(lo, start)
  while (power_at(n) < target) n <- n + 1
  while (n > lo && power_at(n - 1) >= target) n <- n - 1
  n
}
half_up <- function(x) floor(x + 0.5)`;
  const report = 'cat("R check: N =", sf_n, "| power at the app\'s N =", format(sf_power, digits = 6), "\\n")';
  const header = (m, r, disclaimer, packages) => [
    `# ${m.name}`, `# ${disclaimer}`,
    ...packages.map(pkg => `# install.packages("${pkg}")`),
    `# App result: N = ${r.total}, power = ${R(r.power)}`, '',
  ].join('\n');

  // Two groups sized by the app's allocation rule: Group 2 = max(2, round(Group 1 × ratio)).
  const twoGroupSearch = (ratio, lo = 2) => `ratio <- ${R(ratio)}
n2_of <- function(n1) max(2, half_up(n1 * ratio))
n1 <- sf_search(function(n1) power_at(n1, n2_of(n1)), floor(n_equal * (1 + 1 / ratio) / 2) - 2, ${lo})
sf_n <- n1 + n2_of(n1)`;

  const builders = {
    'two-sample'(m, raw, p, r) {
      if (p.welch) {
        const delta = Number(raw.mean1) - Number(raw.mean2), sign = p.alternative === 'less' ? -1 : 1;
        return {
          packages: ['MESS'], check: 'exact', note: '',
          verify: `library(MESS)
delta <- ${R(sign * delta)}; sd1 <- ${R(raw.sd1)}; sd.ratio <- ${R(p.sdRatio)}
alpha <- ${R(p.alpha)}; target <- ${R(p.power)}; alt <- "${p.alternative === 'two-sided' ? 'two.sided' : 'one.sided'}"
${searchR}
power_at <- function(n1, n2) power_t_test(n = n1, delta = delta, sd = sd1, sd.ratio = sd.ratio, ratio = n2 / n1, sig.level = alpha, alternative = alt, df.method = "welch", strict = TRUE)$power
# (a) Package sample size for Group 1 (Group 2 = ratio × Group 1, not rounded):
print(power_t_test(delta = delta, sd = sd1, sd.ratio = sd.ratio, ratio = ${R(p.ratio)}, sig.level = alpha, power = target, alternative = alt, df.method = "welch", strict = TRUE))
n_equal <- 2
# (b) The app's rounding rule with the package's power, and power at the app's sizes:
${twoGroupSearch(p.ratio)}
sf_power <- power_at(${r.n}, ${r.n2})
${report}`,
          analysis: `# dat: one row per participant; y = outcome, group = factor with two levels.
t.test(y ~ group, data = dat)   # Welch's t-test (var.equal = FALSE is the default)`,
          simulate: 'dat <- data.frame(group = factor(rep(c("A", "B"), each = 30)), y = rnorm(60, rep(c(105, 100), each = 30), rep(c(10, 15), each = 30)))',
        };
      }
      return {
        packages: ['pwr'], check: 'exact', note: '',
        verify: `library(pwr)
d <- ${R(p.effect)}; alpha <- ${R(p.alpha)}; target <- ${R(p.power)}; alt <- "${alt(p.alternative)}"
${searchR}
power_at <- function(n1, n2) pwr.t2n.test(n1 = n1, n2 = n2, d = d, sig.level = alpha, alternative = alt)$power
# (a) Package sample size per group for equal allocation:
print(pwr.t.test(d = d, sig.level = alpha, power = target, type = "two.sample", alternative = alt))
n_equal <- ceiling(pwr.t.test(d = d, sig.level = alpha, power = target, type = "two.sample", alternative = alt)$n)
# (b) The app's allocation rule with the package's power, and power at the app's sizes:
${twoGroupSearch(p.ratio)}
sf_power <- power_at(${r.n}, ${r.n2})
${report}`,
        analysis: `# dat: one row per participant; y = outcome, group = factor with two levels.
t.test(y ~ group, data = dat, var.equal = TRUE)   # pooled two-sample t-test`,
        simulate: 'dat <- data.frame(group = factor(rep(c("A", "B"), each = 30)), y = rnorm(60, rep(c(105, 100), each = 30), 10))',
      };
    },
    paired: (m, raw, p, r) => oneT(p, r, 'paired', `# dat: one row per pair; before and after measured on the same unit.
t.test(dat$after, dat$before, paired = TRUE)`, 'dat <- data.frame(before = rnorm(30, 100, 10)); dat$after <- dat$before + rnorm(30, 5, 8)'),
    'one-sample': (m, raw, p, r) => oneT(p, r, 'one.sample', `# dat: one row per observation; y = outcome.
t.test(dat$y, mu = ${raw.mode === 'means' ? R(raw.reference) : 'reference_value)   # reference_value: the fixed reference, set it first'}${raw.mode === 'means' ? ')' : ''}`, 'dat <- data.frame(y = rnorm(30, 105, 10)); reference_value <- 100'),
    anova(m, raw, p, r) {
      return {
        packages: ['pwr'], check: 'exact', note: '',
        verify: `library(pwr)
k <- ${p.groups}; f <- ${R(p.effect)}; alpha <- ${R(p.alpha)}; target <- ${R(p.power)}
${searchR}
power_at <- function(n) pwr.anova.test(k = k, n = n, f = f, sig.level = alpha)$power
# (a) Package sample size per group:
print(pwr.anova.test(k = k, f = f, sig.level = alpha, power = target))
# (b) Smallest whole size per group, and power at the app's size:
n <- sf_search(power_at, ceiling(pwr.anova.test(k = k, f = f, sig.level = alpha, power = target)$n))
sf_n <- k * n
sf_power <- power_at(${r.n})
${report}`,
        analysis: `# dat: one row per participant; y = outcome, group = factor with ${p.groups} levels.
anova(lm(y ~ factor(group), data = dat))   # overall F-test`,
        simulate: 'dat <- data.frame(group = rep(1:3, each = 20)); dat$y <- rnorm(60, c(95, 100, 105)[dat$group], 15)',
      };
    },
    ancova(m, raw, p, r) {
      return {
        packages: [], check: 'formula',
        note: 'No CRAN package implements this approximation. The code restates the noncentral t formula and adds a 2,000-run lm() simulation; the formula is known to be slightly optimistic in small trials.',
        verify: `# Base R restatement of the app's model, then a simulation with lm().
d <- ${R(p.effect)}; rho2 <- ${R(p.rSquared)}; q <- ${p.covariates}; alpha <- ${R(p.alpha)}; target <- ${R(p.power)}; alt <- "${alt(p.alternative)}"
${searchR}
power_at <- function(n1, n2) {
  df <- n1 + n2 - 2 - q; ncp <- d / sqrt(1 - rho2) / sqrt(1 / n1 + 1 / n2)
  if (alt == "two.sided") { crit <- qt(1 - alpha / 2, df); pt(crit, df, ncp, lower.tail = FALSE) + pt(-crit, df, ncp) }
  else if (alt == "greater") pt(qt(1 - alpha, df), df, ncp, lower.tail = FALSE) else pt(-qt(1 - alpha, df), df, ncp)
}
n_equal <- 2
${twoGroupSearch(p.ratio, 2)}
sf_power <- power_at(${r.n}, ${r.n2})
# Simulation at the app's sizes: q standard normal covariates jointly explaining R² of the outcome.
set.seed(1989)
n1 <- ${r.n}; n2 <- ${r.n2}
sim <- replicate(2000, {
  group <- rep(c(1, 0), c(n1, n2)); x <- matrix(rnorm((n1 + n2) * q), ncol = q)
  y <- d * group + sqrt(rho2 / q) * rowSums(x) + sqrt(1 - rho2) * rnorm(n1 + n2)
  t <- summary(lm(y ~ group + x))$coefficients["group", "t value"]; df <- n1 + n2 - 2 - q
  if (alt == "two.sided") abs(t) > qt(1 - alpha / 2, df) else if (alt == "greater") t > qt(1 - alpha, df) else t < -qt(1 - alpha, df)
})
sf_sim <- mean(sim)
cat("Simulated power:", sf_sim, "\\n")
${report}`,
        analysis: `# dat: one row per participant; y = outcome, group = factor with two levels, baseline = covariate.
fit <- lm(y ~ group + baseline, data = dat)   # add further covariates to the formula
summary(fit)
confint(fit)`,
        simulate: 'dat <- data.frame(group = factor(rep(c("A", "B"), each = 30)), baseline = rnorm(60)); dat$y <- 5 * (dat$group == "A") + 5 * dat$baseline + rnorm(60, 0, 8)',
      };
    },
    correlation(m, raw, p, r) {
      return {
        packages: ['pwr'], check: 'exact', note: '',
        verify: `library(pwr)
rho <- ${R(p.effect)}; alpha <- ${R(p.alpha)}; target <- ${R(p.power)}; alt <- "${alt(p.alternative)}"
${searchR}
power_at <- function(n) pwr.r.test(n = n, r = rho, sig.level = alpha, alternative = alt)$power
print(pwr.r.test(r = rho, sig.level = alpha, power = target, alternative = alt))
sf_n <- sf_search(power_at, ceiling(pwr.r.test(r = rho, sig.level = alpha, power = target, alternative = alt)$n), 4)
sf_power <- power_at(${r.n})
${report}`,
        analysis: `# dat: one row per unit; x and y measured on each.
cor.test(dat$x, dat$y, method = "pearson")`,
        simulate: 'dat <- data.frame(x = rnorm(50)); dat$y <- 0.3 * dat$x + rnorm(50)',
      };
    },
    regression(m, raw, p, r) {
      return {
        packages: ['pwr'], check: 'exact', note: '',
        verify: `library(pwr)
u <- ${p.predictors}; f2 <- ${R(p.effect)}; alpha <- ${R(p.alpha)}; target <- ${R(p.power)}
${searchR}
power_at <- function(N) pwr.f2.test(u = u, v = N - u - 1, f2 = f2, sig.level = alpha)$power
print(pwr.f2.test(u = u, f2 = f2, sig.level = alpha, power = target))   # N = ceiling(v) + u + 1
sf_n <- sf_search(power_at, ceiling(pwr.f2.test(u = u, f2 = f2, sig.level = alpha, power = target)$v) + u + 1, u + 2)
sf_power <- power_at(${r.n})
${report}`,
        analysis: `# dat: one row per observation; y = outcome, every other column a predictor.
fit <- lm(y ~ ., data = dat)
summary(fit)   # the overall F-test is in the last line`,
        simulate: 'dat <- data.frame(x1 = rnorm(80), x2 = rnorm(80), x3 = rnorm(80)); dat$y <- 0.3 * dat$x1 + 0.2 * dat$x2 + rnorm(80)',
      };
    },
    'mann-whitney': (m, raw, p, r) => rank(p, r, false),
    'signed-rank': (m, raw, p, r) => rank(p, r, true),
    proportions(m, raw, p, r) {
      return {
        packages: ['pwr'], check: 'exact', note: '',
        verify: `library(pwr)
h <- ${R(p.effect)}; alpha <- ${R(p.alpha)}; target <- ${R(p.power)}; alt <- "${alt(p.alternative)}"
${searchR}
power_at <- function(n) pwr.2p.test(h = h, n = n, sig.level = alpha, alternative = alt)$power
print(pwr.2p.test(h = h, sig.level = alpha, power = target, alternative = alt))
n <- sf_search(power_at, ceiling(pwr.2p.test(h = h, sig.level = alpha, power = target, alternative = alt)$n), 20)
sf_n <- 2 * n
sf_power <- power_at(${r.n})
${report}`,
        analysis: `# x1, x2 = participants with the event; n1, n2 = participants per group.
prop.test(c(x1, x2), c(n1, n2), correct = FALSE)`,
        simulate: 'x1 <- 60; x2 <- 45; n1 <- 100; n2 <- 100',
      };
    },
    'chi-square'(m, raw, p, r) {
      return {
        packages: ['pwr'], check: 'exact', note: '',
        verify: `library(pwr)
w <- ${R(p.effect)}; df <- ${p.df}; alpha <- ${R(p.alpha)}; target <- ${R(p.power)}
${searchR}
power_at <- function(N) pwr.chisq.test(w = w, N = N, df = df, sig.level = alpha)$power
print(pwr.chisq.test(w = w, df = df, sig.level = alpha, power = target))
sf_n <- sf_search(power_at, ceiling(pwr.chisq.test(w = w, df = df, sig.level = alpha, power = target)$N))
sf_power <- power_at(${r.total})
${report}`,
        analysis: `# dat: one row per observation; row and col are the two classifying factors.
chisq.test(table(dat$row, dat$col), correct = FALSE)`,
        simulate: 'dat <- data.frame(row = sample(c("a", "b"), 200, TRUE), col = sample(c("x", "y"), 200, TRUE))',
      };
    },
    'ni-proportions'(m, raw, p, r) {
      // gsDesign tests p1 − p2 > delta0. When lower is better, the non-event proportions are compared.
      const flip = p.direction < 0, p1 = flip ? 1 - p.p1 : p.p1, p2 = flip ? 1 - p.p2 : p.p2, d0 = flip ? -p.delta0 : p.delta0;
      return {
        packages: ['gsDesign'], check: 'exact', note: '',
        verify: `library(gsDesign)
${flip ? '# Lower proportions are better: compare the proportions WITHOUT the event, so higher is better.\n' : ''}p1 <- ${R(p1)}; p2 <- ${R(p2)}; delta0 <- ${R(d0)}; alpha <- ${R(p.alpha)}; target <- ${R(p.power)}
${searchR}
power_at <- function(n1, n2) nBinomial(p1 = p1, p2 = p2, delta0 = delta0, alpha = alpha, ratio = n2 / n1, sided = 1, scale = "Difference", n = n1 + n2)
# (a) Package total sample size (Farrington–Manning, ratio = reference / test):
print(nBinomial(p1 = p1, p2 = p2, delta0 = delta0, alpha = alpha, beta = 1 - target, ratio = ${R(p.ratio)}, sided = 1, scale = "Difference"))
n_equal <- ceiling(nBinomial(p1 = p1, p2 = p2, delta0 = delta0, alpha = alpha, beta = 1 - target, ratio = 1, sided = 1, scale = "Difference") / 2)
${twoGroupSearch(p.ratio)}
sf_power <- power_at(${r.n}, ${r.n2})
${report}`,
        analysis: `# x1, n1 = events and participants in the test group; x2, n2 in the reference group.
library(gsDesign)
testBinomial(x1 = x1, x2 = x2, n1 = n1, n2 = n2, delta0 = ${R(d0)})          # Z statistic; compare with qnorm(1 - ${R(p.alpha)})
ciBinomial(x1 = x1, x2 = x2, n1 = n1, n2 = n2, alpha = ${R(2 * p.alpha)})    # two-sided ${R(100 * (1 - 2 * p.alpha))}% CI for p1 - p2${flip ? '\n# Enter counts of participants WITHOUT the event, as in the verify code.' : ''}`,
        simulate: 'x1 <- 200; x2 <- 205; n1 <- 255; n2 <- 255',
      };
    },
    'log-rank'(m, raw, p, r, x) {
      const hr = Math.exp(-p.effect), q = p.allocation;
      const enrol = x.enrol ? `

# Enrolment step: a base R restatement of the app's exponential model, not a package check.
lambda <- c(${R(Math.LN2 / Number(raw.controlMedian))} * hr, ${R(Math.LN2 / Number(raw.controlMedian))})   # hazards: Group 1, Group 2
eta <- -log(1 - ${R(raw.loss)}); A <- ${R(raw.accrual)}; F <- ${R(raw.followUp)}
p_event <- sapply(lambda, function(l) { h <- l + eta; l / h * (1 - (exp(-h * F) - exp(-h * (A + F))) / (h * A)) })
sf_enrol <- ceiling(${r.total} / sum(c(q, 1 - q) * p_event) - 1e-9)
cat("Participants to enrol:", sf_enrol, "\\n")` : '';
      return {
        packages: ['gsDesign'], check: 'exact', note: '',
        verify: `library(gsDesign)
hr <- ${R(hr)}; q <- ${R(q)}; alpha <- ${R(p.alpha)}; target <- ${R(p.power)}
${searchR}
power_at <- function(D) nEvents(hr = hr, alpha = alpha, n = D, ratio = q / (1 - q), sided = 2, tbl = TRUE)$Power
print(nEvents(hr = hr, alpha = alpha, beta = 1 - target, ratio = q / (1 - q), sided = 2))   # Schoenfeld events
sf_n <- sf_search(power_at, ceiling(nEvents(hr = hr, alpha = alpha, beta = 1 - target, ratio = q / (1 - q), sided = 2)), 10)
sf_power <- power_at(${r.total})
${report}${enrol}`,
        analysis: `# dat: one row per participant; time = follow-up time, status = 1 for an event, 0 if censored;
# group = factor with two levels.
library(survival)
survdiff(Surv(time, status) ~ group, data = dat)            # log-rank test
summary(coxph(Surv(time, status) ~ group, data = dat))     # hazard ratio with 95% CI`,
        simulate: 'dat <- data.frame(group = factor(rep(c("A", "B"), each = 100))); dat$time <- rexp(200, ifelse(dat$group == "A", 0.04, 0.06)); dat$status <- as.integer(dat$time < 24); dat$time <- pmin(dat$time, 24)',
      };
    },
    'vaccine-efficacy'(m, raw, p, r, x) {
      const enrol = x.attackRate !== undefined ? `

# Cases to participants (the app's planning step, restated):
attack <- ${R(x.attackRate)}; lost <- ${R(x.nonEvaluable)}
per_participant <- (ratio * attack * (1 - ve) + attack) / (ratio + 1)
sf_enrol <- ceiling(ceiling(${r.total} / per_participant - 1e-9) / (1 - lost) - 1e-9)
cat("Participants to enrol:", sf_enrol, "\\n")` : '';
      return {
        packages: [], check: 'exact', note: '',
        verify: `# Exact conditional binomial test, written in base R independently of the app.
ve <- ${R(p.ve)}; ve0 <- ${R(p.ve0)}; ratio <- ${R(p.ratio)}; alpha <- ${R(p.alpha)}; target <- ${R(p.power)}
pi0 <- ratio * (1 - ve0) / (ratio * (1 - ve0) + 1); pi1 <- ratio * (1 - ve) / (ratio * (1 - ve) + 1)
power_at <- function(T) {
  c <- qbinom(alpha, T, pi0); if (pbinom(c, T, pi0) > alpha) c <- c - 1
  if (c < 0) 0 else pbinom(c, T, pi1)
}
# Smallest total after which power stays at or above the target for the next 100 totals:
pw <- sapply(1:(${r.total} + 200), power_at); sf_n <- NA
for (T in seq_along(pw)) if (T + 100 <= length(pw) && all(pw[T:(T + 100)] >= target)) { sf_n <- T; break }
sf_power <- power_at(${r.total})
${report}${enrol}`,
        analysis: `# x_vaccine = cases in the vaccine group; total_cases = cases in both groups.
pi0 <- ${R(p.ratio)} * (1 - ${R(p.ve0)}) / (${R(p.ratio)} * (1 - ${R(p.ve0)}) + 1)
test <- binom.test(x_vaccine, total_cases, p = pi0, alternative = "less")
test
# VE confidence limits from the two-sided ${R(100 * (1 - 2 * p.alpha))}% Clopper–Pearson interval for the vaccine share:
ci <- binom.test(x_vaccine, total_cases, conf.level = ${R(1 - 2 * p.alpha)})$conf.int
ve_limits <- 1 - ci / (${R(p.ratio)} * (1 - ci))   # VE = 1 - pi / (r (1 - pi))
rev(ve_limits)`,
        simulate: 'x_vaccine <- 40; total_cases <- 160',
      };
    },
    'negative-binomial'(m, raw, p, r) {
      const viaPackage = p.nullRatio === 1;
      const common = `rate0 <- ${R(p.rate0)}; RR <- ${R(p.rateRatio)}; k <- ${R(p.dispersion)}; t <- ${R(p.followUp)}; alpha <- ${R(p.alpha)}; target <- ${R(p.power)}`;
      return {
        packages: viaPackage ? ['MKpower'] : ['MASS'], check: viaPackage ? 'exact' : 'formula',
        note: viaPackage ? 'MKpower approach = 2 uses the variance at the planned rates for both terms, as the app does (Zhu and Lakatos method 1).' : 'With a null rate ratio other than 1, no package call matches; the code restates the Wald formula and adds a glm.nb() simulation.',
        verify: viaPackage ? `library(MKpower)
${common}
${searchR}
power_at <- function(n0, n1) power.nb.test(n = n0, mu0 = rate0, RR = RR, theta = 1 / k, duration = t, ssize.ratio = n1 / n0, sig.level = alpha, alternative = "one.sided", approach = 2)$power
print(power.nb.test(mu0 = rate0, RR = RR, theta = 1 / k, duration = t, ssize.ratio = ${R(p.ratio)}, sig.level = alpha, power = target, alternative = "one.sided", approach = 2))
n_equal <- ceiling(power.nb.test(mu0 = rate0, RR = RR, theta = 1 / k, duration = t, ssize.ratio = 1, sig.level = alpha, power = target, alternative = "one.sided", approach = 2)$n)
${twoGroupSearch(p.ratio)}
sf_power <- power_at(${r.n}, ${r.n2})
${report}` : `# Base R restatement of the app's Wald test on log RR (H0: RR >= RR0), then a glm.nb() simulation.
library(MASS)
${common}; RR0 <- ${R(p.nullRatio)}
${searchR}
power_at <- function(n0, n1) { V <- (1 / (rate0 * t) + k) / n0 + (1 / (rate0 * RR * t) + k) / n1; pnorm((log(RR0) - log(RR)) / sqrt(V) - qnorm(1 - alpha)) }
n_equal <- 2
${twoGroupSearch(p.ratio)}
sf_power <- power_at(${r.n}, ${r.n2})
set.seed(1989)
n0 <- ${r.n}; n1 <- ${r.n2}
sim <- replicate(400, {
  group <- rep(0:1, c(n0, n1)); mu <- rate0 * t * ifelse(group == 1, RR, 1)
  y <- rnbinom(n0 + n1, size = 1 / k, mu = mu)
  fit <- suppressWarnings(glm.nb(y ~ group))
  z <- (coef(fit)[["group"]] - log(RR0)) / sqrt(vcov(fit)["group", "group"])
  z < -qnorm(1 - alpha)
})
sf_sim <- mean(sim)
cat("Simulated power:", sf_sim, "\\n")
${report}`,
        analysis: `# dat: one row per participant; events = count, time = follow-up time, group = factor (reference level first).
library(MASS)
fit <- glm.nb(events ~ group + offset(log(time)), data = dat)
summary(fit)
exp(cbind(rate_ratio = coef(fit), confint.default(fit, level = ${R(1 - 2 * p.alpha)})))   # two-sided ${R(100 * (1 - 2 * p.alpha))}% CI`,
        simulate: 'dat <- data.frame(group = factor(rep(c("control", "treatment"), each = 100)), time = 1); dat$events <- rnbinom(200, size = 2, mu = ifelse(dat$group == "control", 0.8, 0.6))',
      };
    },
    bonferroni(m, raw, p, r) {
      return {
        packages: ['pwr'], check: 'exact', note: '',
        verify: `library(pwr)
d <- ${R(p.effect)}; m <- ${p.comparisons}; alpha <- ${R(p.alpha)}; target <- ${R(p.power)}; alt <- "${alt(p.alternative)}"
${searchR}
power_at <- function(n) pwr.t.test(n = n, d = d, sig.level = alpha / m, type = "two.sample", alternative = alt)$power
print(pwr.t.test(d = d, sig.level = alpha / m, power = target, type = "two.sample", alternative = alt))
n <- sf_search(power_at, ceiling(pwr.t.test(d = d, sig.level = alpha / m, power = target, type = "two.sample", alternative = alt)$n))
sf_n <- 2 * n
sf_power <- power_at(${r.n})
${report}`,
        analysis: `# p_values: the ${p.comparisons} raw p-values of the prespecified comparisons, in a fixed order.
p.adjust(p_values, method = "bonferroni")   # reject where the adjusted p-value is at most ${R(p.alpha)}`,
        simulate: 'p_values <- c(0.001, 0.02, 0.2, 0.04, 0.5)',
      };
    },
    'non-inferiority'(m, raw, p, r) {
      // Canonical orientation: higher is better. PowerTOST reads margin < 0 as "higher is better".
      return {
        packages: ['PowerTOST'], check: 'exact', note: '',
        verify: `library(PowerTOST)
# On the SD scale (CV = 1): margin and expected difference in SD units, higher is better.
margin <- ${R(-p.margin)}; theta0 <- ${R(p.direction * p.effect)}; alpha <- ${R(p.alpha)}; target <- ${R(p.power)}
${searchR}
power_at <- function(n) power.noninf(alpha = alpha, logscale = FALSE, margin = margin, theta0 = theta0, CV = 1, n = 2 * n, design = "parallel")
print(sampleN.noninf(alpha = alpha, targetpower = target, logscale = FALSE, margin = margin, theta0 = theta0, CV = 1, design = "parallel", print = FALSE))
n <- sf_search(power_at, sampleN.noninf(alpha = alpha, targetpower = target, logscale = FALSE, margin = margin, theta0 = theta0, CV = 1, design = "parallel", print = FALSE)[["Sample size"]] / 2)
sf_n <- 2 * n
sf_power <- power_at(${r.n})
${report}`,
        analysis: `# dat: one row per participant; y = outcome, group = factor with levels "reference", "test".
dat$group <- relevel(factor(dat$group), ref = "test")   # t.test compares the first level minus the second
t.test(y ~ group, data = dat, var.equal = TRUE, mu = ${raw.benefit === 'lower' ? '' : '-'}margin, alternative = "${raw.benefit === 'lower' ? 'less' : 'greater'}")
# margin = the allowed loss in original units (${raw.mode === 'means' ? R(raw.marginRaw) : 'set it'}).`,
        simulate: `dat <- data.frame(group = rep(c("test", "reference"), each = 40)); dat$y <- rnorm(80, 100, 1); margin <- ${raw.mode === 'means' ? R(raw.marginRaw) : '0.5'}`,
      };
    },
    tost(m, raw, p, r) {
      return {
        packages: ['PowerTOST'], check: 'exact', note: '',
        verify: `library(PowerTOST)
# On the SD scale (CV = 1): expected difference and bounds in SD units.
theta0 <- ${R(p.effect)}; theta1 <- ${R(p.lower)}; theta2 <- ${R(p.upper)}; alpha <- ${R(p.alpha)}; target <- ${R(p.power)}
${searchR}
power_at <- function(n) power.TOST(alpha = alpha, logscale = FALSE, theta0 = theta0, theta1 = theta1, theta2 = theta2, CV = 1, n = 2 * n, design = "parallel")
print(sampleN.TOST(alpha = alpha, targetpower = target, logscale = FALSE, theta0 = theta0, theta1 = theta1, theta2 = theta2, CV = 1, design = "parallel", print = FALSE))
n <- sf_search(power_at, sampleN.TOST(alpha = alpha, targetpower = target, logscale = FALSE, theta0 = theta0, theta1 = theta1, theta2 = theta2, CV = 1, design = "parallel", print = FALSE)[["Sample size"]] / 2)
sf_n <- 2 * n
sf_power <- power_at(${r.n})
${report}`,
        analysis: `# dat: one row per participant; y = outcome, group = factor with levels "test", "reference".
dat$group <- relevel(factor(dat$group), ref = "test")
ci <- t.test(y ~ group, data = dat, var.equal = TRUE, conf.level = ${R(1 - 2 * p.alpha)})$conf.int
ci   # equivalence if the whole interval lies inside (lower, upper)
lower <- ${raw.mode === 'means' ? R(raw.lowerRaw) : 'NA   # set the lower limit'}
upper <- ${raw.mode === 'means' ? R(raw.upperRaw) : 'NA   # set the upper limit'}
ci[1] > lower && ci[2] < upper`,
        simulate: 'dat <- data.frame(group = rep(c("test", "reference"), each = 40)); dat$y <- rnorm(80, 100, 1)',
      };
    },
    'tost-lognormal': (m, raw, p, r) => lognormalTost(p, r, 'parallel'),
    'tost-crossover': (m, raw, p, r) => lognormalTost(p, r, '2x2'),
  };

  function oneT(p, r, type, analysis, simulate) {
    return {
      packages: ['pwr'], check: 'exact', note: '', analysis, simulate,
      verify: `library(pwr)
d <- ${R(p.effect)}; alpha <- ${R(p.alpha)}; target <- ${R(p.power)}; alt <- "${alt(p.alternative)}"
${searchR}
power_at <- function(n) pwr.t.test(n = n, d = d, sig.level = alpha, type = "${type}", alternative = alt)$power
print(pwr.t.test(d = d, sig.level = alpha, power = target, type = "${type}", alternative = alt))
sf_n <- sf_search(power_at, ceiling(pwr.t.test(d = d, sig.level = alpha, power = target, type = "${type}", alternative = alt)$n))
sf_power <- power_at(${r.n})
${report}`,
    };
  }

  function rank(p, r, paired) {
    const theta = p.effect + 0.5, mult = paired ? 3 : 6, lo = 20;
    return {
      packages: [], check: 'formula',
      // Measured by npm run check:r: Noether's formula sits about 3 points below the simulated
      // Mann–Whitney power under a normal shift (2 points or less for the signed-rank test).
      simTolerance: paired ? 0.02 : 0.04,
      note: paired
        ? 'No CRAN package implements Noether’s formula for this effect measure. The code restates it and simulates the exact test under normal paired differences with the same θ.'
        : 'No CRAN package implements Noether’s formula. The code restates it and simulates the test under a normal shift with the same θ; the simulated power is about 3 percentage points higher, so the formula is conservative there.',
      verify: `# Base R restatement of Noether's large-sample formula, then a simulation with wilcox.test().
theta <- ${R(theta)}; alpha <- ${R(p.alpha)}; target <- ${R(p.power)}; alt <- "${alt(p.alternative)}"
${searchR}
power_at <- function(n) {
  shift <- (theta - 0.5) * sqrt(${mult} * n)
  if (alt == "two.sided") pnorm(shift - qnorm(1 - alpha / 2)) + pnorm(-shift - qnorm(1 - alpha / 2))
  else if (alt == "greater") pnorm(shift - qnorm(1 - alpha)) else pnorm(-shift - qnorm(1 - alpha))
}
sf_n <- ${paired ? '' : '2 * '}sf_search(power_at, ${lo}, ${lo})
sf_power <- power_at(${r.n})
# Simulation at the app's size: ${paired ? 'normal paired differences with P(D1 + D2 > 0) = theta' : 'two normal groups with P(X1 > X2) = theta'}.
set.seed(1989)
n <- ${r.n}; shift <- ${paired ? 'qnorm(theta) / sqrt(2)' : 'sqrt(2) * qnorm(theta)'}
sim <- replicate(2000, ${paired ? 'wilcox.test(rnorm(n, shift), alternative = alt, exact = FALSE)$p.value' : 'wilcox.test(rnorm(n, shift), rnorm(n), alternative = alt, exact = FALSE)$p.value'} < alpha)
sf_sim <- mean(sim)
cat("Simulated power:", sf_sim, "\\n")
${report}`,
      analysis: paired
        ? `# dat: one row per pair; before and after measured on the same unit.
wilcox.test(dat$after, dat$before, paired = TRUE)`
        : `# dat: one row per participant; y = outcome (ordinal or continuous), group = factor with two levels.
wilcox.test(y ~ group, data = dat)`,
      simulate: paired ? 'dat <- data.frame(before = rnorm(30)); dat$after <- dat$before + rnorm(30, 0.5)' : 'dat <- data.frame(group = factor(rep(c("A", "B"), each = 30)), y = c(rnorm(30, 0.5), rnorm(30)))',
    };
  }

  function lognormalTost(p, r, design) {
    const gmr = Math.exp(p.effect * p.sigma), lower = Math.exp(p.lower * p.sigma), upper = Math.exp(p.upper * p.sigma), cv = Math.sqrt(Math.expm1(p.sigma * p.sigma));
    const crossover = design === '2x2';
    return {
      packages: ['PowerTOST'], check: 'exact', note: '',
      verify: `library(PowerTOST)
theta0 <- ${R(gmr)}; theta1 <- ${R(lower)}; theta2 <- ${R(upper)}; CV <- ${R(cv)}   # ${crossover ? 'within-subject' : 'total'} CV
alpha <- ${R(p.alpha)}; target <- ${R(p.power)}
${searchR}
power_at <- function(n) power.TOST(alpha = alpha, theta0 = theta0, theta1 = theta1, theta2 = theta2, CV = CV, n = 2 * n, design = "${design}")
print(sampleN.TOST(alpha = alpha, targetpower = target, theta0 = theta0, theta1 = theta1, theta2 = theta2, CV = CV, design = "${design}", print = FALSE))
n <- sf_search(power_at, sampleN.TOST(alpha = alpha, targetpower = target, theta0 = theta0, theta1 = theta1, theta2 = theta2, CV = CV, design = "${design}", print = FALSE)[["Sample size"]] / 2)
sf_n <- 2 * n   # ${crossover ? 'n subjects per sequence' : 'n per group'}
sf_power <- power_at(${r.n})
${report}`,
      analysis: crossover
        ? `# dat: one row per subject and period; y = PK parameter (e.g. AUC), subject, sequence ("TR"/"RT"),
# period (1/2) and treatment ("T"/"R") as factors.
dat[c("subject", "sequence", "period", "treatment")] <- lapply(dat[c("subject", "sequence", "period", "treatment")], factor)
dat$treatment <- relevel(dat$treatment, ref = "R")
fit <- lm(log(y) ~ sequence + subject + period + treatment, data = dat)
exp(confint(fit, "treatmentT", level = ${R(1 - 2 * p.alpha)}))   # bioequivalence if inside ${R(lower)}–${R(upper)}`
        : `# dat: one row per participant; y = PK parameter (e.g. AUC), group = factor with levels "T", "R".
dat$group <- relevel(factor(dat$group), ref = "T")
exp(t.test(log(y) ~ group, data = dat, var.equal = TRUE, conf.level = ${R(1 - 2 * p.alpha)})$conf.int)   # inside ${R(lower)}–${R(upper)}?`,
      simulate: crossover
        ? 'ids <- 1:24; seq <- rep(c("TR", "RT"), each = 12); dat <- data.frame(subject = rep(ids, 2), sequence = rep(seq, 2), period = rep(1:2, each = 24)); dat$treatment <- ifelse((dat$sequence == "TR") == (dat$period == 1), "T", "R"); dat$y <- exp(rnorm(48, 4 + 0.1 * (dat$treatment == "T"), 0.2) + rep(rnorm(24, 0, 0.3), 2))'
        : 'dat <- data.frame(group = rep(c("T", "R"), each = 30)); dat$y <- exp(rnorm(60, 4, 0.3))',
    };
  }

  // Bell and Towel: gsDesign with the same spending functions; bounds compared to 1e-3.
  const spendR = { obf: 'sfLDOF', pocock: 'sfLDPocock', power: 'sfPower', hsd: 'sfHSD' };
  function sequential(m, raw, p, r) {
    const k = p.fractions.length, futility = Boolean(p.futility);
    const sfu = `sfu = ${spendR[p.spending]}${['power', 'hsd'].includes(p.spending) ? `, sfupar = ${R(p.spendingParameter)}` : ''}`;
    const sfl = futility ? `, sfl = ${spendR[p.futilitySpending]}${['power', 'hsd'].includes(p.futilitySpending) ? `, sflpar = ${R(p.futilityParameter)}` : ''}` : '';
    return {
      packages: ['gsDesign'], check: 'close',
      note: 'gsDesign uses its own integration grid; boundaries agree with the app to about 1e-6 and the maximum size after the app’s rounding is the same.',
      verify: `library(gsDesign)
alpha <- ${R(p.alpha)}; target <- ${R(p.power)}; timing <- c(${p.fractions.map(R).join(', ')})
# Fixed-design size: ${raw.mode === 'effect' ? 'participants for a two-sample z-test of this standardised effect' : raw.mode === 'hazard' ? 'Schoenfeld events for this hazard ratio' : 'as entered'}.
n_fix <- ${R(p.fixedSize)}
g <- gsDesign(k = ${k}, test.type = ${futility ? 4 : 1}, alpha = alpha, beta = 1 - target, timing = timing, n.fix = n_fix, ${sfu}${sfl})
print(g)
cat("Efficacy bounds (Z):", round(g$upper$bound, 4), "\\n")${futility ? '\ncat("Futility bounds (Z):", round(g$lower$bound, 4), "\\n")' : ''}
sf_n <- ${p.evenTotal ? '2 * ceiling(g$n.I[' + k + '] / 2 - 1e-9)   # even total for two equal groups' : `ceiling(g$n.I[${k}] - 1e-9)`}
N <- ${r.total}
pr <- gsProbability(k = ${k}, theta = g$delta, n.I = N * timing, a = ${futility ? 'g$lower$bound' : `rep(-20, ${k})`}, b = g$upper$bound)
sf_power <- sum(pr$upper$prob[, 1])
sf_bounds <- g$upper$bound
${report}`,
      analysis: `# At each completed look, compute the Z statistic for the treatment effect from the data so far
# (e.g. a two-sample t or log-rank Z, oriented so that benefit is positive), then call check_looks().
library(gsDesign)
n_max <- ${r.total}   # planned maximum (participants or events)
check_looks <- function(n_observed, z_observed) {
  # Boundaries for the information actually reached, with the same spending functions:
  timing_actual <- c(n_observed / n_max, 1)
  g_actual <- gsDesign(k = length(timing_actual), test.type = ${futility ? 4 : 1}, alpha = ${R(p.alpha)}, beta = ${R(1 - p.power)}, timing = timing_actual, n.fix = ${R(p.fixedSize)}, ${sfu}${sfl})
  looks <- seq_along(z_observed)
  data.frame(look = looks, information = n_observed, z = z_observed,
    efficacy_bound = g_actual$upper$bound[looks], stop_for_efficacy = z_observed >= g_actual$upper$bound[looks]${futility ? ',\n    futility_bound = g_actual$lower$bound[looks], futility_advised = z_observed < g_actual$lower$bound[looks]' : ''})
}
# check_looks(n_observed = c(...), z_observed = c(...))`,
      simulate: '',
      exercise: `print(check_looks(c(${r.looks.slice(0, -1).map(R).join(', ')}), c(${r.looks.slice(0, -1).map(() => '1.5').join(', ')})))`,
    };
  }
  builders['gsd-efficacy'] = sequential;
  builders['gsd-futility'] = sequential;

  const statusText = (s, names) => s.check === 'exact'
    ? `Checked against ${names} on ${checkedOn}: same sample size and power.`
    : s.check === 'close' ? `Checked: same model, small differences. ${s.note}`
    : 'No package implements this model. The code restates the formula and adds a simulation.';

  // extras: { disclaimer, enrol (log-rank enrolment shown), attackRate, nonEvaluable }
  function snippets(m, raw, p, r, extras = {}) {
    const build = builders[m.id];
    if (!build) throw new Error(`No R code for ${m.id}.`);
    const s = build(m, raw, p, r, extras);
    const installs = s.packages.filter(pkg => !['MASS', 'survival'].includes(pkg));
    const analysisPackages = [...new Set([...s.analysis.matchAll(/library\((\w+)\)/g)].map(x => x[1]))].filter(pkg => !['MASS', 'survival'].includes(pkg));
    const disclaimer = extras.disclaimer ?? '';
    const names = s.packages.length ? s.packages.map(pkg => `${pkg} ${versions[pkg] ?? ''}`.trim()).join(', ') : 'base R';
    return {
      verify: header(m, r, disclaimer, installs) + s.verify,
      analysis: `# ${m.name} · analysis of the study data\n# ${disclaimer}\n${analysisPackages.map(pkg => `# install.packages("${pkg}")\n`).join('')}\n${s.analysis}`,
      simulate: s.simulate, exercise: s.exercise ?? '', simTolerance: s.simTolerance ?? 0.02, packages: s.packages, check: s.check, note: s.note, status: statusText(s, names),
    };
  }
  // The method-level status used by the protocol text (inputs can only make it stricter).
  const check = id => ({ ancova: 'formula', 'mann-whitney': 'formula', 'signed-rank': 'formula', 'gsd-efficacy': 'close', 'gsd-futility': 'close' }[id] ?? (builders[id] ? 'exact' : undefined));

  const rcode = { snippets, check, checkedOn, versions };
  if (typeof module !== 'undefined') module.exports = rcode;
  else globalThis.StatFighter.rcode = rcode;
}
