import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {applyApprovedContentRevisions} from '../js/suite-utils.js';
import {sourceRows, recordKey} from '../js/catalog.js';
import {approvedContentBaseline} from './approved-content-baseline.mjs';
const read = path => JSON.parse(fs.readFileSync(new URL('../'+path, import.meta.url),'utf8'));
const manifest = read('reports/project-audit-20261111/content-applied/changes.json');
const z = read('data/img2img-prompts.json');
const b = read('data/bangyan-data.json');
test('批准内容修改仅涉及39条41字段，ID、分类、标签及其他字段完整保留', () => {
  const before = ['data/img2img-prompts.json','data/bangyan-data.json'].map(f=>JSON.parse(approvedContentBaseline(f)));
  const rows = sourceRows(...before);
  assert.equal(rows.length,754);
  assert.equal(manifest.changes.length,41);
  assert.equal(new Set(manifest.changes.map(c=>c.key)).size,39);
  const byKey = new Map(rows.map(r=>[recordKey(r.suite,r.kind,r.entry),r.entry]));
  for (const c of manifest.changes) {
    assert.ok(['title','prompt','positive','actionBreakdown'].includes(c.field));
    assert.deepEqual(byKey.get(c.key)[c.field],c.before);
    byKey.get(c.key)[c.field]=c.after;
  }
  before[0].contentRevisions=manifest.changes.filter(c=>c.key.startsWith('zhuangyuan:')).map(c=>({id:c.key.split(':').at(-1),field:c.field,before:c.before,after:c.after}));
  assert.deepEqual([z,b],before);
});
test('旧默认内容刷新保留收藏置顶删除与本机修改，重复执行不改变结果', () => {
  for (const rev of z.contentRevisions) {
    const old={id:rev.id,[rev.field]:rev.before,pinned:true,pinOrder:7,deletedAt:'2026-11-01',favorite:true};
    const updated=applyApprovedContentRevisions(old,z.contentRevisions);
    assert.deepEqual(updated,{...old,[rev.field]:rev.after});
    assert.equal(old[rev.field],rev.before);
    assert.deepEqual(applyApprovedContentRevisions(updated,z.contentRevisions),updated);
    const edited={...old,[rev.field]:'我的手动修改'};
    assert.deepEqual(applyApprovedContentRevisions(edited,z.contentRevisions),edited);
  }
  const custom={id:'custom-1',prompt:'自定义正文'};
  assert.deepEqual(applyApprovedContentRevisions(custom,z.contentRevisions),custom);
});
test('旧默认刷新接入本机加载和同步回填，用户覆盖层独立保留',()=>{
  const source=fs.readFileSync(new URL('../js/prototype.js',import.meta.url),'utf8');
  assert.ok(source.includes('applyApprovedContentRevisions(storedEntry, defaultData.contentRevisions)'));
  assert.ok(source.includes('applyApprovedContentRevisions(entry, app.defaults.zhuangyuan.contentRevisions)'));
});
