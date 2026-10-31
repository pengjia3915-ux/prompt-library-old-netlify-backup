import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
const source=fs.readFileSync(new URL('../js/pose-reference.js',import.meta.url),'utf8');
const copySource=source.slice(source.indexOf('async function copyText('),source.indexOf("$('#copy').onclick"));
function copyHarness(execSucceeds){
 const preview={value:'原始动作预览'},nodes=new Map([['#prompt-preview',preview]]),toasts=[];
 const create=tag=>({tag,value:'',style:{},children:[],setAttribute(){},append(...children){this.children.push(...children)},querySelector(selector){return this.children.find(x=>x.tag===selector)},focus(){},select(){this.selected=true},showModal(){this.open=true},close(){this.open=false}});
 const context=vm.createContext({navigator:{clipboard:{writeText:async()=>{throw Error('permission denied')}}},toast:x=>toasts.push(x),$:id=>nodes.get(id),document:{createElement:create,body:{append:node=>nodes.set('#'+node.id,node)},execCommand:()=>execSucceeds}});
 vm.runInContext(copySource,context);return {context,preview,nodes,toasts};
}
test('剪贴板拒绝时备用复制不会改掉当前动作预览',async()=>{
 const h=copyHarness(true);await vm.runInContext("copyText('完整图生图指令','已复制')",h.context);
 assert.equal(h.preview.value,'原始动作预览');assert.equal(h.nodes.get('#copy-fallback').open,false);assert.deepEqual(h.toasts,['已复制']);
});
test('两种自动复制都失败时保留手动复制窗口，不假报成功',async()=>{
 const h=copyHarness(false);await vm.runInContext("copyText('完整图生图指令','已复制')",h.context);
 const dialog=h.nodes.get('#copy-fallback');assert.equal(dialog.open,true);assert.equal(dialog.querySelector('textarea').value,'完整图生图指令');assert.equal(dialog.querySelector('textarea').selected,true);assert.equal(h.preview.value,'原始动作预览');assert.equal(h.toasts.length,0);
});
test('从动作页直接进入时会检查新缓存，本地预览不注册缓存',async()=>{
 const code=source.slice(source.indexOf('async function watchPoseUpdates'));
 for(const hostname of ['127.0.0.1','prompt-library-pengjia3915.netlify.app']){
  let registrations=0,updates=0;const context=vm.createContext({location:{hostname},navigator:{serviceWorker:{controller:{},addEventListener(){},register:async()=>{registrations++;return {update:async()=>updates++}}}}});
  await vm.runInContext(code.replace('watchPoseUpdates();','watchPoseUpdates();'),context);
  assert.equal(registrations,hostname==='127.0.0.1'?0:1);assert.equal(updates,registrations);
 }
});
