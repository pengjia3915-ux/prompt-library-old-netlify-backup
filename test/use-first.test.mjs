import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {classify} from '../js/catalog.js';
import {normalizePromptEdits, normalizeSavedCompositions, mergeSyncedSuiteState, parseUserBackup} from '../js/suite-utils.js';

test('保留条件与适用场景不误算为修改，混合指令不丢失',()=>{
  const r=classify({positive:'保持原姿势和酒店场景不变，仅调整穿搭。上身更换为针织上衣。整体适合酒店写真。'},'direct');
  assert.deepEqual(r.scopes,['穿搭调整']);
  const mixed=classify({positive:'保持人物脸型不变，人物站在咖啡馆窗边。身穿宽松针织衫。'},'direct');
  assert.ok(mixed.scopes.includes('姿势与表情'));
  assert.ok(mixed.scopes.includes('场景与光线'));
  assert.ok(mixed.scopes.includes('穿搭调整'));
});

test('内部重复只标记、不重写原文',()=>{
  const positive='保持人物身份与脸型完全不变。将服装调整为柔软的白色针织衫。保持人物身份与脸型完全不变。将服装调整为柔软的白色针织衫。';
  const entry={positive};
  assert.ok(classify(entry,'direct').issues.some(x=>x.includes('内部重复')));
  assert.equal(entry.positive,positive);
});

test('人工说明标签用途通过规范化、同步合并和备份恢复保留',()=>{
  const entry={id:'test',kind:'direct',title:'人工标题',positive:'原文\n原文',negative:'',description:'人工说明',tags:['原标签'],browseScopes:['姿势与表情'],updatedAt:'2026-10-26T00:00:00Z'};
  const edits=normalizePromptEdits([entry]);
  const merged=mergeSyncedSuiteState({promptEdits:edits},{promptEdits:[]});
  const backup=parseUserBackup(JSON.stringify({format:'prompt-library-user-state',version:1,suites:{bangyan:merged}}));
  const result=normalizePromptEdits(backup.suites.bangyan.promptEdits)[0];
  for(const field of ['positive','description','tags','browseScopes'])assert.deepEqual(result[field],entry[field]);
  const saved=normalizeSavedCompositions([{...entry,builder:{}}])[0];
  assert.equal(saved.description,entry.description);
});

test('本轮前后两份正式数据字节一致',async()=>{
  const baseline=JSON.parse(await fs.readFile(new URL('../backups/before-use-first/source-hashes.json',import.meta.url),'utf8'));
  for(const item of baseline){
    const name=item.Path.split(/[\\/]/).at(-1);
    const bytes=await fs.readFile(new URL('../data/'+name,import.meta.url));
    assert.equal(createHash('sha256').update(bytes).digest('hex').toUpperCase(),item.Hash);
  }
});
