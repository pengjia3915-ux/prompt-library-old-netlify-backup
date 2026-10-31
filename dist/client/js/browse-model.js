// Presentation-only routing. Does not rewrite prompts or stored source categories.
export function contentType(kind, metadata) {
  if (kind === 'component') return 'component';
  if (kind === 'preset') return 'preset';
  if (kind === 'composition') return 'composition';
  return metadata.scopes.length === 1 ? 'single' : 'multi';
}
export function contentLabel(kind, metadata) {
  const type=contentType(kind,metadata);
  if(type==='component')return '单项组件';
  if(type==='preset')return '推荐组合';
  if(type==='composition')return '保存的组合';
  if(type==='multi')return '多项修改方案';
  return ({'姿势与表情':'姿势 / 表情单项','穿搭调整':'穿搭单项','原图修复':'原图处理','发型与配饰':'发型 / 配饰单项','镜头与构图':'镜头 / 构图单项','场景与光线':'场景 / 光线单项'})[metadata.scopes[0]] || '单项指令';
}
export function belongsToWorkspace(workspace, kind, metadata) {
  const type=contentType(kind,metadata);
  if(workspace==='browse')return ['multi','preset','composition'].includes(type);
  if(workspace==='goals')return type!=='component';
  if(workspace==='components')return type==='component';
  return true;
}
