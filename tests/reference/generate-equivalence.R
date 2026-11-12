# Independent finite-sample parallel normal-model NI/TOST references. No JS used.
options(digits=17)
tost_power <- function(n,delta,sigma,lower,upper,alpha) {
 df<-2*n-2; se<-sigma*sqrt(2/n); critical<-qt(alpha,df,lower.tail=FALSE)
 vmax<-df*((upper-lower)/(2*critical*se))^2
 lo<-qchisq(1e-14,df); hi<-min(vmax,qchisq(1-1e-14,df))
 if(hi<=lo)return(0)
 integrate(function(v){
  a<-(lower-delta)/se+critical*sqrt(v/df)
  b<-(upper-delta)/se-critical*sqrt(v/df)
  interval<-ifelse(a>0,pnorm(a,lower.tail=FALSE)-pnorm(b,lower.tail=FALSE),pnorm(b)-pnorm(a))
  pmax(0,interval)*dchisq(v,df)
 },lo,hi,rel.tol=1e-11,abs.tol=1e-13,subdivisions=2000)$value
}
ni_power <- function(n,delta,sigma,margin,direction,alpha) pt(qt(alpha,2*n-2,lower.tail=FALSE),2*n-2,ncp=(margin+direction*delta)/(sigma*sqrt(2/n)),lower.tail=FALSE)
first_n <- function(evaluate,target){
 lo<-1;hi<-2
 while(evaluate(hi)<target&&hi<500000){lo<-hi;hi<-min(500000,hi*2)}
 if(evaluate(hi)<target)return(NA_real_)
 while(hi-lo>1){mid<-floor((hi+lo)/2);if(evaluate(mid)<target)lo<-mid else hi<-mid};hi
}
rows<-list()
add <- function(id,delta,sigma,lower=NA,upper=NA,margin=NA,direction=NA,alpha=.05,target=.8,gmr=NA,cv=NA,lowerRatio=NA,upperRatio=NA) {
 evaluate<-if(id=='non-inferiority')function(n)ni_power(n,delta,sigma,margin,direction,alpha) else function(n)tost_power(n,delta,sigma,lower,upper,alpha)
 n<-first_n(evaluate,target);if(is.na(n))return(invisible(NULL))
 rows[[length(rows)+1]]<<-data.frame(id=id,delta=delta,sigma=sigma,lower=lower,upper=upper,margin=margin,direction=direction,alpha=alpha,target=target,gmr=gmr,cv=cv,lowerRatio=lowerRatio,upperRatio=upperRatio,n=n,total=2*n,achieved=evaluate(n),previous=if(n>2)evaluate(n-1) else NA_real_)
}
ni<-expand.grid(margin=c(.1,.5,2),factor=c(-.5,0,.8),direction=c(-1,1),alpha=c(.0001,.025,.2),target=c(.5,.8,.99))
for(i in seq_len(nrow(ni))){v<-ni[i,];add('non-inferiority',v$direction*v$factor*v$margin,1,margin=v$margin,direction=v$direction,alpha=v$alpha,target=v$target)}
tost<-expand.grid(width=c(.05,.5,5),factor=c(-.8,0,.8),asym=c(1,2),alpha=c(.0001,.05,.2),target=c(.5,.8,.99))
for(i in seq_len(nrow(tost))){v<-tost[i,];add('tost',v$factor*v$width,1,-v$width,v$width*v$asym,alpha=v$alpha,target=v$target)}
be<-expand.grid(cv=c(.1,.3,.8),gmr=c(.85,.95,1,1.1),bounds=c('standard','wide'),alpha=c(.025,.05),target=c(.8,.95))
for(i in seq_len(nrow(be))){v<-be[i,];lr<-if(v$bounds=='standard').8 else .7;ur<-if(v$bounds=='standard')1.25 else 1.4;add('tost-lognormal',log(v$gmr),sqrt(log1p(v$cv^2)),log(lr),log(ur),alpha=v$alpha,target=v$target,gmr=v$gmr,cv=v$cv,lowerRatio=lr,upperRatio=ur)}
# Published PowerTOST parallel example: total48, power rounded .815435.
add('tost',-.05,.2,-.2,.2)
# Strong finite-sample and near-cap examples, asymmetric centered interval and small df.
for(nudge in c(0,.2))add('tost',nudge,1,-10,10,alpha=.2,target=.5)
add('tost',0,1,-.01,.01,alpha=.05,target=.8)
add('tost-lognormal',0,sqrt(log1p(.01^2)),log(.8),log(1.25),alpha=.05,target=.8,gmr=1,cv=.01,lowerRatio=.8,upperRatio=1.25)
write.table(do.call(rbind,rows),'tests/reference/equivalence.csv',sep=',',quote=FALSE,row.names=FALSE,na='')
writeLines(c(R.version.string,paste('stats',packageVersion('stats')),paste('Generated:',Sys.Date()),paste(length(rows),'cases; designs exceeding total cap excluded.'),'Generator tests/reference/generate-equivalence.R; no JavaScript used.','TOST: integrate normal interval conditional on pooled variance against chi-square density, truncate at interval closure and chi-square tail probabilities1e-14 each; rel.tol1e-11 abs.tol1e-13.','NI: R qt/pt noncentral-t; direction explicit; positive allowed loss.','Balanced independent parallel groups; df2n-2; total2n; minimum2/group; cap1milliontotal.','One-sided alpha for NI; same alpha for each TOST component (not alpha/2); TOST CI1-2alpha.','BE logsigma=sqrt(log1p(CV^2)); total parallel CV; geometric T/R ratios.','PowerTOST published additive parallel example: theta0=-.05,CV=.2,theta1=-.2,theta2=.2,design=parallel; N48,power.815435.','https://search.r-project.org/CRAN/refmans/PowerTOST/html/sampleN.TOST.html','https://search.r-project.org/CRAN/refmans/PowerTOST/html/power.TOST.html','https://search.r-project.org/CRAN/refmans/PowerTOST/html/power.noninf.html','https://search.r-project.org/CRAN/refmans/PowerTOST/html/CV2se.html'),'tests/reference/equivalence-provenance.txt')
