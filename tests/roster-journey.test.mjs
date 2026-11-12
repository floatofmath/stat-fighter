import assert from 'node:assert/strict';
import { test } from 'node:test';
import { readFileSync } from 'node:fs';
import methods from '../journey/methods.js';
import stats from '../stats.js';
const solve=(m,raw)=>m.solve(stats,m.normalize(raw),m.id);
for(const m of Object.values(methods)) {
 test(`${m.id}: contract, mode drafts, defaults and result units`,()=>{
  assert.ok(m.modes.length>=2);assert.ok(m.assumptions);assert.ok(m.totalLabel);assert.ok(m.allocations);
  for(const mode of m.modes){
   const raw={...m.defaults,mode:mode.id},copy={...raw};const answer=solve(m,raw);
   assert.deepEqual(raw,copy);assert.ok(answer.power>=Number(raw.power));
   assert.equal(answer.total,solve(m,m.defaults).total);
   assert.ok(Math.abs(answer.power-solve(m,m.defaults).power)<2e-9);
   for(const id of [...m.designFields,...m.inputFields(raw),...m.tuningFields])assert.ok(m.fields[id],id);
  }
 });
 test(`${m.id}: reject invalid active fields and preserve inactive ones`,()=>{
  for(const mode of m.modes){
   const raw={...m.defaults,mode:mode.id};
   for(const id of [...m.inputFields(raw),...m.designFields,...m.tuningFields]){
    assert.throws(()=>m.normalize({...raw,[id]:''}),RangeError,`${mode.id}/${id} empty`);
    assert.throws(()=>m.normalize({...raw,[id]:'Infinity'}),RangeError,`${mode.id}/${id} nonfinite`);
   }
  }
  assert.throws(()=>m.normalize({...m.defaults,mode:'unknown'}),RangeError);
  if (!m.marginPlanning) {
   assert.throws(()=>m.normalize({...m.defaults,effect:'0'}),RangeError);
   assert.throws(()=>m.normalize({...m.defaults,effect:'5.01'}),RangeError);
  }
  if(m.signed)assert.throws(()=>m.normalize({...m.defaults,alternative:'less'}),RangeError);
 });
}
test('Nova uses population spread, equal weights, and preserves inactive group drafts',()=>{
 const m=methods.anova;
 const raw={...m.defaults,mode:'means',groups:'3',groupMean1:'0',groupMean2:'0',groupMean3:'3',sd:'1'};
 assert.ok(Math.abs(m.normalize(raw).effect-Math.sqrt(2))<1e-14);
 const shifted={...raw,groupMean1:'100',groupMean2:'100',groupMean3:'103'};
 assert.equal(m.normalize(shifted).effect,m.normalize(raw).effect);
 const scaled={...raw,groupMean1:'0',groupMean2:'0',groupMean3:'30',sd:'10'};
 assert.equal(m.normalize(scaled).effect,m.normalize(raw).effect);
 assert.ok(!m.inputFields({...raw,groups:'2'}).includes('groupMean3'));
 assert.ok(m.inputFields(raw).includes('groupMean3'));assert.equal(raw.groupMean3,'3');
 for(const bad of [{groups:'2.5'},{groups:'1'},{groups:'21'},{sd:'0'},{groupMean3:'0'},{groupMean1:'1e308',groupMean2:'-1e308'}])assert.throws(()=>m.normalize({...raw,...bad}),RangeError);
 assert.throws(()=>m.normalize({...m.defaults,effect:'-0.25'}),RangeError);
 const two={...raw,groups:'2',groupMean1:'95',groupMean2:'105',sd:'20'};
 assert.equal(m.normalize(two).effect,0.25);
 assert.equal(solve(m,two).n,stats.sampleSize('two-sample',{alpha:.05,power:.8,effect:.5,ratio:1,alternative:'two-sided'}).n);
});
test('paired and one-sample alternative inputs preserve signs and units',()=>{
 const p=methods.paired,o=methods['one-sample'];
 const paired={...p.defaults,mode:'differences',difference:'-5',sdDifference:'10',alternative:'less'};
 const one={...o.defaults,mode:'means',mean:'95',reference:'100',sd:'10',alternative:'less'};
 assert.equal(p.normalize(paired).effect,-.5);assert.equal(o.normalize(one).effect,-.5);
 assert.equal(solve(p,paired).n,solve(o,one).n);
 assert.equal(p.normalize({...paired,difference:'-50',sdDifference:'100'}).effect,-.5);
 assert.equal(o.normalize({...one,mean:'950',reference:'1000',sd:'100'}).effect,-.5);
 assert.throws(()=>p.normalize({...paired,sdDifference:'0'}),RangeError);
 assert.throws(()=>o.normalize({...one,sd:'-1'}),RangeError);
});
const csv=readFileSync(new URL('./reference/journey-modes.csv',import.meta.url),'utf8').trim().split('\n');
const keys=csv.shift().split(',');
for(const [i,row]of csv.entries()){
 const v=Object.fromEntries(row.split(',').map((value,j)=>[keys[j],value]));
 test(`independent R entry-mode reference ${i+1}: ${v.id}`,()=>{
  const m=methods[v.id],raw={...m.defaults,mode:v.mode,alpha:v.alpha,power:v.target};
  if(v.id==='anova'){
   raw.groups=v.groups;raw.sd=v.sd;v.means.split(';').forEach((value,j)=>raw['groupMean'+(j+1)]=value);
  }else if(v.id==='paired')Object.assign(raw,{difference:v.a,sdDifference:v.sd,alternative:v.alternative});
  else Object.assign(raw,{mean:v.a,reference:v.b,sd:v.sd,alternative:v.alternative});
  const canonical=m.normalize(raw),answer=m.solve(stats,canonical,m.id);
  assert.ok(Math.abs(canonical.effect-Number(v.effect))<1e-12);
  assert.equal(answer.n,Number(v.n));assert.equal(answer.total,Number(v.total));
  assert.ok(Math.abs(answer.power-Number(v.achieved))<2e-9);
  if(v.previous!==''){
   assert.ok(Number(v.previous)<Number(v.target));
   if(m.signed){const previous=stats.tPowerAt(m.id,{...canonical,n:answer.n-1});assert.ok(Math.abs(previous.power-Number(v.previous))<2e-9);assert.ok(previous.power<canonical.power);}
   else{const previous=stats.anovaSampleSize({...canonical,power:Number(v.previous)-2e-9});assert.equal(previous.n,answer.n-1);assert.ok(Math.abs(previous.power-Number(v.previous))<2e-9);}
  }
 });
}
