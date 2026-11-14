# Independent base-R references for the arcade-interface staples:
#   Switch  (2x2 crossover TOST, log scale), Anchor (two-group ANCOVA),
#   Welch   (Maverick's unequal-variance mode), Parry (Farrington-Manning NI for two proportions).
# No JavaScript and no add-on packages are used. Run from the project root:
#   Rscript tests/reference/generate-arcade.R
options(digits = 17)
half_up <- function(x) floor(x + 0.5)
cap <- 1e6

first_n <- function(evaluate, target, minimum = 2) {
  lo <- minimum - 1; hi <- minimum
  while (evaluate(hi) < target && hi < cap) { lo <- hi; hi <- min(cap, hi * 2) }
  if (evaluate(hi) < target) return(NA_real_)
  while (hi - lo > 1) { mid <- floor((hi + lo) / 2); if (evaluate(mid) < target) lo <- mid else hi <- mid }
  hi
}

# ---- Switch: 2x2 crossover TOST ------------------------------------------------------------
# Total N = 2m (m per sequence), df = N - 2, SE of the log difference = sigma_w * sqrt(2 / N).
# Joint TOST power: normal interval probability conditional on the pooled variance, integrated
# against the chi-square density of the variance (exact; equivalent to Owen's Q).
tost_power <- function(se, df, delta, lower, upper, alpha) {
  critical <- qt(alpha, df, lower.tail = FALSE)
  vmax <- df * ((upper - lower) / (2 * critical * se))^2
  lo <- qchisq(1e-14, df); hi <- min(vmax, qchisq(1 - 1e-14, df))
  if (hi <= lo) return(0)
  integrate(function(v) {
    a <- (lower - delta) / se + critical * sqrt(v / df)
    b <- (upper - delta) / se - critical * sqrt(v / df)
    interval <- ifelse(a > 0, pnorm(a, lower.tail = FALSE) - pnorm(b, lower.tail = FALSE), pnorm(b) - pnorm(a))
    pmax(0, interval) * dchisq(v, df)
  }, lo, hi, rel.tol = 1e-11, abs.tol = 1e-13, subdivisions = 2000)$value
}
crossover <- list()
add_crossover <- function(gmr, cv, lowerRatio, upperRatio, alpha, target) {
  sigma <- sqrt(log1p(cv^2))
  evaluate <- function(m) tost_power(sigma * sqrt(2 / (2 * m)), 2 * m - 2, log(gmr), log(lowerRatio), log(upperRatio), alpha)
  m <- first_n(evaluate, target)
  if (is.na(m) || 2 * m > cap) return(invisible(NULL))
  crossover[[length(crossover) + 1]] <<- data.frame(gmr = gmr, cv = cv, lowerRatio = lowerRatio, upperRatio = upperRatio,
    alpha = alpha, target = target, n = m, total = 2 * m, achieved = evaluate(m), previous = if (m > 2) evaluate(m - 1) else NA_real_)
}
grid <- expand.grid(cv = c(.1, .2, .3, .5), gmr = c(.9, .95, 1, 1.05), bounds = c('standard', 'wide'), alpha = c(.025, .05), target = c(.8, .9), stringsAsFactors = FALSE)
for (i in seq_len(nrow(grid))) {
  v <- grid[i, ]
  if (v$bounds == 'standard') add_crossover(v$gmr, v$cv, .8, 1.25, v$alpha, v$target) else add_crossover(v$gmr, v$cv, .7, 1.43, v$alpha, v$target)
}
# PowerTOST documentation example: sampleN.TOST(CV = 0.3, theta0 = 0.95), design 2x2 -> N 40, power 0.815845.
add_crossover(.95, .3, .8, 1.25, .05, .8)
add_crossover(1, .05, .8, 1.25, .05, .8)   # minimum design (2 per sequence)
add_crossover(.95, 1.2, .8, 1.25, .05, .99) # very variable, high target

# ---- Anchor: ANCOVA, Welch: unequal variances ---------------------------------------------
t_power <- function(df, ncp, alpha, alternative) {
  if (alternative == 'two-sided') {
    critical <- qt(alpha / 2, df, lower.tail = FALSE)
    pt(critical, df, ncp = ncp, lower.tail = FALSE) + pt(-critical, df, ncp = ncp)
  } else pt(qt(alpha, df, lower.tail = FALSE), df, ncp = ncp, lower.tail = FALSE)
}
ancova <- list()
add_ancova <- function(effect, correlation, covariates, ratio, alpha, target, alternative) {
  second <- function(n) max(2, half_up(n * ratio))
  evaluate <- function(n) { n2 <- second(n); t_power(n + n2 - 2 - covariates, abs(effect) / sqrt(1 - correlation^2) / sqrt(1 / n + 1 / n2), alpha, alternative) }
  minimum <- 2; while (minimum + second(minimum) - 2 - covariates < 1) minimum <- minimum + 1
  n <- first_n(evaluate, target, minimum)
  if (is.na(n) || n + second(n) > cap) return(invisible(NULL))
  ancova[[length(ancova) + 1]] <<- data.frame(effect = effect, correlation = correlation, covariates = covariates, ratio = ratio,
    alpha = alpha, target = target, alternative = alternative, n = n, n2 = second(n), total = n + second(n),
    achieved = evaluate(n), previous = if (n > minimum) evaluate(n - 1) else NA_real_, minimum = minimum)
}
grid <- expand.grid(effect = c(.3, .8), correlation = c(0, .5, .9), covariates = c(1, 3), ratio = c(1, .5, 2), alpha = .05, target = c(.8, .95), alternative = c('two-sided', 'greater'), stringsAsFactors = FALSE)
for (i in seq_len(nrow(grid))) with(grid[i, ], add_ancova(effect, correlation, covariates, ratio, alpha, target, alternative))
add_ancova(-.5, .6, 1, 1, .01, .9, 'less')
add_ancova(-.5, .6, 1, 1, .01, .9, 'two-sided')
add_ancova(5, .95, 10, 1, .2, .5, 'two-sided') # minimum-size corner: df must stay positive

welch <- list()
add_welch <- function(effect, sdRatio, ratio, alpha, target, alternative) {
  second <- function(n) max(2, half_up(n * ratio))
  evaluate <- function(n) {
    n2 <- second(n); a <- 1 / n; b <- sdRatio^2 / n2
    t_power((a + b)^2 / (a^2 / (n - 1) + b^2 / (n2 - 1)), abs(effect) / sqrt(a + b), alpha, alternative)
  }
  n <- first_n(evaluate, target)
  if (is.na(n) || n + second(n) > cap) return(invisible(NULL))
  welch[[length(welch) + 1]] <<- data.frame(effect = effect, sdRatio = sdRatio, ratio = ratio, alpha = alpha, target = target,
    alternative = alternative, n = n, n2 = second(n), total = n + second(n), achieved = evaluate(n), previous = if (n > 2) evaluate(n - 1) else NA_real_)
}
grid <- expand.grid(effect = c(.3, .8), sdRatio = c(.5, 1, 2), ratio = c(1, .5, 2), alpha = c(.05, .01), target = c(.8, .9), alternative = c('two-sided', 'greater'), stringsAsFactors = FALSE)
for (i in seq_len(nrow(grid))) with(grid[i, ], add_welch(effect, sdRatio, ratio, alpha, target, alternative))
add_welch(-.6, 3, 1.5, .05, .8, 'less')
add_welch(4, .25, 1, .2, .5, 'two-sided')

# ---- Parry: Farrington-Manning non-inferiority / superiority by a margin --------------------
# Null: p1 - p2 = delta0 (p1 Test, p2 Reference). The restricted MLE under the null is found by
# solving the binomial score equation with uniroot, not the published closed-form cubic.
restricted <- function(p1, p2, n1, n2, delta0) {
  if (delta0 == 0) return((n1 * p1 + n2 * p2) / (n1 + n2))
  score <- function(x) n1 * (p1 - x) / (x * (1 - x)) + n2 * (p2 - (x - delta0)) / ((x - delta0) * (1 - x + delta0))
  lo <- max(0, delta0); hi <- min(1, 1 + delta0); eps <- 1e-15
  uniroot(score, c(lo + eps, hi - eps), tol = 1e-15, maxiter = 10000)$root
}
fm_power <- function(p1, p2, n1, n2, delta0, direction, alpha) {
  x <- restricted(p1, p2, n1, n2, delta0); y <- x - delta0
  v0 <- x * (1 - x) / n1 + y * (1 - y) / n2
  v1 <- p1 * (1 - p1) / n1 + p2 * (1 - p2) / n2
  pnorm((direction * (p1 - p2 - delta0) - qnorm(alpha, lower.tail = FALSE) * sqrt(v0)) / sqrt(v1))
}
parry <- list()
add_parry <- function(p1, p2, margin, hypothesis, direction, ratio, alpha, target) {
  if (p1 <= 0 || p1 >= 1) return(invisible(NULL))
  delta0 <- if (hypothesis == 'non-inferiority') -direction * margin else direction * margin
  if (direction * (p1 - p2 - delta0) < .001) return(invisible(NULL))
  second <- function(n) max(2, half_up(n * ratio))
  evaluate <- function(n) fm_power(p1, p2, n, second(n), delta0, direction, alpha)
  n <- first_n(evaluate, target)
  if (is.na(n) || n + second(n) > cap) return(invisible(NULL))
  parry[[length(parry) + 1]] <<- data.frame(p1 = p1, p2 = p2, margin = margin, hypothesis = hypothesis, direction = direction, ratio = ratio,
    alpha = alpha, target = target, n = n, n2 = second(n), total = n + second(n), achieved = evaluate(n), previous = if (n > 2) evaluate(n - 1) else NA_real_)
}
grid <- expand.grid(p2 = c(.2, .5, .8, .9), shift = c(-.02, 0, .03), margin = c(.05, .1, .15), ratio = c(1, 2), alpha = .025, target = c(.8, .9), direction = c(1, -1))
for (i in seq_len(nrow(grid))) with(grid[i, ], add_parry(p2 + direction * shift, p2, margin, 'non-inferiority', direction, ratio, alpha, target))
grid <- expand.grid(p2 = c(.3, .6), shift = c(.1, .15), margin = c(0, .05), direction = c(1, -1), target = c(.8, .9))
for (i in seq_len(nrow(grid))) with(grid[i, ], add_parry(p2 + direction * shift, p2, margin, 'superiority', direction, 1, .025, target))
add_parry(.5, .5, .2, 'non-inferiority', 1, 1, .2, .5)    # near-minimum
add_parry(.97, .97, .02, 'non-inferiority', 1, .5, .01, .95) # near the boundary of the unit interval

write_csv <- function(rows, file) write.table(do.call(rbind, rows), file, sep = ',', quote = FALSE, row.names = FALSE, na = '')
write_csv(crossover, 'tests/reference/crossover.csv')
write_csv(ancova, 'tests/reference/ancova.csv')
write_csv(welch, 'tests/reference/welch.csv')
write_csv(parry, 'tests/reference/ni-proportions.csv')

# ---- Simulation spot-checks of the ANCOVA approximation (recorded, not tested) ---------------
set.seed(1989)
simulate_ancova <- function(effect, correlation, n, reps = 20000, alpha = .05) {
  group <- rep(0:1, each = n)
  mean(replicate(reps, {
    baseline <- rnorm(2 * n)
    outcome <- effect * group + correlation * baseline + sqrt(1 - correlation^2) * rnorm(2 * n)
    summary(lm(outcome ~ group + baseline))$coefficients['group', 4] < alpha
  }))
}
sims <- sapply(list(c(.5, .5, 48), c(.5, .7, 33), c(.8, .3, 20)), function(v) {
  approx <- t_power(2 * v[3] - 3, v[1] / sqrt(1 - v[2]^2) / sqrt(2 / v[3]), .05, 'two-sided')
  sprintf('d=%.1f rho=%.1f n=%d/group: approximation %.4f, simulation %.4f (20000 reps)', v[1], v[2], v[3], approx, simulate_ancova(v[1], v[2], v[3]))
})

writeLines(c(R.version.string, paste('stats', packageVersion('stats')), paste('Generated:', Sys.Date()),
  'Generator tests/reference/generate-arcade.R; base R only, no JavaScript.',
  sprintf('crossover.csv %d cases; ancova.csv %d; welch.csv %d; ni-proportions.csv %d.', length(crossover), length(ancova), length(welch), length(parry)),
  'Crossover TOST (Switch): 2x2 balanced sequences, total N = 2m, df = N - 2, se = sqrt(log(1 + CV^2)) * sqrt(2 / N); joint power by integrate() over dchisq, as in generate-equivalence.R.',
  'PowerTOST documentation example sampleN.TOST(CV = 0.3, theta0 = 0.95, design = "2x2"): N 40, power 0.815845 (PowerTOST not installed; value from its manual).',
  'ANCOVA (Anchor): noncentral t, df = N - 2 - q, ncp = |d| / sqrt(1 - R^2) / sqrt(1/n1 + 1/n2); approximate (ignores the variance of the estimated covariate slope).',
  'Welch (Maverick): noncentral t with Satterthwaite df from population SDs, ncp = |delta| / sqrt(sd1^2/n1 + sd2^2/n2); approximate.',
  'Farrington-Manning (Parry): restricted MLE by uniroot on the binomial score equation; power = pnorm((s(p1 - p2 - delta0) - z_alpha sqrt(V0)) / sqrt(V1)); approximate.',
  'Allocation n2 = max(2, floor(n1 * ratio + 0.5)); cap 1,000,000 total; cases over the cap are excluded.',
  'ANCOVA simulation spot-checks (lm with one baseline covariate):', sims), 'tests/reference/arcade-provenance.txt')
