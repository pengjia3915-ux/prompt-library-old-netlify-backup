export const DEFAULT_FIXED_REQUIREMENTS = [
  {
    id: "natural-proportions",
    label: "保持人体比例",
    text: "保持自然真实的人体比例，避免肢体变形",
    enabled: true,
    builtIn: true
  },
  {
    id: "real-texture",
    label: "保持真实摄影质感",
    text: "保持真实摄影质感、自然光影和可信的材质细节",
    enabled: true,
    builtIn: true
  },
  {
    id: "keep-face-shape",
    label: "保持人物脸型",
    text: "保持人物原有脸型和五官比例，不做明显改变",
    enabled: true,
    builtIn: true
  },
  {
    id: "sharpen",
    label: "提升画面清晰度",
    text: "适度提升画面清晰度和细节辨识度，不产生过度锐化",
    enabled: false,
    builtIn: true
  },
  {
    id: "clean-background",
    label: "优化背景干净度",
    text: "适度优化背景干净度，但不要抹去真实环境层次",
    enabled: false,
    builtIn: true
  }
];

export function normalizeFixedRequirements(value) {
  if (!Array.isArray(value)) return DEFAULT_FIXED_REQUIREMENTS.map((item) => ({ ...item }));
  return value
    .filter((item) => item && item.id && (item.label || item.text))
    .map((item) => ({
      id: String(item.id),
      label: String(item.label || item.text),
      text: String(item.text || item.label),
      enabled: item.enabled !== false,
      builtIn: Boolean(item.builtIn)
    }));
}

export function createBackup(state) {
  return {
    version: 1,
    exportedAt: new Date().toISOString(),
    data: {
      customKeywords: state.customKeywords || [],
      keywordOverrides: state.keywordOverrides || {},
      deletedKeywordIds: state.deletedKeywordIds || [],
      featuredOrder: state.featuredOrder || [],
      fixedRequirements: state.fixedRequirements || DEFAULT_FIXED_REQUIREMENTS,
      templates: state.templates || [],
      templateOverrides: state.templateOverrides || {},
      deletedTemplateIds: state.deletedTemplateIds || [],
      recent: state.recent || [],
      knowledgeEntries: state.knowledgeEntries || [],
      currentSelection: state.currentSelection || [],
      currentFixedIds: state.currentFixedIds || [],
      settings: state.settings || {}
    }
  };
}

export function validateBackup(payload) {
  if (!payload || typeof payload !== "object") return { ok: false, error: "文件内容不是有效 JSON 对象" };
  if (payload.version !== 1) return { ok: false, error: "备份版本不兼容，目前只支持 version 1" };
  if (!payload.data || typeof payload.data !== "object") return { ok: false, error: "备份缺少 data 数据" };

  const requiredArrays = ["customKeywords", "templates", "recent"];
  const missing = requiredArrays.filter((key) => key in payload.data && !Array.isArray(payload.data[key]));
  if (missing.length) return { ok: false, error: `字段格式不正确：${missing.join("、")}` };
  return { ok: true, data: payload.data };
}

function mergeById(current = [], incoming = []) {
  const result = new Map(current.filter((item) => item?.id).map((item) => [item.id, item]));
  for (const item of incoming) {
    if (item?.id) result.set(item.id, item);
  }
  return [...result.values()];
}

export function mergeBackup(current, incoming, mode = "merge") {
  if (mode === "replace") {
    return {
      ...current,
      ...incoming,
      fixedRequirements: normalizeFixedRequirements(incoming.fixedRequirements),
      settings: { ...(incoming.settings || {}) }
    };
  }

  return {
    ...current,
    customKeywords: mergeById(current.customKeywords, incoming.customKeywords),
    keywordOverrides: { ...(current.keywordOverrides || {}), ...(incoming.keywordOverrides || {}) },
    deletedKeywordIds: [...new Set([...(current.deletedKeywordIds || []), ...(incoming.deletedKeywordIds || [])])],
    featuredOrder: [...new Set([...(current.featuredOrder || []), ...(incoming.featuredOrder || [])])],
    fixedRequirements: normalizeFixedRequirements(incoming.fixedRequirements || current.fixedRequirements),
    templates: mergeById(current.templates, incoming.templates),
    templateOverrides: { ...(current.templateOverrides || {}), ...(incoming.templateOverrides || {}) },
    deletedTemplateIds: [...new Set([...(current.deletedTemplateIds || []), ...(incoming.deletedTemplateIds || [])])],
    recent: mergeById(current.recent, incoming.recent).sort((a, b) => Number(b.createdAt || 0) - Number(a.createdAt || 0)).slice(0, 12),
    knowledgeEntries: mergeById(current.knowledgeEntries, incoming.knowledgeEntries),
    currentSelection: incoming.currentSelection || current.currentSelection || [],
    currentFixedIds: incoming.currentFixedIds || current.currentFixedIds || [],
    settings: { ...(current.settings || {}), ...(incoming.settings || {}) }
  };
}
