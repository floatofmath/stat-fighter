# Independent R stats evaluation of the documented Association Heights models.
# Formula conventions follow CRAN pwr 1.3-0 documentation/source; no JS is used.
options(digits=17)
first_n <- function(evaluate, target, minimum) {
  lo <- minimum - 1; hi <- minimum
  while (evaluate(hi) < target && hi < 1000000) { lo <- hi; hi <- min(1000000, hi * 2) }
  if (evaluate(hi) < target) stop('Reference exceeds supported search cap')
  while (hi - lo > 1) {
    mid <- floor((lo + hi) / 2)
    if (evaluate(mid) < target) lo <- mid else hi <- mid
  }
  hi
}
rows <- list()
correlations <- expand.grid(effect=c(-0.6,0.1,0.3,0.8),alpha=c(0.0001,0.05,0.2),target=c(0.5,0.8,0.99),tail=c('two-sided','directional'),stringsAsFactors=FALSE)
correlations <- rbind(correlations,data.frame(effect=c(.99,-.99,.01),alpha=c(.2,.05,.0001),target=c(.5,.8,.99),tail=c('two-sided','directional','two-sided')))
for(i in seq_len(nrow(correlations))) {
  v <- correlations[i,]; alternative <- if(v$tail=='two-sided') 'two-sided' else if(v$effect<0) 'less' else 'greater'
  evaluate <- function(n) {
    tcut <- qt(v$alpha/ifelse(alternative=='two-sided',2,1),n-2,lower.tail=FALSE)
    rcut <- sqrt(tcut^2/(tcut^2+n-2))
    zcut <- atanh(rcut)
    za <- atanh(abs(v$effect))+abs(v$effect)/(2*(n-1))
    pnorm((za-zcut)*sqrt(n-3))+ifelse(alternative=='two-sided',pnorm((-za-zcut)*sqrt(n-3)),0)
  }
  n <- first_n(evaluate,v$target,4)
  rows[[length(rows)+1]] <- data.frame(id='correlation',effect=v$effect,alpha=v$alpha,target=v$target,alternative=alternative,predictors='',n=n,total=n,achieved=evaluate(n),previous=if(n>4)evaluate(n-1) else NA_real_)
}
regressions <- expand.grid(predictors=c(1,3,10,20),effect=c(.001,.02,.15,1,5),alpha=c(.0001,.05,.2),target=c(.5,.8,.99))
for(i in seq_len(nrow(regressions))) {
  v <- regressions[i,]
  evaluate <- function(n) {
    df2 <- n-v$predictors-1
    critical <- qf(v$alpha,v$predictors,df2,lower.tail=FALSE)
    pf(critical,v$predictors,df2,ncp=n*v$effect,lower.tail=FALSE)
  }
  minimum <- v$predictors+2; n <- first_n(evaluate,v$target,minimum)
  rows[[length(rows)+1]] <- data.frame(id='regression',effect=v$effect,alpha=v$alpha,target=v$target,alternative='',predictors=v$predictors,n=n,total=n,achieved=evaluate(n),previous=if(n>minimum)evaluate(n-1) else NA_real_)
}
write.table(do.call(rbind,rows),'tests/reference/association.csv',sep=',',row.names=FALSE,quote=FALSE,na='')
writeLines(c(R.version.string,paste('stats',packageVersion('stats')),paste('Generated:',Sys.Date()),'Generator: tests/reference/generate-association.R',paste(nrow(correlations),'correlation cases;',nrow(regressions),'regression cases.'),'Correlation: null rho=0; central t critical with n-2 df; alternative atanh(abs(rho))+abs(rho)/(2(n-1)); normal Fisher-z approximation with scale sqrt(n-3); both tails if two-sided. Minimum n=4.','Regression: overall fixed-model F, numerator df=p, residual df=n-p-1, noncentrality=n*f2, one intercept. Minimum n=p+2.','All searches use whole N and independently evaluate predecessor power.','Primary conventions: https://search.r-project.org/CRAN/refmans/pwr/html/pwr.r.test.html','https://search.r-project.org/CRAN/refmans/pwr/help/pwr.f2.test.html'),'tests/reference/association-provenance.txt')
