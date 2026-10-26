import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { classify, recordKey, sourceRows } from '../js/catalog.js';

const zBytes = await fs.readFile(new URL('../data/img2img-prompts.json', import.meta.url));
const bBytes = await fs.readFile(new URL('../data/bangyan-data.json', import.meta.url));
const z = JSON.parse(zBytes), b = JSON.parse(bBytes);
const map = JSON.parse(await fs.readFile(new URL('../data/catalog-map.json', import.meta.url), 'utf8'));
const rows = sourceRows(z,b);

test('分类映射覆盖每条原记录，ID唯一，源文件字节校验一致', () => {
  assert.equal(rows.length,754);
  assert.equal(Object.keys(map.entries).length,rows.length);
  assert.equal(new Set(rows.map(r=>recordKey(r.suite,r.kind,r.entry))).size,rows.length);
  assert.equal(createHash('sha256').update(zBytes).digest('hex'),map.sourceHashes['img2img-prompts.json']);
  assert.equal(createHash('sha256').update(bBytes).digest('hex'),map.sourceHashes['bangyan-data.json']);
  for(const row of rows) assert.ok(map.entries[recordKey(row.suite,row.kind,row.entry)]?.category);
});

test('正文范围按显式指令区分单项与综合方案，未改动输入记录', () => {
  const outfit={id:'a',title:'纯丝袜',positive:'上身更换为针织上衣。下身搭配短裙与长筒袜。'};
  const before=structuredClone(outfit);
  assert.equal(classify(outfit,'direct').category,'穿搭调整');
  assert.deepEqual(outfit,before);
  const composite={id:'b',title:'站姿',positive:'人物自然站立，一条腿向前。下身搭配短裙。场景调整为酒店房间。'};
  const result=classify(composite,'direct');
  assert.equal(result.category,'综合方案');
  assert.deepEqual(result.scopes,['穿搭调整','姿势与表情','场景与光线']);
});

test('仅供辨认组件保持不可复制用途标签', () => {
  const component=b.components.find(c=>c.subcategory==='胸型调整');
  assert.ok(component);
  const result=classify(component,'component',b.components);
  assert.equal(result.category,'仅供辨认');
});

test('未识别内容进入未分类，不把审查问题当作分类', () => {
  const result=classify({id:'c',title:'站姿',positive:'保持原人物特征。'},'direct');
  assert.equal(result.category,'未分类');
});
