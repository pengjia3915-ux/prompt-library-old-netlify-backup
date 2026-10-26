// Browsing metadata only. Never changes source text, IDs, categories or user state.
export const SCOPES = ['原图修复', '发型与配饰', '穿搭调整', '姿势与表情', '镜头与构图', '场景与光线', '仅供辨认'];
export const CATEGORIES = ['全部', ...SCOPES];
const componentScopes = { '画面清理': '原图修复', '人物修复': '原图修复', '胸型调整': '仅供辨认', '发型': '发型与配饰', '发色': '发型与配饰', '眼镜': '发型与配饰', '穿搭': '穿搭调整', '领口': '穿搭调整', '姿势': '姿势与表情', '表情': '姿势与表情', '机位': '镜头与构图', '视角': '镜头与构图', '场景': '场景与光线' };
const rules = [
  ['原图修复', /(?:去掉|去除|移除|清理|消除|修复|修正|还原|美白|优化肤色|增强.{0,6}清晰|提升.{0,8}画质)/i],
  ['发型与配饰', /(?:更换|调整|改为|采用|佩戴|戴上|头戴).{0,16}(?:发型|发色|马尾|卷发|短发|长发|眼镜|发箍|耳饰|项链)|(?:发型|发色|头发).{0,8}(?:改为|调整为|更换为)/i],
  ['穿搭调整', /(?:穿着|身穿|身披|身上披|披着|换上|换成|更换为一套|着装|换件|外穿|外搭|内搭|搭配|穿上|(?:仅)?调整穿搭|(?:仅)?调整服装|更换穿搭|更换.{0,8}(?:衣|裙|裤|袜|服装)|衣服是|上身.{0,6}(?:采用|为)|上半身.{0,6}(?:采用|为)|下身.{0,6}(?:采用|为)|下半身.{0,6}(?:采用|为)|领口.{0,8}(?:调整|采用)|wearing|dressed in|outfit:)/i],
  ['姿势与表情', /(?:坐在|坐于|站在|站立|行走|靠在|倚靠|半躺|躺在|跪坐|跪地|盘坐|盘腿|回眸|回头|侧坐|身体.{0,8}(?:前倾|后仰|侧转)|一只手|一条腿|双手.{0,6}(?:撑|搭|放)|眼神.{0,6}看向|闭眼|微笑|笑意|站姿|坐姿|standing|sitting|leaning|one leg|one hand)/i],
  ['镜头与构图', /(?:切换为.{0,12}(?:构图|全身|视角|写真)|扩展为|全身出镜|第一人称|自拍.{0,6}视角|俯拍|仰拍|镜头稍低|镜头.{0,5}(?:向下|向上)|低机位|高机位|full.body|low.angle|high.angle|camera angle)/i],
  ['场景与光线', /(?:场景(?:为|改为|调整为|扩展为)|置身|位于|置于|背景(?:为|是)|布景|站在.{0,16}(?:酒店|房间|厨房|森林|走廊|窗前|阳台|海边)|坐在.{0,16}(?:餐厅|咖啡|图书馆)|采用.{0,12}(?:晨光|暖光|灯光|窗光)|lighting:|soft (?:window|natural) light|in a .{0,15}(?:room|studio))/i]
];
const themeRules = [['丝袜', /丝袜|长筒袜|过膝袜|吊带袜|鱼网袜|渔网袜/], ['浴袍浴巾', /浴袍|浴巾/], ['cosplay', /女仆|护士装|兔女郎|修女|警服|精灵|女巫|海盗|哥特公主|科幻战士/], ['坐姿', /坐姿|坐在|坐于|坐着|sitting/i], ['站姿', /站姿|站立|站在|standing/i], ['躺卧', /半躺|躺在|躺卧/], ['自拍', /自拍/], ['镜头互动', /镜头外|伸向镜头/], ['酒店', /酒店/], ['居家', /卧室|客厅|居家|公寓/], ['职场', /办公室|职场|办公椅/], ['户外', /海边|街拍|户外|森林|阳台/]];
export function classify(entry, kind, components = []) {
  const text = String(entry.positive ?? entry.prompt ?? '');
  // Ignore identity/preservation and negative clauses, not arbitrary words in titles.
  const clauses = text.split(/[。；;，,\n]/).map(s => s.trim()).filter(Boolean);
  // Preserve/avoid clauses are not change instructions. Split mixed sentences first.
  const actionable = clauses.filter(s => !/^(?:避免|反向|不要|不改变|保持|保留|以原图|适合|适用于|整体适合|keep |preserve )/i.test(s));
  const evidence = [];
  let scopes = [];
  if (kind === 'component' && componentScopes[entry.subcategory]) {
    scopes = [componentScopes[entry.subcategory]];
    evidence.push({ scope: scopes[0], text: entry.composeText || text, basis: 'component-slot' });
  } else if (kind === 'preset') {
    for (const id of Object.values(entry.slots || {}).flat().filter(Boolean)) {
      const c = components.find(c => c.id === id);
      if (c) scopes.push(...classify(c, 'component').scopes);
    }
    evidence.push({ scope: 'preset', text: JSON.stringify(entry.slots), basis: 'component-references' });
  } else {
    for (const [scope, expression] of rules) {
      const match = actionable.find(s => expression.test(s));
      if (match) { scopes.push(scope); evidence.push({ scope, text: match, basis: 'explicit-clause' }); }
    }
    // Descriptive instructions without an imperative (e.g. 女子坐书房地毯，宽松白衬衫).
    const descriptive = [
      ['穿搭调整', /(?:宽松|修身|紧身|白色|黑色|米白|深色|浅色|牛仔|蕾丝|丝绸|针织).{0,14}(?:上衣|衬衫|针织衫|毛衣|开衫|围裙|外套|背心|长裙|短裙|亚麻裙|短裤|长裤|七分裤|睡袍|浴袍|风衣|卫衣|crop top|白T|吊带裙)|(?:上衣|下衣).{0,8}(?:清爽|凉快)/],
      ['姿势与表情', /(?:女子|人物).{0,4}(?:坐|站|蹲|倚)|坐着|一手|双腿.{0,8}(?:展开|分开|摆放|伸展|并拢|交叠|屈|踩|放置|交错)|双膝.{0,6}(?:弯曲|并拢|屈|打开)|双臂.{0,6}(?:搭|抱|伸|撑|交叠)|头部自然转向|自然向镜头|低头整理|人物手持|人物自然整理|镜头外人物|看向镜头|眼神与镜头交流/],
      ['场景与光线', /(?:厨房|书房|酒店|办公室|咖啡馆|咖啡店|车厢|电梯|海边|浅水|泳池|牧场|废弃厂房|便利店|拳台|发廊|陶艺|水果摊|阳台|车内|驾驶座|消防楼梯|窗前|落地窗|卧室|客厅|浴室|古镇|石桥|户外|街头|街边|会议室|公司工位|打印区|地铁|站台|医院|候诊区|病房|机场|停机坪|机舱|登机口|教室|教学楼|公园|运动场|屋顶菜园|游乐场|修理铺|市集|旧物摊|码头|照相馆|衣帽间|工作室|公寓|理发椅|烘干机|玻璃吹制炉)|(?:晨光|夕阳|逆光|烛火|阅读灯|光斑|绿光|蓝光|窗边光线|窗光|自然光|阳光|暖光|冷白灯光)/]
    ];
    for (const [scope, re] of descriptive) {
      const match = actionable.find(s => re.test(s) && !/^(?:保持|不改变|保留|避免)/.test(s));
      if (match && !scopes.includes(scope)) {scopes.push(scope); evidence.push({scope,text:match,basis:'descriptive-instruction'});}
    }
  }
  scopes = SCOPES.filter(s => scopes.includes(s));
  const issues = [];
  const repeated = [...new Set(clauses.filter((s,i)=>s.length>8 && clauses.indexOf(s)!==i))];
  if(repeated.length) issues.push(`正文内部重复片段 ${repeated.length} 处（保留原文）`);

  if (!scopes.length) issues.push('未识别明确修改范围，保留未分类');
  if (/95\s*%/.test(text) && /全身/.test(text)) issues.push('全身构图与95%占比的含义需核对');
  if (/肩胛骨/.test(text) && /U领|U 领|U型领/.test(text)) issues.push('前领与后背开口位置需核对');
  if (/七分裤/.test(text) && /大腿肌肤|一段大腿/.test(text)) issues.push('裤长与露腿描述可能冲突');
  if (/180[°度]/.test(text + (entry.actionBreakdown || []).join(' '))) issues.push('转头180度需核对人体可行性');
  if (/反向提示词[：:]/.test(text)) issues.push('反向约束嵌在正向正文，未自动拆分');
  if (/交错但不交叉/.test(text)) issues.push('交错与不交叉的动作含义需核对');
  if (/保持.{0,14}姿势不变/.test(text) && /(?:姿势调整为|人物改为|采用自然站姿)/.test(text)) issues.push('保留与更换姿势可能冲突');
  if (/both feet.{0,15}ground/i.test(text) && /foot.{0,30}table/i.test(text)) issues.push('双脚落地与踩桌动作可能冲突');
  const themes = themeRules.filter(([, re]) => re.test(text + ' ' + entry.title)).map(([label]) => label);
  return { category: scopes.includes('仅供辨认') ? '仅供辨认' : scopes.length > 1 ? '综合方案' : scopes[0] || '未分类', scopes, themes, evidence, issues, originalCategory: entry.category || entry.categoryId || '', originalSubcategory: entry.subcategory || '', status: issues.length ? '需人工核对' : scopes.length ? '规则归类' : '待核对' };
}
export function recordKey(suite, kind, entry) { return `${suite}:${kind}:${entry.id}`; }
export function sourceRows(z, b) {
  return [...z.prompts.map(entry => ({ suite: 'zhuangyuan', kind: 'prompt', entry })), ...['components', 'presets', 'directPrompts'].flatMap((field, i) => b[field].map(entry => ({ suite: 'bangyan', kind: ['component', 'preset', 'direct'][i], entry })))];
}
