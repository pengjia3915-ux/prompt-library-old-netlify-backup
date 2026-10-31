import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {createHash} from 'node:crypto';
import {groupPoses,resolveActionPrompt,filterPoses} from '../js/pose-model.js';
const root=new URL('../data/pose-reference/',import.meta.url);
const groups=groupPoses(JSON.parse(fs.readFileSync(new URL('catalog.json',root),'utf8')).records);
const entries=JSON.parse(fs.readFileSync(new URL('action-prompts.json',root),'utf8')).entries;
const baseline=JSON.parse(fs.readFileSync(new URL('../backups/before-pose-prompts-20261031/action-prompts.json',import.meta.url),'utf8')).entries;

test('251组1254真实视角都有独立中文动作词，不补造缺失视角',()=>{
 assert.equal(Object.keys(entries).length,251);let count=0;
 assert.deepEqual(new Set(Object.keys(entries)),new Set(groups.map(g=>g.key)));
 for(const group of groups){
  const entry=entries[group.key];
  assert.ok(entry.pose.length>20,group.key);assert.equal(entry.generationTested,false);
  assert.deepEqual(new Set(Object.keys(entry.views)),new Set(group.views.map(v=>v.id)),group.key);
  const before=JSON.stringify(group),texts=new Set();
  for(const view of group.views){
   const value=resolveActionPrompt(group,view,entries);assert.ok(value,view.id);
   assert.ok(value.action.includes(entry.pose));assert.ok(value.action.includes(entry.views[view.id]));
   assert.ok(/[\u4e00-\u9fff]/.test(entry.views[view.id]));
   assert.ok(value.instruction.includes('服装和场景不变'));assert.ok(value.instruction.includes(value.action));texts.add(value.action);count++;
  }
  assert.equal(texts.size,group.views.length,group.key);assert.equal(JSON.stringify(group),before);
 }
 assert.equal(count,1254);
});

test('最早25组125视角正文逐字段完全保留',()=>{
 assert.equal(Object.keys(baseline).length,25);
 for(const [key,value] of Object.entries(baseline))assert.deepEqual(entries[key],value,key);
});

test('不存在的动作或角度不会凭标题生成正文',()=>{
 assert.equal(resolveActionPrompt({key:'missing'}, {id:'missing'},entries),null);
 assert.equal(resolveActionPrompt(groups[0],{id:'nonexistent'},entries),null);
 const four=groups.find(g=>g.key==='全身单人・性感系:P018');assert.equal(four.views.length,4);
 assert.equal(Object.keys(entries[four.key].views).length,4);
});

test('双人指令分别保持两人身份，不再要求不添加人物却只用单人原图',()=>{
 const g=groups.find(g=>g.family==='pair'),v=resolveActionPrompt(g,g.views[0],entries);
 assert.ok(v.instruction.includes('两位成年人物'));assert.ok(v.instruction.includes('分别保持各自身份'));
 assert.ok(v.instruction.includes('若原图不是双人'));assert.ok(!v.instruction.includes('唯一人物参考'));
});

test('主库和图片目录源数据字节不受动作词补齐影响',()=>{
 const baseline=JSON.parse(fs.readFileSync(new URL('../backups/before-pose-prompts-20261031/source-hashes.json',import.meta.url),'utf8'));
 for(const [file,hash] of Object.entries(baseline))assert.equal(createHash('sha256').update(fs.readFileSync(new URL('../'+file,import.meta.url))).digest('hex'),hash,file);
});

test('上半身指令不虚构看不到的下肢或强制扩成全身',()=>{
 const g=groups.find(g=>g.family==='upper'),v=resolveActionPrompt(g,g.views[0],entries);
 assert.ok(v.instruction.includes('仅调整可见的上半身'));
 assert.ok(v.instruction.includes('保留原图下肢状态'));
 assert.ok(!v.instruction.includes('完整保留动作所需的手脚'));
});

test('动作搜索覆盖新增中文正文，并保持多关键词AND筛选',()=>{
 const group=groups.find(g=>g.key==='全身单人・标准系:P008');
 const result=filterPoses(groups,{query:'坐部 脑后',entries});
 assert.ok(result.some(g=>g.key===group.key));
 assert.equal(filterPoses(groups,{query:'坐部 不存在的测试词',entries}).length,0);
 assert.equal(filterPoses(groups,{family:'upper',query:'坐部 脑后',entries}).some(g=>g.family!=='upper'),false);
});
