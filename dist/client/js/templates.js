export function mergeTemplates(defaultTemplates = [], userState = {}) {
  const overrides = userState.templateOverrides && typeof userState.templateOverrides === "object"
    ? userState.templateOverrides
    : {};
  const deleted = new Set(Array.isArray(userState.deletedTemplateIds) ? userState.deletedTemplateIds : []);
  const defaults = defaultTemplates
    .filter((template) => !deleted.has(template.id))
    .map((template) => ({ ...template, ...(overrides[template.id] || {}), source: "default" }));
  const custom = (Array.isArray(userState.templates) ? userState.templates : [])
    .filter((template) => template && template.id && !deleted.has(template.id))
    .map((template) => ({ ...template, source: "custom" }));

  return [...defaults, ...custom].sort((a, b) => {
    if (Boolean(b.pinned) !== Boolean(a.pinned)) return Number(b.pinned) - Number(a.pinned);
    if (Boolean(b.favorite) !== Boolean(a.favorite)) return Number(b.favorite) - Number(a.favorite);
    return Number(a.order || 999) - Number(b.order || 999);
  });
}

export function describeTemplate(template, itemMap) {
  const labels = (template.selectedIds || [])
    .map((id) => itemMap.get(id)?.label)
    .filter(Boolean);
  return labels.length ? labels.slice(0, 5).join(" · ") : "尚未选择关键词";
}
