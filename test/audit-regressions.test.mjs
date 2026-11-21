import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import {mergeSyncedSuiteState} from '../js/suite-utils.js';
import {belongsToWorkspace, copyPriority} from '../js/browse-model.js';
import {sourceRows, classify} from '../js/catalog.js';
import {createPreviewServer} from '../scripts/preview-server.mjs';
import os from 'node:os';
import path from 'node:path';

const root = new URL('../', import.meta.url);
const read = file => fs.readFileSync(new URL(file, root), 'utf8');
const source = read('js/prototype.js');
function functionSource(name) {
  const start = source.search(new RegExp(`^(?:async )?function ${name}\\(`, 'm'));
  assert.ok(start >= 0, name);
  const remaining = source.slice(start);
  const next = remaining.slice(1).search(/^(?:async )?function /m);
  return next < 0 ? remaining : remaining.slice(0, next + 1);
}
function contextFor(name, globals) {
  const context = vm.createContext(globals);
  vm.runInContext(functionSource(name), context);
  return context;
}

test('PWA预缓存覆盖三个入口的所有传递模块依赖（包含查询版本）', () => {
  const sw = read('service-worker.js');
  const section = sw.slice(sw.indexOf('const CORE_ASSETS'), sw.indexOf('const NETWORK_FIRST_PATHS'));
  const base = 'https://library.test/';
  const cached = new Set([...section.matchAll(/"(\.\/[^\"]*)"/g)].map(([,url]) => new URL(url, base).href));
  const visited = new Set();
  const visit = url => {
    if (visited.has(url)) return;
    visited.add(url);
    assert.ok(cached.has(url), `离线缺少依赖: ${url}`);
    const file = new URL(url).pathname.slice(1);
    const content = read(file);
    const pattern = file.endsWith('.html') ? /<script[^>]+src="([^"]+)"/g : /(?:from\s+|import\s*)['"](\.[^'"]+)['"]/g;
    for (const [,dependency] of content.matchAll(pattern)) visit(new URL(dependency, url).href);
  };
  for (const file of ['index.html','pose-reference.html','costume-reference.html']) visit(new URL(file, base).href);
});

test('离线缓存写满时仍返回已成功下载的资源', async () => {
  const listeners = {};
  const context = vm.createContext({URL,Response,
    self:{location:{origin:'https://library.test'},addEventListener:(name,fn)=>listeners[name]=fn},
    caches:{open:async()=>({match:async()=>null,put:async()=>{throw Error('QuotaExceededError');}})},
    fetch:async()=>new Response('network response')
  });
  vm.runInContext(read('service-worker.js'),context);
  let response;
  listeners.fetch({request:{method:'GET',mode:'cors',url:'https://library.test/js/prototype.js?v=4.4.0'},respondWith:value=>response=value});
  assert.equal(await (await response).text(),'network response');
});

test('组件库重置筛选后仍有235条，主库支持原始ID检索', () => {
  const z = JSON.parse(read('data/img2img-prompts.json'));
  const b = JSON.parse(read('data/bangyan-data.json'));
  const rows = sourceRows(z,b);
  const context = contextFor('catalogItems',{
    studio:{workspace:'components',category:'全部',type:'all'},
    CATEGORIES:['全部'],app:{states:{},searchQuery:''},catalogUniverse:()=>rows,
    inSuite:(_suite,fn)=>fn(),isFavorite:()=>false,isPinned:()=>false,
    copyPriority,belongsToWorkspace,catalogMeta:(kind,entry)=>classify(entry,kind,b.components),
    familyFor:()=>null,hasPromptEdit:()=>false,effectiveEntry:(_kind,entry)=>entry,
    displayFor:(_kind,entry)=>({title:entry.title,positive:entry.prompt||entry.positive||''}),
    categoryNameFor:()=>''
  });
  assert.equal(context.catalogItems().length,235);
  context.studio.workspace='browse';
  assert.equal(context.catalogItems().length,519);
  context.app.searchQuery='default-001';
  assert.equal(context.catalogItems().length,1);
  assert.equal(context.catalogItems()[0].entry.id,'default-001');
});

test('剪贴板等待期间切换来源，复制历史仍写入原来源', async () => {
  let resolveCopy;
  const recorded=[];
  const app={activeSuite:'zhuangyuan'};
  const context=contextFor('copyEntry',{
    app,findEntry:()=>({id:'a'}),displayFor:()=>({title:'A',positive:'正文',all:'正文'}),
    copyText:()=>new Promise(resolve=>resolveCopy=resolve),
    inSuite:(suite,fn)=>{const previous=app.activeSuite;try{app.activeSuite=suite;return fn();}finally{app.activeSuite=previous;}},
    recordRecent:()=>recorded.push(app.activeSuite),persist:async()=>true,renderRecent:()=>{},showToast:()=>{}
  });
  const operation=context.copyEntry('prompt','a');
  app.activeSuite='bangyan';resolveCopy(true);await operation;
  assert.deepEqual(recorded,['zhuangyuan']);assert.equal(app.activeSuite,'bangyan');
});

test('旧版无时间戳的表情和机位组合不会被误当为空组合', () => {
  for (const slot of ['expression','cameraPosition','cameraView']) {
    const local={builder:{[slot]:'local-selection'}};
    const remote={builder:{pose:'remote-selection'}};
    assert.deepEqual(mergeSyncedSuiteState(local,remote).builder,local.builder);
    assert.deepEqual(mergeSyncedSuiteState({builder:{}},local).builder,local.builder);
  }
});

test('组合复制在等待期间切换来源也只记录到榜眼', async () => {
  let resolveCopy;
  const recorded=[];
  const context=contextFor('copyBuilder',{
    app:{states:{bangyan:{builder:{}}}},normalizeBuilder:x=>x,
    composeBuilderResult:()=>({positive:'正文',title:'组合',componentIds:['a']}),
    copyText:()=>new Promise(resolve=>resolveCopy=resolve),inSuite:(suite,fn)=>{recorded.push(suite);return fn();},
    recordRecent:()=>{},persist:async()=>true,renderRecent:()=>{},showToast:()=>{}
  });
  const operation=context.copyBuilder('positive');resolveCopy(true);await operation;
  assert.deepEqual(recorded,['bangyan']);
});

test('同步错误在结束后仍可见，重复点击不会并发写云端', async () => {
  let rejectSync, calls=0;
  const statuses=[];
  const context=contextFor('syncNow',{
    app:{syncBusy:false,meta:{}},$:()=>({value:'code'}),normalizeSyncCode:x=>x,isValidSyncCode:()=>true,
    renderSyncStatus:message=>statuses.push(message),suiteSyncState:()=>({}),
    syncSuites:()=>{calls++;return new Promise((_resolve,reject)=>rejectSync=reject);}
  });
  const operation=context.syncNow();await context.syncNow();
  assert.equal(calls,1);rejectSync(Error('网络不可用'));await operation;
  assert.equal(statuses.at(-1),'网络不可用');assert.equal(context.app.syncBusy,false);
});

test('备用复制抛异常时移除临时文本框并显示手动复制', async () => {
  let removed=false, opened=false;
  const area={style:{},select:()=>{},remove:()=>removed=true};
  const dialog={querySelector:()=>({select:()=>{}}),addEventListener:()=>{},showModal:()=>opened=true};
  const context=contextFor('fallbackCopy',{
    document:{createElement:tag=>tag==='textarea'?area:dialog,body:{append:()=>{}},execCommand:()=>{throw Error('denied');}}
  });
  assert.equal(await context.fallbackCopy('原文'),false);
  assert.equal(removed,true);assert.equal(opened,true);
});

test('本地预览正确声明图片类型，并阻止编码反斜杠访问隐藏目录', async () => {
  const fixture=fs.mkdtempSync(path.join(os.tmpdir(),'prompt-audit-'));
  fs.mkdirSync(path.join(fixture,'.private'));
  fs.writeFileSync(path.join(fixture,'.private','fixture.txt'),'test-only');
  fs.writeFileSync(path.join(fixture,'sample.png'),'fixture');
  const server=createPreviewServer({root:fixture});
  await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
  const base=`http://127.0.0.1:${server.address().port}`;
  try {
    assert.equal((await fetch(base+'/sample.png')).headers.get('content-type'),'image/png');
    assert.equal((await fetch(base+'/folder%5c..%5c.private%5cfixture.txt')).status,403);
  } finally {
    server.closeAllConnections();await new Promise(resolve=>server.close(resolve));
    fs.rmSync(fixture,{recursive:true,force:true});
  }
});
