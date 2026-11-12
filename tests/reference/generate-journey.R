# Independent R references for step 4 entry modes. Run from the project root.
options(digits = 17)
rows <- list()
first_size <- function(evaluate, target) {
  lo <- 1; hi <- 2
  while (evaluate(hi) < target) hi <- hi * 2
  while (hi - lo > 1) {
    mid <- floor((lo + hi) / 2)
    if (evaluate(mid) < target) lo <- mid else hi <- mid
  }
  hi
}
for (id in c('paired', 'one-sample')) {
  for (effect in c(-0.8, 0.2, 0.5, 1.2)) for (alpha in c(0.01, 0.05)) for (target in c(0.8, 0.95)) for (tail in c('two-sided', 'directional')) {
    alternative <- if (tail == 'two-sided') 'two-sided' else if (effect < 0) 'less' else 'greater'
    a <- if (id == 'paired') effect * 10 else 100 + effect * 10
    b <- if (id == 'paired') 0 else 100
    expected <- (a - b) / 10
    evaluate <- function(n) {
      cutoff <- qt(alpha / ifelse(alternative == 'two-sided', 2, 1), n - 1, lower.tail = FALSE)
      lambda <- abs(expected) * sqrt(n)
      pt(-cutoff, n - 1, ncp = -lambda) + ifelse(alternative == 'two-sided', pt(-cutoff, n - 1, ncp = lambda), 0)
    }
    n <- first_size(evaluate, target)
    rows[[length(rows) + 1]] <- data.frame(id=id, mode=ifelse(id=='paired','differences','means'), a=a, b=b, sd=10, means='', groups='', alternative=alternative, alpha=alpha, target=target, effect=expected, n=n, total=n, achieved=evaluate(n), previous=ifelse(n>2,evaluate(n-1),NA_real_))
  }
}
mean_sets <- list(c(95,100,105), c(90,100), c(1,2,4,8), c(-4,-1,0,2,6), c(1000,1000.1,1000.2), c(2,2,2,3), c(0,0,3), c(7,9,12,14,20,22,28))
for (i in seq_along(mean_sets)) for (target in c(0.8, 0.95)) {
  means <- mean_sets[[i]]; groups <- length(means); sd <- c(16.32993161855452,20,8,5,0.5,1,5.656854249492381,20)[i]
  alpha <- ifelse(i %% 2 == 1, 0.05, 0.01)
  effect <- sqrt(mean((means - mean(means))^2)) / sd
  evaluate <- function(n) {
    cutoff <- qf(alpha, groups-1, groups*(n-1), lower.tail=FALSE)
    pf(cutoff, groups-1, groups*(n-1), ncp=groups*n*effect^2, lower.tail=FALSE)
  }
  n <- first_size(evaluate,target)
  rows[[length(rows) + 1]] <- data.frame(id='anova',mode='means',a='',b='',sd=sd,means=paste(means,collapse=';'),groups=groups,alternative='',alpha=alpha,target=target,effect=effect,n=n,total=n*groups,achieved=evaluate(n),previous=ifelse(n>2,evaluate(n-1),NA_real_))
}
write.table(do.call(rbind,rows),'tests/reference/journey-modes.csv',sep=',',row.names=FALSE,quote=FALSE,na='')
writeLines(c(R.version.string,paste('stats',packageVersion('stats')),'Generator: tests/reference/generate-journey.R',paste('Generated:',Sys.Date()),'32 paired + 32 one-sample cases, 16 ANOVA group-means cases.','t: both tails for two-sided; n counts complete pairs or observations.','ANOVA: equal weights; population SD of means (divisor k); qf/pf noncentral F; equal integer group sizes.'),'tests/reference/journey-provenance.txt')
