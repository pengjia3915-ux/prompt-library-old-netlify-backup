import test from 'node:test';
import assert from 'node:assert/strict';
import { mergeSyncedSuiteState, parseUserBackup, searchMatches, SUITE_STATE_KEYS } from '../js/suite-utils.js';
import { readStorageBundle, writeStorageBundle, SUITE_FALLBACK_KEY } from '../js/storage.js';

test('多关键词按 AND 匹配，不要求关键词连续', () => {
  assert.equal(searchMatches({title:'窗边坐姿', prompt:'蓝色衣服'}, '坐姿 蓝色'), true);
  assert.equal(searchMatches({title:'窗边坐姿'}, '坐姿 红色'), false);
});
test('取消收藏不会被旧远端复活；重新收藏可覆盖取消', () => {
  const removed = {favoriteIds:[],favoriteChanges:{'prompt:a':{value:false,updatedAt:'2026-09-06T01:00:00Z'}}};
  const legacy = {favoriteIds:['prompt:a','prompt:b']};
  const merged = mergeSyncedSuiteState(removed, legacy);
  assert.deepEqual(merged.favoriteIds,['prompt:b']);
  assert.deepEqual(mergeSyncedSuiteState(legacy,removed).favoriteIds,['prompt:b']);
  const added = {favoriteIds:['prompt:a'],favoriteChanges:{'prompt:a':{value:true,updatedAt:'2026-09-06T02:00:00Z'}}};
  assert.ok(mergeSyncedSuiteState(merged, added).favoriteIds.includes('prompt:a'));
});
test('备份校验拒绝误选正式数据，保留正文和未知字段', () => {
  assert.throws(()=>parseUserBackup('{"version":1,"champion":[]}'));
  const backup={format:'prompt-library-user-state',version:1,suites:{bangyan:{customPrompts:[{id:'a',title:'测试',prompt:'原文\n  保留。',legacy:{x:1}}]}}};
  assert.deepEqual(parseUserBackup(JSON.stringify(backup)),backup);
  assert.throws(()=>parseUserBackup(JSON.stringify({...backup,suites:{bangyan:{favoriteIds:{}}}})));
});

// Minimal transactional IndexedDB fixture: exercises storage keys and fallback recovery.
function environment() {
  const local = new Map(), db = new Map();
  const indexedDB = {open() {
    const request={};
    queueMicrotask(()=>{
      request.result={objectStoreNames:{contains:()=>true},close(){},transaction() {
        const jobs=[], transaction={};
        transaction.objectStore=()=>({get(key){const r={};jobs.push(()=>{r.result=db.get(key);r.onsuccess?.();});return r;},put(value,key){jobs.push(()=>db.set(key,structuredClone(value)));}});
        queueMicrotask(()=>{jobs.forEach(job=>job());transaction.oncomplete?.();});
        return transaction;
      }};
      request.onsuccess?.();
    });
    return request;
  }};
  globalThis.window={indexedDB,localStorage:{getItem:key=>local.get(key)||null,setItem:(key,value)=>local.set(key,value),removeItem:key=>local.delete(key)}};
  return {local,db,indexedDB};
}
test('IndexedDB 正常保存后刷新按真实 key 恢复两个版本', async () => {
  environment();
  await writeStorageBundle({zhuangyuan:{favoriteIds:['prompt:a']},bangyan:{recent:[{id:'b'}]},meta:{activeSuite:'bangyan'}});
  const result=await readStorageBundle();
  assert.deepEqual(result.zhuangyuan.favoriteIds,['prompt:a']);
  assert.equal(result.bangyan.recent[0].id,'b');
  assert.equal(result.meta.activeSuite,'bangyan');
});
test('IndexedDB 恢复可用后先恢复最新 fallback，再提交清除备用快照', async () => {
  const env=environment();
  env.db.set(SUITE_STATE_KEYS.zhuangyuan,{favoriteIds:['old']});
  delete window.indexedDB;
  assert.equal(await writeStorageBundle({zhuangyuan:{favoriteIds:['new']},bangyan:{builder:{pose:'pose_04'}},meta:{}}),'localStorage-fallback');
  window.indexedDB=env.indexedDB;
  const recovered=await readStorageBundle();
  assert.deepEqual(recovered.zhuangyuan.favoriteIds,['new']);
  await writeStorageBundle(recovered);
  assert.equal(env.local.has(SUITE_FALLBACK_KEY),false);
  assert.deepEqual((await readStorageBundle()).zhuangyuan.favoriteIds,['new']);
});
test('旧 fallback 不能覆盖已更新的 IndexedDB 提交', async () => {
  const env=environment();
  await writeStorageBundle({zhuangyuan:{favoriteIds:['new']},bangyan:{},meta:{}});
  env.local.set(SUITE_FALLBACK_KEY,JSON.stringify({zhuangyuan:{favoriteIds:['old']},bangyan:{},meta:{storageWrittenAt:1}}));
  assert.deepEqual((await readStorageBundle()).zhuangyuan.favoriteIds,['new']);
});
test('两个存储都失败时抛出错误，不伪装成保存成功', async () => {
  environment(); delete window.indexedDB;
  window.localStorage.setItem=()=>{throw new Error('quota');};
  await assert.rejects(writeStorageBundle({zhuangyuan:{},bangyan:{},meta:{}}),/无法保存/);
});
