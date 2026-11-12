import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import { readFileSync, existsSync } from 'node:fs';
const source = readFileSync(new URL('../sw.js', import.meta.url), 'utf8');
const version = source.match(/^const version = '([^']+)';$/m)[1];
function worker(scope='https://example.test/arcade/') {
  const listeners = {}, deleted = [], requests = [], fetched = [];
  const cache = { addAll: async files => { requests.push(...files); }, match: async () => undefined };
  const caches = { open: async () => cache, keys: async () => [], delete: async name => { deleted.push(name); } };
  let claimed = false;
  const self = { registration: { scope }, clients: { claim: async () => { claimed=true; } }, addEventListener: (event, fn) => listeners[event]=fn };
  class Request { constructor(path, options) { this.url=new URL(path,scope).href; this.cache=options.cache; } }
  vm.runInNewContext(source, { self, caches, Request, URL, fetch: async request => { fetched.push(request);return 'network'; } });
  const dispatch = async (type, properties={}) => {let work; listeners[type]({ ...properties, waitUntil: p=>work=p, respondWith: p=>work=p });return work;};
  return { listeners, dispatch, caches, cache, deleted, requests, fetched, claimed:()=>claimed };
}
test('offline install contains every real shell and journey asset, bypassing HTTP cache', async()=>{
 const w=worker();await w.dispatch('install');assert.equal(w.requests.length,45);
 for(const r of w.requests){assert.equal(r.cache,'reload');assert.ok(existsSync(new URL('..'+new URL(r.url).pathname.replace('/arcade',''),import.meta.url)),r.url);}
});
test('failed precache rejects installation and never activates or deletes previous version', async()=>{
 const w=worker();w.cache.addAll=async()=>{throw Error('asset missing')};await assert.rejects(w.dispatch('install'),/asset missing/);assert.deepEqual(w.deleted,[]);assert.equal(w.claimed(),false);
});
test('activation removes only older caches for this exact scope',async()=>{
 const w=worker();w.caches.keys=async()=>['stat-fighter-https://example.test/arcade/-v6',`stat-fighter-https://example.test/arcade/-${version}`,'stat-fighter-https://example.test/other/-v6','unrelated'];await w.dispatch('activate');assert.deepEqual(w.deleted,['stat-fighter-https://example.test/arcade/-v6']);assert.equal(w.claimed(),true);
});
test('root and index navigations including queries use the same cached app shell',async()=>{
 const w=worker();w.cache.match=async key=>key==='./index.html'?'offline shell':undefined;
 for(const url of ['https://example.test/arcade/','https://example.test/arcade/index.html?release=7'])assert.equal(await w.dispatch('fetch',{request:{url,method:'GET',mode:'navigate'}}),'offline shell');assert.equal(w.fetched.length,0);
});
test('cached assets work without network; uncached requests fall through',async()=>{
 const w=worker();w.cache.match=async r=>r.url.endsWith('stats.js')?'cached engine':undefined;
 assert.equal(await w.dispatch('fetch',{request:{url:'https://example.test/arcade/stats.js',method:'GET'}}),'cached engine');assert.equal(w.fetched.length,0);
 assert.equal(await w.dispatch('fetch',{request:{url:'https://example.test/arcade/tests/browser-qa.html',method:'GET'}}),'network');assert.equal(w.fetched.length,1);
});
test('worker leaves other origins, paths and non-GET requests alone',async()=>{
 const w=worker();for(const request of [{url:'https://elsewhere.test/',method:'GET'},{url:'https://example.test/other/',method:'GET'},{url:'https://example.test/arcade/',method:'POST'}])assert.equal(await w.dispatch('fetch',{request}),undefined);assert.equal(w.fetched.length,0);
});
test('web-tier images are answered with the cached full-size original without network',async()=>{
 const w=worker();const keys=[];w.cache.match=async key=>{keys.push(key);return key==='https://example.test/arcade/assets/nova-arcade-v1.webp'?'full-size nova':undefined;};
 assert.equal(await w.dispatch('fetch',{request:{url:'https://example.test/arcade/assets/web/nova-arcade-v1.webp',method:'GET'}}),'full-size nova');
 assert.deepEqual(keys,['https://example.test/arcade/assets/nova-arcade-v1.webp']);assert.equal(w.fetched.length,0);
});
test('web-tier images fall through to the network until the full-size original is cached',async()=>{
 const w=worker();const request={url:'https://example.test/arcade/assets/web/nova-arcade-v1.webp',method:'GET'};
 assert.equal(await w.dispatch('fetch',{request}),'network');assert.deepEqual(w.fetched,[request]);
});
test('precache holds the full tier only, never assets/web/',async()=>{
 const w=worker();await w.dispatch('install');assert.ok(w.requests.length>0);
 for(const r of w.requests)assert.ok(!new URL(r.url).pathname.includes('/assets/web/'),r.url);
 assert.ok(w.requests.some(r=>r.url.endsWith('/assets/nova-arcade-v1.webp')));
});
