import {
  createSyncCode,
  formatSyncCode,
  isValidSyncCode,
  normalizeSyncCode,
  syncSuites
} from "./sync.js";
import { readStorageBundle, writeStorageBundle } from "./storage.js";
import {
  BANGYAN_SYNTHESIS_ORDER,
  clone,
  composeBangyanPreset,
  composeBangyanSelection,
  componentSlot,
  emptyBuilder,
  favoriteKey,
  isDisplayOnlyComponent,
  migrateLegacyPrototypeState,
  normalizeBuilder,
  normalizeFavoriteIds,
  normalizePromptEdits,
  normalizeRecent,
  normalizeSavedComposition,
  normalizeSavedCompositions,
  searchMatches,
  selectBuilderComponent,
  removeBuilderComponent
} from "./suite-utils.js";

const APP_ASSET_VERSION = "2.6.8";
const PAGE_SIZE = 48;
const THEME_KEY = "prompt-library-prototype-theme";
const THEMES = new Set(["sage", "wine", "blue", "studio"]);
const THEME_COLORS = {
  sage: "#F2F4F5",
  wine: "#F2F4F5",
  blue: "#F3F5F7",
  studio: "#181B1A"
};

const BANGYAN_CATEGORIES = [
  { id: "原图处理", name: "原图处理", shortName: "原图处理", description: "保持人物身份与场景关系，处理原图中的遮挡、结构和画面问题。", order: 1 },
  { id: "发型发色", name: "发型发色", shortName: "发型发色", description: "按发型、发色和眼镜 slot 自由选择，不改变未选择的项目。", order: 2 },
  { id: "姿势穿搭场景", name: "姿势穿搭场景", shortName: "姿势穿搭场景", description: "表情、姿势、穿搭、领口、场景、机位和视角完全由用户自由组合。", order: 3 }
];

const BANGYAN_MODES = [
  { id: "presets", label: "推荐组合" },
  { id: "builder", label: "自由拼装" },
  { id: "components", label: "单项库" },
  { id: "direct", label: "直接 Prompt" }
];

const BANGYAN_SUBCATEGORIES = Object.freeze({
  "原图处理": [],
  "发型发色": ["全部", "发型", "发色", "眼镜"],
  "姿势穿搭场景": ["全部", "表情", "姿势", "穿搭", "领口", "场景", "机位", "视角"]
});

const BUILDER_SLOT_GROUPS = Object.freeze({
  "原图处理": [{ slot: "original", label: "原图处理组件" }],
  "发型发色": [
    { slot: "hairstyle", label: "发型" },
    { slot: "hairColor", label: "发色" },
    { slot: "glasses", label: "眼镜" }
  ],
  "姿势穿搭场景": [
    { slot: "expression", label: "表情" },
    { slot: "pose", label: "姿势" },
    { slot: "outfit", label: "穿搭" },
    { slot: "neckline", label: "领口" },
    { slot: "scene", label: "场景" },
    { slot: "cameraPosition", label: "机位" },
    { slot: "cameraView", label: "视角" }
  ]
});

const BANGYAN_COLOR_MODES = Object.freeze([
  { id: "uniform", label: "全套统一色" },
  { id: "matching", label: "搭配色" }
]);

const BANGYAN_UNIFORM_COLORS = Object.freeze([
  { id: "black", label: "黑色 · 经典利落", name: "黑色", tone: "成熟、利落" },
  { id: "white", label: "白色 · 纯净清爽", name: "白色", tone: "清爽、干净" },
  { id: "cream", label: "奶油白 · 柔和明亮", name: "奶油白", tone: "柔和、明亮" },
  { id: "light-gray", label: "浅灰 · 低调轻盈", name: "浅灰色", tone: "克制、轻盈" },
  { id: "graphite", label: "石墨灰 · 高级沉稳", name: "石墨灰", tone: "沉稳、高级" },
  { id: "beige", label: "米色 · 自然温和", name: "米色", tone: "自然、温和" },
  { id: "camel", label: "驼色 · 温暖成熟", name: "驼色", tone: "温暖、成熟" },
  { id: "coffee", label: "咖棕 · 复古沉稳", name: "咖棕色", tone: "沉稳、复古" },
  { id: "burgundy", label: "酒红 · 成熟吸引力", name: "深酒红", tone: "成熟、自信的高级女性美" },
  { id: "red", label: "正红 · 明快自信", name: "正红色", tone: "明快、自信" },
  { id: "rose", label: "玫瑰粉 · 浪漫柔和", name: "玫瑰粉", tone: "柔和、浪漫" },
  { id: "blush", label: "粉彩粉 · 甜美轻盈", name: "粉彩粉", tone: "甜美、轻盈但不幼态" },
  { id: "coral", label: "珊瑚橙 · 明亮活力", name: "珊瑚橙", tone: "明亮、活力" },
  { id: "apricot", label: "杏色 · 温柔亲和", name: "杏色", tone: "温柔、亲和" },
  { id: "mint", label: "薄荷绿 · 清新轻盈", name: "薄荷绿", tone: "清新、轻盈" },
  { id: "olive", label: "橄榄绿 · 自然从容", name: "橄榄绿", tone: "自然、从容" },
  { id: "forest", label: "墨绿 · 精致沉稳", name: "墨绿色", tone: "沉稳、精致" },
  { id: "mist-blue", label: "雾蓝 · 清爽理性", name: "雾蓝色", tone: "清爽、理性" },
  { id: "navy", label: "海军蓝 · 经典端庄", name: "海军蓝", tone: "经典、端庄" },
  { id: "denim", label: "牛仔蓝 · 休闲利落", name: "牛仔蓝", tone: "轻松、利落" }
]);

const BANGYAN_MATCHING_PALETTES = Object.freeze([
  { id: "classic-contrast", label: "黑 + 白 + 灰 · 经典清晰", colors: ["黑色", "白色", "灰色"], tone: "经典、清晰、利落" },
  { id: "burgundy-neutral", label: "酒红 + 黑 + 米白 · 成熟吸引力", colors: ["深酒红", "黑色", "米白色"], tone: "成熟、自信、克制" },
  { id: "burgundy-rose", label: "酒红 + 玫瑰粉 + 奶油白 · 浪漫成熟", colors: ["深酒红", "玫瑰粉", "奶油白"], tone: "成熟与柔和自然平衡" },
  { id: "black-camel", label: "黑 + 驼 + 米白 · 稳重温暖", colors: ["黑色", "驼色", "米白色"], tone: "稳重、温暖、耐看" },
  { id: "black-forest", label: "黑 + 墨绿 + 米色 · 高级自然", colors: ["黑色", "墨绿色", "米色"], tone: "沉稳、高级、自然" },
  { id: "graphite-white", label: "石墨灰 + 白 + 浅灰 · 冷静干净", colors: ["石墨灰", "白色", "浅灰色"], tone: "冷静、干净、克制" },
  { id: "cream-oat", label: "奶油白 + 燕麦 + 浅棕 · 柔和自然", colors: ["奶油白", "燕麦色", "浅棕色"], tone: "柔和、自然、明亮" },
  { id: "beige-brown", label: "米色 + 咖棕 + 奶油白 · 复古温和", colors: ["米色", "咖棕色", "奶油白"], tone: "自然、复古、温和" },
  { id: "camel-forest", label: "驼色 + 墨绿 + 米白 · 温暖高级", colors: ["驼色", "墨绿色", "米白色"], tone: "温暖、自然、沉稳" },
  { id: "navy-white", label: "海军蓝 + 白 + 浅灰 · 经典清爽", colors: ["海军蓝", "白色", "浅灰色"], tone: "经典、清爽、端庄" },
  { id: "denim-white", label: "牛仔蓝 + 白 + 浅灰 · 休闲清爽", colors: ["牛仔蓝", "白色", "浅灰色"], tone: "休闲、清爽、利落" },
  { id: "mist-blue-white", label: "雾蓝 + 白 + 浅灰 · 轻盈理性", colors: ["雾蓝色", "白色", "浅灰色"], tone: "轻盈、理性、干净" },
  { id: "denim-camel", label: "牛仔蓝 + 驼色 + 白 · 日常利落", colors: ["牛仔蓝", "驼色", "白色"], tone: "日常、利落、自然" },
  { id: "pink-cream", label: "粉彩粉 + 奶油白 + 浅灰 · 甜美柔和", colors: ["粉彩粉", "奶油白", "浅灰色"], tone: "甜美、柔和但不幼态" },
  { id: "rose-blush", label: "玫瑰粉 + 粉彩粉 + 米白 · 浪漫温柔", colors: ["玫瑰粉", "粉彩粉", "米白色"], tone: "浪漫、温柔、轻盈" },
  { id: "pink-mint", label: "粉彩粉 + 薄荷绿 + 奶油白 · 清新甜美", colors: ["粉彩粉", "薄荷绿", "奶油白"], tone: "轻快、清新、甜美" },
  { id: "coral-cream", label: "珊瑚橙 + 米色 + 白 · 明亮活力", colors: ["珊瑚橙", "米色", "白色"], tone: "明亮、活力、亲和" },
  { id: "olive-cream", label: "橄榄绿 + 奶油白 + 驼色 · 自然沉稳", colors: ["橄榄绿", "奶油白", "驼色"], tone: "自然、沉稳、温和" },
  { id: "red-navy-white", label: "正红 + 海军蓝 + 白 · 明快经典", colors: ["正红色", "海军蓝", "白色"], tone: "明快、经典、自信" },
  { id: "mint-mist-blue", label: "薄荷绿 + 雾蓝 + 白 · 清新轻盈", colors: ["薄荷绿", "雾蓝色", "白色"], tone: "清新、轻盈、明亮" }
]);

const app = {
  defaults: { zhuangyuan: null, bangyan: null },
  states: { zhuangyuan: null, bangyan: null },
  meta: { schemaVersion: 2, migrationVersion: 0, activeSuite: "zhuangyuan", syncCode: "", lastSyncedAt: "" },
  activeSuite: "zhuangyuan",
  subcategoryFilter: "全部",
  searchQuery: "",
  visibleLimit: PAGE_SIZE,
  collapsedSections: new Set(),
  detail: null,
  storageMode: "indexeddb",
  syncBusy: false,
  toastTimer: null,
  theme: THEMES.has(document.documentElement.dataset.theme) ? document.documentElement.dataset.theme : "sage"
};

const $ = (selector) => document.querySelector(selector);

function escapeHtml(value = "") {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function makeId(prefix = "prompt") {
  return crypto.randomUUID?.() || `${prefix}-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function nowIso() {
  return new Date().toISOString();
}

function currentState() {
  return app.states[app.activeSuite];
}

function categoryList(suite = app.activeSuite) {
  return suite === "bangyan" ? BANGYAN_CATEGORIES : (app.defaults.zhuangyuan?.categories || []);
}

function categoryById(id, suite = app.activeSuite) {
  return categoryList(suite).find((category) => category.id === id) || categoryList(suite)[0];
}

function normalizeCustomPrompt(entry, suite) {
  if (!entry || !entry.id || !entry.title || !entry.prompt) return null;
  return {
    id: String(entry.id),
    title: String(entry.title),
    categoryId: String(entry.categoryId || (suite === "bangyan" ? "原图处理" : "image-edit")),
    prompt: String(entry.prompt),
    negativePrompt: String(entry.negativePrompt || ""),
    pinned: Boolean(entry.pinned),
    pinOrder: Number(entry.pinOrder || 0),
    createdAt: entry.createdAt || nowIso(),
    updatedAt: entry.updatedAt || entry.createdAt || nowIso(),
    ...(suite === "bangyan" ? { kind: entry.kind === "direct" ? "direct" : "custom" } : {}),
    ...(entry.deletedAt ? { deletedAt: entry.deletedAt } : {})
  };
}

function normalizeZhuangyuanState(defaultData, stored) {
  const source = stored && typeof stored === "object" ? stored : {};
  const defaults = Array.isArray(defaultData?.prompts) ? defaultData.prompts : [];
  const storedPrompts = Array.isArray(source.prompts) ? source.prompts : [];
  const defaultsById = new Map(defaults.map((entry) => [entry.id, entry]));
  const storedById = new Map(storedPrompts.map((entry) => [entry.id, entry]));
  const defaultVersion = Number(defaultData?.version || 1);
  const storedVersion = Number(source.defaultDataVersion || 0);
  const mergedDefaults = defaults.map((entry) => {
    const storedEntry = storedById.get(entry.id);
    if (!storedEntry) return clone(entry);
    if (storedVersion < defaultVersion) {
      return {
        ...clone(entry),
        pinned: Boolean(storedEntry.pinned),
        pinOrder: Number(storedEntry.pinOrder || 0),
        ...(storedEntry.deletedAt ? { deletedAt: storedEntry.deletedAt } : {})
      };
    }
    return clone(storedEntry);
  });
  const customPrompts = storedPrompts
    .filter((entry) => !defaultsById.has(entry.id))
    .map((entry) => normalizeCustomPrompt(entry, "zhuangyuan"))
    .filter(Boolean);
  const validCategoryIds = new Set(defaultData?.categories?.map((category) => category.id) || []);
  const favoriteIds = normalizeFavoriteIds([
    ...(source.favoriteIds || []),
    ...storedPrompts.filter((entry) => entry.favorite).map((entry) => favoriteKey("prompt", entry.id))
  ]);
  const promptEdits = normalizePromptEdits(source.promptEdits).filter((entry) => entry.kind === "prompt");
  return {
    version: 2,
    suite: "zhuangyuan",
    categories: clone(defaultData?.categories || []),
    prompts: [...mergedDefaults, ...customPrompts],
    customPrompts,
    activeCategoryId: validCategoryIds.has(source.activeCategoryId) ? source.activeCategoryId : defaultData?.categories?.[0]?.id || "",
    defaultDataVersion: defaultVersion,
    promptEdits,
    savedCompositions: normalizeSavedCompositions(source.savedCompositions),
    favoriteIds,
    recent: normalizeRecent(source.recent),
    syncCode: typeof source.syncCode === "string" ? source.syncCode : "",
    lastSyncedAt: source.lastSyncedAt || ""
  };
}

function normalizeBangyanState(stored) {
  const source = stored && typeof stored === "object" ? stored : {};
  const customPrompts = (Array.isArray(source.customPrompts) ? source.customPrompts : [])
    .map((entry) => normalizeCustomPrompt(entry, "bangyan"))
    .filter(Boolean);
  const validCategoryIds = new Set(BANGYAN_CATEGORIES.map((category) => category.id));
  const activeMode = BANGYAN_MODES.some((mode) => mode.id === source.activeMode) ? source.activeMode : "presets";
  const promptEdits = normalizePromptEdits(source.promptEdits).filter((entry) => entry.kind === "component" || entry.kind === "preset" || entry.kind === "direct");
  return {
    version: 2,
    suite: "bangyan",
    customPrompts,
    activeCategoryId: validCategoryIds.has(source.activeCategoryId) ? source.activeCategoryId : BANGYAN_CATEGORIES[0].id,
    activeMode,
    promptEdits,
    savedCompositions: normalizeSavedCompositions(source.savedCompositions),
    builder: normalizeBuilder(source.builder),
    builderUpdatedAt: typeof source.builderUpdatedAt === "string" ? source.builderUpdatedAt : "",
    favoriteIds: normalizeFavoriteIds(source.favoriteIds),
    recent: normalizeRecent(source.recent),
    syncCode: typeof source.syncCode === "string" ? source.syncCode : "",
    lastSyncedAt: source.lastSyncedAt || ""
  };
}

function normalizeMeta(stored) {
  const source = stored && typeof stored === "object" ? stored : {};
  return {
    schemaVersion: 2,
    migrationVersion: Math.max(1, Number(source.migrationVersion || 0)),
    activeSuite: source.activeSuite === "bangyan" ? "bangyan" : "zhuangyuan",
    syncCode: typeof source.syncCode === "string" ? source.syncCode : "",
    lastSyncedAt: source.lastSyncedAt || ""
  };
}

function zhuangyuanEntries() {
  return (app.states.zhuangyuan?.prompts || []).filter((entry) => !entry.deletedAt);
}

function bangyanComponents() {
  return (app.defaults.bangyan?.components || []).filter((entry) => entry.enabled !== false);
}

function bangyanComponentsForDisplay() {
  return bangyanComponents().map((entry) => effectiveEntry("component", entry));
}

function bangyanPresets() {
  return (app.defaults.bangyan?.presets || []).filter((entry) => entry.enabled !== false);
}

function bangyanDirectPrompts() {
  return (app.defaults.bangyan?.directPrompts || []).filter((entry) => entry.enabled !== false);
}

function bangyanCustomDirectPrompts() {
  return (app.states.bangyan?.customPrompts || []).filter((entry) => entry.kind === "direct" && !entry.deletedAt);
}

function bangyanDirectEntries() {
  return [
    ...bangyanDirectPrompts().map((entry) => ({ kind: "direct", entry })),
    ...bangyanCustomDirectPrompts().map((entry) => ({ kind: "custom", entry }))
  ];
}

function bangyanCustomPrompts() {
  return (app.states.bangyan?.customPrompts || []).filter((entry) => !entry.deletedAt);
}

function savedCompositionEntries(suite = app.activeSuite) {
  return (app.states[suite]?.savedCompositions || []).filter((entry) => !entry.deletedAt);
}

function syncZhuangyuanCustomPrompts() {
  const state = app.states.zhuangyuan;
  if (!state || !app.defaults.zhuangyuan) return;
  const defaultIds = new Set(app.defaults.zhuangyuan.prompts.map((entry) => entry.id));
  state.customPrompts = state.prompts.filter((entry) => !defaultIds.has(entry.id));
}

function findEntry(kind, id) {
  if (kind === "prompt") return zhuangyuanEntries().find((entry) => entry.id === id);
  if (kind === "component") return bangyanComponents().find((entry) => entry.id === id);
  if (kind === "preset") return bangyanPresets().find((entry) => entry.id === id);
  if (kind === "direct") return bangyanDirectPrompts().find((entry) => entry.id === id);
  if (kind === "custom") return bangyanCustomPrompts().find((entry) => entry.id === id);
  if (kind === "composition") return savedCompositionEntries().find((entry) => entry.id === id);
  return null;
}

function promptEditFor(kind, id) {
  return currentState()?.promptEdits?.find((entry) => entry.kind === kind && entry.id === id && !entry.deletedAt) || null;
}

function hasPromptEdit(kind, id) {
  return Boolean(promptEditFor(kind, id));
}

function isStaticEditable(kind, id) {
  if (!id) return false;
  if (kind === "prompt") return Boolean(app.defaults.zhuangyuan?.prompts?.some((entry) => entry.id === id));
  if (kind === "component") return Boolean(app.defaults.bangyan?.components?.some((entry) => entry.id === id));
  if (kind === "preset") return Boolean(app.defaults.bangyan?.presets?.some((entry) => entry.id === id));
  if (kind === "direct") return Boolean(app.defaults.bangyan?.directPrompts?.some((entry) => entry.id === id));
  return false;
}

function effectiveEntry(kind, entry) {
  if (!entry) return entry;
  const edit = promptEditFor(kind, entry.id);
  if (!edit) return entry;
  if (kind === "prompt") {
    return {
      ...entry,
      title: edit.title,
      categoryId: edit.categoryId || entry.categoryId,
      prompt: edit.positive,
      negativePrompt: edit.negative,
      updatedAt: edit.updatedAt
    };
  }
  if (kind === "component" || kind === "direct") {
    return { ...entry, title: edit.title, positive: edit.positive, negative: edit.negative, updatedAt: edit.updatedAt };
  }
  if (kind === "preset") return { ...entry, title: edit.title, updatedAt: edit.updatedAt };
  return entry;
}

function displayFor(kind, entry) {
  if (!entry) return { title: "", positive: "", negative: "", all: "" };
  const edit = promptEditFor(kind, entry.id);
  if (kind === "preset") {
    if (edit) {
      return {
        title: edit.title,
        positive: edit.positive,
        negative: edit.negative,
        all: edit.negative ? `${edit.positive}\n\n反向提示词：${edit.negative}` : edit.positive
      };
    }
    const composed = composeBangyanPreset(entry, bangyanComponentsForDisplay(), app.defaults.bangyan?.compositionRules);
    return { ...composed, all: composed.negative ? `${composed.positive}\n\n反向提示词：${composed.negative}` : composed.positive };
  }
  const view = effectiveEntry(kind, entry);
  const positive = kind === "component" || kind === "direct" || kind === "composition" ? view.positive : view.prompt;
  const negative = kind === "component" || kind === "direct" || kind === "composition" ? view.negative : view.negativePrompt;
  return {
    title: view.title,
    positive: String(positive || ""),
    negative: String(negative || ""),
    all: negative ? `${positive}\n\n反向提示词：${negative}` : String(positive || "")
  };
}

function categoryNameFor(kind, entry) {
  if (!entry) return "";
  const view = effectiveEntry(kind, entry);
  if (kind === "prompt") return categoryById(view.categoryId, "zhuangyuan")?.name || view.categoryId;
  if (kind === "custom" || kind === "composition") return categoryById(view.categoryId, "bangyan")?.name || view.categoryId;
  return view.category || "";
}

function subcategoryFor(kind, entry) {
  if (kind === "component") return entry.subcategory || "单项组件";
  if (kind === "preset") return "推荐组合";
  if (kind === "direct") return entry.subcategory || "直接 Prompt";
  if (kind === "composition") return "已收藏组合";
  if (kind === "custom" && entry?.kind === "direct") return "直接 Prompt";
  return kind === "custom" ? "自定义 Prompt" : "完整 Prompt";
}

function searchEntry(kind, entry) {
  const display = displayFor(kind, entry);
  const view = effectiveEntry(kind, entry);
  const extra = kind === "preset"
    ? Object.values(entry.slots || {}).map((id) => bangyanComponentsForDisplay().find((component) => component.id === id)).filter(Boolean).flatMap((component) => [component.title, component.subcategory, ...(component.keywords || [])]).join(" ")
    : "";
  return searchMatches({
    ...view,
    category: categoryNameFor(kind, entry),
    positive: display.positive,
    negative: display.negative
  }, app.searchQuery, extra);
}

function compactSummary(value, limit = 68) {
  const normalized = String(value || "").replace(/\s+/g, " ").trim();
  if (!normalized) return "";
  const firstSentence = normalized.split(/(?<=[。！？.!?])/u)[0].trim();
  const chars = Array.from(firstSentence);
  return chars.length > limit ? `${chars.slice(0, limit).join("")}…` : firstSentence;
}

function entrySummary(kind, entry, display) {
  if (kind === "preset" && !hasPromptEdit(kind, entry.id)) return "可继续调整各 slot 的组件选择";
  if (kind === "component" || kind === "direct") return compactSummary(entry.composeText || entry.positive);
  return compactSummary(display.positive);
}

function isFavorite(kind, id) {
  if (kind === "composition") return Boolean(findEntry(kind, id));
  return currentState().favoriteIds.includes(favoriteKey(kind, id));
}

function isPinned(kind, entry) {
  return (kind === "prompt" || kind === "custom") && Boolean(entry?.pinned);
}

function sortEntries(items) {
  return [...items].sort((left, right) => {
    const leftPinned = Number(isPinned(left.kind, left.entry));
    const rightPinned = Number(isPinned(right.kind, right.entry));
    if (leftPinned !== rightPinned) return rightPinned - leftPinned;
    const leftView = effectiveEntry(left.kind, left.entry);
    const rightView = effectiveEntry(right.kind, right.entry);
    const leftDate = new Date(leftView.updatedAt || leftView.createdAt || 0).getTime();
    const rightDate = new Date(rightView.updatedAt || rightView.createdAt || 0).getTime();
    return rightDate - leftDate || String(left.entry.id).localeCompare(String(right.entry.id));
  });
}

function showToast(message) {
  const toast = $("#toast");
  if (!toast) return;
  toast.textContent = message;
  toast.classList.add("is-visible");
  window.clearTimeout(app.toastTimer);
  app.toastTimer = window.setTimeout(() => toast.classList.remove("is-visible"), 1900);
}

function copyText(value) {
  return navigator.clipboard?.writeText(value).catch(() => fallbackCopy(value)) || fallbackCopy(value);
}

function fallbackCopy(value) {
  const textarea = document.createElement("textarea");
  textarea.value = value;
  textarea.style.position = "fixed";
  textarea.style.opacity = "0";
  document.body.append(textarea);
  textarea.select();
  document.execCommand("copy");
  textarea.remove();
  return Promise.resolve();
}

function recordRecent(kind, id, title, content, recentId = `${kind}:${id}`) {
  const state = currentState();
  state.recent = normalizeRecent([
    { id: recentId, kind, title, content, copiedAt: nowIso() },
    ...(state.recent || []).filter((entry) => entry.id !== recentId)
  ]);
}

async function persist() {
  try {
    app.storageMode = await writeStorageBundle({
      zhuangyuan: app.states.zhuangyuan,
      bangyan: app.states.bangyan,
      meta: app.meta
    });
  } catch {
    showToast("本地保存失败，请稍后重试");
  }
}

function exportUserState() {
  const withoutSyncSecrets = (state) => {
    if (!state) return null;
    const { syncCode, lastSyncedAt, ...safeState } = state;
    return safeState;
  };
  const payload = {
    format: "prompt-library-user-state",
    version: 1,
    exportedAt: nowIso(),
    suites: {
      zhuangyuan: withoutSyncSecrets(app.states.zhuangyuan),
      bangyan: withoutSyncSecrets(app.states.bangyan)
    }
  };
  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = "prompt-library-user-state-" + new Date().toISOString().slice(0, 10) + ".json";
  document.body.append(anchor);
  anchor.click();
  anchor.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 500);
  showToast("本机编辑和收藏已导出");
}

async function copyEntry(kind, id, copyType = "all") {
  const entry = findEntry(kind, id);
  if (kind === "component" && isDisplayOnlyComponent(entry)) {
    showToast("该项仅供辨认，不会复制到 Prompt 正文");
    return;
  }
  const display = displayFor(kind, entry);
  if (!entry || !display.positive) return;
  const content = copyType === "positive" ? display.positive : copyType === "negative" ? display.negative : display.all;
  if (!content) {
    showToast("这条内容没有单独的反向提示词");
    return;
  }
  await copyText(content);
  recordRecent(kind, id, display.title, content);
  await persist();
  renderRecent();
  showToast(copyType === "negative" ? "反向提示词已复制" : "Prompt 已复制");
}

function applyTheme(theme, { save = false } = {}) {
  const nextTheme = THEMES.has(theme) ? theme : "sage";
  app.theme = nextTheme;
  document.documentElement.dataset.theme = nextTheme;
  document.querySelector('meta[name="theme-color"]')?.setAttribute("content", THEME_COLORS[nextTheme]);
  if (save) {
    try { localStorage.setItem(THEME_KEY, nextTheme); } catch {}
  }
  document.querySelectorAll(".theme-option").forEach((option) => {
    const active = option.dataset.theme === nextTheme;
    option.classList.toggle("is-active", active);
    option.setAttribute("aria-checked", String(active));
  });
}

function renderSuiteTabs() {
  document.querySelectorAll("[data-suite-tab]").forEach((button) => {
    const active = button.dataset.suiteTab === app.activeSuite;
    button.classList.toggle("is-active", active);
    button.setAttribute("aria-selected", String(active));
  });
}

function modeCount(mode, categoryId) {
  if (mode === "presets") return bangyanPresets().filter((entry) => entry.category === categoryId).length;
  if (mode === "direct") return bangyanDirectEntries().filter(({ entry }) => (entry.category || entry.categoryId) === categoryId).length;
  return bangyanComponents().filter((entry) => entry.category === categoryId).length;
}

function renderModeTabs() {
  const container = $("#mode-tabs");
  if (app.activeSuite !== "bangyan") {
    container.hidden = true;
    container.innerHTML = "";
    return;
  }
  const state = app.states.bangyan;
  container.hidden = false;
  container.innerHTML = BANGYAN_MODES.map((mode) => `
    <button class="mode-button ${state.activeMode === mode.id ? "is-active" : ""}" type="button" data-action="change-mode" data-mode="${mode.id}" aria-pressed="${state.activeMode === mode.id}">
      ${escapeHtml(mode.label)}
    </button>
  `).join("");
}

function renderAddPromptButton() {
  const label = $("#add-prompt-label");
  if (!label) return;
  label.textContent = app.activeSuite === "bangyan" && app.states.bangyan?.activeMode === "direct" ? "新增直接 Prompt" : "新增";
}

function renderSubcategoryTabs() {
  const container = $("#subcategory-tabs");
  if (!container) return;
  const options = BANGYAN_SUBCATEGORIES[app.states.bangyan?.activeCategoryId] || [];
  const visible = app.activeSuite === "bangyan" && app.states.bangyan?.activeMode === "components" && options.length > 1;
  container.hidden = !visible;
  if (!visible) {
    container.innerHTML = "";
    app.subcategoryFilter = "全部";
    return;
  }
  if (!options.includes(app.subcategoryFilter)) app.subcategoryFilter = "全部";
  container.innerHTML = options.map((subcategory) => `
    <button class="subcategory-button ${subcategory === app.subcategoryFilter ? "is-active" : ""}" type="button" data-action="change-subcategory" data-subcategory="${escapeHtml(subcategory)}" aria-pressed="${subcategory === app.subcategoryFilter}">
      ${escapeHtml(subcategory)}
    </button>
  `).join("");
}

function renderCategoryTabs() {
  const state = currentState();
  const categories = categoryList();
  $("#category-tabs").innerHTML = categories
    .sort((left, right) => Number(left.order || 0) - Number(right.order || 0))
    .map((category) => {
      const count = app.activeSuite === "bangyan" ? modeCount(app.states.bangyan.activeMode, category.id) : zhuangyuanEntries().filter((entry) => effectiveEntry("prompt", entry).categoryId === category.id).length;
      return `
        <button class="tab-button ${category.id === state.activeCategoryId ? "is-active" : ""}" type="button" data-action="change-category" data-id="${escapeHtml(category.id)}">
          <span>${escapeHtml(category.shortName || category.name)}</span><small>${count}</small>
        </button>
      `;
    }).join("");
}

function renderHeading() {
  const state = currentState();
  const category = categoryById(state.activeCategoryId);
  const categoryId = category?.id || "";
  let count = 0;
  let description = category?.description || "";
  if (app.activeSuite === "bangyan") {
    count = modeCount(state.activeMode, categoryId);
    if (state.activeMode === "builder") description = "选择组件加入拼装区；同一个 slot 的新选择会替换旧选择，不设置主观禁配。";
    if (state.activeMode === "direct") description = "完整 Prompt 直接复制使用；不参与自由拼装，也不生成推荐组合。";
  } else {
    count = zhuangyuanEntries().filter((entry) => effectiveEntry("prompt", entry).categoryId === categoryId).length;
  }
  $("#category-eyebrow").textContent = app.activeSuite === "bangyan" ? "榜眼正式数据" : "状元旧站数据";
  $("#category-title").textContent = category?.name || "Prompt";
  $("#category-description").textContent = description;
  $("#category-count").textContent = `${count} 条`;
}

function renderEntryCard(kind, entry) {
  const display = displayFor(kind, entry);
  const view = effectiveEntry(kind, entry);
  const favorite = isFavorite(kind, entry.id);
  const pinned = isPinned(kind, entry);
  const categoryName = categoryNameFor(kind, entry);
  const subcategory = subcategoryFor(kind, entry);
  const id = escapeHtml(entry.id);
  const edited = hasPromptEdit(kind, entry.id);
  const editable = ["prompt", "custom", "component", "preset", "direct", "composition"].includes(kind);
  const displayOnly = kind === "component" && isDisplayOnlyComponent(entry);
  const copyable = !displayOnly;
  const addBuilder = (kind === "component" || kind === "preset" || kind === "composition") && !displayOnly;
  const inlineBuilder = kind === "preset" || kind === "composition";
  const builderLabel = inlineBuilder ? "继续调整" : "加入拼装";
  const favoriteAction = kind === "composition" ? "delete-composition" : "toggle-favorite";
  return `
    <article class="prompt-card ${pinned ? "is-pinned" : ""}" data-entry-kind="${kind}" data-entry-id="${id}">
      <div class="card-topline">
        <div class="card-title-block">
          <h3><button class="entry-title" type="button" data-action="open-detail" data-kind="${kind}" data-id="${id}">${escapeHtml(display.title)}</button></h3>
          <span>${escapeHtml(categoryName)} · ${escapeHtml(subcategory)}${pinned ? " · 已置顶" : ""}${favorite ? " · 已收藏" : ""}${edited ? " · 已编辑" : ""}</span>
        </div>
        <button class="favorite-button ${favorite ? "is-active" : ""}" type="button" data-action="${favoriteAction}" data-kind="${kind}" data-id="${id}" aria-label="${favorite ? "取消收藏" : "收藏"}">${favorite ? "★" : "☆"}</button>
      </div>
      <p class="card-preview">${escapeHtml(entrySummary(kind, view, display))}</p>
      <div class="card-actions">
        ${copyable ? `<button class="text-action is-copy" type="button" data-action="copy-entry" data-kind="${kind}" data-id="${id}" data-copy-type="all">复制</button>` : `<span class="text-action is-muted" title="该项仅用于辨认">仅供辨认</span>`}
        ${inlineBuilder ? `<button class="text-action" type="button" data-action="add-to-builder" data-kind="${kind}" data-id="${id}">${builderLabel}</button>` : ""}
        <details class="entry-menu">
          <summary>更多</summary>
          <div class="entry-menu-panel">
            ${copyable ? `<button type="button" data-action="copy-entry" data-kind="${kind}" data-id="${id}" data-copy-type="positive">复制正向</button>
            <button type="button" data-action="copy-entry" data-kind="${kind}" data-id="${id}" data-copy-type="negative">复制反向</button>
            <button type="button" data-action="copy-entry" data-kind="${kind}" data-id="${id}" data-copy-type="all">复制全部</button>` : `<span class="menu-note">仅供辨认，不进入 Prompt 正文</span>`}
            ${kind === "composition" ? `<button type="button" data-action="delete-composition" data-kind="${kind}" data-id="${id}">取消收藏</button>` : `<button type="button" data-action="toggle-favorite" data-kind="${kind}" data-id="${id}">${favorite ? "取消收藏" : "收藏"}</button>`}
            ${(kind === "prompt" || kind === "custom") ? `<button type="button" data-action="toggle-pin" data-kind="${kind}" data-id="${id}">${pinned ? "取消置顶" : "置顶"}</button>` : ""}
            ${addBuilder ? `<button type="button" data-action="add-to-builder" data-kind="${kind}" data-id="${id}">${builderLabel}</button>` : ""}
            ${editable ? `<button type="button" data-action="edit-prompt" data-kind="${kind}" data-id="${id}">编辑</button>` : ""}
            ${edited ? `<button type="button" data-action="reset-edit" data-kind="${kind}" data-id="${id}">恢复正式内容</button>` : ""}
            ${(kind === "prompt" || kind === "custom") ? `<button class="is-danger" type="button" data-action="delete-prompt" data-kind="${kind}" data-id="${id}">删除</button>` : ""}
          </div>
        </details>
      </div>
    </article>
  `;
}

function renderList(title, items, { collapsible = false, sectionKey = "" } = {}) {
  const visible = items.slice(0, app.visibleLimit);
  const collapsed = collapsible && app.collapsedSections.has(sectionKey);
  return `
    <section class="prompt-section">
      <div class="section-title-row">
        <h3>${escapeHtml(title)}</h3>
        <div class="section-title-actions">
          <span>${items.length} 条</span>
          ${collapsible ? `<button class="section-toggle" type="button" data-action="toggle-section" data-section-key="${escapeHtml(sectionKey)}" aria-expanded="${!collapsed}">${collapsed ? "展开" : "收起"}</button>` : ""}
        </div>
      </div>
      ${collapsed ? "" : `<div class="prompt-list">${visible.map(({ kind, entry }) => renderEntryCard(kind, entry)).join("")}</div>
      ${visible.length < items.length ? `<div class="empty-state compact-load-more"><p>已显示 ${visible.length} / ${items.length} 条</p><button class="primary-button" type="button" data-action="load-more">继续加载</button></div>` : ""}`}
    </section>
  `;
}

function renderCustomSection() {
  if (app.activeSuite !== "bangyan") return "";
  const state = app.states.bangyan;
  const items = bangyanCustomPrompts()
    .filter((entry) => entry.kind !== "direct")
    .filter((entry) => entry.categoryId === state.activeCategoryId)
    .filter((entry) => searchEntry("custom", entry))
    .map((entry) => ({ kind: "custom", entry }));
  return items.length ? renderList("自定义 Prompt", items) : "";
}

function renderSavedCompositionSection() {
  if (app.activeSuite !== "bangyan") return "";
  const state = app.states.bangyan;
  const items = sortEntries(savedCompositionEntries()
    .filter((entry) => entry.categoryId === state.activeCategoryId)
    .filter((entry) => searchEntry("composition", entry))
    .map((entry) => ({ kind: "composition", entry })));
  return items.length ? renderList("已收藏组合", items) : "";
}

function renderDirectPrompts() {
  const state = app.states.bangyan;
  const groups = new Map();
  bangyanDirectEntries()
    .filter(({ entry }) => (entry.category || entry.categoryId) === state.activeCategoryId)
    .filter(({ kind, entry }) => searchEntry(kind, entry))
    .forEach(({ kind, entry }) => {
      const group = kind === "custom" ? "我的直接 Prompt" : entry.subcategory || "直接 Prompt";
      if (!groups.has(group)) groups.set(group, []);
      groups.get(group).push({ kind, entry });
    });
  return [...groups.entries()].map(([title, items]) => renderList(title, items, {
    collapsible: true,
    sectionKey: `direct:${title}`
  })).join("");
}

function builderColorMode(builder) {
  return BANGYAN_COLOR_MODES.find((mode) => mode.id === builder.colorMode) || null;
}

function builderUniformColor(builder) {
  return BANGYAN_UNIFORM_COLORS.find((color) => color.id === builder.colorStyle) || null;
}

function builderMatchingPalette(builder) {
  return BANGYAN_MATCHING_PALETTES.find((palette) => palette.id === builder.colorStyle) || null;
}

function builderCustomColorNames(builder) {
  return [builder.colorPrimary, builder.colorSecondary, builder.colorAccent]
    .map((id) => BANGYAN_UNIFORM_COLORS.find((color) => color.id === id)?.name)
    .filter(Boolean);
}

function builderColorLabel(builder) {
  if (builder.colorMode === "uniform") return builderUniformColor(builder)?.label || "";
  if (builder.colorMode !== "matching") return "";
  const palette = builderMatchingPalette(builder);
  if (palette) return palette.label;
  if (builder.colorStyle === "custom") {
    const names = builderCustomColorNames(builder);
    return names.length ? `自由搭配 · ${names.join(" + ")}` : "自由搭配";
  }
  return "";
}

function builderColorInstruction(builder) {
  const mode = builderColorMode(builder);
  if (!mode) return "";
  if (mode.id === "uniform") {
    const color = builderUniformColor(builder);
    return color ? `服装整体采用${color.name}单一主色，呈现${color.tone}的服装气质。` : "";
  }
  const palette = builderMatchingPalette(builder);
  if (palette) return `服装采用${palette.colors.join("、")}的搭配色，${palette.tone}，颜色层次自然协调。`;
  const names = builderCustomColorNames(builder);
  if (builder.colorStyle === "custom" && names.length >= 2) {
    return `服装采用${names.join("、")}的自定义搭配色，以${names[0]}为主色、${names[1]}为辅色${names[2] ? `、${names[2]}作为点缀色` : ""}，整体色彩层次自然协调。`;
  }
  return "";
}

function composeBuilderResult(builder) {
  const result = composeBangyanSelection({
    components: bangyanComponentsForDisplay(),
    selection: builder,
    compositionRules: app.defaults.bangyan?.compositionRules
  });
  const colorInstruction = builderColorInstruction(builder);
  const colorLabel = builderColorLabel(builder);
  if (!result.positive || !colorInstruction) return result;
  return {
    ...result,
    title: `${result.title} · ${colorLabel}`,
    positive: `${result.positive}${colorInstruction}`
  };
}

function renderBuilderCustomColors(builder) {
  const fields = [
    { key: "colorPrimary", label: "主色", placeholder: "选择主色" },
    { key: "colorSecondary", label: "辅色", placeholder: "选择辅色" },
    { key: "colorAccent", label: "点缀色", placeholder: "可选点缀色" }
  ];
  return `
    <div class="builder-custom-color-grid">
      ${fields.map(({ key, label, placeholder }) => `
        <label class="builder-color-style-field">
          <span>${label}</span>
          <select class="builder-select" data-action="change-builder-custom-color" data-color-key="${key}" aria-label="${label}">
            <option value="">${placeholder}</option>
            ${BANGYAN_UNIFORM_COLORS.map((color) => `<option value="${color.id}" ${builder[key] === color.id ? "selected" : ""}>${escapeHtml(color.label)}</option>`).join("")}
          </select>
        </label>
      `).join("")}
    </div>
    <p class="builder-color-note">自由搭配至少选择主色和辅色，点缀色可选。</p>
  `;
}

function renderBuilderColorPicker(categoryId, builder) {
  if (categoryId !== "姿势穿搭场景") return "";
  const mode = builderColorMode(builder);
  const choices = mode?.id === "uniform" ? BANGYAN_UNIFORM_COLORS : mode?.id === "matching" ? BANGYAN_MATCHING_PALETTES : [];
  const isCustomMatching = mode?.id === "matching" && builder.colorStyle === "custom";
  return `
    <section class="builder-color-picker" aria-label="服装颜色选择">
      <div class="builder-picker-heading">
        <strong>服装颜色</strong>
        <p>先选择统一方式，再选择一种常用色彩风格；只作用于穿搭和领口，不新增组件。</p>
      </div>
      <div class="builder-color-mode" role="group" aria-label="颜色统一方式">
        ${BANGYAN_COLOR_MODES.map((item) => `
          <button class="color-mode-button ${item.id === builder.colorMode ? "is-active" : ""}" type="button" data-action="change-builder-color-mode" data-color-mode="${item.id}" aria-pressed="${item.id === builder.colorMode}">
            ${escapeHtml(item.label)}
          </button>
          `).join("")}
      </div>
      <label class="builder-color-style-field">
        <span>${mode?.id === "uniform" ? "统一色" : "搭配方案"}</span>
        <select class="builder-select" data-action="change-builder-color-style" aria-label="选择颜色方案" ${mode ? "" : "disabled"}>
          <option value="">${mode ? (mode.id === "uniform" ? "选择一种颜色" : "选择一组搭配色") : "先选择颜色模式"}</option>
          ${choices.map((choice) => `<option value="${choice.id}" ${choice.id === builder.colorStyle ? "selected" : ""}>${escapeHtml(choice.label)}</option>`).join("")}
          ${mode?.id === "matching" ? `<option value="custom" ${isCustomMatching ? "selected" : ""}>自由搭配 · 自选颜色组合</option>` : ""}
        </select>
      </label>
      ${isCustomMatching ? renderBuilderCustomColors(builder) : ""}
    </section>
  `;
}

function renderBuilderPicker(categoryId, components, builder) {
  const groups = BUILDER_SLOT_GROUPS[categoryId] || [];
  if (!groups.length) return `<p class="builder-picker-note">当前分类暂未提供可拼装的组件 slot。</p>`;

  const renderOptions = (slot) => {
    const selectedId = slot === "original" ? "" : builder[slot] || "";
    const options = components
      .filter((component) => component.category === categoryId && componentSlot(component) === slot)
      .filter((component) => searchEntry("component", component) || component.id === selectedId);
    if (slot !== "pose") {
      options.sort((left, right) => String(left.title).localeCompare(String(right.title), "zh-CN"));
    }
    const placeholder = slot === "original" ? "选择后加入原图组件" : "不选择";
    return [
      `<option value="">${placeholder}</option>`,
      ...options.map((component) => `<option value="${escapeHtml(component.id)}" ${component.id === selectedId ? "selected" : ""}>${escapeHtml(component.title)}</option>`)
    ].join("");
  };

  return `
    <section class="builder-picker" aria-label="自由拼装选择区">
      <div class="builder-picker-heading"><div><strong>选择组件</strong><p>按 slot 选择；搜索只筛选可选项，不改变已保存的拼装逻辑。</p></div></div>
      <div class="builder-slot-grid">
        ${groups.map(({ slot, label }) => `
          <label class="builder-field">
            <span>${escapeHtml(label)}</span>
            <select class="builder-select" data-action="change-builder-slot" data-slot="${escapeHtml(slot)}" aria-label="选择${escapeHtml(label)}">
              ${renderOptions(slot)}
            </select>
          </label>
        `).join("")}
      </div>
      ${renderBuilderColorPicker(categoryId, builder)}
    </section>
  `;
}

function renderBuilder() {
  const state = app.states.bangyan;
  const builder = normalizeBuilder(state.builder);
  const components = bangyanComponentsForDisplay();
  const byId = new Map(components.map((component) => [component.id, component]));
  const selectedIds = [
    ...builder.original,
    ...BANGYAN_SYNTHESIS_ORDER.filter((slot) => slot !== "original").map((slot) => builder[slot]).filter(Boolean)
  ];
  const selected = [...new Set(selectedIds)]
    .map((id) => byId.get(id))
    .filter((component) => component && !isDisplayOnlyComponent(component));
  const result = composeBuilderResult(builder);
  const chips = selected.length
    ? selected.map((component) => `<button class="builder-chip" type="button" data-action="remove-builder" data-id="${escapeHtml(component.id)}">${escapeHtml(component.title)} ×</button>`).join("")
    : `<span class="builder-empty">还没有选择组件。可以自由搭配，不设主观禁配。</span>`;
  return `
    <section class="builder-panel">
      <div class="builder-heading"><div><p class="eyebrow">自由组合</p><h3>${escapeHtml(result.title)}</h3></div><button class="quiet-button" type="button" data-action="reset-builder">重置</button></div>
      <div class="builder-chips">${chips}</div>
      <div class="builder-result">
        <div class="prompt-block"><strong>正向 Prompt</strong><p>${escapeHtml(result.positive || "选择组件后生成稳定组合文本。")}</p></div>
        ${result.negative ? `<div class="prompt-block is-negative"><strong>反向提示词</strong><p>${escapeHtml(result.negative)}</p></div>` : ""}
        <div class="dialog-actions builder-actions">
         <button class="quiet-button" type="button" data-action="copy-builder" data-copy-type="positive" ${result.positive ? "" : "disabled"}>复制正向</button>
         <button class="quiet-button" type="button" data-action="copy-builder" data-copy-type="negative" ${result.negative ? "" : "disabled"}>复制反向</button>
          <button class="quiet-button" type="button" data-action="save-builder-composition" ${result.positive ? "" : "disabled"}>收藏组合</button>
         <button class="primary-button" type="button" data-action="copy-builder" data-copy-type="all" ${result.positive ? "" : "disabled"}>复制全部</button>
        </div>
      </div>
    </section>
    ${renderBuilderPicker(state.activeCategoryId, components, builder)}
  `;
}

function renderContent() {
  const state = currentState();
  let content = "";
  if (app.activeSuite === "zhuangyuan") {
    const items = sortEntries(zhuangyuanEntries()
      .filter((entry) => effectiveEntry("prompt", entry).categoryId === state.activeCategoryId)
      .filter((entry) => searchEntry("prompt", entry))
      .map((entry) => ({ kind: "prompt", entry })));
    content = items.length ? renderList("Prompt 列表", items) : `<div class="empty-state"><h3>没有匹配的 Prompt</h3><p>换一个关键词，或清空搜索条件。</p></div>`;
  } else if (state.activeMode === "builder") {
    content = renderBuilder();
  } else if (state.activeMode === "presets") {
    const items = bangyanPresets()
      .filter((entry) => entry.category === state.activeCategoryId)
      .filter((entry) => searchEntry("preset", entry))
      .map((entry) => ({ kind: "preset", entry }));
    content = items.length ? renderList("推荐组合", items) : `<div class="empty-state"><h3>当前分类没有推荐组合</h3><p>可以切换到“单项库”或“自由拼装”。</p></div>`;
  } else if (state.activeMode === "direct") {
    content = renderDirectPrompts() || `<div class="empty-state"><h3>没有匹配的直接 Prompt</h3><p>换一个关键词，或清空搜索条件。</p></div>`;
  } else {
    const items = bangyanComponents()
      .filter((entry) => entry.category === state.activeCategoryId)
      .filter((entry) => app.subcategoryFilter === "全部" || entry.subcategory === app.subcategoryFilter)
      .filter((entry) => searchEntry("component", entry))
      .map((entry) => ({ kind: "component", entry }));
    content = items.length ? renderList("单项组件", items) : `<div class="empty-state"><h3>没有匹配的组件</h3><p>换一个关键词，或清空搜索条件。</p></div>`;
  }
  $("#prompt-sections").innerHTML = content + renderCustomSection() + renderSavedCompositionSection();
}

function renderRecent() {
  const panel = $("#recent-panel");
  const list = $("#recent-list");
  const recent = (currentState()?.recent || []).slice(0, 20);
  panel.hidden = !recent.length;
  list.innerHTML = recent.map((entry) => `
    <button class="recent-item" type="button" data-action="copy-recent" data-id="${escapeHtml(entry.id)}">
      <span><strong>${escapeHtml(entry.title)}</strong><small>${escapeHtml(new Date(entry.copiedAt).toLocaleString("zh-CN"))}</small></span><b>复制</b>
    </button>
  `).join("");
}

function render() {
  renderSuiteTabs();
  renderCategoryTabs();
  renderModeTabs();
  renderAddPromptButton();
  renderSubcategoryTabs();
  renderHeading();
  renderContent();
  renderRecent();
  const search = $("#search-input");
  if (search && search.value !== app.searchQuery) search.value = app.searchQuery;
}

function fillCategoryOptions(selectedId) {
  $("#prompt-category").innerHTML = categoryList().map((category) => `
    <option value="${escapeHtml(category.id)}" ${category.id === selectedId ? "selected" : ""}>${escapeHtml(category.name)}</option>
  `).join("");
}

function promptKindForAdd() {
  if (app.activeSuite !== "bangyan") return "prompt";
  return currentState()?.activeMode === "direct" ? "direct" : "custom";
}

function openPromptDialog(entryId = "", kind = promptKindForAdd()) {
  const entry = entryId ? findEntry(kind, entryId) : null;
  const allowedKinds = new Set(["prompt", "custom", "component", "preset", "direct", "composition"]);
  if (entry && !allowedKinds.has(kind)) return;
  const view = entry ? effectiveEntry(kind, entry) : null;
  const display = entry ? displayFor(kind, entry) : { title: "", positive: "", negative: "" };
  const staticEdit = Boolean(entry && isStaticEditable(kind, entry.id));
  const customDirect = kind === "direct" ? !staticEdit : kind === "custom" && entry?.kind === "direct";
  const categoryEditable = kind === "prompt" || kind === "custom" || customDirect;
  const compositionEdit = kind === "composition";
  const kindLabel = kind === "component" ? "单项组件" : kind === "preset" ? "推荐组合" : (kind === "direct" || customDirect) ? "直接 Prompt" : compositionEdit ? "已收藏组合" : "Prompt";
  $("#prompt-dialog-title").textContent = entry ? "编辑" + kindLabel : customDirect ? "新增直接 Prompt" : "新增 Prompt";
  $("#prompt-suite-hint").textContent = staticEdit
    ? "编辑覆盖版本 · 正式数据仍保留，不会改动 JSON"
    : compositionEdit
      ? "已收藏组合 · 独立快照，不会改动正式组件或推荐组合"
      : customDirect
        ? "榜眼自定义直接 Prompt · 与正式直接 Prompt 和状元数据隔离"
      : app.activeSuite === "bangyan" ? "榜眼自定义内容 · 与正式组件和状元数据隔离" : "状元自定义内容 · 保留旧站数据结构";
  $("#prompt-id").value = entry?.id || "";
  $("#prompt-kind").value = kind;
  $("#prompt-title").value = view?.title || display.title || "";
  $("#prompt-positive").value = categoryEditable ? view?.prompt || "" : display.positive || "";
  $("#prompt-negative").value = categoryEditable ? view?.negativePrompt || "" : display.negative || "";
  $("#prompt-positive-label").textContent = kind === "component" ? "正向组件 Prompt" : kind === "preset" ? "组合正向 Prompt" : "完整 Prompt";
  $("#prompt-pinned").checked = Boolean(view?.pinned);
  fillCategoryOptions(view?.categoryId || currentState().activeCategoryId);
  $("#prompt-category").hidden = !categoryEditable;
  $("#prompt-category").previousElementSibling.hidden = !categoryEditable;
  $("#prompt-pinned").closest(".pin-checkbox").hidden = !categoryEditable;
  $("#prompt-reset-edit").hidden = !(staticEdit && hasPromptEdit(kind, entry.id));
  $("#prompt-reset-edit").dataset.kind = kind;
  $("#prompt-reset-edit").dataset.id = entry?.id || "";
  $("#prompt-save-button").textContent = entry ? "保存修改" : "保存 Prompt";
  $("#prompt-dialog").showModal();
  window.setTimeout(() => $("#prompt-title").focus(), 0);
}

async function savePrompt() {
  const state = currentState();
  const id = $("#prompt-id").value;
  const kind = $("#prompt-kind").value || (app.activeSuite === "bangyan" ? "custom" : "prompt");
  const title = $("#prompt-title").value.trim();
  const categoryId = $("#prompt-category").value;
  const positive = $("#prompt-positive").value.trim();
  const negative = $("#prompt-negative").value.trim();
  const pinned = $("#prompt-pinned").checked;
  const customDirect = (kind === "direct" && !isStaticEditable(kind, id))
    || (kind === "custom" && state.customPrompts.some((entry) => entry.id === id && entry.kind === "direct"));
  const categoryEditable = kind === "prompt" || kind === "custom" || customDirect;
  if (!title || !positive || (categoryEditable && !categoryId)) return;
  const now = nowIso();
  if (kind === "composition") {
    const existing = state.savedCompositions.find((entry) => entry.id === id && !entry.deletedAt);
    if (!existing) return;
    Object.assign(existing, { title, positive, negative, updatedAt: now });
  } else if (isStaticEditable(kind, id)) {
    const existing = state.promptEdits.find((entry) => entry.kind === kind && entry.id === id);
    const next = { id, kind, title, positive, negative, createdAt: existing?.createdAt || now, updatedAt: now };
    if (kind === "prompt") next.categoryId = categoryId;
    if (existing) {
      Object.assign(existing, next);
      delete existing.deletedAt;
    } else {
      state.promptEdits.push(next);
    }
  } else if ((kind === "custom" || customDirect) && app.activeSuite === "bangyan") {
    const existing = state.customPrompts.find((entry) => entry.id === id);
    const storedKind = existing?.kind === "direct" || kind === "direct" ? "direct" : "custom";
    if (existing) {
      Object.assign(existing, { kind: storedKind, title, categoryId, prompt: positive, negativePrompt: negative, pinned, updatedAt: now });
    } else {
      state.customPrompts.push({ id: makeId(storedKind === "direct" ? "bangyan-direct-custom" : "bangyan-custom"), kind: storedKind, title, categoryId, prompt: positive, negativePrompt: negative, pinned, pinOrder: pinned ? Date.now() : 0, createdAt: now, updatedAt: now });
    }
  } else if (kind === "prompt" && app.activeSuite === "zhuangyuan") {
    const existing = state.prompts.find((entry) => entry.id === id);
    if (existing) {
      Object.assign(existing, { title, categoryId, prompt: positive, negativePrompt: negative, pinned, pinOrder: pinned ? existing.pinOrder || Date.now() : 0, updatedAt: now });
    } else {
      state.prompts.push({ id: makeId("zhuangyuan-custom"), title, categoryId, prompt: positive, negativePrompt: negative, pinned, pinOrder: pinned ? Date.now() : 0, createdAt: now, updatedAt: now });
    }
    syncZhuangyuanCustomPrompts();
  } else {
    return;
  }
  if (categoryEditable) state.activeCategoryId = categoryId;
  $("#prompt-dialog").close();
  await persist();
  render();
  showToast(id ? "内容已更新" : "Prompt 已保存");
}

async function resetStaticEdit(kind, id) {
  if (!isStaticEditable(kind, id) || !hasPromptEdit(kind, id)) return;
  const entry = findEntry(kind, id);
  if (!entry || !window.confirm("恢复「" + entry.title + "」的正式内容吗？本地编辑版本会被移除。")) return;
  const edit = currentState().promptEdits.find((item) => item.kind === kind && item.id === id && !item.deletedAt);
  if (!edit) return;
  edit.deletedAt = nowIso();
  edit.updatedAt = edit.deletedAt;
  $("#prompt-dialog")?.close();
  $("#detail-dialog")?.close();
  await persist();
  render();
  showToast("已恢复正式内容");
}

async function saveBuilderComposition() {
  const state = app.states.bangyan;
  const builder = normalizeBuilder(state.builder);
  const result = composeBuilderResult(builder);
  if (!result.positive) return showToast("请先选择组件");
  const now = nowIso();
  const saved = normalizeSavedComposition({
    id: makeId("bangyan-composition"),
    title: result.title || "自由拼装组合",
    categoryId: state.activeCategoryId,
    positive: result.positive,
    negative: result.negative,
    builder,
    componentIds: result.componentIds,
    createdAt: now,
    updatedAt: now
  });
  if (!saved) return;
  state.savedCompositions.unshift(saved);
  await persist();
  render();
  showToast("组合已收藏");
}

async function deleteSavedComposition(id) {
  const entry = findEntry("composition", id);
  if (!entry || !window.confirm("取消收藏「" + entry.title + "」吗？")) return;
  const stored = currentState().savedCompositions.find((item) => item.id === id && !item.deletedAt);
  if (!stored) return;
  stored.deletedAt = nowIso();
  stored.updatedAt = stored.deletedAt;
  $("#detail-dialog")?.close();
  await persist();
  render();
  showToast("已取消收藏");
}

async function togglePinned(kind, id) {
  const entry = findEntry(kind, id);
  if (!entry || (kind !== "prompt" && kind !== "custom")) return;
  entry.pinned = !entry.pinned;
  entry.pinOrder = entry.pinned ? Date.now() : 0;
  entry.updatedAt = nowIso();
  if (app.activeSuite === "zhuangyuan") syncZhuangyuanCustomPrompts();
  await persist();
  render();
}

async function toggleFavorite(kind, id) {
  const state = currentState();
  const key = favoriteKey(kind, id);
  state.favoriteIds = state.favoriteIds.includes(key) ? state.favoriteIds.filter((value) => value !== key) : [...state.favoriteIds, key];
  await persist();
  render();
}

async function deletePrompt(kind, id) {
  const entry = findEntry(kind, id);
  if (!entry || (kind !== "prompt" && kind !== "custom") || !window.confirm(`确定删除「${entry.title}」吗？`)) return;
  entry.deletedAt = nowIso();
  entry.updatedAt = entry.deletedAt;
  if (app.activeSuite === "zhuangyuan") syncZhuangyuanCustomPrompts();
  await persist();
  render();
  showToast("Prompt 已删除");
}

function openDetail(kind, id) {
  const entry = findEntry(kind, id);
  if (!entry) return;
  const display = displayFor(kind, entry);
  const entryId = escapeHtml(entry.id);
  const edited = hasPromptEdit(kind, entry.id);
  const editable = ["prompt", "custom", "component", "preset", "direct", "composition"].includes(kind);
  const displayOnly = kind === "component" && isDisplayOnlyComponent(entry);
  const builderTarget = app.activeSuite === "bangyan"
    && ["component", "preset", "composition"].includes(kind)
    && !displayOnly;
  app.detail = { kind, id };
  $("#detail-eyebrow").textContent = `${categoryNameFor(kind, entry)} · ${subcategoryFor(kind, entry)}`;
  $("#detail-title").textContent = display.title;
  $("#detail-meta").textContent = displayOnly
    ? "仅供辨认 · 不参与自由拼装、组合正文或复制"
    : kind === "preset"
    ? (edited ? "已编辑推荐组合 · 正式 preset 仍保留" : "推荐组合 · 可直接复制，也可放入自由拼装区继续修改")
    : kind === "component"
      ? (edited ? "已编辑单项组件 · 正式组件仍保留" : (entry.keywords?.join(" · ") || "单项组件"))
      : kind === "direct"
        ? (edited ? "已编辑直接 Prompt · 正式内容仍保留" : "完整 Prompt · 可直接复制，不参与自由拼装")
      : kind === "composition"
        ? "已收藏组合 · 可独立编辑，不会修改正式组件或推荐组合"
        : kind === "custom" && entry.kind === "direct"
          ? "自定义直接 Prompt · 可直接复制，不参与自由拼装"
        : edited ? "已编辑版本 · 正式数据仍保留" : "可编辑的自定义内容";
  $("#detail-positive").textContent = display.positive;
  $("#detail-negative").textContent = display.negative;
  $("#detail-negative-block").hidden = !display.negative;
  $("#detail-actions").innerHTML = `
    ${displayOnly ? `<span class="detail-note">仅供辨认，不复制到 Prompt 正文</span>` : `<button class="quiet-button" type="button" data-action="detail-copy" data-copy-type="positive">复制正向</button>
    <button class="quiet-button" type="button" data-action="detail-copy" data-copy-type="negative" ${display.negative ? "" : "disabled"}>复制反向</button>
    <button class="primary-button" type="button" data-action="detail-copy" data-copy-type="all">复制全部</button>`}
    ${editable ? `<button class="quiet-button" type="button" data-action="edit-prompt" data-kind="${kind}" data-id="${entryId}">编辑</button>` : ""}
    ${edited ? `<button class="quiet-button" type="button" data-action="reset-edit" data-kind="${kind}" data-id="${entryId}">恢复正式内容</button>` : ""}
    ${builderTarget ? `<button class="quiet-button" type="button" data-action="detail-add-builder" data-kind="${kind}" data-id="${entryId}">${kind === "composition" || kind === "preset" ? "继续调整" : "放入拼装区"}</button>` : ""}
    ${kind === "composition" ? `<button class="quiet-button is-danger" type="button" data-action="delete-composition" data-kind="${kind}" data-id="${entryId}">取消收藏</button>` : ""}
 `;
  $("#detail-dialog").showModal();
}

async function addToBuilder(kind, id) {
  const entry = findEntry(kind, id);
  if (!entry || app.activeSuite !== "bangyan") return;
  if (kind === "component" && isDisplayOnlyComponent(entry)) {
    showToast("该项仅供辨认，不会加入自由拼装");
    return;
  }
  if (kind === "component") {
    app.states.bangyan.builder = selectBuilderComponent(app.states.bangyan.builder, entry);
  } else if (kind === "preset") {
    let builder = emptyBuilder();
    for (const componentId of Object.values(entry.slots || {}).filter(Boolean)) {
      const component = bangyanComponents().find((item) => item.id === componentId);
      if (component) builder = selectBuilderComponent(builder, component);
    }
    app.states.bangyan.builder = builder;
  } else if (kind === "composition") {
    app.states.bangyan.builder = normalizeBuilder(entry.builder);
  }
  markBuilderUpdated();
  if (kind === "composition" && entry.categoryId) app.states.bangyan.activeCategoryId = entry.categoryId;
  app.states.bangyan.activeMode = "builder";
  await persist();
  $("#detail-dialog")?.close();
  render();
  showToast("已放入自由拼装区");
}

async function removeFromBuilder(id) {
  const component = bangyanComponents().find((entry) => entry.id === id);
  if (!component) return;
  app.states.bangyan.builder = removeBuilderComponent(app.states.bangyan.builder, component);
  markBuilderUpdated();
  await persist();
  render();
}

async function resetBuilder() {
  app.states.bangyan.builder = emptyBuilder();
  markBuilderUpdated();
  await persist();
  render();
}

async function copyBuilder(copyType) {
  const result = composeBuilderResult(normalizeBuilder(app.states.bangyan.builder));
  const content = copyType === "positive" ? result.positive : copyType === "negative" ? result.negative : result.negative ? `${result.positive}\n\n反向提示词：${result.negative}` : result.positive;
  if (!content) return showToast("请先选择组件");
  await copyText(content);
  recordRecent("builder", result.componentIds.join(","), result.title, content);
  await persist();
  renderRecent();
  showToast("组合 Prompt 已复制");
}

function renderSyncStatus(message = "") {
  const status = $("#sync-status");
  if (!status) return;
  if (message) status.textContent = message;
  else if (app.syncBusy) status.textContent = "正在安全合并状元与榜眼数据……";
  else if (app.meta.lastSyncedAt) status.textContent = `已启用同步 · 上次更新 ${new Date(app.meta.lastSyncedAt).toLocaleString("zh-CN")}`;
  else if (isValidSyncCode(app.meta.syncCode)) status.textContent = "同步码已保存，可以在另一台设备继续使用。";
  else status.textContent = "尚未设置同步码。";
}

function markBuilderUpdated() {
  if (app.states.bangyan) app.states.bangyan.builderUpdatedAt = nowIso();
}

function openSyncDialog() {
  $("#sync-code").value = formatSyncCode(app.meta.syncCode);
  renderSyncStatus();
  $("#sync-dialog").showModal();
}

function suiteSyncState(suite) {
  const state = app.states[suite];
  if (suite === "zhuangyuan") {
    return {
      prompts: state.prompts,
      customPrompts: state.customPrompts,
      promptEdits: state.promptEdits,
      savedCompositions: state.savedCompositions,
      favoriteIds: state.favoriteIds,
      recent: state.recent
    };
  }
  return {
    customPrompts: state.customPrompts,
    promptEdits: state.promptEdits,
    savedCompositions: state.savedCompositions,
    favoriteIds: state.favoriteIds,
    recent: state.recent,
    builder: state.builder,
    builderUpdatedAt: state.builderUpdatedAt
  };
}

async function syncNow() {
  const code = normalizeSyncCode($("#sync-code").value || app.meta.syncCode);
  if (!isValidSyncCode(code)) return renderSyncStatus("请先生成或填写正确的 32 位同步码。");
  app.meta.syncCode = code;
  app.syncBusy = true;
  renderSyncStatus();
  try {
    const result = await syncSuites({
      code,
      zhuangyuan: suiteSyncState("zhuangyuan"),
      bangyan: suiteSyncState("bangyan"),
      meta: { migrationVersion: app.meta.migrationVersion }
    });
    const remoteZhuangyuan = result.suites.zhuangyuan;
    const remoteBangyan = result.suites.bangyan;
    if (remoteZhuangyuan) {
      app.states.zhuangyuan.prompts = remoteZhuangyuan.prompts || app.states.zhuangyuan.prompts;
      app.states.zhuangyuan.customPrompts = app.states.zhuangyuan.prompts.filter((entry) => !app.defaults.zhuangyuan.prompts.some((defaultEntry) => defaultEntry.id === entry.id));
      app.states.zhuangyuan.promptEdits = normalizePromptEdits(remoteZhuangyuan.promptEdits).filter((entry) => entry.kind === "prompt");
      app.states.zhuangyuan.savedCompositions = normalizeSavedCompositions(remoteZhuangyuan.savedCompositions);
      app.states.zhuangyuan.favoriteIds = normalizeFavoriteIds(remoteZhuangyuan.favoriteIds);
      app.states.zhuangyuan.recent = normalizeRecent(remoteZhuangyuan.recent);
    }
    if (remoteBangyan) {
      app.states.bangyan.customPrompts = (remoteBangyan.customPrompts || []).map((entry) => normalizeCustomPrompt(entry, "bangyan")).filter(Boolean);
      app.states.bangyan.promptEdits = normalizePromptEdits(remoteBangyan.promptEdits).filter((entry) => entry.kind === "component" || entry.kind === "preset" || entry.kind === "direct");
      app.states.bangyan.savedCompositions = normalizeSavedCompositions(remoteBangyan.savedCompositions);
      app.states.bangyan.favoriteIds = normalizeFavoriteIds(remoteBangyan.favoriteIds);
      app.states.bangyan.recent = normalizeRecent(remoteBangyan.recent);
      if (remoteBangyan.builder && typeof remoteBangyan.builder === "object") {
        app.states.bangyan.builder = normalizeBuilder(remoteBangyan.builder);
      }
      if (typeof remoteBangyan.builderUpdatedAt === "string") {
        app.states.bangyan.builderUpdatedAt = remoteBangyan.builderUpdatedAt;
      }
    }
    app.meta.lastSyncedAt = result.syncedAt;
    await persist();
    render();
    showToast("状元与榜眼数据已同步");
  } catch (error) {
    renderSyncStatus(error.message || "同步失败，请稍后重试");
  } finally {
    app.syncBusy = false;
    renderSyncStatus();
  }
}

async function registerServiceWorker() {
  if (!("serviceWorker" in navigator)) return;
  try {
    const hadController = Boolean(navigator.serviceWorker.controller);
    let reloadingForUpdate = false;
    navigator.serviceWorker.addEventListener("controllerchange", () => {
      if (!hadController || reloadingForUpdate) return;
      reloadingForUpdate = true;
      window.location.reload();
    });
    const registration = await navigator.serviceWorker.register(`service-worker.js?v=${APP_ASSET_VERSION}`, { updateViaCache: "none" });
    await registration.update();
  } catch {
    // Service Worker 更新失败不影响在线使用与本地数据。
  }
}

async function initialize() {
  const [zhuangyuanResponse, bangyanResponse, storage] = await Promise.all([
    fetch(`data/img2img-prompts.json?v=${APP_ASSET_VERSION}`, { cache: "no-store" }),
    fetch(`data/bangyan-data.json?v=${APP_ASSET_VERSION}`, { cache: "no-store" }),
    readStorageBundle()
  ]);
  if (!zhuangyuanResponse.ok || !bangyanResponse.ok) throw new Error("正式数据加载失败");
  const [zhuangyuanData, bangyanData] = await Promise.all([zhuangyuanResponse.json(), bangyanResponse.json()]);
  const migratedLegacy = !storage.zhuangyuan && migrateLegacyPrototypeState(storage.legacy || storage.legacyFallback);
  app.defaults.zhuangyuan = zhuangyuanData;
  app.defaults.bangyan = bangyanData;
  app.states.zhuangyuan = normalizeZhuangyuanState(zhuangyuanData, storage.zhuangyuan || migratedLegacy);
  app.states.bangyan = normalizeBangyanState(storage.bangyan);
  app.meta = normalizeMeta(storage.meta);
  if (!app.meta.syncCode) app.meta.syncCode = migratedLegacy?.syncCode || app.states.zhuangyuan.syncCode || "";
  if (!app.meta.lastSyncedAt) app.meta.lastSyncedAt = migratedLegacy?.lastSyncedAt || app.states.zhuangyuan.lastSyncedAt || "";
  app.activeSuite = app.meta.activeSuite;
  app.storageMode = storage.storage;
  await persist();
  applyTheme(app.theme);
  render();
  registerServiceWorker();
}

document.addEventListener("click", async (event) => {
  const target = event.target.closest("[data-action], [data-suite-tab]");
  if (!target) return;
  const action = target.dataset.action;
  if (target.dataset.suiteTab) {
    const suite = target.dataset.suiteTab;
    if (suite === "zhuangyuan" || suite === "bangyan") {
      app.activeSuite = suite;
      app.meta.activeSuite = suite;
      app.subcategoryFilter = "全部";
      app.searchQuery = "";
      app.visibleLimit = PAGE_SIZE;
      await persist();
      render();
    }
    return;
  }
  const id = target.dataset.id;
  const kind = target.dataset.kind;
  if (action === "change-category") {
    currentState().activeCategoryId = id;
    app.subcategoryFilter = "全部";
    app.visibleLimit = PAGE_SIZE;
    await persist();
    render();
  } else if (action === "change-mode") {
    if (BANGYAN_MODES.some((mode) => mode.id === target.dataset.mode)) {
      app.states.bangyan.activeMode = target.dataset.mode;
      app.subcategoryFilter = "全部";
      app.visibleLimit = PAGE_SIZE;
      await persist();
      render();
    }
  } else if (action === "change-subcategory") {
    app.subcategoryFilter = target.dataset.subcategory || "全部";
    app.visibleLimit = PAGE_SIZE;
    render();
  } else if (action === "change-builder-color-mode") {
    if (BANGYAN_COLOR_MODES.some((mode) => mode.id === target.dataset.colorMode)) {
      const builder = normalizeBuilder(app.states.bangyan.builder);
      builder.colorMode = target.dataset.colorMode;
      app.states.bangyan.builder = builder;
      markBuilderUpdated();
      await persist();
      render();
    }
  } else if (action === "add-prompt") {
    openPromptDialog();
  } else if (action === "edit-prompt") {
    openPromptDialog(id, kind);
  } else if (action === "delete-prompt") {
    await deletePrompt(kind, id);
  } else if (action === "toggle-pin") {
    await togglePinned(kind, id);
  } else if (action === "toggle-favorite") {
    await toggleFavorite(kind, id);
  } else if (action === "open-detail") {
    openDetail(kind, id);
  } else if (action === "copy-entry") {
    await copyEntry(kind, id, target.dataset.copyType || "all");
  } else if (action === "copy-recent") {
    const record = currentState().recent.find((entry) => entry.id === id);
    if (record) {
      await copyText(record.content);
      recordRecent(record.kind, record.id, record.title, record.content, record.id);
      await persist();
      renderRecent();
      showToast("最近 Prompt 已复制");
    }
  } else if (action === "clear-recent") {
    currentState().recent = [];
    await persist();
    renderRecent();
  } else if (action === "load-more") {
    app.visibleLimit += PAGE_SIZE;
    renderContent();
  } else if (action === "toggle-section") {
    const sectionKey = target.dataset.sectionKey || "";
    if (!sectionKey) return;
    if (app.collapsedSections.has(sectionKey)) app.collapsedSections.delete(sectionKey);
    else app.collapsedSections.add(sectionKey);
    renderContent();
  } else if (action === "remove-builder") {
    await removeFromBuilder(id);
  } else if (action === "reset-builder") {
    await resetBuilder();
  } else if (action === "copy-builder") {
    await copyBuilder(target.dataset.copyType || "all");
  } else if (action === "save-builder-composition") {
    await saveBuilderComposition();
  } else if (action === "add-to-builder") {
    await addToBuilder(kind, id);
  } else if (action === "reset-edit") {
    await resetStaticEdit(kind, id);
  } else if (action === "delete-composition") {
    await deleteSavedComposition(id);
  } else if (action === "detail-copy") {
    if (app.detail) await copyEntry(app.detail.kind, app.detail.id, target.dataset.copyType || "all");
  } else if (action === "detail-add-builder") {
    if (app.detail) await addToBuilder(app.detail.kind, app.detail.id);
  } else if (action === "open-sync") {
    openSyncDialog();
  } else if (action === "generate-sync-code") {
    app.meta.syncCode = createSyncCode();
    $("#sync-code").value = formatSyncCode(app.meta.syncCode);
    app.meta.lastSyncedAt = "";
    await persist();
    renderSyncStatus();
    showToast("已生成同步码");
  } else if (action === "copy-sync-code") {
    const code = normalizeSyncCode($("#sync-code").value || app.meta.syncCode);
    if (!isValidSyncCode(code)) return renderSyncStatus("请先生成或填写正确的同步码。");
    await copyText(formatSyncCode(code));
    showToast("同步码已复制");
  } else if (action === "export-state") {
    exportUserState();
  } else if (action === "sync-now") {
    await syncNow();
  } else if (action === "open-theme") {
    applyTheme(app.theme);
    $("#theme-dialog").showModal();
  } else if (action === "set-theme") {
    applyTheme(target.dataset.theme, { save: true });
    $("#theme-dialog").close();
    showToast("配色主题已切换");
  } else if (action === "close-dialog") {
    target.closest("dialog")?.close();
  }
});

document.addEventListener("change", async (event) => {
  const colorTarget = event.target.closest('[data-action="change-builder-color-style"]');
  if (colorTarget) {
    if (app.activeSuite !== "bangyan" || app.states.bangyan.activeMode !== "builder") return;
    const builder = normalizeBuilder(app.states.bangyan.builder);
    const validChoice = builder.colorMode === "uniform"
      ? BANGYAN_UNIFORM_COLORS.some((color) => color.id === colorTarget.value)
      : builder.colorMode === "matching"
        ? colorTarget.value === "custom" || BANGYAN_MATCHING_PALETTES.some((palette) => palette.id === colorTarget.value)
        : false;
    builder.colorStyle = validChoice ? colorTarget.value : "";
    app.states.bangyan.builder = builder;
    markBuilderUpdated();
    await persist();
    render();
    return;
  }
  const customColorTarget = event.target.closest('[data-action="change-builder-custom-color"]');
  if (customColorTarget) {
    if (app.activeSuite !== "bangyan" || app.states.bangyan.activeMode !== "builder") return;
    const validKeys = new Set(["colorPrimary", "colorSecondary", "colorAccent"]);
    if (!validKeys.has(customColorTarget.dataset.colorKey)) return;
    const builder = normalizeBuilder(app.states.bangyan.builder);
    builder[customColorTarget.dataset.colorKey] = BANGYAN_UNIFORM_COLORS.some((color) => color.id === customColorTarget.value)
      ? customColorTarget.value
      : "";
    app.states.bangyan.builder = builder;
    markBuilderUpdated();
    await persist();
    render();
    return;
  }
  const target = event.target.closest('[data-action="change-builder-slot"]');
  if (!target || app.activeSuite !== "bangyan" || app.states.bangyan.activeMode !== "builder") return;
  if (!target.value) {
    if (target.dataset.slot === "original") return;
    const builder = normalizeBuilder(app.states.bangyan.builder);
    builder[target.dataset.slot] = "";
    app.states.bangyan.builder = builder;
    markBuilderUpdated();
    await persist();
    render();
    showToast("已清除该 slot");
    return;
  }
  const component = bangyanComponents().find((entry) => entry.id === target.value);
  if (!component) return;
  app.states.bangyan.builder = selectBuilderComponent(app.states.bangyan.builder, component);
  markBuilderUpdated();
  await persist();
  render();
  showToast(target.dataset.slot === "original" ? "已加入原图组件" : "已更新拼装组件");
});

$("#prompt-form").addEventListener("submit", (event) => {
  event.preventDefault();
  savePrompt().catch(() => showToast("保存失败，请重试"));
});

$("#sync-form").addEventListener("submit", async (event) => {
  event.preventDefault();
  const code = normalizeSyncCode($("#sync-code").value);
  if (!isValidSyncCode(code)) return renderSyncStatus("同步码应为 32 位字符，请检查后再保存。");
  app.meta.syncCode = code;
  await persist();
  renderSyncStatus();
  showToast("同步码已保存");
});

$("#search-input").addEventListener("input", () => {
  app.searchQuery = $("#search-input").value;
  app.visibleLimit = PAGE_SIZE;
  renderContent();
  renderHeading();
});

$("#clear-search").addEventListener("click", () => {
  app.searchQuery = "";
  $("#search-input").value = "";
  app.visibleLimit = PAGE_SIZE;
  render();
});

initialize().catch((error) => {
  console.error(error);
  $("#prompt-sections").innerHTML = '<div class="empty-state"><h3>正式数据暂时无法加载</h3><p>请通过本地 HTTP 服务或部署后的 HTTPS 地址打开此 PWA。</p></div>';
});
