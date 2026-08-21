export const SUITE_STATE_KEYS = Object.freeze({
  zhuangyuan: "zhuangyuan-state",
  bangyan: "bangyan-state",
  meta: "app-meta",
  legacy: "prototype-state"
});

export const BANGYAN_SYNTHESIS_ORDER = Object.freeze([
  "original",
  "pose",
  "outfit",
  "neckline",
  "scene",
  "hairstyle",
  "hairColor",
  "glasses"
]);

const SLOT_BY_SUBCATEGORY = Object.freeze({
  "姿势": "pose",
  "穿搭": "outfit",
  "领口": "neckline",
  "场景": "scene",
  "发型": "hairstyle",
  "发色": "hairColor",
  "眼镜": "glasses"
});

const BASE_CONSTRAINT = "保持原图成年女性人物身份、脸型、五官、年龄感、整体气质、姿势基础和场景关系自然一致。";

export function clone(value) {
  return value == null ? value : JSON.parse(JSON.stringify(value));
}

export function suiteStateKey(suite) {
  return SUITE_STATE_KEYS[suite] || "";
}

export function componentSlot(component) {
  return SLOT_BY_SUBCATEGORY[component?.subcategory] || "original";
}

export function emptyBuilder() {
  return {
    original: [],
    pose: "",
    outfit: "",
    neckline: "",
    scene: "",
    hairstyle: "",
    hairColor: "",
    glasses: ""
  };
}

export function normalizeBuilder(value) {
  const source = value && typeof value === "object" ? value : {};
  const empty = emptyBuilder();
  return {
    ...empty,
    ...Object.fromEntries(Object.keys(empty).filter((key) => key !== "original").map((key) => [key, typeof source[key] === "string" ? source[key] : ""])),
    original: [...new Set(Array.isArray(source.original) ? source.original.filter(Boolean).map(String) : [])]
  };
}

export function selectBuilderComponent(builder, component) {
  const next = normalizeBuilder(builder);
  const slot = componentSlot(component);
  if (slot === "original") {
    next.original = [...new Set([...next.original, String(component.id)])];
  } else {
    next[slot] = String(component.id);
  }
  return next;
}

export function removeBuilderComponent(builder, component) {
  const next = normalizeBuilder(builder);
  const slot = componentSlot(component);
  if (slot === "original") {
    next.original = next.original.filter((id) => id !== String(component.id));
  } else if (next[slot] === String(component.id)) {
    next[slot] = "";
  }
  return next;
}

function sentenceParts(value) {
  return String(value || "")
    .match(/[^。！？]+[。！？]?/g)
    ?.map((part) => part.trim())
    .filter(Boolean) || [];
}

function uniqueParts(values) {
  const seen = new Set();
  const result = [];
  for (const value of values.flatMap(sentenceParts)) {
    const normalized = value.trim();
    if (!normalized || seen.has(normalized)) continue;
    seen.add(normalized);
    result.push(normalized);
  }
  return result;
}

function stripBaseConstraint(value) {
  return String(value || "").replace(BASE_CONSTRAINT, "").trim();
}

function cleanComponentText(component, options) {
  let text = stripBaseConstraint(component.positive);
  if (options.hasHairColor && component.subcategory === "发型") {
    text = text.replace("保持原有发色不变，", "");
  }
  if (options.hasHairstyle && component.subcategory === "发色") {
    text = text.replace("保持原有发型长度、卷度、发量和结构不变，", "");
  }
  if (options.hasNeckline && component.subcategory === "穿搭") {
    text = text
      .replace("，领口允许后续用独立领口组件覆盖", "")
      .replace("低领内搭", "内搭");
  }
  return text.trim();
}

function joinSentences(values) {
  return uniqueParts(values).map((part) => /[。！？]$/.test(part) ? part : `${part}。`).join("");
}

export function composeBangyanSelection({ components = [], selection = emptyBuilder(), title = "" } = {}) {
  const byId = new Map(components.map((component) => [String(component.id), component]));
  const normalized = normalizeBuilder(selection);
  const ids = [
    ...normalized.original,
    ...BANGYAN_SYNTHESIS_ORDER.filter((slot) => slot !== "original").map((slot) => normalized[slot]).filter(Boolean)
  ];
  const selected = [...new Set(ids)].map((id) => byId.get(id)).filter(Boolean);
  if (!selected.length) return { title: title || "未选择组件", positive: "", negative: "", componentIds: [] };

  const options = {
    hasHairColor: selected.some((component) => component.subcategory === "发色"),
    hasHairstyle: selected.some((component) => component.subcategory === "发型"),
    hasNeckline: selected.some((component) => component.subcategory === "领口")
  };
  const positive = joinSentences([BASE_CONSTRAINT, ...selected.map((component) => cleanComponentText(component, options))]);
  const negative = joinSentences(selected.map((component) => component.negative));
  return {
    title: title || selected.map((component) => component.title).join(" + "),
    positive,
    negative,
    componentIds: selected.map((component) => String(component.id))
  };
}

export function composeBangyanPreset(preset, components = []) {
  const slots = preset?.slots || {};
  return composeBangyanSelection({
    components,
    selection: {
      ...emptyBuilder(),
      pose: slots.pose || "",
      outfit: slots.outfit || "",
      neckline: slots.neckline || "",
      scene: slots.scene || "",
      hairstyle: slots.hairstyle || "",
      hairColor: slots.hairColor || "",
      glasses: slots.glasses || ""
    },
    title: preset?.title || "推荐组合"
  });
}

export function favoriteKey(kind, id) {
  return `${String(kind || "entry")}:${String(id || "")}`;
}

export function normalizeFavoriteIds(value) {
  return [...new Set(Array.isArray(value) ? value.filter(Boolean).map(String) : [])];
}

export function normalizeRecent(value, limit = 20) {
  return (Array.isArray(value) ? value : [])
    .filter((entry) => entry && entry.id && entry.title && entry.content)
    .map((entry) => ({
      id: String(entry.id),
      kind: String(entry.kind || "entry"),
      title: String(entry.title),
      content: String(entry.content),
      copiedAt: entry.copiedAt || new Date(0).toISOString()
    }))
    .sort((left, right) => new Date(right.copiedAt).getTime() - new Date(left.copiedAt).getTime())
    .slice(0, limit);
}

export function normalizeCloudPayload(payload) {
  if (payload?.schemaVersion === 2 && payload.suites && typeof payload.suites === "object") {
    return {
      schemaVersion: 2,
      suites: {
        zhuangyuan: payload.suites.zhuangyuan || null,
        bangyan: payload.suites.bangyan || null
      },
      meta: payload.meta || {}
    };
  }
  if (payload?.version === 1 && Array.isArray(payload.entries)) {
    return {
      schemaVersion: 2,
      suites: {
        zhuangyuan: { prompts: clone(payload.entries) },
        bangyan: null
      },
      meta: { migratedFrom: "legacy-entries" }
    };
  }
  return null;
}

export function buildCloudPayload({ zhuangyuan, bangyan, meta = {} } = {}) {
  return {
    schemaVersion: 2,
    suites: {
      zhuangyuan: clone(zhuangyuan),
      bangyan: clone(bangyan)
    },
    meta: clone(meta)
  };
}

function updatedAt(entry) {
  const value = new Date(entry?.updatedAt || entry?.createdAt || 0).getTime();
  return Number.isFinite(value) ? value : 0;
}

export function mergePromptEntries(local = [], remote = []) {
  const merged = new Map();
  for (const entry of [...local, ...remote]) {
    if (!entry?.id) continue;
    const id = String(entry.id);
    const current = merged.get(id);
    if (!current || updatedAt(entry) >= updatedAt(current)) merged.set(id, clone(entry));
  }
  return [...merged.values()];
}

export function mergeSyncedSuiteState(local = {}, remote = {}) {
  return {
    ...clone(local),
    prompts: mergePromptEntries(local.prompts || [], remote.prompts || []),
    customPrompts: mergePromptEntries(local.customPrompts || [], remote.customPrompts || []),
    favoriteIds: normalizeFavoriteIds([...(local.favoriteIds || []), ...(remote.favoriteIds || [])]),
    recent: normalizeRecent([...(local.recent || []), ...(remote.recent || [])]),
    lastSyncedAt: new Date().toISOString()
  };
}

export function migrateLegacyPrototypeState(legacy) {
  if (!legacy || !Array.isArray(legacy.prompts)) return null;
  return {
    version: 2,
    suite: "zhuangyuan",
    categories: clone(legacy.categories || []),
    prompts: clone(legacy.prompts),
    activeCategoryId: String(legacy.activeCategoryId || ""),
    defaultDataVersion: Number(legacy.defaultDataVersion || 0),
    favoriteIds: normalizeFavoriteIds(legacy.favoriteIds),
    recent: normalizeRecent(legacy.recent),
    syncCode: typeof legacy.syncCode === "string" ? legacy.syncCode : "",
    lastSyncedAt: legacy.lastSyncedAt || ""
  };
}

export function searchMatches(entry, query, extraText = "") {
  const normalizedQuery = String(query || "").trim().toLocaleLowerCase("zh-CN");
  if (!normalizedQuery) return true;
  const haystack = [
    entry?.id,
    entry?.title,
    entry?.category,
    entry?.categoryId,
    entry?.subcategory,
    entry?.negative,
    entry?.negativePrompt,
    entry?.positive,
    entry?.prompt,
    Array.isArray(entry?.keywords) ? entry.keywords.join(" ") : "",
    extraText
  ].filter(Boolean).join("\n").toLocaleLowerCase("zh-CN");
  return haystack.includes(normalizedQuery);
}
