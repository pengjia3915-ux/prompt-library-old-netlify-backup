export const SUITE_STATE_KEYS = Object.freeze({
  zhuangyuan: "zhuangyuan-state",
  bangyan: "bangyan-state",
  meta: "app-meta",
  legacy: "prototype-state"
});

export const BANGYAN_SYNTHESIS_ORDER = Object.freeze([
  "original",
  "expression",
  "pose",
  "outfit",
  "neckline",
  "scene",
  "cameraPosition",
  "cameraView",
  "hairstyle",
  "hairColor",
  "glasses"
]);

const SLOT_BY_SUBCATEGORY = Object.freeze({
  "表情": "expression",
  "姿势": "pose",
  "穿搭": "outfit",
  "领口": "neckline",
  "场景": "scene",
  "机位": "cameraPosition",
  "视角": "cameraView",
  "发型": "hairstyle",
  "发色": "hairColor",
  "眼镜": "glasses"
});

const DISPLAY_ONLY_SUBCATEGORIES = new Set(["胸型调整"]);
const LEGACY_BASE_CONSTRAINT = "保持原图成年女性人物身份、脸型、五官、年龄感、整体气质、姿势基础和场景关系自然一致。";
const DEFAULT_COMPOSITION_RULES = Object.freeze({
  commonPrefix: "保持原图20岁以上成年女性人物身份、脸型、五官、年龄感和整体气质一致。人物整体保持身材丰满、凹凸有致、比例协调的自然体型；除用户主动选择的修改项外，其余内容保持不变。表情组件仅调整面部情绪，不改变脸型、五官结构和人物辨识度。",
  commonSuffix: "保持真实人体比例、自然衣物褶皱、面料垂坠和真实摄影光影；保持服装结构完整、穿着关系自然，避免低俗化特写。",
  commonNegative: "避免人物身份漂移、换脸、脸型五官变化、眼距变化、鼻型变化、唇形变化、夸张表情导致嘴眼变形、人体结构错误、头身比例异常、肢体穿模、衣料与身体分离、左右镜像复制、轮廓过度外扩、独立球状结构、反重力隆起、尖锐边缘、领口结构错位、绑带穿模、衣片断裂、褶皱塑料感、极端透视、广角拉伸、走光失控、过度磨皮和明显AI痕迹。"
});

export function clone(value) {
  return value == null ? value : JSON.parse(JSON.stringify(value));
}

export function suiteStateKey(suite) {
  return SUITE_STATE_KEYS[suite] || "";
}

export function isDisplayOnlyComponent(component) {
  return DISPLAY_ONLY_SUBCATEGORIES.has(component?.subcategory);
}

export function componentSlot(component) {
  if (isDisplayOnlyComponent(component)) return "displayOnly";
  return SLOT_BY_SUBCATEGORY[component?.subcategory] || "original";
}

function normalizeCompositionRules(value) {
  const source = value && typeof value === "object" ? value : {};
  return {
    commonPrefix: String(source.commonPrefix || DEFAULT_COMPOSITION_RULES.commonPrefix),
    commonSuffix: String(source.commonSuffix || DEFAULT_COMPOSITION_RULES.commonSuffix),
    commonNegative: String(source.commonNegative || DEFAULT_COMPOSITION_RULES.commonNegative)
  };
}

export function emptyBuilder() {
  return {
    original: [],
    expression: "",
    pose: "",
    outfit: "",
    neckline: "",
    scene: "",
    cameraPosition: "",
    cameraView: "",
    hairstyle: "",
    hairColor: "",
    glasses: "",
    colorMode: "",
    colorStyle: "",
    colorPrimary: "",
    colorSecondary: "",
    colorAccent: ""
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

const EDITABLE_STATIC_KINDS = new Set(["prompt", "component", "preset"]);

export function normalizePromptEdit(value) {
  const source = value && typeof value === "object" ? value : {};
  const kind = String(source.kind || "");
  const id = String(source.id || "");
  if (!id || !EDITABLE_STATIC_KINDS.has(kind)) return null;
  const deletedAt = source.deletedAt ? String(source.deletedAt) : "";
  const title = String(source.title || "");
  const positive = String(source.positive || "");
  if (!deletedAt && (!title || !positive)) return null;
  return {
    id,
    kind,
    title,
    positive,
    negative: String(source.negative || ""),
    ...(source.categoryId ? { categoryId: String(source.categoryId) } : {}),
    createdAt: String(source.createdAt || new Date(0).toISOString()),
    updatedAt: String(source.updatedAt || source.createdAt || new Date(0).toISOString()),
    ...(deletedAt ? { deletedAt } : {})
  };
}

export function normalizePromptEdits(value) {
  const entries = new Map();
  for (const item of Array.isArray(value) ? value : []) {
    const entry = normalizePromptEdit(item);
    if (!entry) continue;
    const key = `${entry.kind}:${entry.id}`;
    const current = entries.get(key);
    if (!current || updatedAt(entry) >= updatedAt(current)) entries.set(key, entry);
  }
  return [...entries.values()];
}

export function normalizeSavedComposition(value) {
  const source = value && typeof value === "object" ? value : {};
  const id = String(source.id || "");
  const deletedAt = source.deletedAt ? String(source.deletedAt) : "";
  const title = String(source.title || "");
  const positive = String(source.positive || "");
  if (!id || (!deletedAt && (!title || !positive))) return null;
  return {
    id,
    title,
    categoryId: String(source.categoryId || ""),
    positive,
    negative: String(source.negative || ""),
    builder: normalizeBuilder(source.builder),
    componentIds: [...new Set(Array.isArray(source.componentIds) ? source.componentIds.filter(Boolean).map(String) : [])],
    sourcePresetId: String(source.sourcePresetId || ""),
    createdAt: String(source.createdAt || new Date(0).toISOString()),
    updatedAt: String(source.updatedAt || source.createdAt || new Date(0).toISOString()),
    ...(deletedAt ? { deletedAt } : {})
  };
}

export function normalizeSavedCompositions(value) {
  const entries = new Map();
  for (const item of Array.isArray(value) ? value : []) {
    const entry = normalizeSavedComposition(item);
    if (!entry) continue;
    const current = entries.get(entry.id);
    if (!current || updatedAt(entry) >= updatedAt(current)) entries.set(entry.id, entry);
  }
  return [...entries.values()];
}

export function selectBuilderComponent(builder, component) {
  const next = normalizeBuilder(builder);
  if (isDisplayOnlyComponent(component)) return next;
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
  if (isDisplayOnlyComponent(component)) return next;
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

function stripBaseConstraint(value, compositionRules) {
  return String(value || "")
    .replace(LEGACY_BASE_CONSTRAINT, "")
    .replace(compositionRules.commonPrefix, "")
    .trim();
}

function cleanComponentText(component, options, compositionRules) {
  let text = stripBaseConstraint(component.positive, compositionRules);
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

export function composeBangyanSelection({ components = [], selection = emptyBuilder(), title = "", compositionRules = DEFAULT_COMPOSITION_RULES } = {}) {
  const byId = new Map(components.map((component) => [String(component.id), component]));
  const normalized = normalizeBuilder(selection);
  const rules = normalizeCompositionRules(compositionRules);
  const ids = [
    ...normalized.original,
    ...BANGYAN_SYNTHESIS_ORDER.filter((slot) => slot !== "original").map((slot) => normalized[slot]).filter(Boolean)
  ];
  const selected = [...new Set(ids)]
    .map((id) => byId.get(id))
    .filter((component) => component && !isDisplayOnlyComponent(component));
  if (!selected.length) return { title: title || "未选择组件", positive: "", negative: "", componentIds: [] };

  const options = {
    hasHairColor: selected.some((component) => component.subcategory === "发色"),
    hasHairstyle: selected.some((component) => component.subcategory === "发型"),
    hasNeckline: selected.some((component) => component.subcategory === "领口")
  };
  const positive = joinSentences([
    rules.commonPrefix,
    ...selected.map((component) => cleanComponentText(component, options, rules)),
    rules.commonSuffix
  ]);
  const negative = joinSentences([
    rules.commonNegative,
    ...selected.map((component) => component.negative)
  ]);
  return {
    title: title || selected.map((component) => component.title).join(" + "),
    positive,
    negative,
    componentIds: selected.map((component) => String(component.id))
  };
}

export function composeBangyanPreset(preset, components = [], compositionRules = DEFAULT_COMPOSITION_RULES) {
  const slots = preset?.slots || {};
  return composeBangyanSelection({
    components,
    compositionRules,
    selection: {
      ...emptyBuilder(),
      expression: slots.expression || "",
      pose: slots.pose || "",
      outfit: slots.outfit || "",
      neckline: slots.neckline || "",
      scene: slots.scene || "",
      cameraPosition: slots.cameraPosition || "",
      cameraView: slots.cameraView || "",
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

function builderUpdatedAt(value) {
  const timestamp = new Date(value || 0).getTime();
  return Number.isFinite(timestamp) ? timestamp : 0;
}

function builderHasContent(builder) {
  if (!builder || typeof builder !== "object") return false;
  if (Array.isArray(builder.original) && builder.original.length) return true;
  return ["pose", "outfit", "neckline", "scene", "hairstyle", "hairColor", "glasses", "colorMode", "colorStyle", "colorPrimary", "colorSecondary", "colorAccent"]
    .some((key) => Boolean(builder[key]));
}

function mergeNormalizedRecords(local, remote, normalize, getKey) {
  const merged = new Map();
  for (const raw of [...(Array.isArray(local) ? local : []), ...(Array.isArray(remote) ? remote : [])]) {
    const entry = normalize(raw);
    if (!entry) continue;
    const key = getKey(entry);
    const current = merged.get(key);
    if (!current || updatedAt(entry) >= updatedAt(current)) merged.set(key, clone(entry));
  }
  return [...merged.values()];
}

export function mergePromptEdits(local = [], remote = []) {
  return mergeNormalizedRecords(local, remote, normalizePromptEdit, (entry) => `${entry.kind}:${entry.id}`);
}

export function mergeSavedCompositions(local = [], remote = []) {
  return mergeNormalizedRecords(local, remote, normalizeSavedComposition, (entry) => entry.id);
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
  const localBuilder = local?.builder && typeof local.builder === "object" ? local.builder : null;
  const remoteBuilder = remote?.builder && typeof remote.builder === "object" ? remote.builder : null;
  const localBuilderTimestamp = builderUpdatedAt(local?.builderUpdatedAt);
  const remoteBuilderTimestamp = builderUpdatedAt(remote?.builderUpdatedAt);
  const useRemoteBuilder = Boolean(remoteBuilder) && (
    !localBuilder
    || remoteBuilderTimestamp > localBuilderTimestamp
    || (remoteBuilderTimestamp === 0 && localBuilderTimestamp === 0 && !builderHasContent(localBuilder) && builderHasContent(remoteBuilder))
  );
  const merged = {
    ...clone(local),
    prompts: mergePromptEntries(local.prompts || [], remote.prompts || []),
    customPrompts: mergePromptEntries(local.customPrompts || [], remote.customPrompts || []),
    promptEdits: mergePromptEdits(local.promptEdits || [], remote.promptEdits || []),
    savedCompositions: mergeSavedCompositions(local.savedCompositions || [], remote.savedCompositions || []),
    favoriteIds: normalizeFavoriteIds([...(local.favoriteIds || []), ...(remote.favoriteIds || [])]),
    recent: normalizeRecent([...(local.recent || []), ...(remote.recent || [])]),
    lastSyncedAt: new Date().toISOString()
  };
  if (localBuilder || remoteBuilder) {
    merged.builder = clone(useRemoteBuilder ? remoteBuilder : localBuilder);
    merged.builderUpdatedAt = useRemoteBuilder ? String(remote.builderUpdatedAt || "") : String(local.builderUpdatedAt || "");
  }
  return merged;
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
