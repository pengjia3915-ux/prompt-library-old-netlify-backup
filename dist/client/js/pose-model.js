export const ANGLES=['正面','斜侧','侧面','俯视','仰视'];
export function categoryLabel(value){return ({'趴卧':'躺卧','侧坐・女孩坐':'侧坐','跪立・四肢着地':'跪立与支撑','特殊':'伸展与平衡','可爱系':'手势与表情','挤胸・强调事业线系':'上半身姿态','性感・大胆系':'伸展与倚靠','立位':'站姿互动','坐位':'坐姿互动','坐位贴身':'坐姿互动','骑乘位':'坐姿互动','背向坐位':'坐姿互动','面对面坐位':'坐姿互动','立位贴身':'站姿互动','侧卧位':'躺卧互动'})[value]||value}
export function poseFamily(system){return system==='上半身单人'?'upper':system==='双人缠绵'?'pair':'single'}
export const FAMILIES=[['','全部动作'],['single','全身单人'],['upper','上半身动作'],['pair','双人互动']];
export function displayCategory(group){return group.family==='pair'&&group.category==='趴卧'?'躺卧互动':categoryLabel(group.category)}
export const CATEGORIES=['坐姿','站姿','侧坐・女孩坐','跪立','蹲姿','趴卧','前倾','后仰・挺背','扭身'];
export function groupPoses(records){
 const map=new Map();
 for(const record of records){
  const key=`${record['体系']}:${record['姿势编号']}`;
  if(!map.has(key))map.set(key,{key,system:record['体系'],family:poseFamily(record['体系']),title:record['姿势名称'],category:record['分类'],number:record['姿势编号'],views:[]});
  map.get(key).views.push(record);
 }
 return [...map.values()].map(group=>({...group,views:group.views.sort((a,b)=>ANGLES.indexOf(a['角度'])-ANGLES.indexOf(b['角度']))}));
}
export function filterPoses(groups,{category='',family='',query='',favoriteOnly=false,favorites=[],entries={}}={}){
 const words=query.trim().toLowerCase().split(/\s+/).filter(Boolean);
 return groups.filter(g=>(!family||g.family===family)&&(!category||g.category===category||displayCategory(g)===category)&&(!favoriteOnly||favorites.includes(g.key))&&words.every(w=>`${g.title} ${g.category} ${displayCategory(g)} ${g.system} ${g.number} ${g.views.map(v=>v['角度']).join(' ')} ${entries[g.key]?.pose||''} ${Object.values(entries[g.key]?.views||{}).join(' ')}`.toLowerCase().includes(w)));
}
export function normalizePoseState(value,groups){
 if(!value||value.format!=='prompt-library-pose-state'||value.version!==1||!Array.isArray(value.favorites))throw new Error('请选择动作参考区导出的收藏备份。');
 const valid=new Set(groups.map(g=>g.key));
 return {format:'prompt-library-pose-state',version:1,favorites:[...new Set(value.favorites.filter(key=>valid.has(key)))]};
}
export function resolveActionPrompt(group,view,entries={}){
 const entry=entries[group.key];
 const angle=entry?.views?.[view.id];
 if(!entry?.pose||!angle)return null;
 const action=`${entry.pose}\n\n${angle}`;
 if(group.family==='upper')return {action,instruction:`以原图中的成年人物为唯一人物参考，保持人物身份、脸型、五官、发型、面部表情、身材比例、服装和场景不变，仅调整可见的上半身动作与拍摄视角。\n\n${action}\n\n保持肩、肘、腕和手指连接自然。参考图被裁切或遮挡的部位不凭空补造；保留原图下肢状态，不因上半身参考强制扩为全身。避免额外手指、肢体穿模、面部变化和极端透视。`};
 if(group.family==='pair')return {action,instruction:`以原图中两位成年人物为人物参考，分别保持各自身份、脸型、五官、发型、面部表情、身材比例、服装和场景不变，仅调整两人的姿势与拍摄视角。若原图不是双人，请同时提供两位人物参考，不凭空增添或复制人物。\n\n${action}\n\n两人的手臂、腿部和支撑关系须分别清楚，避免肢体归属混淆、穿模、额外手脚和极端透视。保留动作所需接触面，不额外改变穿搭或人物数量。`};
 return {action,instruction:`以原图中的成年人物为唯一人物参考，保持人物身份、脸型、五官、发型、面部表情、身材比例、服装和场景不变，仅调整姿势与拍摄视角。\n\n${action}\n\n保持真实人体比例、合理关节角度和稳定支撑关系，避免手脚增生、肢体穿模、面部变化和极端透视。完整保留动作所需的手脚与接触面，不额外改变穿搭或添加人物。`};
}
