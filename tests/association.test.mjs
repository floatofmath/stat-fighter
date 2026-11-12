import assert from 'node:assert/strict';
import { test } from 'node:test';
import { readFileSync,existsSync } from 'node:fs';
import vm from 'node:vm';
import methods from '../journey/methods.js';
import stats from '../stats.js';
const rows=readFileSync(new URL('./reference/association.csv',import.meta.url),'utf8').trim().split('\n');
const keys=rows.shift().split(',');
for(const [index,row]of rows.entries()){
 const v=Object.fromEntries(row.split(',').map((value,i)=>[keys[i],['id','alternative'].includes(keys[i])?value:value===''?null:Number(value)]));
 test(`R association convention ${index+1}: ${v.id}`,()=>{
  const p={effect:v.effect,alpha:v.alpha,power:v.target,...(v.id==='correlation'?{alternative:v.alternative}:{predictors:v.predictors})};
  const solve=v.id==='correlation'?stats.correlationSampleSize:stats.regressionSampleSize;
  const fixed=v.id==='correlation'?stats.correlationPowerAt:stats.regressionPowerAt;
  const answer=solve(p);
  assert.deepEqual([answer.n,answer.total],[v.n,v.total]);
  assert.ok(Math.abs(answer.power-v.achieved)<2e-9,`Power ${answer.power} vs R ${v.achieved}`);
  assert.equal(answer.power,fixed({...p,n:answer.n}).power);
  assert.ok(answer.power>=p.power);
  if(v.previous!==null){
   const before=fixed({...p,n:answer.n-1});
   assert.ok(Math.abs(before.power-v.previous)<2e-9,`Previous ${before.power} vs R ${v.previous}`);
   assert.ok(before.power<p.power);
  }else assert.equal(answer.n,v.id==='correlation'?4:p.predictors+2);
 });
}
test('correlation directions, sign symmetry and whole-observation bounds',()=>{
 const p={effect:.3,alpha:.05,power:.8,alternative:'two-sided'};
 assert.equal(stats.correlationSampleSize(p).n,85);
 assert.deepEqual(stats.correlationSampleSize(p),stats.correlationSampleSize({...p,effect:-.3}));
 assert.deepEqual(stats.correlationSampleSize({...p,alternative:'greater'}),stats.correlationSampleSize({...p,effect:-.3,alternative:'less'}));
 for(const bad of [{effect:0},{effect:1},{effect:-1},{effect:.999},{alternative:'less'},{alternative:'unknown'},{alpha:0},{power:1}])assert.throws(()=>stats.correlationSampleSize({...p,...bad}),RangeError);
 assert.throws(()=>stats.correlationPowerAt({...p,n:3}),RangeError);
 assert.throws(()=>stats.correlationPowerAt({...p,n:4.5}),RangeError);
 assert.throws(()=>stats.correlationSampleSize({...p,effect:.001}),/1,000,000/);
});
test('covariance mode preserves units, sign and independent drafts',()=>{
 const m=methods.correlation,raw={...m.defaults,mode:'covariance'},copy={...raw};
 assert.deepEqual(m.normalize(raw),m.normalize(m.defaults));assert.deepEqual(raw,copy);
 assert.equal(m.normalize({...raw,covariance:'300',sdX:'20',sdY:'50'}).effect,.3);
 assert.equal(m.normalize({...raw,covariance:'-3',alternative:'less'}).effect,-.3);
 for(const bad of [{covariance:'10'},{sdX:'0'},{sdY:'-1'},{covariance:''},{covariance:'Infinity'}])assert.throws(()=>m.normalize({...raw,...bad}),RangeError);
 assert.ok(m.notice.includes('Approximate'));assert.ok(m.calculationNote.includes('Not an exact'));
});
test('overall regression modes and model degrees of freedom',()=>{
 const m=methods.regression,raw={...m.defaults,mode:'r-squared'};
 assert.deepEqual(m.normalize(raw),m.normalize(m.defaults));
 assert.equal(stats.regressionSampleSize(m.normalize(raw)).n,77);
 assert.ok(Math.abs(m.normalize({...raw,rSquared:'.2'}).effect-.25)<1e-15);
 for(const bad of [{rSquared:'0'},{rSquared:'1'},{rSquared:'-0.1'},{rSquared:'.9'},{predictors:'0'},{predictors:'21'},{predictors:'3.5'}])assert.throws(()=>m.normalize({...raw,...bad}),RangeError);
 for(const bad of [{effect:-.1},{effect:0},{predictors:1.5},{predictors:0},{predictors:21},{power:1},{alpha:0}])assert.throws(()=>stats.regressionSampleSize({...m.normalize(raw),...bad}),RangeError);
 assert.throws(()=>stats.regressionPowerAt({...m.normalize(raw),n:4}),RangeError);
 const fixed=stats.regressionPowerAt({...m.normalize(raw),n:77});assert.equal(fixed.df1,3);assert.equal(fixed.df2,73);
});
test('Earth and all playable districts have complete method/content/art contracts',()=>{
 const sandbox={globalThis:{StatFighter:{methods,stats}}};vm.runInNewContext(readFileSync(new URL('../journey/content.js',import.meta.url),'utf8'),sandbox);
 const {worldMap,regions,fighters}=sandbox.globalThis.StatFighter.content;
 assert.equal(worldMap.width/worldMap.height,2);assert.ok(worldMap.image.includes('earth-world'));
 assert.ok(existsSync(new URL('../'+worldMap.image,import.meta.url)));
 const precache=readFileSync(new URL('../sw.js',import.meta.url),'utf8').match(/const files = \[([\s\S]*?)\];/)[1];
 const tiered=file=>{assert.ok(file.startsWith('./assets/web/'),`${file} uses the web tier`);const full=file.replace('./assets/web/','./assets/');
  assert.ok(existsSync(new URL('../'+full,import.meta.url)),`${full} full-size counterpart exists`);assert.ok(precache.includes(`'${full}'`),`${full} is precached`);};
 tiered(worldMap.image);
 for(const [id,m]of Object.entries(methods)){
  const f=fighters[id];assert.ok(f,`${id} fighter`);assert.ok(regions.some(r=>r.id===f.region));
  for(const file of [f.image,f.stageImage]){assert.ok(existsSync(new URL('../'+file,import.meta.url)),file);tiered(file);}
  assert.ok(m.solve&&m.normalize&&m.assumptions);
 }
 assert.equal(Object.values(fighters).filter(f=>f.region==='association').length,2);
 assert.equal(regions.filter(r=>Object.values(fighters).some(f=>f.region===r.id)).length,6);
 // 44px map controls must remain separate at the narrowest supported map width.
 for(let i=0;i<regions.length;i++)for(let j=i+1;j<regions.length;j++){
  const a=regions[i],b=regions[j];assert.ok(Math.abs(a.x-b.x)*266/100>=44||Math.abs(a.y-b.y)*133/100>=44,`${a.id}/${b.id} overlap at 320px`);
 }
});
