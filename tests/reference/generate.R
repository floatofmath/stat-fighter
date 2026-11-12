# Independent R stats reference generator. Run from repository root.
# Uses no JavaScript values. Mirrors the documented integer allocation policy.
options(digits = 17)
cases <- expand.grid(effect = c(0.2, 0.5, 1.5), alpha = c(0.01, 0.05), target = c(0.8, 0.95), ratio = c(0.34, 1, 1.33, 2), alternative = c('two-sided', 'greater'), stringsAsFactors = FALSE)
cases <- rbind(cases, data.frame(effect = c(-0.7, -1.3, 0.02, 5, 0.6), alpha = c(0.01, 0.005, 0.0001, 0.2, 0.05), target = c(0.95, 0.997, 0.999, 0.51, 0.8), ratio = c(0.34, 1, 1, 10, 0.1), alternative = c('less', 'less', 'two-sided', 'greater', 'two-sided')))
rows <- lapply(seq_len(nrow(cases)), function(i) {
  v <- cases[i, ]
  evaluate <- function(n) {
    n2 <- max(2, floor(n * v$ratio + 0.5))
    df <- n + n2 - 2
    lambda <- abs(v$effect) / sqrt(1/n + 1/n2)
    two <- v$alternative == 'two-sided'
    critical <- qt(1 - v$alpha / ifelse(two, 2, 1), df)
    # Symmetric lower-tail evaluation avoids subtracting almost-one CDFs.
    power <- pt(-critical, df, ncp = -lambda)
    if (two) power <- power + pt(-critical, df, ncp = lambda)
    c(n2 = n2, power = power)
  }
  lo <- 1; hi <- 2
  while (evaluate(hi)['power'] < v$target) hi <- hi * 2
  while (hi - lo > 1) {
    mid <- floor((lo + hi)/2)
    if (evaluate(mid)['power'] < v$target) lo <- mid else hi <- mid
  }
  current <- evaluate(hi)
  previous <- if (hi > 2) evaluate(hi - 1)['power'] else NA_real_
  data.frame(v, n = hi, n2 = unname(current['n2']), achieved = unname(current['power']), previous = unname(previous))
})
write.table(do.call(rbind, rows), 'tests/reference/two-sample.csv', sep = ',', row.names = FALSE, quote = FALSE, na = '')
writeLines(c(R.version.string, paste('stats', packageVersion('stats')), 'Generator: tests/reference/generate.R', 'Generated: 2026-11-11', 'Two-sided: both rejection tails; allocation: max(2, floor(n * ratio + 0.5))'), 'tests/reference/provenance.txt')
