import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
const source=fs.readFileSync(new URL('../service-worker.js',import.meta.url),'utf8');
function worker(cached){
 const listeners={};let fetches=0;const queries=[];
 const context=vm.createContext({URL,Response,console,
  self:{location:{origin:'https://local.test'},addEventListener:(name,fn)=>listeners[name]=fn},
  caches:{open:async name=>({match:async(request,options)=>{queries.push({name,options});return cached},put:async()=>{}})},
  fetch:async()=>{fetches++;throw new Error('slow offline network')}
 });vm.runInContext(source,context);
 return {listeners,queries,get fetches(){return fetches}};
}
test('已缓存页面及同版本数据立即可用，不等待网络，不读取其他版本缓存',async()=>{
 for(const request of [{method:'GET',url:'https://local.test/?v=preview',mode:'navigate'},{method:'GET',url:'https://local.test/data/bangyan-data.json?v=release',mode:'cors'}]){
  const saved=new Response('cached release'),w=worker(saved);let result;
  w.listeners.fetch({request,respondWith:value=>result=value});
  assert.equal(await(await result).text(),'cached release');assert.equal(w.fetches,0);
  assert.ok(w.queries.every(q=>q.name==='prompt-library-v4.1.0-local2'));
  assert.equal(w.queries[0].options.ignoreSearch,request.mode==='navigate');
 }
});
test('API与大图不写PWA缓存，安装列表不预取整套图片',()=>{
 const w=worker(null);
 for(const path of ['/api/sync','/data/pose-reference/img/example.png','/data/pose-reference/thumbs/example.jpg']){
  let intercepted=false;w.listeners.fetch({request:{method:'GET',url:'https://local.test'+path,mode:'cors'},respondWith:()=>intercepted=true});assert.equal(intercepted,false);
 }
 const core=source.slice(source.indexOf('const CORE_ASSETS'),source.indexOf('const NETWORK_FIRST_PATHS'));
 assert.ok(!core.includes('/img/'));assert.ok(!core.includes('/thumbs/'));
});
