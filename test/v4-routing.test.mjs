import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {classify,sourceRows} from '../js/catalog.js';
import {contentType,belongsToWorkspace,copyPriority} from '../js/browse-model.js';
import {createPreviewServer} from '../scripts/preview-server.mjs';
import {createServer} from 'node:http';
const z=JSON.parse(await readFile(new URL('../data/img2img-prompts.json',import.meta.url)));
const b=JSON.parse(await readFile(new URL('../data/bangyan-data.json',import.meta.url)));
const rows=sourceRows(z,b).map(row=>({...row,meta:classify(row.entry,row.kind,b.components)}));
test('直接复制覆盖全部519条完整内容，235条组件仍可独立查找',()=>{
  assert.equal(rows.length,754);
  const direct=rows.filter(r=>belongsToWorkspace('browse',r.kind,r.meta));
  const goals=rows.filter(r=>belongsToWorkspace('goals',r.kind,r.meta));
  const components=rows.filter(r=>belongsToWorkspace('components',r.kind,r.meta));
  assert.equal(goals.length+components.length,754);assert.equal(components.length,235);
  assert.equal(direct.filter(r=>r.kind==='preset').length,24);
  assert.equal(direct.length,519);
  assert.ok(direct.some(r=>contentType(r.kind,r.meta)==='single'));
  assert.ok(direct.every(r=>contentType(r.kind,r.meta)!=='component'));
  for(const r of rows)assert.ok(belongsToWorkspace('mine',r.kind,r.meta));
});

test('常用排序读取真实复制记录，来源与内容类型隔离，不凭相同ID串用',()=>{
 const states={zhuangyuan:{recent:[{id:'prompt:same',copiedAt:'2026-11-06T01:00:00Z'}]},bangyan:{recent:[{id:'direct:same',copiedAt:'2026-11-05T01:00:00Z'}]}};
 assert.equal(copyPriority({suite:'zhuangyuan',kind:'prompt',entry:{id:'same'}},states).copiedAt,Date.parse('2026-11-06T01:00:00Z'));
 assert.equal(copyPriority({suite:'bangyan',kind:'prompt',entry:{id:'same'}},states).copiedAt,0);
 const saved=copyPriority({suite:'bangyan',kind:'direct',entry:{id:'same'}},states,{favorite:true,pinned:true});
 assert.equal(saved.favorite,1);assert.equal(saved.pinned,1);assert.equal(saved.copiedAt,Date.parse('2026-11-05T01:00:00Z'));
 assert.equal(copyPriority({suite:'zhuangyuan',kind:'prompt',entry:{id:'unused'}},states).copiedAt,0);
});
test('本地预览只转发原同步协议；失败时可返回错误，不伪造同步成功',async()=>{
  const received=[];
  const upstream=createServer(async(req,res)=>{let body='';for await(const c of req)body+=c;received.push({url:req.url,method:req.method,auth:req.headers.authorization,body});res.writeHead(200,{'Content-Type':'application/json'});res.end('{"ok":true}');});
  await new Promise(resolve=>upstream.listen(0,'127.0.0.1',resolve));
  const server=createPreviewServer({syncEndpoint:`http://127.0.0.1:${upstream.address().port}/api/sync`});
  await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
  const base=`http://127.0.0.1:${server.address().port}`;
  try {
    const payload=JSON.stringify({version:1,iv:'test-iv',ciphertext:'encrypted-text'});
    const response=await fetch(base+'/api/sync?id=fixture',{method:'POST',headers:{Authorization:'Bearer fixture','Content-Type':'application/json'},body:payload});
    assert.equal(response.status,200);assert.equal(received[0].body,payload);assert.equal(received[0].auth,'Bearer fixture');assert.equal(received[0].url,'/api/sync?id=fixture');
    const blocked=await fetch(base+'/api/sync',{method:'POST',headers:{Origin:'https://unrelated.example'}});assert.equal(blocked.status,403);
    const html=await fetch(base+'/');assert.equal(html.status,200);assert.ok((await html.text()).includes('id="search-input"'));
    await new Promise(resolve=>upstream.close(resolve));
    const failed=await fetch(base+'/api/sync');assert.equal(failed.status,502);
  } finally {server.closeAllConnections();await new Promise(resolve=>server.close(resolve));if(upstream.listening)await new Promise(resolve=>upstream.close(resolve));}
});
