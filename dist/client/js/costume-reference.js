import {filterCostumes,costumeInstruction,costumeTextInstruction,hasCheckedCostumeText,validateCostumeCatalog,withDesignedCostumes} from './costume-model.js?v=4.4.0';
const $=selector=>document.querySelector(selector);
const esc=value=>String(value).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
let catalog=null,category=new URLSearchParams(location.search).get('category')||'',limit=24,current=null,toastTimer,promptMode='text',checkedTexts={};
function toast(text){$('#toast').textContent=text;$('#toast').classList.add('visible');clearTimeout(toastTimer);toastTimer=setTimeout(()=>$('#toast').classList.remove('visible'),2800)}
function results(){return filterCostumes(catalog?.items||[],{category,query:$('#query').value})}
function render(){
 if(!catalog)return;
 const found=results();
 $('#categories').innerHTML=[{name:'',label:'全部'},...catalog.categories.map(c=>({name:c.name,label:c.name,count:c.n}))].map(c=>`<button type="button" data-category="${esc(c.name)}" aria-pressed="${category===c.name}">${esc(c.label)}<small>${c.name?c.count:catalog.items.length}</small></button>`).join('');
 $('#result').textContent=`${found.length} 套服装${category?' · '+category:''}`;
 $('#grid').innerHTML=found.slice(0,limit).map(item=>{
  const label = item.title || item.id;
  const title = item.title || item.tags.slice(0,2).join(' · ') || item.id;
  const alt = item.title || item.id+' · '+item.tags.slice(0,3).join('、');
  const tags = item.title ? item.tags : item.tags.slice(2);
  const tagChips = tags.slice(0,3).map(tag=>`<span>${esc(tag)}</span>`).join('');
  const overflow = tags.length>3 ? `<span>+${tags.length-3}</span>` : '';
  const kind = hasCheckedCostumeText(item,checkedTexts) ? '看图描述' : '文字近似';
  return `<article class="costume-card">
    <button type="button" class="card-open" data-open="${esc(item.id)}" aria-label="查看 ${esc(label)} 服装详情">
      <div class="thumb">
        <img src="${esc(item.thumbnailUrl)}" alt="${esc(alt)}" loading="lazy" decoding="async" referrerpolicy="no-referrer" width="240" height="360">
        <span class="thumb-error" hidden>缩略图暂不可用<br>点击查看详情</span>
        <span class="category-badge">${esc(item.category)}</span>
      </div>
      <div class="card-info"><h2>${esc(title)}</h2><p>${esc(item.id)}</p><div class="tags">${tagChips}${overflow}</div></div>
    </button>
    <div class="card-footer"><span class="text-kind">${kind}</span><button type="button" data-copy="${esc(item.id)}">复制文字指令</button></div>
  </article>`;
 }).join('');
 $('#grid').setAttribute('aria-busy','false');$('#empty').hidden=found.length>0;$('#more').hidden=found.length<=limit;
}
function updateImage(){
 $('#image-error').hidden=true;$('#image-status').textContent='正在加载大图…';$('#large').hidden=false;
 $('#large').alt=current.title || current.id+' · '+current.tags.join('、');$('#large').src=current.imageUrl;
}
function updatePrompt(){
 if(!current)return;
 const textMode=promptMode==='text',checked=hasCheckedCostumeText(current,checkedTexts);
 $('#mode-text').setAttribute('aria-pressed',String(textMode));$('#mode-image').setAttribute('aria-pressed',String(!textMode));
 $('#instruction').value=textMode?costumeTextInstruction(current,checkedTexts):costumeInstruction(current);
 $('#copy-instruction').textContent=textMode?'复制中文文字Prompt':'复制参考图换装指令';
 $('#usage-title').textContent=textMode?'只需人物原图，不用保存服装图。':'图1是人物原图，图2是这套服装。';
 $('#usage-copy').textContent=textMode?'上传人物原图，再粘贴下方中文描述，按文字完成换装。':'两张图片需随指令一起上传；仅复制指令不会把服装图片传给模型。';
 const textQuality = $('#text-quality');
 textQuality.hidden = !textMode;
 if (current.source === 'design') {
  textQuality.textContent = '来源：本库服装设计图，已按图写成中文描述。';
 } else if (checked) {
  textQuality.textContent = checkedTexts[current.id].referenceKind === 'thumbnail'
   ? '来源：已对照服装缩略图补写中文描述；细小纹样以原图为准，尚未实测出图。'
   : '来源：已对照图片补写服装描述，尚未实测出图。';
 } else {
  textQuality.textContent = '来源：目录关键词近似版，未逐图还原；可生成相近风格，具体单品与配色可能不同。';
 }
 $('#copy-status').textContent=textMode?'本模式不依赖服装图片、链接或图2。':'上传两张参考图后，再粘贴这段指令。';
}
function showItem(item){
 current=item;$('#detail-title').textContent=item.id+' · '+(item.title || item.tags.slice(0,2).join(' · '));$('#detail-category').textContent=item.category+' / 服装参考';
 $('#tags').innerHTML=item.tags.map(tag=>`<span>${esc(tag)}</span>`).join('');$('#keywords').textContent=item.keywords.join(' · ');
 $('#source-link').href=item.imageUrl;
 $('#source-link').textContent=item.source==='design'?'查看服装设计图 ↗':'在原库查看这张图 ↗';
 $('#open-original').href=item.imageUrl;
 updatePrompt();
 const found=results(),index=found.findIndex(i=>i.id===item.id);$('#position').textContent=`${index+1} / ${found.length}`;$('#previous').disabled=index<=0;$('#next').disabled=index<0||index>=found.length-1;
 updateImage();
 const body=$('#detail .dialog-body');body.scrollTop=0;
}
function open(id){const item=catalog?.items.find(i=>i.id===id);if(!item)return;showItem(item);$('#detail').showModal()}
function navigate(direction){const found=results(),index=found.findIndex(i=>i.id===current?.id),item=found[index+direction];if(item)showItem(item)}
async function copy(item,mode=promptMode){
 const text=mode==='text'?costumeTextInstruction(item,checkedTexts):costumeInstruction(item);
 try{await navigator.clipboard.writeText(text);toast(mode==='text'?'已复制中文文字Prompt':'已复制参考图换装指令');return}catch{}
 if(!$('#detail').open){promptMode=mode;open(item.id)}
 const area=$('#instruction');area.value=text;area.focus();area.select();
 try{if(document.execCommand('copy')){toast(mode==='text'?'已复制中文文字Prompt':'已复制参考图换装指令');return}}catch{}
 $('#copy-status').textContent='自动复制不可用，文字已选中，可长按或按 Ctrl / Cmd + C 复制。';
}
async function load(){
 $('#error-panel').hidden=true;$('#result').textContent='正在载入服装目录…';$('#grid').setAttribute('aria-busy','true');
 try{
  const readOptional = file => fetch(file).then(response => response.ok ? response.json() : null).catch(() => null);
  const [response, texts, designs] = await Promise.all([
    fetch('data/costume-reference/catalog.json'),
    readOptional('data/costume-reference/text-prompts.json?v=4.4.0'),
    readOptional('data/costume-reference/designs/catalog.json')
  ]);
  if (!response.ok) throw Error('目录请求失败');
  catalog = validateCostumeCatalog(await response.json());
  if (designs) {
    try {
      catalog = withDesignedCostumes(catalog, designs);
    } catch (error) {
      console.warn('服装设计目录无法加载。', error);
    }
  }
  if (!catalog.categories.some(item => item.name === category)) category = '';
  checkedTexts = texts?.entries || {};
  render();
 }catch{catalog=null;$('#grid').innerHTML='';$('#grid').setAttribute('aria-busy','false');$('#categories').innerHTML='';$('#more').hidden=true;$('#empty').hidden=true;$('#result').textContent='服装目录暂时无法加载';$('#error-panel').hidden=false;$('#error-text').textContent='请检查本地服务是否仍在运行，然后重试。原有Prompt与动作库不受影响。'}
}
$('#grid').addEventListener('click',event=>{const opener=event.target.closest('[data-open]'),copier=event.target.closest('[data-copy]');if(opener)open(opener.dataset.open);else if(copier){const item=catalog.items.find(i=>i.id===copier.dataset.copy);if(item)copy(item,'text')}});
$('#grid').addEventListener('error',event=>{if(event.target.matches('img')){event.target.hidden=true;event.target.parentElement.querySelector('.thumb-error').hidden=false}},true);
$('#categories').addEventListener('click',event=>{const button=event.target.closest('[data-category]');if(button){category=button.dataset.category;limit=24;render()}});
$('#query').addEventListener('input',()=>{limit=24;render()});$('#clear').onclick=()=>{$('#query').value='';limit=24;render();$('#query').focus()};
$('#reset').onclick=()=>{category='';$('#query').value='';limit=24;render()};$('#more').onclick=()=>{limit+=24;render()};$('#retry-catalog').onclick=load;
$('#mode-text').onclick=()=>{promptMode='text';updatePrompt()};$('#mode-image').onclick=()=>{promptMode='image';updatePrompt()};
$('#close').onclick=()=>$('#detail').close();$('#previous').onclick=()=>navigate(-1);$('#next').onclick=()=>navigate(1);$('#copy-instruction').onclick=()=>current&&copy(current);$('#retry-image').onclick=updateImage;
$('#large').onload=()=>{$('#image-status').textContent=`原图 · ${$('#large').naturalWidth} × ${$('#large').naturalHeight}`};
$('#large').onerror=()=>{$('#large').hidden=true;$('#image-status').textContent='服装图片暂时无法加载';$('#image-error').hidden=false};
$('#help-button').onclick=()=>$('#help').showModal();$('#close-help').onclick=()=>$('#help').close();
for(const dialog of [$('#detail'),$('#help')])dialog.addEventListener('click',event=>{if(event.target!==dialog)return;const r=dialog.getBoundingClientRect();if(event.clientX<r.left||event.clientX>r.right||event.clientY<r.top||event.clientY>r.bottom)dialog.close()});
$('#detail').addEventListener('keydown',event=>{if(event.target.closest('textarea,input,[contenteditable=true]'))return;if(event.key==='ArrowLeft'){event.preventDefault();navigate(-1)}if(event.key==='ArrowRight'){event.preventDefault();navigate(1)}});
load();

// Direct entry to the reference page also discovers a new release.
async function watchCostumeUpdates(){
 if(['localhost','127.0.0.1','::1'].includes(location.hostname)||!('serviceWorker' in navigator))return;
 try{
  const hadController=Boolean(navigator.serviceWorker.controller);let reloading=false;
  navigator.serviceWorker.addEventListener('controllerchange',()=>{if(hadController&&!reloading){reloading=true;location.reload()}});
  const registration=await navigator.serviceWorker.register('service-worker.js?v=4.4.0',{updateViaCache:'none'});
  await registration.update();
 }catch{/* Reference browsing remains available without offline caching. */}
}
watchCostumeUpdates();
