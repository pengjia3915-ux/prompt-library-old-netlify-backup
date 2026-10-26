import fs from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { classify, recordKey, sourceRows } from '../js/catalog.js';
const root = new URL('../', import.meta.url);
const files = ['img2img-prompts.json', 'bangyan-data.json'];
const raw = await Promise.all(files.map(f => fs.readFile(new URL('data/' + f, root))));
const [z, b] = raw.map(x => JSON.parse(x));
const rows = sourceRows(z, b);
const entries = Object.fromEntries(rows.map(({suite, kind, entry}) => [recordKey(suite, kind, entry), classify(entry, kind, b.components)]));
const hashes = Object.fromEntries(files.map((f, i) => [f, createHash('sha256').update(raw[i]).digest('hex')]));
await fs.mkdir(new URL('reports/', root), {recursive:true});
await fs.writeFile(new URL('data/catalog-map.json', root), JSON.stringify({version:1, generatedAt:new Date().toISOString(), sourceHashes:hashes, entries}, null, 2));
const csv = value => '"' + String(value ?? '').replaceAll('"', '""') + '"';
await fs.writeFile(new URL('reports/分类对照.csv', root), '\ufeff' + [['key','标题','原分类','原分组','新分类','修改范围','主题','核对状态','问题','判断依据'], ...rows.map(({suite,kind,entry}) => {const key=recordKey(suite,kind,entry), m=entries[key]; return [key,entry.title,m.originalCategory,m.originalSubcategory,m.category,m.scopes.join(' / '),m.themes.join(' / '),m.status,m.issues.join('；'),m.evidence.map(e=>e.text).join('；')];})].map(row=>row.map(csv).join(',')).join('\n'));
const duplicate = field => {
  const groups = new Map();
  for (const row of rows) { const text = field === 'title' ? row.entry.title : row.entry.positive ?? row.entry.prompt; if(!text)continue; const ids=groups.get(text)||[]; ids.push(recordKey(row.suite,row.kind,row.entry)); groups.set(text,ids); }
  return [...groups].filter(([,ids])=>ids.length>1).map(([text,ids])=>({text,ids}));
};
const count = {};
for(const m of Object.values(entries))count[m.category]=(count[m.category]||0)+1;
const duplicates = {titles:duplicate('title'), prompts:duplicate('prompt')};
await fs.writeFile(new URL('reports/重复记录.json',root),JSON.stringify(duplicates,null,2));
const issues = rows.filter(r=>entries[recordKey(r.suite,r.kind,r.entry)].issues.length);
const report = `# 全量分类检查\n\n导出时间：${new Date().toISOString()}\n\n754 条源记录全部遍历；这是有原文证据的规则归类，不冒充逐条人工审核。问题标记仅放详情与审查报告，不作为浏览分类。正文、标题、ID、原分类及组合算法均未修改。主题是独立检索元数据，不写回原始 tags。\n\n## 兼容主分类数量（首页按修改范围多入口检索）\n\n${Object.entries(count).map(([k,v])=>`- ${k}：${v}`).join('\n')}\n\n迁移前：${rows.length}；映射后：${Object.keys(entries).length}；差异：${rows.length-Object.keys(entries).length}。\n\n同名组：${duplicates.titles.length}；完全相同正文组：${duplicates.prompts.length}。没有删除或合并。\n\n## 需要核对的正文（不自动改写）\n\n${issues.map(r=>`- ${recordKey(r.suite,r.kind,r.entry)} — ${r.entry.title}：${entries[recordKey(r.suite,r.kind,r.entry)].issues.join('；')}`).join('\n')}\n\n## 边界\n\n浏览器个人新增与覆盖层不在源码中，页面运行时进行同规则归类并标明；未读取其他端的个人数据。映射可删去恢复旧浏览分类，原源数据始终保留。全量原文证据见分类对照.csv。\n\n## 源数据 SHA256\n\n${JSON.stringify(hashes,null,2)}\n`;
await fs.writeFile(new URL('reports/内容审查.md',root),report);
console.log(JSON.stringify({records:rows.length,categories:count,issueRecords:issues.length,duplicates:{titles:duplicates.titles.length,prompts:duplicates.prompts.length}},null,2));
