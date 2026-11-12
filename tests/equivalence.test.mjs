import assert from 'node:assert/strict';
import {test} from 'node:test';
import {readFileSync} from 'node:fs';
import stats from '../stats.js';
import methods from '../journey/methods.js';
const lines=readFileSync(new URL('./reference/equivalence.csv',import.meta.url),'utf8').trim().split('\n'),keys=lines.shift().split(',');
for(const [i,line]of lines.entries()){
 const r=Object.fromEntries(line.split(',').map((v,j)=>[keys[j],keys[j]==='id'?v:v===''?null:Number(v)]));
 test(`R finite-sample margin reference ${i+1}: ${r.id}`,()=>{
  const p={effect:r.delta/r.sigma,alpha:r.alpha,power:r.target,...(r.id==='non-inferiority'?{margin:r.margin/r.sigma,direction:r.direction}:{lower:r.lower/r.sigma,upper:r.upper/r.sigma})};
  const out=stats.marginSampleSize(r.id,p);
  assert.equal(out.n,r.n);assert.equal(out.total,r.total);assert.equal(out.n2,r.n);
  assert.ok(Math.abs(out.power-r.achieved)<2e-9,`${out.power} vs ${r.achieved}`);
  assert.equal(out.power,stats.marginPowerAt(r.id,{...p,n:out.n}).power);assert.ok(out.power>=p.power);
  if(r.previous!==null){const prev=stats.marginPowerAt(r.id,{...p,n:out.n-1});assert.ok(Math.abs(prev.power-r.previous)<2e-9);assert.ok(prev.power<p.power);}else assert.equal(out.n,2);
  // Exercise the UI's independent input conversion, not just canonical solver inputs.
  const m=methods[r.id];let raw;
  if(r.id==='tost-lognormal')raw={...m.defaults,gmr:String(r.gmr),cv:String(r.cv),lowerRatio:String(r.lowerRatio),upperRatio:String(r.upperRatio)};
  else raw={...m.defaults,mode:'means',mean1:String(r.delta),mean2:'0',sd:String(r.sigma),...(r.id==='non-inferiority'?{marginRaw:String(r.margin),benefit:r.direction===1?'higher':'lower'}:{lowerRaw:String(r.lower),upperRaw:String(r.upper)})};
  Object.assign(raw,{alpha:String(r.alpha),power:String(r.target)});
  const fromUI=m.solve(stats,m.normalize(raw),m.id);assert.equal(fromUI.total,r.total);assert.ok(Math.abs(fromUI.power-r.achieved)<2e-9);
 });
}
const run=(id,raw)=>methods[id].solve(stats,methods[id].normalize(raw),id);
test('non-inferiority handles both benefit directions, signed expected difference and zero',()=>{
 const m=methods['non-inferiority'],p=m.normalize(m.defaults);
 assert.equal(p.effect,0);assert.equal(run(m.id,m.defaults).total,128);
 const high={...m.defaults,effect:'-.1'},low={...m.defaults,effect:'.1',benefit:'lower'};
 assert.deepEqual(run(m.id,high),run(m.id,low));
 assert.ok(run(m.id,high).n>run(m.id,m.defaults).n);
 assert.ok(m.receipt(m.defaults,p,run(m.id,m.defaults)).some(([label,value])=>label==='Null boundary / SD'&&value===-.5));
 for(const bad of [{margin:'0'},{margin:'-1'},{effect:'-.5'},{effect:'-.6'},{benefit:'unknown'}])assert.throws(()=>m.normalize({...m.defaults,...bad}),RangeError);
 for(const bad of [{effect:'.5'},{effect:'.6'}])assert.throws(()=>m.normalize({...m.defaults,benefit:'lower',...bad}),RangeError);
});
test('raw difference and bounds are translation/unit invariant, with separate drafts',()=>{
 for(const id of ['non-inferiority','tost']){
  const m=methods[id],raw={...m.defaults,mode:'means',mean1:'100',mean2:'100',sd:'2',marginRaw:'1',lowerRaw:'-1',upperRaw:'1'},copy={...raw};
  assert.equal(run(id,raw).total,run(id,m.defaults).total);assert.deepEqual(raw,copy);
  const changed={...raw,mean1:'1000',mean2:'1000',sd:'20',marginRaw:'10',lowerRaw:'-10',upperRaw:'10'};
  assert.deepEqual(m.normalize(raw),m.normalize(changed));
  const effect={...raw,mode:'effect',mean1:'garbage',sd:'0'};assert.equal(run(id,effect).total,run(id,m.defaults).total);
  assert.ok(!m.inputFields(effect).includes('lowerRaw'));assert.ok(!m.inputFields(raw).includes('lower'));
 }
});
test('TOST uses exact joint shared-variance event, not marginal-power arithmetic',()=>{
 const p=methods.tost.normalize(methods.tost.defaults);
 const exact=stats.marginPowerAt('tost',{...p,n:2}).power;
 const marginal=stats.tPowerAt('two-sample',{n:2,n2:2,effect:.5,alpha:.05,alternative:'greater'}).power;
 assert.ok(exact>0);assert.equal(Math.max(0,2*marginal-1),0);
 assert.equal(stats.marginSampleSize('tost',p).total,140);
 const published=stats.marginSampleSize('tost',{effect:-.25,lower:-1,upper:1,alpha:.05,power:.8});
 assert.equal(published.total,48);assert.ok(Math.abs(published.power-.815434728291861)<2e-9);
 const asymmetric={...p,effect:.2,lower:-.4,upper:.8};
 assert.equal(stats.marginSampleSize('tost',asymmetric).n,stats.marginSampleSize('tost',{...asymmetric,effect:-.2,lower:-.8,upper:.4}).n);
 assert.equal(stats.marginPowerAt('tost',{...p,n:70}).confidence,.9);
 for(const bad of [{lower:0},{upper:0},{lower:1,upper:-1},{effect:.5},{effect:-.5},{effect:NaN}])assert.throws(()=>stats.marginSampleSize('tost',{...p,...bad}),RangeError);
 for(const bad of [{lower:'0'},{upper:'0'},{lower:'.6'},{effect:'.5'},{effect:'-.5'}])assert.throws(()=>methods.tost.normalize({...methods.tost.defaults,...bad}),RangeError);
});
test('bioequivalence uses log GMR and total CV with exact alternate-mode agreement',()=>{
 const m=methods['tost-lognormal'],raw={...m.defaults},p=m.normalize(raw),out=run(m.id,raw);
 assert.equal(out.n,38);assert.equal(out.total,76);
 assert.ok(Math.abs(p.sigma-Math.sqrt(Math.log1p(.09)))<1e-15);
 assert.ok(Math.abs(p.effect*p.sigma-Math.log(.95))<1e-15);
 assert.deepEqual(run(m.id,{...raw,mode:'log'}),out);
 const inverse={...raw,gmr:String(1/.95),lowerRatio:String(1/1.25),upperRatio:String(1/.8)};
 assert.equal(run(m.id,inverse).total,out.total);assert.ok(Math.abs(run(m.id,inverse).power-out.power)<1e-12);
 assert.equal(run(m.id,{...raw,gmr:'1'}).total,stats.marginSampleSize('tost',{...p,effect:0}).total);
 const equivalent=m.receipt(raw,p,out);assert.ok(equivalent.some(([label])=>label==='Common natural-log SD'));
 for(const bad of [{gmr:'0'},{gmr:'.8'},{gmr:'1.25'},{gmr:'95'},{cv:'30'},{cv:'0'},{lowerRatio:'0'},{lowerRatio:'1'},{upperRatio:'1'},{upperRatio:'.7'}])assert.throws(()=>m.normalize({...raw,...bad}),RangeError);
 for(const bad of [{logSD:'0'},{logSD:'5'},{logDifference:String(Math.log(.8))}])assert.throws(()=>m.normalize({...raw,mode:'log',...bad}),RangeError);
 // Inactive mode inputs cannot poison the active calculation.
 assert.equal(run(m.id,{...raw,logSD:'bad',logDifference:''}).total,out.total);
});
test('margin engines enforce integer counts, supported domains and unreachable targets',()=>{
 for(const id of ['non-inferiority','tost','tost-lognormal']){
  const p=methods[id].normalize(methods[id].defaults);
  for(const bad of [{alpha:0},{alpha:.5},{effect:NaN},{power:1}])assert.throws(()=>stats.marginSampleSize(id,{...p,...bad}),RangeError);
  for(const n of [0,1,2.5,500001])assert.throws(()=>stats.marginPowerAt(id,{...p,n}),RangeError);
  const close=id==='non-inferiority'?{...p,margin:.001,effect:0}:{...p,lower:-.001,upper:.001,effect:0};
  assert.throws(()=>stats.marginSampleSize(id,{...close,alpha:.0001,power:.999}),/1,000,000/);
 }
 assert.throws(()=>stats.marginSampleSize('unknown',{}),RangeError);
});
