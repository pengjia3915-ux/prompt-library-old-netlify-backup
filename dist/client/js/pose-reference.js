import {groupPoses,filterPoses,normalizePoseState,CATEGORIES,resolveActionPrompt,categoryLabel,FAMILIES,displayCategory} from './pose-model.js?v=4.1.0';
const $=s=>document.querySelector(s),KEY='prompt-library-pose-reference-v1';
const esc=s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
let promptEntries={},promptOnly=false,family='';
let groups=[],state={format:'prompt-library-pose-state',version:1,favorites:[]},category='',favoriteOnly=false,limit=24,current=null,viewIndex=0,timer;
function toast(text){$('#toast').textContent=text;$('#toast').classList.add('visible');clearTimeout(timer);timer=setTimeout(()=>$('#toast').classList.remove('visible'),3000)}
function save(next){try{localStorage.setItem(KEY,JSON.stringify(next));state=next;return true}catch{toast('本机保存失败，请先导出收藏备份。');return false}}
function star(key){const favorites=state.favorites.includes(key)?state.favorites.filter(k=>k!==key):[...state.favorites,key];if(save({...state,favorites})){render();if(current)$('#detail-star').textContent=state.favorites.includes(current.key)?'★ 已收藏':'☆ 收藏动作'}}
function render(){
 const found=filterPoses(groups,{family,category,query:$('#query').value,favoriteOnly,favorites:state.favorites}).filter(g=>!promptOnly||promptEntries[g.key]);
 $('#with-prompts').setAttribute('aria-pressed',String(promptOnly));$('#with-prompts').textContent=`有动作词 · ${Object.keys(promptEntries).length}组`;
 const familyPool=groups.filter(g=>!family||g.family===family);
 $('#families').innerHTML=FAMILIES.map(([key,label])=>`<button data-family="${key}" aria-pressed="${family===key}">${label}<small>${groups.filter(g=>!key||g.family===key).length}</small></button>`).join('');
 const available=new Set(familyPool.map(displayCategory));
 const ordered=[...new Set([...CATEGORIES.map(categoryLabel),...available])].filter(c=>available.has(c));
 $('#scope-summary').textContent=FAMILIES.find(([key])=>key===family)?.[1]||'全部动作';
 $('#categories').innerHTML=['',...ordered].map(c=>`<button data-category="${esc(c)}" aria-pressed="${category===c}">${esc(categoryLabel(c)||'全部动作')}</button>`).join('');
 $('#favorites').setAttribute('aria-pressed',String(favoriteOnly));$('#favorites').textContent=`${favoriteOnly?'★':'☆'} 我的动作收藏 (${state.favorites.length})`;
 $('#result').textContent=`${found.length} 组动作 · ${found.reduce((n,g)=>n+g.views.length,0)} 个视角`;
 $('#grid').innerHTML=found.slice(0,limit).map(g=>`<article class="pose-card"><button class="pose-open" data-open="${esc(g.key)}" aria-label="查看 ${esc(g.title)}"><img loading="lazy" src="data/pose-reference/${esc(g.views[0]['缩略图'])}" alt="${esc(g.title)} · ${esc(g.views[0]['角度'])}" width="300" height="400"><div class="card-info"><h2>${esc(g.title)}</h2><small>${esc(displayCategory(g))} · ${esc(g.number)} · ${esc(g.system==='全身单人・标准系'?'标准':g.system==='全身单人・性感系'?'表现型':g.family==='upper'?'上半身':'双人')}</small></div></button><div class="card-bottom"><span>${g.views.length} 个视角${promptEntries[g.key]?' · 有动作词':''}</span><button data-star="${esc(g.key)}" aria-pressed="${state.favorites.includes(g.key)}" aria-label="收藏 ${esc(g.title)}">${state.favorites.includes(g.key)?'★ 已收藏':'☆ 收藏'}</button></div></article>`).join('')||'<p>没有匹配动作。试试清空搜索或切换分类。</p>';
 $('#more').hidden=found.length<=limit;
}
function showView(index){
 viewIndex=(index+current.views.length)%current.views.length;const view=current.views[viewIndex];const source='data/pose-reference/'+view['原图'];
 $('#large').src=source;$('#large').alt=`${current.title} · ${view['角度']}`;$('#image-status').textContent=`${view['角度']} · ${viewIndex+1} / ${current.views.length}`;
 const resolved=resolveActionPrompt(current,view,promptEntries);
 $('#prompt-preview').value=resolved?.action||'本动作尚未整理文字提示词，请使用参考图或复制名称。';
 $('#copy-action').disabled=!resolved;$('#copy-instruction').disabled=!resolved;
 $('#prompt-status').textContent=resolved?'已对照参考图核对 · 未实测出图；复制内容随当前视角切换。':'仅已核对动作提供正文，不根据标题自动补写。';
 $('#reference-note').hidden=!current.sourceNote;$('#reference-note').textContent=current.sourceNote||'';
 $('#download').href=source;$('#download').download=view['id']+'.png';
 $('#angles').innerHTML=current.views.map((v,i)=>`<button data-angle="${i}" aria-pressed="${i===viewIndex}">${esc(v['角度'])}</button>`).join('');
}
function open(key){current=groups.find(g=>g.key===key);if(!current)return;$('#detail-title').textContent=current.title;$('#detail-category').textContent=`${displayCategory(current)} · ${current.number}`;$('#source-record-info').textContent=`原体系：${current.system}；原分类：${current.category}；原编号：${current.number}`;$('#detail-star').textContent=state.favorites.includes(key)?'★ 已收藏':'☆ 收藏动作';showView(0);$('#detail').showModal();document.body.style.overflow='hidden'}
function close(){ $('#detail').close();document.body.style.overflow='';current=null }
$('#grid').addEventListener('click',e=>{const starButton=e.target.closest('[data-star]'),openButton=e.target.closest('[data-open]');if(starButton)star(starButton.dataset.star);else if(openButton)open(openButton.dataset.open)});
$('#families').addEventListener('click',e=>{const b=e.target.closest('[data-family]');if(b){family=b.dataset.family;category='';promptOnly=false;limit=24;$('#query').value='';render()}});
$('#categories').addEventListener('click',e=>{const b=e.target.closest('[data-category]');if(b){category=b.dataset.category;limit=24;render()}});
$('#with-prompts').onclick=()=>{promptOnly=!promptOnly;limit=24;render()};
$('#query').addEventListener('input',()=>{limit=24;render()});$('#favorites').onclick=()=>{favoriteOnly=!favoriteOnly;limit=24;render()};$('#more').onclick=()=>{limit+=24;render()};
$('#angles').onclick=e=>{const b=e.target.closest('[data-angle]');if(b)showView(Number(b.dataset.angle))};$('#detail-star').onclick=()=>star(current.key);$('#close').onclick=close;
$('#detail').addEventListener('click',e=>{if(e.target===$('#detail')){const r=$('#detail').getBoundingClientRect();if(e.clientX<r.left||e.clientX>r.right||e.clientY<r.top||e.clientY>r.bottom)close()}});
$('#detail').addEventListener('cancel',e=>{e.preventDefault();close()});$('#detail').addEventListener('keydown',e=>{if(e.key==='ArrowRight'){e.preventDefault();showView(viewIndex+1)}if(e.key==='ArrowLeft'){e.preventDefault();showView(viewIndex-1)}});
$('#large').onerror=()=>{$('#image-status').textContent='参考图未能加载，请重试或查看来源原站。'};
async function copyText(text,message){
 try{await navigator.clipboard.writeText(text);toast(message)}catch{
  const area=$('#prompt-preview');area.value=text;area.focus();area.select();
  try{if(document.execCommand('copy'))toast(message);else toast('复制失败，文字已选中，可手动复制。')}catch{toast('文字已选中，请手动复制。')}
 }
}
$('#copy').onclick=()=>copyText(current.title,'已复制动作名称');
$('#copy-action').onclick=()=>{const value=resolveActionPrompt(current,current.views[viewIndex],promptEntries);if(value)copyText(value.action,'已复制当前视角动作')};
$('#copy-instruction').onclick=()=>{const value=resolveActionPrompt(current,current.views[viewIndex],promptEntries);if(value)copyText(value.instruction,'已复制图生图指令')};
$('#export').onclick=()=>{const blob=new Blob([JSON.stringify({...state,exportedAt:new Date().toISOString()},null,2)],{type:'application/json'});const url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download=`prompt-library-pose-favorites-${new Date().toISOString().slice(0,10)}.json`;a.click();setTimeout(()=>URL.revokeObjectURL(url),1000)};
$('#import').onclick=()=>$('#import-file').click();$('#import-file').onchange=async e=>{try{const file=e.target.files[0];if(!file)return;if(file.size>1000000)throw new Error('备份文件过大。');const value=normalizePoseState(JSON.parse(await file.text()),groups);if(save({...state,favorites:[...new Set([...state.favorites,...value.favorites])]})){render();toast('收藏已合并，原有收藏保留。')}}catch(error){toast(error.message||'无法读取备份。')}finally{e.target.value=''}};
$('#source').onclick=()=>$('#source-dialog').showModal();$('#source-close').onclick=()=>$('#source-dialog').close();
try{
 const promptRequest=fetch('data/pose-reference/action-prompts.json').then(r=>{if(!r.ok)throw new Error();return r.json()}).catch(()=>null);
 const response=await fetch('data/pose-reference/catalog.json');if(!response.ok)throw new Error();const catalog=await response.json();groups=groupPoses(catalog.records).map(group=>({...group,sourceNote:catalog.sourceNotes?.[group.key]||''}));$('#source-scope-description').textContent=`本地选集共${groups.length}组、${catalog.records.length}个视角。最多五个视角；缺失视角按原库实际保留，不补造图片。25组已补充可复制动作词，新增条目仅提供图片参考。`;
 const prompts=await promptRequest;if(prompts)promptEntries=prompts.entries||{};else toast('动作词暂未加载，图片参考仍可使用。');
 try{const value=localStorage.getItem(KEY);if(value)state=normalizePoseState(JSON.parse(value),groups)}catch{toast('收藏读取失败，已有存储未覆盖；可尝试导入备份。')}
 render();
}catch{$('#result').textContent='动作数据加载失败，请刷新重试。'}
