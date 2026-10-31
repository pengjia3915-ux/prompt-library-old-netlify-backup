import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {groupPoses,filterPoses,normalizePoseState,ANGLES} from '../js/pose-model.js';
const root=new URL('../data/pose-reference/',import.meta.url);
const data=JSON.parse(fs.readFileSync(new URL('catalog.json',root),'utf8'));
const groups=groupPoses(data.records);
test('本地251组1254视角按体系和编号归组，原始记录逐条保留且本地图片有效',()=>{
 assert.equal(groups.length,251);assert.equal(data.records.length,1254);
 assert.equal(new Set(data.records.map(r=>r.id)).size,1254);
 assert.equal(groups.reduce((n,g)=>n+g.views.length,0),1254);
 for(const group of groups){const expected=group.key==='全身单人・性感系:P018'?ANGLES.filter(a=>a!=='仰视'):ANGLES;assert.deepEqual(group.views.map(v=>v['角度']),expected)}
 for(const record of data.records){
  assert.ok(['全身单人・标准系','全身单人・性感系','上半身单人','双人缠绵'].includes(record['体系']));
  for(const key of ['缩略图','原图']){
   const bytes=fs.readFileSync(new URL(record[key],root));assert.ok(bytes.length>100);
   assert.ok(key==='原图'?bytes.subarray(0,8).equals(Buffer.from([137,80,78,71,13,10,26,10])):bytes[0]===255&&bytes[1]===216);
  }
 }
});
test('动作筛选与收藏以组为单位，不把五个角度当成五个动作',()=>{
 assert.equal(filterPoses(groups.filter(g=>g.system==='全身单人・标准系'),{category:'坐姿'}).length,14);
 const key=groups[0].key;assert.equal(filterPoses(groups,{favoriteOnly:true,favorites:[key]}).length,1);
 assert.equal(filterPoses(groups,{query:'P001 斜侧',family:'upper'}).length,1);
});
test('动作收藏备份拒绝误选正式库，仅保留有效动作并去重',()=>{
 assert.throws(()=>normalizePoseState({champion:[]},groups));
 const key=groups[0].key;
 assert.deepEqual(normalizePoseState({format:'prompt-library-pose-state',version:1,favorites:[key,key,'missing']},groups).favorites,[key]);
});
test('三种动作范围覆盖251组，重号动作不串收藏或动作词，原始字段逐条保留',()=>{
 const upstream=JSON.parse(fs.readFileSync(new URL('../reports/research/upstream-pose-zh.json',import.meta.url),'utf8').replace(/^\uFEFF/,''));
 const original=new Map(upstream.map(r=>[r.id,r]));
 for(const record of data.records)assert.deepEqual(record,original.get(record.id));
 assert.equal(filterPoses(groups,{family:'single'}).length,153);
 assert.equal(filterPoses(groups,{family:'upper'}).length,80);
 assert.equal(filterPoses(groups,{family:'pair'}).length,18);
 const repeated=groups.filter(g=>g.number==='P001');assert.ok(repeated.length>1);
 assert.equal(new Set(repeated.map(g=>g.key)).size,repeated.length);
 const saved=normalizePoseState({format:'prompt-library-pose-state',version:1,favorites:['全身单人・标准系:P001']},groups);
 assert.equal(filterPoses(groups,{favoriteOnly:true,favorites:saved.favorites}).length,1);
});
test('复核仅补回64组319视角，原187组及其所有图片引用不减少',()=>{
 const previous=JSON.parse(fs.readFileSync(new URL('../backups/before-pose-visual-recheck/data/pose-reference/catalog.json',import.meta.url),'utf8'));
 const current=new Map(data.records.map(r=>[r.id,r]));
 for(const record of previous.records)assert.deepEqual(current.get(record.id),record);
 assert.equal(data.records.length-previous.records.length,319);
 assert.equal(groups.length-groupPoses(previous.records).length,64);
 const notes=data.sourceNotes;
 assert.ok(notes['上半身单人:P026']);assert.ok(notes['上半身单人:P043']);
});
