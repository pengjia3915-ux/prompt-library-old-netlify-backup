import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {groupPoses,resolveActionPrompt} from '../js/pose-model.js';
const root=new URL('../data/pose-reference/',import.meta.url);
const groups=groupPoses(JSON.parse(fs.readFileSync(new URL('catalog.json',root),'utf8')).records);
const entries=JSON.parse(fs.readFileSync(new URL('action-prompts.json',root),'utf8')).entries;
test('25组动作125视角均引用真实参考，正文包含当前视角，图生图指令保留原图约束',()=>{
 assert.equal(Object.keys(entries).length,25);let count=0;
 for(const [key,entry] of Object.entries(entries)){
  const group=groups.find(g=>g.key===key);assert.ok(group);assert.equal(Object.keys(entry.views).length,5);
  assert.equal(entry.generationTested,false);const before=JSON.stringify(group);
  const texts=new Set();
  for(const view of group.views){const value=resolveActionPrompt(group,view,entries);assert.ok(value);assert.ok(value.action.includes(entry.pose));assert.ok(value.action.includes(entry.views[view.id]));assert.ok(value.instruction.includes('服装和场景不变'));assert.ok(value.instruction.includes(value.action));texts.add(value.action);count++}
  assert.equal(texts.size,5);assert.equal(JSON.stringify(group),before);
 }
 assert.equal(count,125);
});
test('未核对动作或不存在的角度返回null，不凭标题生成正文',()=>{
 const unknown=groups.find(g=>!entries[g.key]);assert.equal(resolveActionPrompt(unknown,unknown.views[0],entries),null);
 const known=groups.find(g=>entries[g.key]);assert.equal(resolveActionPrompt(known,{id:'nonexistent'},entries),null);
});
