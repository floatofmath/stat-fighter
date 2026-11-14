# Independent R references for the last wave of fighters:
#   Jab     (vaccine efficacy, exact conditional binomial test on cases),
#   Scatter (negative binomial rate ratio, Wald test on the log rate ratio),
#   Bell    (group sequential design, efficacy stopping) and
#   Towel   (group sequential design, efficacy and non-binding futility).
# Base R plus mvtnorm (Miwa algorithm, deterministic) for the multivariate normal probabilities;
# MASS::glm.nb only for the recorded simulation spot-checks. No JavaScript is used.
#   Rscript tests/reference/generate-sequential.R
options(digits = 17)
suppressMessages({ library(mvtnorm); library(MASS) })
half_up <- function(x) floor(x + 0.5)
cap <- 1e6
write_csv <- function(rows, file) write.table(do.call(rbind, rows), file, sep = ',', quote = FALSE, row.names = FALSE, na = '')

# ---- Jab: exact conditional test on the vaccine share of cases --------------------------------
# Given T cases, vaccine-arm cases X ~ Bin(T, pi), pi = r(1 - VE) / (r(1 - VE) + 1), r = vaccine:placebo.
# H0: VE <= VE0. Reject when X <= c, c the largest count with P(X <= c | VE0) <= alpha.
window <- 100
jab_eval <- function(T, ve, ve0, r, alpha) {
  p0 <- r * (1 - ve0) / (r * (1 - ve0) + 1); p1 <- r * (1 - ve) / (r * (1 - ve) + 1)
  c <- qbinom(alpha, T, p0); if (pbinom(c, T, p0) > alpha) c <- c - 1
  list(c = c, power = if (c < 0) 0 else pbinom(c, T, p1), size = if (c < 0) 0 else pbinom(c, T, p0))
}
jab <- list()
add_jab <- function(ve, ve0, r, alpha, target) {
  power <- numeric(0); first <- NA; stable <- NA; T <- 0
  repeat {
    T <- T + 1; e <- jab_eval(T, ve, ve0, r, alpha); power[T] <- e$power
    if (e$power >= target) { if (is.na(first)) first <- T; if (is.na(stable)) stable <- T; if (T - stable >= window) break }
    else stable <- NA
    if (T > 20000) return(invisible(NULL))
  }
  s <- jab_eval(stable, ve, ve0, r, alpha); f <- jab_eval(first, ve, ve0, r, alpha)
  jab[[length(jab) + 1]] <<- data.frame(ve = ve, ve0 = ve0, ratio = r, alpha = alpha, target = target,
    first = first, firstPower = f$power, total = stable, critical = s$c, achieved = s$power, size = s$size,
    boundaryVE = 1 - (s$c / (stable - s$c)) / r, previous = if (stable > 1) power[stable - 1] else NA_real_)
}
grid <- expand.grid(ve = c(.5, .6, .7, .8, .9), ve0 = c(0, .3), ratio = c(1, 2), alpha = .025, target = c(.8, .9))
for (i in seq_len(nrow(grid))) with(grid[i, ], if (ve > ve0) add_jab(ve, ve0, ratio, alpha, target))
add_jab(.6, .3, 1, .05, .9); add_jab(.95, .3, 3, .025, .9); add_jab(.5, .3, 1, .025, .9)
write_csv(jab, 'tests/reference/vaccine.csv')

# ---- Scatter: negative binomial, Wald test on log rate ratio ----------------------------------
# Var(log RR-hat) = (1/n0)(1/(mu0 t) + k) + (1/n1)(1/(mu1 t) + k), variance at the planned rates
# (Zhu and Lakatos 2014, method 1; Keene et al. 2007). One-sided H0: RR >= RR0 against RR < RR0.
nb_power <- function(n0, n1, mu0, rr, k, t, rr0, alpha) {
  mu1 <- mu0 * rr; v <- (1 / (mu0 * t) + k) / n0 + (1 / (mu1 * t) + k) / n1
  pnorm((log(rr0) - log(rr)) / sqrt(v) - qnorm(alpha, lower.tail = FALSE))
}
first_n <- function(evaluate, target, minimum = 2) {
  lo <- minimum - 1; hi <- minimum
  while (evaluate(hi) < target && hi < cap) { lo <- hi; hi <- min(cap, hi * 2) }
  if (evaluate(hi) < target) return(NA_real_)
  while (hi - lo > 1) { mid <- floor((hi + lo) / 2); if (evaluate(mid) < target) lo <- mid else hi <- mid }
  hi
}
nb <- list()
add_nb <- function(mu0, rr, k, t, ratio, rr0, alpha, target) {
  second <- function(n) max(2, half_up(n * ratio))
  evaluate <- function(n) nb_power(n, second(n), mu0, rr, k, t, rr0, alpha)
  n <- first_n(evaluate, target); if (is.na(n) || n + second(n) > cap) return(invisible(NULL))
  nb[[length(nb) + 1]] <<- data.frame(mu0 = mu0, rr = rr, k = k, t = t, ratio = ratio, rr0 = rr0, alpha = alpha, target = target,
    n = n, n2 = second(n), total = n + second(n), achieved = evaluate(n), previous = if (n > 2) evaluate(n - 1) else NA_real_)
}
grid <- expand.grid(mu0 = c(.5, 1, 2), rr = c(.6, .75, .85), k = c(.4, 1), t = 1, ratio = c(1, 2), rr0 = c(1, 1.15), alpha = .025, target = c(.8, .9))
for (i in seq_len(nrow(grid))) with(grid[i, ], add_nb(mu0, rr, k, t, ratio, rr0, alpha, target))
add_nb(.8, .7, .5, 2, 1, 1, .05, .8); add_nb(3, .5, 0, .5, .5, 1, .025, .9)
write_csv(nb, 'tests/reference/negative-binomial.csv')

# ---- Bell and Towel: group sequential designs --------------------------------------------------
spend <- function(t, total, family, par) switch(family,
  obf = 2 * (1 - pnorm(qnorm(1 - total / 2) / sqrt(t))),
  pocock = total * log(1 + (exp(1) - 1) * t),
  power = total * t^par,
  hsd = if (par == 0) total * t else total * (1 - exp(-par * t)) / (1 - exp(-par)))
sigma_for <- function(t) outer(seq_along(t), seq_along(t), function(i, j) sqrt(t[pmin(i, j)] / t[pmax(i, j)]))
mvn <- function(lower, upper, mean, sigma) {
  if (length(lower) == 1) return(pnorm(upper, mean) - pnorm(lower, mean))
  as.numeric(pmvnorm(lower = lower, upper = upper, mean = mean, sigma = sigma, algorithm = Miwa(steps = 4096)))
}
# Probability of continuing through looks 1..k-1 and then crossing above b[k] (or below a[k]).
cross_up <- function(k, a, b, t, theta) mvn(c(a[seq_len(k - 1)], b[k]), c(b[seq_len(k - 1)], Inf), theta * sqrt(t[1:k]), sigma_for(t[1:k]))
cross_down <- function(k, a, b, t, theta) mvn(c(a[seq_len(k - 1)], -Inf), c(b[seq_len(k - 1)], a[k]), theta * sqrt(t[1:k]), sigma_for(t[1:k]))
efficacy_bounds <- function(t, alpha, family, par) {
  b <- numeric(length(t)); a <- rep(-Inf, length(t)); spent <- spend(t, alpha, family, par)
  for (k in seq_along(t)) {
    target <- spent[k] - if (k > 1) spent[k - 1] else 0
    b[k] <- uniroot(function(x) { bb <- b; bb[k] <- x; cross_up(k, a, bb, t, 0) - target }, c(-10, 15), tol = 1e-13)$root
  }
  b
}
# Interim futility bounds from beta spending under the alternative (capped at the efficacy bound);
# the final futility bound equals the final efficacy bound.
futility_bounds <- function(t, b, theta, beta, family, par) {
  K <- length(t); a <- rep(-Inf, K); spent <- spend(t, beta, family, par)
  for (k in seq_len(K - 1)) {
    target <- spent[k] - if (k > 1) spent[k - 1] else 0
    f <- function(x) { aa <- a; aa[k] <- x; cross_down(k, aa, b, t, theta) - target }
    a[k] <- if (f(b[k]) <= 0) b[k] else uniroot(f, c(-20, b[k]), tol = 1e-13)$root
  }
  a[K] <- b[K]
  a
}
type2 <- function(a, b, t, theta) sum(sapply(seq_along(t), function(k) cross_down(k, a, b, t, theta)))
power_with <- function(a, b, t, theta) sum(sapply(seq_along(t), function(k) cross_up(k, a, b, t, theta)))
gsd <- list()
add_gsd <- function(type, t, alpha, beta, family, par, lfamily = family, lpar = par, d = .5) {
  b <- efficacy_bounds(t, alpha, family, par); K <- length(t)
  fixed <- qnorm(1 - alpha) + qnorm(1 - beta)
  if (type == 'efficacy') {
    a <- rep(-Inf, K)
    theta <- uniroot(function(th) power_with(a, b, t, th) - (1 - beta), c(fixed * .5, fixed * 2), tol = 1e-12)$root
  } else {
    # Drift at which the total type II error (binding futility) equals beta.
    theta <- uniroot(function(th) type2(futility_bounds(t, b, th, beta, lfamily, lpar), b, t, th) - beta, c(fixed * .8, fixed * 2), tol = 1e-12)$root
    a <- futility_bounds(t, b, theta, beta, lfamily, lpar)
  }
  inflation <- (theta / fixed)^2
  stop_h1 <- sapply(1:K, function(k) cross_up(k, a, b, t, theta) + if (k < K) cross_down(k, a, b, t, theta) else 0)
  stop_h0 <- sapply(1:K, function(k) cross_up(k, a, b, t, 0) + if (k < K) cross_down(k, a, b, t, 0) else 0)
  stop_h1[K] <- 1 - sum(stop_h1[-K]); stop_h0[K] <- 1 - sum(stop_h0[-K])
  nfixed <- 4 * fixed^2 / d^2; nmax <- 2 * ceiling(inflation * nfixed / 2)
  thetaN <- fixed * sqrt(nmax / nfixed)
  pad <- function(x) c(x, rep(NA, 3 - length(x)))
  bb <- pad(b); aa <- pad(ifelse(is.finite(a), a, NA)); tt <- pad(t); h1 <- pad(stop_h1); h0 <- pad(stop_h0)
  gsd[[length(gsd) + 1]] <<- data.frame(type = type, looks = K, t1 = tt[1], t2 = tt[2], alpha = alpha, beta = beta,
    family = family, par = par, lfamily = lfamily, lpar = lpar, b1 = bb[1], b2 = bb[2], b3 = bb[3], a1 = aa[1], a2 = aa[2], a3 = aa[3],
    inflation = inflation, h1stop1 = h1[1], h1stop2 = h1[2], h1stop3 = h1[3], h0stop1 = h0[1], h0stop2 = h0[2], h0stop3 = h0[3],
    expectedH1 = sum(stop_h1 * t), expectedH0 = sum(stop_h0 * t), d = d, nfixed = nfixed, total = nmax, achieved = power_with(a, b, t, thetaN))
}
families <- list(c('obf', 0), c('pocock', 0), c('power', 3), c('hsd', -4))
for (f in families) for (t in list(c(.5, 1), c(1 / 3, 2 / 3, 1), c(.5, .75, 1))) for (beta in c(.1, .2)) {
  add_gsd('efficacy', t, .025, beta, f[1], as.numeric(f[2]))
  add_gsd('futility', t, .025, beta, f[1], as.numeric(f[2]))
}
add_gsd('futility', c(.5, .75, 1), .025, .1, 'hsd', -4, 'hsd', -2)
add_gsd('futility', c(1 / 3, 2 / 3, 1), .025, .1, 'obf', 0, 'pocock', 0)
add_gsd('efficacy', c(.25, 1), .05, .2, 'hsd', 1, d = .3)
write_csv(gsd, 'tests/reference/group-sequential.csv')

# ---- Simulation spot-checks of the negative binomial approximation (recorded, not tested) ---------
set.seed(1989)
sim_nb <- function(n, mu0, rr, k, reps = 2000) mean(replicate(reps, {
  y0 <- rnbinom(n, mu = mu0, size = 1 / k); y1 <- rnbinom(n, mu = mu0 * rr, size = 1 / k)
  g <- rep(0:1, each = n); fit <- suppressWarnings(glm.nb(c(y0, y1) ~ g))
  z <- coef(summary(fit))['g', 3]; z < qnorm(.025)
}))
sims <- sapply(list(c(1, .7, .5), c(2, .8, .4)), function(v) {
  n <- first_n(function(n) nb_power(n, n, v[1], v[2], v[3], 1, 1, .025), .8)
  sprintf('mu0=%.1f RR=%.2f k=%.1f t=1: n=%d/group, approximation %.4f, glm.nb Wald simulation %.4f (2000 reps)', v[1], v[2], v[3], n, nb_power(n, n, v[1], v[2], v[3], 1, 1, .025), sim_nb(n, v[1], v[2], v[3]))
})
obf3 <- efficacy_bounds(c(1 / 3, 2 / 3, 1), .025, 'obf', 0)

writeLines(c(R.version.string, paste('stats', packageVersion('stats'), '/ mvtnorm', packageVersion('mvtnorm'), '/ MASS', packageVersion('MASS')),
  paste('Generated:', Sys.Date()), 'Generator tests/reference/generate-sequential.R; no JavaScript.',
  sprintf('vaccine.csv %d cases; negative-binomial.csv %d; group-sequential.csv %d.', length(jab), length(nb), length(gsd)),
  'Jab: exact conditional binomial test (Chan and Bohidar 1998 convention). pi = r(1-VE)/(r(1-VE)+1); reject when vaccine cases <= c, c = largest count with pbinom(c, T, pi0) <= alpha.',
  sprintf('Jab: total = smallest T after which power stays >= target for the next %d case totals; first = plain smallest T reaching the target.', window),
  'Scatter: Wald test on log rate ratio with variance at the planned rates (Zhu and Lakatos 2014 method 1; Keene et al. 2007); one-sided H0 RR >= RR0.',
  'Scatter simulation spot-checks (glm.nb Wald test):', sims,
  'Bell/Towel: one-sided efficacy bounds from Lan-DeMets alpha spending (OBF-type, Pocock-type), Kim-DeMets power (rho), Hwang-Shih-DeCani (gamma); non-binding futility from beta spending at the interims (capped at the efficacy bound), final futility bound = final efficacy bound, drift chosen so the total type II error with binding futility equals beta.',
  'Multivariate normal probabilities by mvtnorm::pmvnorm, algorithm Miwa(steps = 4096); roots by uniroot tol 1e-13.',
  sprintf('Sanity: OBF-type, three equally spaced looks, one-sided alpha 0.025: bounds %.4f %.4f %.4f (published gsDesign values 3.7103, 2.5114, 1.9930).', obf3[1], obf3[2], obf3[3]),
  'Effect-size example sizes: N fixed = 4 (z_alpha + z_beta)^2 / d^2, N max = 2 ceil(inflation N fixed / 2); achieved power at N max with the designed bounds.'),
  'tests/reference/sequential-provenance.txt')
