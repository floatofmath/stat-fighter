import assert from 'node:assert/strict';
import { test } from 'node:test';
import { readFileSync } from 'node:fs';
import stats from '../stats.js';
import methods from '../journey/methods.js';
const csv=readFileSync(new URL('./reference/remaining.csv',import.meta.url),'utf8').trim().split('\n');
const keys=csv.shift().split(',');
for(const [i,line] of csv.entries()){
 const r=Object.fromEntries(line.split(',').map((v,j)=>[keys[j],['id','alternative'].includes(keys[j])?v:v===''?null:Number(v)]));
 test(`R remaining-continent model ${i+1}: ${r.id}`,()=>{
  const p={effect:r.effect,alpha:r.alpha,power:r.target,alternative:r.alternative,df:r.df,allocation:r.allocation,comparisons:r.comparisons};
  const out=stats.expansionSampleSize(r.id,p);
  assert.equal(out.n,r.n);assert.equal(out.total,r.total);
  assert.ok(Math.abs(out.power-r.achieved)<2e-9,`${out.power} vs ${r.achieved}`);
  assert.equal(out.power,stats.expansionPowerAt(r.id,{...p,n:out.n}).power);
  assert.ok(out.power>=p.power);
  if(r.previous!==null){const previous=stats.expansionPowerAt(r.id,{...p,n:out.n-1}).power;assert.ok(Math.abs(previous-r.previous)<2e-9);assert.ok(previous<p.power);}
 });
}
test('rank probability definitions, direction, complementary probabilities and scale conversion',()=>{
 const mw=methods['mann-whitney'],sr=methods['signed-rank'];
 const p=mw.normalize(mw.defaults);
 assert.deepEqual(stats.expansionSampleSize(mw.id,p),stats.expansionSampleSize(mw.id,{...p,effect:-p.effect}));
 assert.equal(mw.normalize({...mw.defaults,mode:'probability',probability:'.3'}).effect,-.2);
 const raw={...sr.defaults,mode:'normal-shift',difference:'-.37080715859355795',alternative:'less'};
 assert.ok(Math.abs(sr.normalize(raw).effect+.2)<1e-14);
 assert.equal(sr.normalize({...raw,difference:String(Number(raw.difference)*10),sdDifference:'10'}).effect,sr.normalize(raw).effect);
 assert.ok(sr.assumptions.includes('not P(D>0)'));assert.ok(mw.assumptions.includes('not generally a test of medians'));
 for(const [m,values]of [[mw,[{probability:'0'},{probability:'1'},{probability:'.5'}]],[sr,[{sdDifference:'0'},{difference:'0'}]]])for(const bad of values)assert.throws(()=>m.normalize({...m.defaults,mode:m.modes[1].id,...bad}),RangeError);
});
test('proportions, chi-square joint table and invalid margins',()=>{
 const pp=methods.proportions,chi=methods['chi-square'];
 assert.equal(pp.normalize({...pp.defaults,mode:'proportions'}).effect,Number(pp.defaults.effect));
 for(const bad of [{proportion1:'0'},{proportion2:'1'},{proportion1:'.5'}])assert.throws(()=>pp.normalize({...pp.defaults,mode:'proportions',...bad}),RangeError);
 const raw={...chi.defaults,mode:'table'};
 assert.ok(Math.abs(chi.normalize(raw).effect-.2)<1e-14);
 for(const bad of [{cell11:'.4'},{cell11:'0'},{df:'2'},{cell11:'.25',cell12:'.25',cell21:'.25',cell22:'.25'}])assert.throws(()=>chi.normalize({...raw,...bad}),RangeError);
});
test('Schoenfeld counts events and respects hazard/assignment symmetry',()=>{
 const m=methods['log-rank'],p=m.normalize({...m.defaults,mode:'hazard-ratio'}),out=m.solve(stats,p,m.id);
 assert.equal(out.total,247);assert.equal(m.totalLabel,'OBSERVED EVENTS');assert.equal(m.signed,false);
 assert.ok(Math.abs(m.normalize({...m.defaults,mode:'hazard-ratio',hazardRatio:String(1/.7)}).effect-p.effect)<1e-14);
 assert.equal(stats.expansionSampleSize(m.id,{...p,allocation:.2}).total,stats.expansionSampleSize(m.id,{...p,allocation:.8}).total);
 for(const bad of [{hazardRatio:'1'},{hazardRatio:'0'},{hazardRatio:'11'},{allocation:'0'},{allocation:'.99'}])assert.throws(()=>m.normalize({...m.defaults,mode:'hazard-ratio',...bad}),RangeError);
});
test('Bonferroni uses full derived alpha and records marginal power',()=>{
 const m=methods.bonferroni,p=m.normalize({...m.defaults,comparisons:'100',alpha:'.0001'}),out=m.solve(stats,p,m.id);
 assert.equal(out.comparisonAlpha,.000001);
 assert.ok(m.receipt(m.defaults,p,out).some(([label,value])=>label==='Bonferroni per-comparison alpha'&&value===.000001));
 const single={...p,comparisons:1,alpha:.05};
 assert.deepEqual(stats.expansionSampleSize(m.id,single),{...stats.sampleSize('two-sample',{...single,ratio:1}),comparisonAlpha:.05});
 assert.ok(out.n>stats.sampleSize('two-sample',{...p,alpha:.0001,ratio:1}).n);
 for(const comparisons of [0,1.5,101,NaN])assert.throws(()=>stats.expansionSampleSize(m.id,{...p,comparisons}),RangeError);
});
test('all expansion entry points reject invalid numerical domains and cap failures',()=>{
 for(const id of ['mann-whitney','signed-rank','proportions','chi-square','log-rank','bonferroni']){
  const p=methods[id].normalize(methods[id].defaults);
  for(const bad of [{effect:NaN},{effect:0},{alpha:0},{power:1}])assert.throws(()=>stats.expansionSampleSize(id,{...p,...bad}),RangeError,id);
  for(const n of [0,1.5,1000001])assert.throws(()=>stats.expansionPowerAt(id,{...p,n}),RangeError,id);
  assert.throws(()=>stats.expansionSampleSize(id,{...p,effect:.001,alpha:.0001,power:.999}),/1,000,000/);
 }
 assert.throws(()=>stats.expansionSampleSize('unknown',{}),RangeError);
});
