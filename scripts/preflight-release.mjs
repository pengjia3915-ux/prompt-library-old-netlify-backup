import fs from 'node:fs';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {execFileSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const npm=process.platform==='win32'?'npm.cmd':'npm';
const run=cmd=>execFileSync(cmd[0],cmd.slice(1),{cwd:root,stdio:'inherit',shell:process.platform==='win32'});
run([npm,'test']);run([npm,'run','build']);
const client=path.join(root,'dist/client'),previous=path.resolve(root,'../../../..','prompt-library-old-netlify-publish','dist/client');
const read=rel=>fs.readFileSync(path.join(client,rel));
const json=rel=>JSON.parse(read(rel));
const catalog=json('data/pose-reference/catalog.json');
const entries=json('data/pose-reference/action-prompts.json').entries;
const keys=new Map();
for(const record of catalog.records){const key=record['体系']+':'+record['姿势编号'];if(!keys.has(key))keys.set(key,[]);keys.get(key).push(record)}
if(keys.size!==Object.keys(entries).length)throw Error('动作词组数与图片组数不一致');
for(const [key,views] of keys){
 const e=entries[key];if(!e?.pose||views.length!==Object.keys(e.views||{}).length)throw Error('动作词不完整:'+key);
 for(const v of views)if(!e.views[v.id])throw Error('缺少视角:'+v.id);
}
const files=[];
function walk(dir){for(const item of fs.readdirSync(dir,{withFileTypes:true})){const p=path.join(dir,item.name);if(item.isDirectory())walk(p);else files.push(path.relative(client,p).replaceAll('\\','/'))}}walk(client);
const hash=b=>createHash('sha256').update(b).digest('hex');
const delta=[];let totalBytes=0;
for(const rel of files){
 const bytes=read(rel);totalBytes+=bytes.length;
 const source=path.join(root,rel);if(!fs.existsSync(source)||hash(bytes)!==hash(fs.readFileSync(source)))throw Error('构建与源码不一致:'+rel);
 const old=path.join(previous,rel);if(!fs.existsSync(old)||hash(bytes)!==hash(fs.readFileSync(old)))delta.push({path:rel,bytes:bytes.length});
}
const sw=read('service-worker.js').toString();
const section=sw.slice(sw.indexOf('const CORE_ASSETS'),sw.indexOf('const NETWORK_FIRST_PATHS'));
for(const [,url] of section.matchAll(/"(\.\/[^"]*)"/g)){const rel=url.split('?')[0].replace(/^\.\//,'')||'index.html';if(!fs.existsSync(path.join(client,rel)))throw Error('缓存资源不存在:'+rel)}
const references=[];
for(const rel of ['index.html','pose-reference.html'])if(/本地.*预览|尚未发布/.test(read(rel).toString()))throw Error('发布页面仍含预览标识:'+rel);
const release=sw.match(/const CACHE_NAME = "prompt-library-([^"]+)"/)[1];
if(release.includes('local'))throw Error('发布资源仍使用本地版本号');

for(const rel of files.filter(x=>/\.(html|js)$/.test(x))){
 const content=read(rel).toString();
 const regex=rel.endsWith('.html')?/(?:src|href)="([^"]+)"/g:/(?:from\s+|import\s*)['"](\.[^'"]+)['"]/g;
 for(const [,url] of content.matchAll(regex)){
  if(!url||/^(https?:|#|data:|mailto:)/.test(url))continue;
  const clean=url.split(/[?#]/)[0];if(!clean)continue;
  const target=clean.startsWith('/')?path.join(client,clean):path.resolve(path.dirname(path.join(client,rel)),clean);
  if(!fs.existsSync(target))references.push({file:rel,url});
 }
}
if(references.length)throw Error('引用缺失:'+JSON.stringify(references));
const report={checkedAt:new Date().toISOString(),localOnly:true,testsPassed:true,buildPassed:true,groups:keys.size,views:catalog.records.length,promptGroups:Object.keys(entries).length,files:files.length,totalBytes,comparedWith:previous,changedFiles:delta.length,changedBytes:delta.reduce((s,x)=>s+x.bytes,0),changedImages:delta.filter(x=>/\.(png|jpg)$/.test(x.path)).length,delta};
fs.mkdirSync(path.join(root,'reports/release-audit'),{recursive:true});fs.writeFileSync(path.join(root,'reports/release-audit/preflight.json'),JSON.stringify(report,null,2));
console.log(JSON.stringify({...report,delta:undefined},null,2));
