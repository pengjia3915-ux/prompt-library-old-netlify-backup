import test from 'node:test';
import assert from 'node:assert/strict';
import {createServer} from 'node:http';
import {createPreviewServer} from '../scripts/preview-server.mjs';
import {syncSuites,createSyncCode} from '../js/sync.js';

test('两设备通过本地代理完成原加密同步协议，状元榜眼保持隔离',async()=>{
  const store=new Map(),wire=[];
  const upstream=createServer(async(req,res)=>{
    const id=req.headers['x-sync-id'],auth=req.headers['x-sync-auth'];
    if(!/^[a-f0-9]{64}$/.test(id||'')||!/^[a-f0-9]{64}$/.test(auth||'')){res.writeHead(400);res.end('{}');return;}
    res.setHeader('Content-Type','application/json');
    if(req.method==='POST'){
      let body='';for await(const c of req)body+=c;
      wire.push(body);const {payload}=JSON.parse(body);store.set(id,payload);res.end('{"ok":true}');
    }else res.end(JSON.stringify({exists:store.has(id),payload:store.get(id)}));
  });
  await new Promise(resolve=>upstream.listen(0,'127.0.0.1',resolve));
  const server=createPreviewServer({syncEndpoint:`http://127.0.0.1:${upstream.address().port}/api/sync`});
  await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
  const oldFetch=globalThis.fetch,oldWindow=globalThis.window;
  globalThis.window={crypto:globalThis.crypto};
  globalThis.fetch=(url,options)=>oldFetch(url==='/api/sync'?`http://127.0.0.1:${server.address().port}/api/sync`:url,options);
  try{
    const code=createSyncCode(),now=new Date().toISOString();
    const a=await syncSuites({code,zhuangyuan:{prompts:[{id:'device-z',title:'状元同步验收',prompt:'source-z-secret',categoryId:'image-edit',updatedAt:now}]},bangyan:{customPrompts:[{id:'device-b',kind:'direct',title:'榜眼同步验收',prompt:'source-b-secret',categoryId:'姿势穿搭场景',updatedAt:now}]}});
    const b=await syncSuites({code,zhuangyuan:{prompts:[]},bangyan:{customPrompts:[]}});
    assert.equal(a.hadRemotePayload,false);assert.equal(b.hadRemotePayload,true);
    assert.ok(b.suites.zhuangyuan.prompts.some(x=>x.id==='device-z'));
    assert.ok(b.suites.bangyan.customPrompts.some(x=>x.id==='device-b'));
    assert.ok(!b.suites.zhuangyuan.prompts.some(x=>x.id==='device-b'));
    assert.ok(wire.every(x=>!x.includes('source-z-secret')&&!x.includes('source-b-secret')));
    assert.ok(wire.every(x=>JSON.parse(x).payload.ciphertext.length>20));
  }finally{
    globalThis.fetch=oldFetch;if(oldWindow===undefined)delete globalThis.window;else globalThis.window=oldWindow;
    server.closeAllConnections();upstream.closeAllConnections();
    await Promise.all([new Promise(resolve=>server.close(resolve)),new Promise(resolve=>upstream.close(resolve))]);
  }
});
