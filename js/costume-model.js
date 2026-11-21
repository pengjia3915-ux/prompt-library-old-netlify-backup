export function filterCostumes(items,{category='',query=''}={}){
 const words=query.trim().toLocaleLowerCase().split(/\s+/).filter(Boolean);
 return items.filter(item=>(!category||item.category===category)&&words.every(word=>`${item.id} ${item.title || ''} ${item.category} ${item.tags.join(' ')} ${item.keywords.join(' ')}`.toLocaleLowerCase().includes(word)));
}
export function costumeInstruction(item){
 return `${promptLead(item)}服装参考：${itemLabel(item)}（${item.category}）。\n\n请同时使用两张图：图1为原人物图片，图2为这套服装的参考图。\n\n以图1中的成年人物为唯一人物身份参考，保持脸型、五官、发型、年龄感、身材比例、表情和姿势一致，保留原有背景、光线、构图与画风。\n\n仅将人物穿搭更换为图2所示的整套服装。根据图2实际可见内容保留单品组合、颜色、面料质感、版型、领口、袖型、衣长及配饰细节；让衣料适配图1人物的真实比例与当前姿势，保持接缝、褶皱与遮挡自然。\n\n不要把图2的无人物展示形式、背景、摆放方式或文字带入结果，不添加其他人物，不改变人物身份，不为展示服装而强行改变姿势。参考图未显示的细节不自行添加。输出一张完成换装的图片，不输出拼图。`;
}
export function validateCostumeCatalog(value){
 if(!value||!Array.isArray(value.items)||!Array.isArray(value.categories)||value.items.length===0)throw Error('服装目录格式不完整');
 const categories=new Set(value.categories.map(c=>c.name)),ids=new Set();
 for(const item of value.items){
  if(!/^[A-Z]{3}-\d{4}$/.test(item.id)||ids.has(item.id)||!categories.has(item.category)||!Array.isArray(item.tags)||!Array.isArray(item.keywords))throw Error('服装目录条目不完整');
  if(item.imageUrl!==`https://ai-costume-gallery.pages.dev/png/${item.id}.png`||item.thumbnailUrl!==`https://sleepyzone.online/ai-ref-library-cn/thumbs/${item.id}.webp`)throw Error('服装图片来源异常');
  ids.add(item.id);
 }
 return value;
}

const DESIGN_ROOT = 'data/costume-reference/designs';

export function withDesignedCostumes(catalog, designs) {
  if (!Array.isArray(designs?.items)) throw Error('服装设计目录格式不完整');

  const promptPrefix = typeof designs.promptPrefix === 'string' ? designs.promptPrefix.trim() : '';
  const ids = new Set(catalog.items.map(item => item.id));
  const categories = new Map();
  const additions = designs.items.map(item => {
    const { id, title, category, tags, keywords, description } = item;
    if (!/^DES-\d{4}$/.test(id) || ids.has(id)
        || ![title, category, description].every(value => typeof value === 'string' && value.trim())
        || ![tags, keywords].every(values => Array.isArray(values) && values.every(value => typeof value === 'string'))) {
      throw Error('服装设计条目不完整或编号重复');
    }
    ids.add(id);
    categories.set(category, { name: category, n: (categories.get(category)?.n || 0) + 1 });
    return {
      ...item,
      source: 'design',
      promptPrefix,
      imageUrl: `${DESIGN_ROOT}/images/${id}.jpg`,
      thumbnailUrl: `${DESIGN_ROOT}/thumbs/${id}.webp`
    };
  });
  for (const category of catalog.categories) {
    const count = categories.get(category.name)?.n || 0;
    categories.set(category.name, { ...category, n: category.n + count });
  }
  return { ...catalog, categories: [...categories.values()], items: [...additions, ...catalog.items] };
}

function promptLead(item) {
  return item.source === 'design' && item.promptPrefix ? `${item.promptPrefix}\n\n` : '';
}

function itemLabel(item) {
  return item.title ? `${item.title} · ${item.id}` : item.id;
}

function checkedDescription(item, entries) {
  if (item.source === 'design') return item.description.trim();
  const entry = entries[item.id];
  if (entry?.review === 'reference-checked' && entry.sourceImage === item.imageUrl
      && typeof entry.description === 'string') return entry.description.trim();
  return '';
}

export function hasCheckedCostumeText(item, entries = {}) {
  return Boolean(checkedDescription(item, entries));
}
export function costumeTextInstruction(item,entries={}){
 const outfit=checkedDescription(item,entries)||`穿搭方向：${item.category}。\n服装设计关键词：${[...new Set(item.tags)].join('、')}。\n这些关键词包含配色和单品候选，请据此设计一套协调的完整穿搭；互斥单品择一使用，不把裙子与短裤等所有候选强行叠穿。关键词未明确对应某件单品的颜色或材质时，自然协调搭配即可。`;
 return `${promptLead(item)}文字换装：${itemLabel(item)}（${item.category}）。\n\n以本次上传的原图成年人物为唯一人物参考，保持脸型、五官、发型、年龄感、身材比例、表情和姿势一致，保留原有背景、光线、构图与画风，仅调整服装穿搭。\n\n${outfit}\n\n衣料应适配人物原有体型与姿势，保持服装结构、接缝、褶皱、重力和遮挡关系自然。不得为展示衣服而改变人物身份、体型或姿势，不添加其他人物、文字、水印或拼图。输出一张完成换装的图片。`;
}
