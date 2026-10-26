import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import {FAMILIES,familyFor,familyUnits} from '../js/families.js';
import {sourceRows,recordKey} from '../js/catalog.js';
const z=JSON.parse(await fs.readFile(new URL('../data/img2img-prompts.json',import.meta.url)));
const b=JSON.parse(await fs.readFile(new URL('../data/bangyan-data.json',import.meta.url)));
const rows=sourceRows(z,b), key=r=>recordKey(r.suite,r.kind,r.entry);
const lookup=r=>familyFor(r.suite,r.kind,r.entry);
test('所有同类组引用真实且唯一，区别备注完整，未混淆组件和直接内容',()=>{
  const ids=new Set(rows.map(key)), seen=new Set();
  for(const f of FAMILIES){assert.ok(f.members.length>=2);assert.ok(f.basis);
    assert.equal(new Set(f.members.map(m=>m.key.split(':')[1])).size,1);
    for(const m of f.members){assert.ok(ids.has(m.key),m.key);assert.ok(!seen.has(m.key),m.key);seen.add(m.key);assert.ok(m.difference);}
  }
});
test('归组和逐条模式记录数身份一致，顺序保持首个命中位置，不改原文',()=>{
  const before=JSON.stringify(rows),units=familyUnits(rows,lookup),flat=units.flatMap(u=>u.items);
  assert.equal(flat.length,754);assert.deepEqual(flat.map(key).sort(),rows.map(key).sort());assert.equal(JSON.stringify(rows),before);
  for(const u of units.filter(u=>u.family))assert.equal(key(u.items[0]),key(rows.find(r=>lookup(r)?.family.id===u.family.id)));
});
test('筛选后归组不带回未匹配成员，编辑版本不沿用旧差异说明',()=>{
  const r=rows.find(r=>r.entry.id==='direct_bold_pose_03');
  const units=familyUnits([r],lookup);assert.equal(units.length,1);assert.equal(units[0].items.length,1);
  assert.equal(familyFor(r.suite,r.kind,r.entry,true),null);
  assert.equal(familyFor('zhuangyuan',r.kind,r.entry),null);
});
