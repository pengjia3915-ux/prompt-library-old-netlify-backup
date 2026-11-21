import {approvedContentBaseline} from './approved-content-baseline.mjs';
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {createHash} from 'node:crypto';
import {filterCostumes,costumeInstruction,costumeTextInstruction,hasCheckedCostumeText,validateCostumeCatalog,withDesignedCostumes} from '../js/costume-model.js';
// Preserve historical hashes; only the audited import URL migration is allowed.
function baselineBytes(file) {
 const bytes=approvedContentBaseline(file);
 return ['js/storage.js','js/sync.js'].includes(file)
  ? Buffer.from(bytes.toString('utf8').replace('./suite-utils.js?v=4.4.0','./suite-utils.js?v=4.2.0')) : bytes;
}
const catalog=JSON.parse(fs.readFileSync(new URL('../data/costume-reference/catalog.json',import.meta.url),'utf8'));
test('服装目录完整保留1407原编号、8分类与双语标签，不混入脸或姿势',()=>{
 validateCostumeCatalog(catalog);assert.equal(catalog.items.length,1407);assert.equal(catalog.categories.length,8);
 assert.equal(new Set(catalog.items.map(x=>x.id)).size,1407);
 for(const c of catalog.categories)assert.equal(catalog.items.filter(x=>x.category===c.name).length,c.n,c.name);
 for(const item of catalog.items){assert.equal(item.id,item.sourceRecord.id);assert.deepEqual(item.tags,item.sourceRecord.zh);assert.deepEqual(item.keywords,item.sourceRecord.kw);assert.equal(item.category,catalog.categories[item.sourceRecord.c].name)}
});
test('中文、英文、编号与多关键词AND搜索可用，分类独立生效',()=>{
 assert.equal(filterCostumes(catalog.items,{query:'spr-0001'})[0].id,'SPR-0001');
 assert.ok(filterCostumes(catalog.items,{query:'象牙白 针织'}).some(x=>x.id==='SPR-0001'));
 assert.ok(filterCostumes(catalog.items,{query:'ivory knit'}).some(x=>x.id==='SPR-0001'));
 assert.equal(filterCostumes(catalog.items,{query:'并不存在的衣服'}).length,0);
 assert.equal(filterCostumes(catalog.items,{category:'派对'}).length,48);
 assert.ok(filterCostumes(catalog.items,{category:'夏',query:'白色'}).every(x=>x.category==='夏'));
});
test('复制指令逐条对应所选套装，保留原图人物且不把标签猜成服装细节',()=>{
 for(const item of catalog.items){const instruction=costumeInstruction(item);assert.ok(instruction.includes(item.id));assert.ok(instruction.includes('图1为原人物图片'));assert.ok(instruction.includes('图2为这套服装的参考图'));assert.ok(instruction.includes('仅将人物穿搭更换'));assert.ok(instruction.includes('背景、光线、构图与画风'));assert.ok(!instruction.includes('curl '));assert.ok(!instruction.includes('参考脸'));assert.ok(!instruction.includes('ai-portrait-gallery'))}
});
test('原服装目录的外部图片仍按需加载',()=>{
 const dir=new URL('../data/costume-reference/',import.meta.url);assert.deepEqual(fs.readdirSync(dir).sort(),['SOURCE.md','catalog.json','designs','text-prompts.json']);
 assert.equal(catalog.imageStorage,'remote-on-demand');
 const sw=fs.readFileSync(new URL('../service-worker.js',import.meta.url),'utf8');assert.ok(sw.includes('requestUrl.origin !== self.location.origin'));
 const page=fs.readFileSync(new URL('../costume-reference.html',import.meta.url),'utf8');assert.ok(!page.includes('data/face'));assert.ok(!page.includes('gtag'));assert.ok(!page.includes('clarity'));
});
test('目录拒绝重复ID和非预期图片来源',()=>{
 const duplicate=structuredClone(catalog);duplicate.items[1].id=duplicate.items[0].id;assert.throws(()=>validateCostumeCatalog(duplicate));
 const bad=structuredClone(catalog);bad.items[0].imageUrl='https://example.invalid/image.png';assert.throws(()=>validateCostumeCatalog(bad));
});
test('新增参考区不修改原754条主库、251组动作词及存储同步实现',()=>{
 const hashes=JSON.parse(fs.readFileSync(new URL('../backups/before-costume-reference-20261102/source-hashes.json',import.meta.url),'utf8'));
 for(const [file,hash] of Object.entries(hashes))assert.equal(createHash('sha256').update(baselineBytes(file)).digest('hex'),hash,file);
});

test('1407套均可复制不依赖服装图片的中文文字版',()=>{
 for(const item of catalog.items){const text=costumeTextInstruction(item);assert.ok(text.includes(item.id));assert.ok(text.includes('原图成年人物'));assert.ok(text.includes('仅调整服装穿搭'));assert.ok(!/图2|两张图|https?:|同时上传|curl/.test(text));for(const tag of new Set(item.tags))assert.ok(text.includes(tag))}
});
test('全部1407套都有独立看图描述，来源正确且纯文字不依赖第二张图',()=>{
 const entries=JSON.parse(fs.readFileSync(new URL('../data/costume-reference/text-prompts.json',import.meta.url),'utf8')).entries;
 assert.deepEqual(Object.keys(entries).sort(),catalog.items.map(x=>x.id).sort());
 for(const item of catalog.items){
  const entry=entries[item.id];assert.equal(hasCheckedCostumeText(item,entries),true,item.id);
  assert.ok(entry.description.length>=40,item.id);assert.equal(entry.generationTested,false);
  const text=costumeTextInstruction(item,entries);assert.ok(text.includes(entry.description.trim()));
  assert.ok(!/图2|两张图|https?:|互斥单品择一|服装设计关键词/.test(text),item.id);
 }
 const original=JSON.parse(fs.readFileSync(new URL('../backups/before-costume-full-captions-20261102/data/costume-reference/text-prompts.json.bak',import.meta.url),'utf8'));
 assert.deepEqual(entries['SPR-0001'],original.entries['SPR-0001']);
 const item=catalog.items[0];assert.equal(hasCheckedCostumeText(item,{[item.id]:{...entries[item.id],sourceImage:'different'}}),false);
 assert.ok(costumeTextInstruction(item,{}).includes('互斥单品择一使用'));
});

test('补充服装描述不改变目录、主库、动作数据或同步存储',()=>{
 const hashes=JSON.parse(fs.readFileSync(new URL('../backups/before-costume-full-captions-20261102/source-hashes.json',import.meta.url),'utf8'));
 for(const [file,hash] of Object.entries(hashes))assert.equal(createHash('sha256').update(baselineBytes(file)).digest('hex'),hash,file);
});


test('18 套服装设计支持搜索与换装词前缀，保留原目录内容', () => {
  const designPath = new URL('../data/costume-reference/designs/catalog.json', import.meta.url);
  const designs = JSON.parse(fs.readFileSync(designPath, 'utf8'));
  const combined = withDesignedCostumes(catalog, designs);
  assert.equal(combined.items.length, 1425);
  assert.deepEqual(combined.items.slice(18), catalog.items);
  assert.deepEqual(combined.categories.slice(2), catalog.categories);
  assert.equal(filterCostumes(combined.items, { category: '古装' }).length, 13);
  assert.equal(filterCostumes(combined.items, { category: '现代写真' }).length, 5);
  assert.equal(filterCostumes(combined.items, { query: '青碧水墨' })[0].id, 'DES-0004');
  assert.equal(filterCostumes(combined.items, { query: '现代古风 盘扣' })[0].id, 'DES-0009');
  assert.deepEqual(
    filterCostumes(combined.items, { query: '露腿款' }).map(item => item.id),
    ['DES-0013', 'DES-0014', 'DES-0015', 'DES-0016', 'DES-0017', 'DES-0018']
  );
  assert.throws(() => withDesignedCostumes(catalog, { items: [designs.items[0], designs.items[0]] }));
  assert.ok(costumeTextInstruction(catalog.items[0]).startsWith('文字换装：'));
  assert.ok(costumeInstruction(catalog.items[0]).startsWith('服装参考：'));

  for (const item of combined.items.slice(0, 18)) {
    assert.equal(hasCheckedCostumeText(item), true, item.id);
    const text = costumeTextInstruction(item);
    assert.ok(text.includes(item.title) && text.includes(item.description), item.id);
    assert.doesNotMatch(text, /图2|两张图|https?:|服装设计关键词/, item.id);
    const imagePrompt = costumeInstruction(item);
    assert.ok(imagePrompt.includes(item.title) && imagePrompt.includes('图2为这套服装的参考图'), item.id);
    for (const prompt of [text, imagePrompt]) {
      assert.ok(prompt.startsWith('模特身材丰满。\n\n'), item.id);
      assert.equal((prompt.match(/模特身材丰满/g) || []).length, 1, item.id);
    }
    for (const relativePath of [item.imageUrl, item.thumbnailUrl]) {
      assert.ok(fs.statSync(new URL('../' + relativePath, import.meta.url)).size > 0, relativePath);
    }
  }
});
