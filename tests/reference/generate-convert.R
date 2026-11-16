# Independent R references for the Training Room conversions (journey/convert.js).
# Base R only, no JavaScript. Each row: tool, mode, output key, inputs (JSON with ';' for ','
# and "'" for '"', so the CSV needs no quoting), expected value.
#   Rscript tests/reference/generate-convert.R
options(digits = 17)
rows <- list()
add <- function(tool, mode, inputs, key, value) {
  json <- paste0("{", paste0("'", names(inputs), "':", format(unlist(inputs), digits = 17), collapse = ";"), "}")
  rows[[length(rows) + 1]] <<- data.frame(tool = tool, mode = mode, key = key, inputs = json, expected = format(value, digits = 17))
}

# Log-normal: sigma^2 = log(1 + CV^2); mu = log(mean) - sigma^2 / 2; GM = exp(mu); GSD = exp(sigma).
for (x in list(c(100, 30), c(5, 1), c(250, 400))) {
  m <- x[1]; s <- x[2]; cv <- s / m; s2 <- log(1 + cv^2); mu <- log(m) - s2 / 2
  inp <- list(mean = m, sd = s)
  add("lognormal", "mean-sd", inp, "cv", cv); add("lognormal", "mean-sd", inp, "sigma", sqrt(s2))
  add("lognormal", "mean-sd", inp, "gmean", exp(mu)); add("lognormal", "mean-sd", inp, "mu", mu)
}
add("lognormal", "gmean-gsd", list(gmean = 95, gsd = 1.4), "mean", exp(log(95) + log(1.4)^2 / 2))
add("lognormal", "log", list(mu = 4.5, sigma = 0.25), "cv", sqrt(exp(0.25^2) - 1))

# Spread: SD from SE, from a t interval, pooled, and from an IQR (normal data).
add("spread", "se-n", list(se = 1.7, n = 33), "sd", 1.7 * sqrt(33))
for (x in list(c(45, 55, 40, 0.95), c(1.2, 3.4, 12, 0.9), c(-2, 6, 200, 0.99))) {
  L <- x[1]; U <- x[2]; n <- x[3]; lev <- x[4]
  add("spread", "ci", list(lower = L, upper = U, n = n, level = lev), "sd", sqrt(n) * (U - L) / (2 * qt(1 - (1 - lev) / 2, n - 1)))
}
add("spread", "pooled", list(sd1 = 10, n1 = 30, sd2 = 14, n2 = 45), "sd", sqrt((29 * 100 + 44 * 196) / 73))
add("spread", "iqr", list(iqr = 20), "sd", 20 / 1.349)

# Paired differences: var(X1 - X2) = s1^2 + s2^2 - 2 rho s1 s2.
for (x in list(c(10, 10, 0.5), c(8, 12, 0.3), c(5, 9, -0.2))) add("paired", "sds", list(sd1 = x[1], sd2 = x[2], rho = x[3]), "sdDiff", sqrt(x[1]^2 + x[2]^2 - 2 * x[3] * x[1] * x[2]))

# Effect sizes: theta = pnorm(d / sqrt(2)); f2 = R2 / (1 - R2).
for (d in c(0.2, 0.5, 0.8, -0.35)) add("effect", "d", list(d = d), "theta", pnorm(d / sqrt(2)))
for (r2 in c(0.02, 0.13, 0.4)) { add("effect", "r2", list(r2 = r2), "f2", r2 / (1 - r2)); add("effect", "eta2", list(eta2 = r2), "f", sqrt(r2 / (1 - r2))) }

# Risks.
for (x in list(c(0.2, 2), c(0.05, 0.5), c(0.6, 1.3))) {
  p0 <- x[1]; or <- x[2]; o1 <- or * p0 / (1 - p0); p1 <- o1 / (1 + o1)
  inp <- list(p0 = p0, or = or)
  add("risk", "or", inp, "p1", p1); add("risk", "or", inp, "nnt", 1 / abs(p1 - p0)); add("risk", "or", inp, "h", 2 * asin(sqrt(p1)) - 2 * asin(sqrt(p0)))
}

# Survival: Weibull with common shape k, S(t) = exp(-log(2) (t / median)^k); PH gives S1 = S0^HR.
for (x in list(c(12, 0.7, 12, 1), c(12, 0.7, 6, 2), c(30, 1.4, 24, 0.8))) {
  m0 <- x[1]; hr <- x[2]; t <- x[3]; k <- x[4]
  inp <- list(median0 = m0, hr = hr, time = t, shape = k)
  # Independent route: Weibull scale b with hazard ratio hr changes the scale by hr^(-1/k).
  b0 <- m0 / log(2)^(1 / k); b1 <- b0 * hr^(-1 / k)
  add("survival", "median-hr", inp, "median1", qweibull(0.5, shape = k, scale = b1))
  add("survival", "median-hr", inp, "s1", pweibull(t, shape = k, scale = b1, lower.tail = FALSE))
}
add("survival", "survs", list(time = 18, s0 = 0.4, s1 = 0.55, shape = 1), "hr", log(0.55) / log(0.4))

# Counts: constant rate; negative binomial dispersion.
for (x in list(c(0.02, 2), c(1.3, 0.5))) add("counts", "rate-period", list(rate = x[1], period = x[2]), "risk", ppois(0, x[1] * x[2], lower.tail = FALSE))
add("counts", "risk-period", list(risk = 0.1, period = 3), "rate", -log(0.9) / 3)
add("counts", "mean-var", list(mean = 2, variance = 4), "k", 0.5)
add("counts", "mean-var", list(mean = 1.3, variance = 3.1), "theta", 1.3^2 / (3.1 - 1.3))

out <- do.call(rbind, rows)
write.csv(out, "tests/reference/convert.csv", row.names = FALSE, quote = FALSE)
writeLines(c(R.version.string, paste("stats", packageVersion("stats")), paste("Generated:", Sys.Date()),
  "Generator tests/reference/generate-convert.R; base R only, no JavaScript.",
  paste0("convert.csv ", nrow(out), " cases: log-normal scales, SD recovery (qt for intervals), paired differences, effect sizes, risks, Weibull/exponential survival (qweibull/pweibull), counts (ppois).")),
  "tests/reference/convert-provenance.txt")
