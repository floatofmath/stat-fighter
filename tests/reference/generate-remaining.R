# Independent R evaluation of explicitly approximate tour models. No JavaScript used.
options(digits=17)
minimum <- function(id) if(id=='bonferroni'||id=='chi-square') 2 else if(id=='log-rank') 10 else 20
balanced <- function(id) id %in% c('mann-whitney','proportions','bonferroni')
evaluate <- function(v,n) {
 two <- v$alternative=='two-sided'
 if(v$id=='chi-square') return(pchisq(qchisq(v$alpha,v$df,lower.tail=FALSE),v$df,ncp=n*v$effect^2,lower.tail=FALSE))
 if(v$id=='bonferroni') {
  critical <- qt(v$alpha/v$comparisons/ifelse(two,2,1),2*n-2,lower.tail=FALSE)
  nc <- abs(v$effect)*sqrt(n/2)
  return(pt(critical,2*n-2,ncp=nc,lower.tail=FALSE)+if(two)pt(-critical,2*n-2,ncp=nc) else 0)
 }
 signal <- switch(v$id,'mann-whitney'=abs(v$effect)*sqrt(6*n),'signed-rank'=abs(v$effect)*sqrt(3*n),'proportions'=abs(v$effect)*sqrt(n/2),'log-rank'=abs(v$effect)*sqrt(n*v$allocation*(1-v$allocation)))
 critical <- qnorm(v$alpha/ifelse(two,2,1),lower.tail=FALSE)
 pnorm(signal-critical)+if(two)pnorm(-signal-critical) else 0
}
rows <- list()
add <- function(id,effects,dfs=1,allocations=.5,comparisons=1) {
 grid <- expand.grid(effect=effects,alpha=c(.0001,.05,.2),target=c(.5,.8,.99),df=dfs,allocation=allocations,comparisons=comparisons,tail=if(id%in%c('chi-square','log-rank'))'two-sided' else c('two-sided','directional'),stringsAsFactors=FALSE)
 for(i in seq_len(nrow(grid))) {
  v <- grid[i,];v$id <- id;v$alternative <- if(v$tail=='two-sided') 'two-sided' else if(v$effect<0) 'less' else 'greater'
  lo <- minimum(id)-1; hi <- minimum(id); cap <- if(balanced(id)) 500000 else 1000000
  while(evaluate(v,hi)<v$target && hi<cap){lo<-hi;hi<-min(cap,hi*2)}
  if(evaluate(v,hi)<v$target)next
  while(hi-lo>1){mid<-floor((hi+lo)/2);if(evaluate(v,mid)<v$target)lo<-mid else hi<-mid}
  rows[[length(rows)+1]] <<- data.frame(id=id,effect=v$effect,alpha=v$alpha,target=v$target,alternative=v$alternative,df=v$df,allocation=v$allocation,comparisons=v$comparisons,n=hi,total=hi*ifelse(balanced(id),2,1),achieved=evaluate(v,hi),previous=if(hi>minimum(id))evaluate(v,hi-1) else NA_real_)
 }
}
add('mann-whitney',c(-.4,.02,.2,.49))
add('signed-rank',c(-.4,.02,.2,.49))
add('proportions',c(-2,.02,.2,3))
add('chi-square',c(.01,.2,1,5),dfs=c(1,3,20,100))
add('log-rank',c(log(1.01),-log(.7),log(10)),allocations=c(.1,.5,.9))
add('bonferroni',c(-1,.1,.5,5),comparisons=c(1,5,100))
write.table(do.call(rbind,rows),'tests/reference/remaining.csv',sep=',',row.names=FALSE,quote=FALSE,na='')
writeLines(c(R.version.string,paste('stats',packageVersion('stats')),paste('Generated:',Sys.Date()),paste(length(rows),'cases; unattainable designs above cap excluded.'),'Generator: tests/reference/generate-remaining.R','Normal models: strict two-tail power when two-sided; null variance under alternatives. R pnorm/qnorm.','MW: centered superiority probability, normal shift |effect| sqrt(6n), balanced groups.','Signed-rank: centered Walsh-sum probability, normal shift |effect| sqrt(3n).','Two proportions: Cohen h, normal shift |h| sqrt(n/2), balanced groups.','Chi-square: R qchisq/pchisq, df, ncp=N*w^2.','Log-rank: absolute ln HR, observed events D, normal shift effect sqrt(D*q*(1-q)); two-sided.','Bonferroni: R qt/pt, threshold family alpha/m, pooled t, df=2n-2, ncp=abs(d)*sqrt(n/2); marginal power.','Minimums: 20/group normal group models,20 pairs signed-rank,10 events log-rank,2 total chi-square,2/group Bonferroni.','Checks validate implementation of approximations, not empirical design accuracy.','Primary sources and derivations: REMAINING-REVIEW.md'),'tests/reference/remaining-provenance.txt')
