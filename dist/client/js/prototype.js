import { contentType, contentLabel, belongsToWorkspace } from './browse-model.js?v=4.1.0';
import { familyFor, familyUnits } from './families.js?v=4.1.0';
import { classify, recordKey, CATEGORIES } from './catalog.js?v=4.1.0';
import {
  createSyncCode,
  formatSyncCode,
  isValidSyncCode,
  normalizeSyncCode,
  syncSuites
} from "./sync.js?v=4.1.0";
import { readStorageBundle, writeStorageBundle } from "./storage.js?v=4.1.0";
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
  mergeFavorites,
  mergeSyncedSuiteState,
  parseUserBackup,
  normalizeBuilder,
  normalizeCatalogFields,
  normalizeFavoriteIds,
  normalizePromptEdits,
  normalizeRecent,
  normalizeSavedComposition,
  normalizeSavedCompositions,
  searchMatches,
  selectBuilderComponent,
  removeBuilderComponent
} from "./suite-utils.js?v=4.1.0";

const APP_ASSET_VERSION = "4.1.0";
const PAGE_SIZE = 8;
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
  quickView: "browse",
  quickViewSuite: "zhuangyuan",
  searchAll: false,
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
    ...normalizeCatalogFields(entry),
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
    ...mergeFavorites({ favoriteIds, favoriteChanges: source.favoriteChanges }),
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
  const activeMode = BANGYAN_MODES.some((mode) => mode.id === source.activeMode) ? source.activeMode : "direct";
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
    ...mergeFavorites(source),
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
      ...normalizeCatalogFields(edit),
      title: edit.title,
      categoryId: edit.categoryId || entry.categoryId,
      prompt: edit.positive,
      negativePrompt: edit.negative,
      updatedAt: edit.updatedAt
    };
  }
  if (kind === "component" || kind === "direct") {
    return { ...entry, ...normalizeCatalogFields(edit), title: edit.title, positive: edit.positive, negative: edit.negative, updatedAt: edit.updatedAt };
  }
  if (kind === "preset") return { ...entry, ...normalizeCatalogFields(edit), title: edit.title, updatedAt: edit.updatedAt };
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
  if (kind === "preset" && !hasPromptEdit(kind, entry.id)) return "一键复制整套提示词，也可以继续调整其中的搭配。";
  if (kind === "component" || kind === "direct") return compactSummary(entry.composeText || entry.positive);
  return compactSummary(display.positive);
}

function isFavorite(kind, id) {
  if (kind === "composition") return currentState().favoriteChanges?.[favoriteKey(kind,id)]?.value ?? Boolean(findEntry(kind,id));
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

function confirmAction(message) {
  return new Promise(resolve=>{
    const dialog=document.createElement('dialog');
    dialog.className='sheet-dialog action-confirm';
    dialog.innerHTML=`<form method="dialog"><h2>确认操作</h2><p>${escapeHtml(message)}</p><div class="dialog-actions"><button value="cancel" class="quiet-button">取消</button><button value="confirm" class="primary-button">确认</button></div></form>`;
    dialog.addEventListener('close',()=>{const accepted=dialog.returnValue==='confirm';dialog.remove();resolve(accepted);},{once:true});
    document.body.append(dialog);dialog.showModal();
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
  return navigator.clipboard?.writeText(value).then(()=>true).catch(() => fallbackCopy(value)) || fallbackCopy(value);
}

function fallbackCopy(value) {
  const textarea = document.createElement("textarea");
  textarea.value = value;
  textarea.style.position = "fixed";
  textarea.style.opacity = "0";
  document.body.append(textarea);
  textarea.select();
  const copied=document.execCommand("copy");
  textarea.remove();
  if(!copied) {
    const dialog=document.createElement('dialog');dialog.className='sheet-dialog';
    dialog.innerHTML='<form method="dialog"><h2>请手动复制</h2><p>浏览器未允许自动复制，请选择下面的完整内容。</p><textarea class="field-control field-textarea" readonly aria-label="手动复制正文"></textarea><button class="quiet-button">关闭</button></form>';
    dialog.querySelector('textarea').value=value;document.body.append(dialog);dialog.addEventListener('close',()=>dialog.remove(),{once:true});dialog.showModal();dialog.querySelector('textarea').select();
  }
  return Promise.resolve(copied);
}

function recordRecent(kind, id, title, content, recentId = `${kind}:${id}`) {
  const state = currentState();
  state.recent = normalizeRecent([
    { id: recentId, kind, title, content, copiedAt: nowIso() },
    ...(state.recent || []).filter((entry) => entry.id !== recentId)
  ]);
}

async function persist() {
  if (!app.states.zhuangyuan || !app.states.bangyan) return false;
  try {
    app.storageMode = await writeStorageBundle({
      zhuangyuan: app.states.zhuangyuan,
      bangyan: app.states.bangyan,
      meta: app.meta
    });
    return true;
  } catch {
    showToast("本地保存失败，请稍后重试");
    return false;
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
  if(!await copyText(content))return;
  recordRecent(kind, id, display.title, content);
  if (!await persist()) return;
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
    const label = button.querySelector('small');
    if (label) label.textContent = button.dataset.suiteTab === 'zhuangyuan' ? `${app.defaults.zhuangyuan?.prompts?.length || 251} 条` : `${(app.defaults.bangyan?.components?.length || 235) + (app.defaults.bangyan?.presets?.length || 24) + (app.defaults.bangyan?.directPrompts?.length || 244)} 条`;
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
  $("#category-eyebrow").textContent = app.activeSuite === "bangyan" ? "榜眼" : "状元";
  $("#category-title").textContent = category?.name || "Prompt";
  $("#category-description").textContent = state.activeMode === "builder" ? "先选想改变的部分，再复制到图片对话中。未选择的部分保持原样。" : "";
  $("#category-count").textContent = `${count} 条`;
}

function renderEntryCard(kind, entry) {
  return renderStudioCard(kind, entry);
}

function renderLegacyEntryCard(kind, entry) {
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
    <article class="prompt-card ${pinned ? "is-pinned" : ""}" data-entry-kind="${kind}" data-entry-id="${id}" data-owner-suite="${app.activeSuite}">
      <div class="card-topline">
        <div class="card-title-block">
          <h3><button class="entry-title" type="button" data-action="open-detail" data-kind="${kind}" data-id="${id}">${escapeHtml(display.title)}</button></h3>
          <span>${escapeHtml(categoryName)} · ${escapeHtml(subcategory)}${pinned ? " · 已置顶" : ""}${favorite ? " · 已收藏" : ""}${edited ? " · 已编辑" : ""}</span>
        </div>
        <button class="favorite-button ${favorite ? "is-active" : ""}" type="button" data-action="${favoriteAction}" data-kind="${kind}" data-id="${id}" aria-label="${favorite ? "取消收藏" : "收藏"}">${favorite ? "★" : "☆"}</button>
      </div>
      <button class="card-preview preview-open" type="button" data-action="open-detail" data-kind="${kind}" data-id="${id}" aria-label="查看 ${escapeHtml(display.title)} 详情">${escapeHtml(entrySummary(kind, view, display))}</button>
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
    if(slot==='pose') {
      const label=c=>/自拍/.test(c.title)?'自拍':/地面|盘腿|盘坐|抱腿/.test(c.title)?'地面坐姿':/跪/.test(c.title)?'跪姿':/躺|卧|蜷/.test(c.title)?'躺卧':/蹲|低姿态/.test(c.title)?'蹲姿':/坐|沙发侧坐/.test(c.title)?'坐姿':/行走|迈步|上楼|转身|停步|动态|抓拍/.test(c.title)?'动态与抓拍':'站姿与倚靠';
      const groups=['坐姿','站姿与倚靠','自拍','地面坐姿','跪姿','躺卧','蹲姿','动态与抓拍'];
      return `<option value="">${placeholder}</option>`+groups.map(group=>{
        const entries=options.filter(c=>label(c)===group);
        return entries.length?`<optgroup label="${group}">${entries.map(c=>`<option value="${escapeHtml(c.id)}" ${c.id===selectedId?'selected':''}>${escapeHtml(c.title)}</option>`).join('')}</optgroup>`:'';
      }).join('');
    }
    return [
      `<option value="">${placeholder}</option>`,
      ...options.map((component) => `<option value="${escapeHtml(component.id)}" ${component.id === selectedId ? "selected" : ""}>${escapeHtml(component.title)}</option>`)
    ].join("");
  };

  return `
    <section class="builder-picker" aria-label="自由拼装选择区">
      <div class="builder-picker-heading"><div><strong>选择想改变的部分</strong><p>每一项都可以不选。更换选项时，其他选择会保留。</p></div></div>
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
    ${renderBuilderPicker(state.activeCategoryId, components, builder)}
    <section class="builder-panel">
      <div class="builder-heading"><div><p class="eyebrow">自由组合</p><h3>${escapeHtml(result.title)}</h3></div><button class="quiet-button" type="button" data-action="reset-builder">重置</button></div>
      <div class="builder-chips">${chips}</div>
      <div class="builder-result">
        <details><summary>查看完整组合正文</summary>
        <div class="prompt-block"><strong>正向 Prompt</strong><p>${escapeHtml(result.positive || "选择组件后生成稳定组合文本。")}</p></div>
        ${result.negative ? `<div class="prompt-block is-negative"><strong>反向提示词</strong><p>${escapeHtml(result.negative)}</p></div>` : ""}
        </details>
        <div class="dialog-actions builder-actions"><span class="builder-selection-count">已选 ${selected.length} 项</span>
         <button class="quiet-button" type="button" data-action="copy-builder" data-copy-type="positive" ${result.positive ? "" : "disabled"}>复制正向</button>
         <button class="quiet-button" type="button" data-action="copy-builder" data-copy-type="negative" ${result.negative ? "" : "disabled"}>复制反向</button>
          <button class="quiet-button" type="button" data-action="save-builder-composition" ${result.positive ? "" : "disabled"}>保存并收藏</button>
         <button class="primary-button" type="button" data-action="copy-builder" data-copy-type="all" ${result.positive ? "" : "disabled"}>复制全部</button>
        </div>
      </div>
    </section>
  `;
}

function renderContent() {
  if (studio.workspace !== 'builder') { renderCatalog(); return; }
  const state = currentState();
  document.querySelectorAll('[data-action="quick-view"]').forEach((button) => button.setAttribute("aria-pressed", String(button.dataset.view === app.quickView)));
  if (app.quickView === "recent") {
    $("#prompt-sections").innerHTML = "";
    $("#category-title").textContent = "最近复制";
    $("#category-count").textContent = `${(state.recent || []).length} 条`;
    if (!state.recent?.length) $("#prompt-sections").innerHTML = '<div class="empty-state"><h3>还没有复制记录</h3><p>复制过的内容会出现在这里，方便下次直接使用。</p></div>';
    return;
  }
  if (app.quickView === "favorites" || (app.searchAll && app.searchQuery.trim())) {
    const items = allSuiteEntries().filter(({kind, entry}) => (app.quickView !== "favorites" || kind === "composition" || isFavorite(kind, entry.id)) && searchEntry(kind, entry));
    $("#category-title").textContent = app.quickView === "favorites" ? "我的收藏" : "全部栏目搜索";
    $("#category-count").textContent = `${items.length} 条`;
    $("#prompt-sections").innerHTML = items.length ? renderList("", items) : '<div class="empty-state"><h3>没有找到内容</h3><p>试试更短的关键词，或收藏常用的 Prompt。</p></div>';
    return;
  }
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
    const emptyModes = ["direct", "components", "builder"]
      .map((mode) => ({ mode, count: modeCount(mode, state.activeCategoryId) }))
      .filter(({ count }) => count > 0);
    const emptyActions = emptyModes.map(({ mode, count }) => `<button class="quiet-button" type="button" data-action="change-mode" data-mode="${mode}">${escapeHtml(BANGYAN_MODES.find((item) => item.id === mode)?.label || mode)} · ${count} 条</button>`).join("");
    content = items.length ? renderList("推荐组合", items) : `<div class="empty-state"><h3>当前分类暂未提供推荐组合</h3><p>这不是数据丢失。可以按当前分类直接使用已有 Prompt，或进入单项库自由挑选。</p><div class="empty-actions">${emptyActions}</div></div>`;
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
  if (app.searchQuery.trim()) {
    const counts = [...$("#prompt-sections").querySelectorAll(".section-title-actions > span")].map((item) => parseInt(item.textContent, 10) || 0);
    $("#category-count").textContent = `${counts.reduce((sum, count) => sum + count, 0)} 条匹配`;
  }
}

function allSuiteEntries() {
  if (app.activeSuite === "zhuangyuan") return zhuangyuanEntries().map((entry) => ({ kind: "prompt", entry }));
  return [
    ...bangyanPresets().map((entry) => ({ kind: "preset", entry })),
    ...bangyanComponents().map((entry) => ({ kind: "component", entry })),
    ...bangyanDirectEntries(),
    ...bangyanCustomPrompts().filter((entry) => entry.kind !== "direct").map((entry) => ({ kind: "custom", entry })),
    ...(currentState().savedCompositions || []).filter((entry) => !entry.deletedAt).map((entry) => ({ kind: "composition", entry }))
  ];
}

function renderRecent() {
  const panel = $("#recent-panel");
  const list = $("#recent-list");
  const recent = (currentState()?.recent || []).slice(0, 20);
  panel.hidden = app.quickView !== "recent" || !recent.length;
  list.innerHTML = recent.map((entry) => `
    <button class="recent-item" type="button" data-action="copy-recent" data-id="${escapeHtml(entry.id)}">
      <span><strong>${escapeHtml(entry.title)}</strong><small>${escapeHtml(new Date(entry.copiedAt).toLocaleString("zh-CN"))}</small></span><b>复制</b>
    </button>
  `).join("");
}

function render() {
  renderSuiteTabs();
  if (app.quickViewSuite !== app.activeSuite) {
    app.quickView = "browse";
    app.searchAll = false;
    app.searchQuery = "";
    app.quickViewSuite = app.activeSuite;
  }
  if (!app.defaults[app.activeSuite]) {
    ["#category-tabs", "#mode-tabs", "#subcategory-tabs", "#recent-list"].forEach((selector) => { $(selector).innerHTML = ""; });
    $("#category-title").textContent = app.activeSuite === "bangyan" ? "榜眼" : "状元";
    $("#category-count").textContent = "加载未完成";
    $("#prompt-sections").innerHTML = '<div class="empty-state"><h3>这个版本暂时没有加载成功</h3><p>本机内容没有被清空。可切换另一个版本，或重新加载。</p><button class="quiet-button" type="button" data-action="retry-load">重新加载</button></div>';
    return;
  }
  renderCategoryTabs();
  renderModeTabs();
  renderAddPromptButton();
  renderSubcategoryTabs();
  renderHeading();
  renderContent();
  renderRecent();
  renderStudioChrome();
  const search = $("#search-input");
  if (search && search.value !== app.searchQuery) search.value = app.searchQuery;
  $("#search-all").checked = app.searchAll;
  saveBrowsingState();
}

function saveBrowsingState() {
  try { sessionStorage.setItem('prompt-library-v4-view', JSON.stringify({...studio, scrollY: window.scrollY, detail: app.detail, suite: app.activeSuite})); } catch {}
  try { sessionStorage.setItem("prompt-library-v4-browsing", JSON.stringify({ suite: app.activeSuite, query: app.searchQuery, view: app.quickView, all: app.searchAll, subcategory: app.subcategoryFilter, collapsed: [...app.collapsedSections], limit: app.visibleLimit, scrollY: window.scrollY })); } catch {}
}

function restoreBrowsingState() {
  try {
    const state = JSON.parse(sessionStorage.getItem('prompt-library-v4-view'));
    if (state && state.suite === app.activeSuite) {
      for (const key of ['source','only','workspace','category','type','theme','mine','legacy']) if(typeof state[key] === (['legacy','only'].includes(key) ? 'boolean' : 'string')) studio[key] = state[key];
      requestAnimationFrame(() => { if (state.detail) openDetail(state.detail.kind, state.detail.id); else window.scrollTo(0,state.scrollY||0); });
    }
  } catch {}
  try {
    const saved = JSON.parse(sessionStorage.getItem("prompt-library-v4-browsing"));
    if (!saved || saved.suite !== app.activeSuite) return;
    app.searchQuery = typeof saved.query === "string" ? saved.query : "";
    app.quickView = ["browse", "favorites", "recent"].includes(saved.view) ? saved.view : "browse";
    app.searchAll = saved.all === true;
    app.subcategoryFilter = typeof saved.subcategory === "string" ? saved.subcategory : "全部";
    app.collapsedSections = new Set(Array.isArray(saved.collapsed) ? saved.collapsed : []);
    app.visibleLimit = Math.max(PAGE_SIZE, Math.min(Number(saved.limit) || PAGE_SIZE, 5000));
    requestAnimationFrame(() => window.scrollTo(0, Number(saved.scrollY) || 0));
  } catch {}
}

function fillCategoryOptions(selectedId) {
  $("#prompt-category").innerHTML = categoryList().map((category) => `
    <option value="${escapeHtml(category.id)}" ${category.id === selectedId ? "selected" : ""}>${escapeHtml(category.name)}</option>
  `).join("");
}

function promptKindForAdd() {
  if(app.activeSuite!=='bangyan')return 'prompt';
  if(studio.workspace!=='builder')return 'direct';
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
  $('#prompt-source').value=app.activeSuite;$('#prompt-source').disabled=Boolean(entry);
  $('#prompt-description').value=view?.description||'';
  $('#prompt-tags').value=(view?.tags||[]).join('、');
  $('#prompt-scopes').innerHTML=CATEGORIES.filter(s=>s!=='全部'&&s!=='仅供辨认').map(scope=>`<label><input type="checkbox" value="${scope}" ${view?.browseScopes?.includes(scope)?'checked':''}>${scope}</label>`).join('');
  $("#prompt-pinned").checked = Boolean(view?.pinned);
  fillCategoryOptions(view?.categoryId || currentState().activeCategoryId);
  $("#prompt-category").hidden = !categoryEditable;
  $("#prompt-category").previousElementSibling.hidden = !categoryEditable;
  $("#prompt-pinned").closest(".pin-checkbox").hidden = !categoryEditable;
  $("#prompt-reset-edit").hidden = !(staticEdit && hasPromptEdit(kind, entry.id));
  $("#prompt-reset-edit").dataset.kind = kind;
  $("#prompt-reset-edit").dataset.id = entry?.id || "";
  $("#prompt-save-button").textContent = entry ? "保存修改" : "保存 Prompt";
  if(!entry) {
    try {const draft=JSON.parse(localStorage.getItem('prompt-library-draft:'+app.activeSuite)); if(draft) for(const [key,value] of Object.entries(draft)) {if(key==='scopes'){$('#prompt-scopes').querySelectorAll('input').forEach(el=>el.checked=value.includes(el.value));continue;} const field=document.getElementById(key);if(field)field.value=value;}} catch {}
  }
  $('#prompt-suite-hint').textContent += ' · 关闭后保留未保存草稿';
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
  const scopes=[...$('#prompt-scopes').querySelectorAll('input:checked')].map(el=>el.value);
  const catalogFields={description:$('#prompt-description').value,tags:$('#prompt-tags').value.split(/[、,，]/).map(s=>s.trim()).filter(Boolean),browseScopes:scopes.length?scopes:undefined};
  if (kind === "composition") {
    const existing = state.savedCompositions.find((entry) => entry.id === id && !entry.deletedAt);
    if (!existing) return;
    Object.assign(existing, { title, positive, negative, ...catalogFields, updatedAt: now });
  } else if (isStaticEditable(kind, id)) {
    const existing = state.promptEdits.find((entry) => entry.kind === kind && entry.id === id);
    const next = { id, kind, title, positive, negative, ...catalogFields, createdAt: existing?.createdAt || now, updatedAt: now };
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
      Object.assign(existing, { kind: storedKind, title, categoryId, prompt: positive, negativePrompt: negative, ...catalogFields, pinned, updatedAt: now });
    } else {
      state.customPrompts.push({ id: makeId(storedKind === "direct" ? "bangyan-direct-custom" : "bangyan-custom"), kind: storedKind, title, categoryId, prompt: positive, negativePrompt: negative, ...catalogFields, pinned, pinOrder: pinned ? Date.now() : 0, createdAt: now, updatedAt: now });
    }
  } else if (kind === "prompt" && app.activeSuite === "zhuangyuan") {
    const existing = state.prompts.find((entry) => entry.id === id);
    if (existing) {
      Object.assign(existing, { title, categoryId, prompt: positive, negativePrompt: negative, ...catalogFields, pinned, pinOrder: pinned ? existing.pinOrder || Date.now() : 0, updatedAt: now });
    } else {
      state.prompts.push({ id: makeId("zhuangyuan-custom"), title, categoryId, prompt: positive, negativePrompt: negative, ...catalogFields, pinned, pinOrder: pinned ? Date.now() : 0, createdAt: now, updatedAt: now });
    }
    syncZhuangyuanCustomPrompts();
  } else {
    return;
  }
  if (categoryEditable) state.activeCategoryId = categoryId;
  $("#prompt-dialog").close();
  $("#detail-dialog")?.close();
  if (!await persist()) return;
  render();
  try {localStorage.removeItem('prompt-library-draft:'+app.activeSuite);} catch {}
  studio.workspace='mine';studio.mine='custom';studio.source=app.activeSuite;studio.category='全部';studio.type='all';studio.theme='';app.searchQuery='';
  render();
  showToast(id ? "内容已更新" : "Prompt 已保存，可在这里复制");
}

async function resetStaticEdit(kind, id) {
  if (!isStaticEditable(kind, id) || !hasPromptEdit(kind, id)) return;
  const entry = findEntry(kind, id);
  if (!entry || !await confirmAction("恢复「" + entry.title + "」的正式内容吗？本地编辑版本会被移除。")) return;
  const edit = currentState().promptEdits.find((item) => item.kind === kind && item.id === id && !item.deletedAt);
  if (!edit) return;
  edit.deletedAt = nowIso();
  edit.updatedAt = edit.deletedAt;
  $("#prompt-dialog")?.close();
  $("#detail-dialog")?.close();
  if (!await persist()) return;
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
  if (!await persist()) return;
  render();
  showToast("组合已收藏");
}

async function deleteSavedComposition(id) {
  const entry = findEntry("composition", id);
  if (!entry || !await confirmAction("删除保存的组合「" + entry.title + "」吗？")) return;
  const stored = currentState().savedCompositions.find((item) => item.id === id && !item.deletedAt);
  if (!stored) return;
  stored.deletedAt = nowIso();
  stored.updatedAt = stored.deletedAt;
  $("#detail-dialog")?.close();
  if (!await persist()) return;
  render();
  showToast("保存的组合已删除");
}

async function togglePinned(kind, id) {
  const entry = findEntry(kind, id);
  if (!entry || (kind !== "prompt" && kind !== "custom")) return;
  entry.pinned = !entry.pinned;
  entry.pinOrder = entry.pinned ? Date.now() : 0;
  entry.updatedAt = nowIso();
  if (app.activeSuite === "zhuangyuan") syncZhuangyuanCustomPrompts();
  if (!await persist()) return;
  render();
}

async function toggleFavorite(kind, id) {
  const state = currentState();
  const key = favoriteKey(kind, id);
  const wasFavorite = isFavorite(kind,id);
  state.favoriteIds = wasFavorite ? state.favoriteIds.filter((value) => value !== key) : [...state.favoriteIds, key];
  state.favoriteChanges ||= {};
  state.favoriteChanges[key] = { value: state.favoriteIds.includes(key), updatedAt: nowIso() };
  if (!await persist()) return;
  render();
  if ($('#detail-dialog').open && app.detail?.kind===kind && app.detail?.id===id) {
    const button=$('#detail-actions').querySelector('[data-action="toggle-favorite"]');
    if(button)button.textContent=isFavorite(kind,id)?'取消收藏':'收藏';
  }
}

async function deletePrompt(kind, id) {
  const entry = findEntry(kind, id);
  if (!entry || (kind !== "prompt" && kind !== "custom") || !await confirmAction(`确定删除「${entry.title}」吗？`)) return;
  entry.deletedAt = nowIso();
  entry.updatedAt = entry.deletedAt;
  if (app.activeSuite === "zhuangyuan") syncZhuangyuanCustomPrompts();
  if (!await persist()) return;
  render();
  $("#detail-dialog").close();
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
  $("#detail-eyebrow").textContent = `${app.activeSuite === "bangyan" ? "榜眼" : "状元"} · ${subcategoryFor(kind, entry)}`;
  $("#detail-title").textContent = display.title;
  const metadata = catalogMeta(kind, entry);
  const member = familyFor(app.activeSuite,kind,entry,edited);
  $('#catalog-detail').innerHTML = `${member?`<div class="family-detail-note"><strong>同类 · ${escapeHtml(member.family.title)}</strong><p>区别 · ${escapeHtml(member.difference)}</p><small>浏览备注，不加入复制正文。</small></div>`:''}${effectiveEntry(kind,entry).description?`<p class="source-notes">${escapeHtml(effectiveEntry(kind,entry).description)}</p>`:''}${effectiveEntry(kind,entry).tags?.length?`<p class="source-notes">标签：${effectiveEntry(kind,entry).tags.map(escapeHtml).join(' · ')}</p>`:''}<div class="scope-tags">${[metadata.category,...metadata.scopes].filter((v,i,a)=>a.indexOf(v)===i).map(s=>`<span>${escapeHtml(s)}</span>`).join('')}</div>
    ${entry.actionBreakdown?.length ? `<details class="source-notes" open><summary>中文动作说明 · 不加入复制正文</summary><ul>${entry.actionBreakdown.map(s=>`<li>${escapeHtml(s)}</li>`).join('')}</ul></details>` : ''}
    ${kind === 'preset' ? `<div class="source-notes"><strong>组合内容</strong><p>${Object.values(entry.slots || {}).flat().filter(Boolean).map(id=>bangyanComponentsForDisplay().find(c=>c.id===id)?.title || id).map(escapeHtml).join(' · ')}</p></div>` : ''}
    <details class="source-notes"><summary>来源与分类依据${metadata.issues.length ? ` · ${metadata.issues.length} 项待核对` : ''}</summary><p>原分类：${escapeHtml(categoryNameFor(kind,entry))} / ${escapeHtml(subcategoryFor(kind,entry))}</p><p>${escapeHtml(metadata.status)}；只改变浏览索引，未改动正文。</p>${metadata.issues.map(s=>`<p>${escapeHtml(s)}</p>`).join('')}<small>${escapeHtml(entry.id)}</small></details>`;
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
  if (!displayOnly && !['component','preset','composition'].includes(kind)) {
    const origin=isStaticEditable(kind,id)?(edited?'本机编辑版本，可恢复内置原文':'内置原文保留，编辑保存到本机'):'我的内容，已保存到当前设备';
    $('#detail-meta').textContent=`${contentLabel(kind,metadata)} · ${origin}`;
  }
  $("#detail-positive").textContent = display.positive;
  $("#detail-negative").textContent = display.negative;
  $("#detail-negative-block").hidden = !display.negative;
  $("#detail-actions").innerHTML = `
    ${displayOnly ? `<span class="detail-note">仅供辨认，不复制到 Prompt 正文</span>` : `<button class="quiet-button" type="button" data-action="detail-copy" data-copy-type="positive">复制正向</button>
    <button class="quiet-button" type="button" data-action="detail-copy" data-copy-type="negative" ${display.negative ? "" : "disabled"}>复制反向</button>
    <button class="primary-button" type="button" data-action="detail-copy" data-copy-type="all">复制全部</button>`}
    ${editable ? `<button class="quiet-button" type="button" data-action="edit-prompt" data-kind="${kind}" data-id="${entryId}">编辑</button>` : ""}
    ${true ? `<button class="quiet-button" type="button" data-action="toggle-favorite" data-kind="${kind}" data-id="${entryId}">${isFavorite(kind,id) ? '取消收藏' : '收藏'}</button>` : ''}
    ${['prompt','custom'].includes(kind) ? `<button class="quiet-button" type="button" data-action="toggle-pin" data-kind="${kind}" data-id="${entryId}">${isPinned(kind,entry) ? '取消置顶' : '置顶'}</button><button class="quiet-button is-danger" type="button" data-action="delete-prompt" data-kind="${kind}" data-id="${entryId}">删除</button>` : ''}
    ${edited ? `<button class="quiet-button" type="button" data-action="reset-edit" data-kind="${kind}" data-id="${entryId}">恢复正式内容</button>` : ""}
    ${builderTarget ? `<button class="quiet-button" type="button" data-action="detail-add-builder" data-kind="${kind}" data-id="${entryId}">${kind === "composition" || kind === "preset" ? "继续调整" : "放入拼装区"}</button>` : ""}
    ${kind === "composition" ? `<button class="quiet-button is-danger" type="button" data-action="delete-composition" data-kind="${kind}" data-id="${entryId}">删除保存的组合</button>` : ""}
 `;
  $("#detail-dialog").showModal();
  saveBrowsingState();
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
  if (entry.category || entry.categoryId) app.states.bangyan.activeCategoryId = entry.category || entry.categoryId;
  app.states.bangyan.activeMode = "builder";
  studio.workspace = 'builder';
  app.searchQuery = ''; app.quickView = 'browse'; app.searchAll = false;
  if (!await persist()) return;
  $("#detail-dialog")?.close();
  render();
  showToast("已放入自由拼装区");
}

async function removeFromBuilder(id) {
  const component = bangyanComponents().find((entry) => entry.id === id);
  if (!component) return;
  app.states.bangyan.builder = removeBuilderComponent(app.states.bangyan.builder, component);
  markBuilderUpdated();
  if (!await persist()) return;
  render();
}

async function resetBuilder() {
  app.states.bangyan.builder = emptyBuilder();
  markBuilderUpdated();
  if (!await persist()) return;
  render();
}

async function copyBuilder(copyType) {
  const result = composeBuilderResult(normalizeBuilder(app.states.bangyan.builder));
  const content = copyType === "positive" ? result.positive : copyType === "negative" ? result.negative : result.negative ? `${result.positive}\n\n反向提示词：${result.negative}` : result.positive;
  if (!content) return showToast("请先选择组件");
  if(!await copyText(content))return;
  recordRecent("builder", result.componentIds.join(","), result.title, content);
  if (!await persist()) return;
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
      favoriteChanges: state.favoriteChanges,
      recent: state.recent
    };
  }
  return {
    customPrompts: state.customPrompts,
    promptEdits: state.promptEdits,
    savedCompositions: state.savedCompositions,
    favoriteIds: state.favoriteIds,
    favoriteChanges: state.favoriteChanges,
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
      app.states.zhuangyuan.favoriteChanges = remoteZhuangyuan.favoriteChanges || {};
      app.states.zhuangyuan.recent = normalizeRecent(remoteZhuangyuan.recent);
    }
    if (remoteBangyan) {
      app.states.bangyan.customPrompts = (remoteBangyan.customPrompts || []).map((entry) => normalizeCustomPrompt(entry, "bangyan")).filter(Boolean);
      app.states.bangyan.promptEdits = normalizePromptEdits(remoteBangyan.promptEdits).filter((entry) => entry.kind === "component" || entry.kind === "preset" || entry.kind === "direct");
      app.states.bangyan.savedCompositions = normalizeSavedCompositions(remoteBangyan.savedCompositions);
      app.states.bangyan.favoriteIds = normalizeFavoriteIds(remoteBangyan.favoriteIds);
      app.states.bangyan.favoriteChanges = remoteBangyan.favoriteChanges || {};
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
  // Local previews must reflect each build, not yesterday's PWA cache.
  if (["localhost", "127.0.0.1", "::1"].includes(location.hostname)) return;
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
  const catalogRequest = fetch('data/catalog-map.json?v=4.1.0').then(response=>response.ok?response.json():null).catch(()=>null);
  const loadData = async (file) => {
    try {
      const response = await fetch(`data/${file}?v=${APP_ASSET_VERSION}`);
      if (!response.ok) return null;
      const data = await response.json();
      if (file === "img2img-prompts.json" ? !Array.isArray(data.prompts) || !Array.isArray(data.categories) : !Array.isArray(data.components) || !Array.isArray(data.presets) || !Array.isArray(data.directPrompts)) return null;
      return data;
    } catch { return null; }
  };
  const [zhuangyuanData, bangyanData, storage, catalogData] = await Promise.all([
    loadData("img2img-prompts.json"),
    loadData("bangyan-data.json"),
    readStorageBundle(),
    catalogRequest
  ]);
  catalogMap = catalogData?.entries || {};
  const migratedLegacy = !storage.zhuangyuan && migrateLegacyPrototypeState(storage.legacy || storage.legacyFallback);
  app.defaults.zhuangyuan = zhuangyuanData;
  app.defaults.bangyan = bangyanData;
  app.states.zhuangyuan = zhuangyuanData ? normalizeZhuangyuanState(zhuangyuanData, storage.zhuangyuan || migratedLegacy) : storage.zhuangyuan || migratedLegacy;
  app.states.bangyan = bangyanData ? normalizeBangyanState(storage.bangyan) : storage.bangyan;
  app.meta = normalizeMeta(storage.meta);
  if (!app.meta.syncCode) app.meta.syncCode = migratedLegacy?.syncCode || app.states.zhuangyuan?.syncCode || "";
  if (!app.meta.lastSyncedAt) app.meta.lastSyncedAt = migratedLegacy?.lastSyncedAt || app.states.zhuangyuan?.lastSyncedAt || "";
  app.activeSuite = app.meta.activeSuite;
  restoreBrowsingState();
  if (pendingSearch !== null) app.searchQuery = pendingSearch;
  app.quickViewSuite = app.activeSuite;
  app.storageMode = storage.storage;
  await persist();
  applyTheme(app.theme);
  render();
  $("#search-input").disabled = false;
  registerServiceWorker();
}

document.addEventListener("click", async (event) => {
  const target = event.target.closest("[data-action], [data-suite-tab]");
  if (!target) return;
  const owner=target.closest('[data-owner-suite]')?.dataset.ownerSuite;
  if(owner) {app.activeSuite=owner;app.quickViewSuite=owner;app.meta.activeSuite=owner;}
  const action = target.dataset.action;
  if (action?.startsWith('studio-')) { await studioAction(action, target); return; }
  if (action === "retry-load") { window.location.reload(); return; }
  if (target.dataset.suiteTab) {
    const suite = target.dataset.suiteTab;
    if (suite === "zhuangyuan" || suite === "bangyan") {
      app.activeSuite = suite;
      if (suite === 'zhuangyuan' && studio.workspace === 'builder') studio.workspace = 'browse';
      studio.category = '全部'; studio.theme = ''; studio.type = 'all';
      app.meta.activeSuite = suite;
      app.subcategoryFilter = "全部";
      app.searchQuery = "";
      app.quickView = "browse";
      app.quickViewSuite = suite;
      app.searchAll = false;
      app.visibleLimit = PAGE_SIZE;
      render();
      await persist();
      render();
    }
    return;
  }
  const id = target.dataset.id;
  const kind = target.dataset.kind;
  if (action === "quick-view") {
    app.quickView = target.dataset.view;
    app.quickViewSuite = app.activeSuite;
    app.visibleLimit = PAGE_SIZE;
    render();
    $("#category-title").scrollIntoView({ block: "start" });
    return;
  }
  if (!app.defaults[app.activeSuite]) return;
  if (["sync-now", "choose-backup"].includes(action) && (!app.defaults.zhuangyuan || !app.defaults.bangyan)) { showToast("请等待两个版本的数据加载完成，再同步或导入"); return; }
  if (action === "focus-search") {
    $("#search-input").scrollIntoView({ block: "center" });
    $("#search-input").focus();
    return;
  }
  if (action === "choose-backup") { $("#backup-file").click(); return; }
  if (action === "change-category") {
    app.quickView = "browse";
    currentState().activeCategoryId = id;
    if (app.activeSuite === "bangyan" && currentState().activeMode !== "builder" && modeCount(currentState().activeMode, id) === 0) {
      currentState().activeMode = modeCount("direct", id) ? "direct" : "components";
    }
    app.subcategoryFilter = "全部";
    app.visibleLimit = PAGE_SIZE;
    await persist();
    render();
  } else if (action === "change-mode") {
    app.quickView = "browse";
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
      if(!await copyText(record.content))return;
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
    showToast("已清除这一项");
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

$('#prompt-source').addEventListener('change',()=>{app.activeSuite=$('#prompt-source').value;app.quickViewSuite=app.activeSuite;app.meta.activeSuite=app.activeSuite;openPromptDialog();});
$('#prompt-form').addEventListener('input',()=>{
  if($('#prompt-id').value)return;
  try {localStorage.setItem('prompt-library-draft:'+app.activeSuite,JSON.stringify({...Object.fromEntries(['prompt-title','prompt-positive','prompt-negative','prompt-category','prompt-description','prompt-tags'].map(id=>[id,document.getElementById(id).value])),scopes:[...$('#prompt-scopes').querySelectorAll('input:checked')].map(el=>el.value)}));}catch{showToast('草稿暂时无法保存，请先复制正文');}
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
  if (!currentState()) { pendingSearch = app.searchQuery; return; }
  app.visibleLimit = PAGE_SIZE;
  renderHeading();
  renderContent();
  renderStudioChrome();
  saveBrowsingState();
});

$("#search-all").addEventListener("change", () => {
  app.searchAll = $("#search-all").checked;
  render();
});
window.addEventListener("pagehide", saveBrowsingState);
document.addEventListener("visibilitychange", () => { if (document.hidden) saveBrowsingState(); });

let pendingBackup = null;
$("#backup-file").addEventListener("change", async (event) => {
  pendingBackup = null;
  $("#apply-backup").hidden = true;
  try {
    const file = event.target.files[0];
    if (!file) return;
    if (file.size > 20 * 1024 * 1024) throw new Error("文件超过 20 MB，请确认选择的是本机 JSON 备份");
    const backup = parseUserBackup(await file.text());
    const counts = ["zhuangyuan", "bangyan"].map((suite) => {
      const value = backup.suites[suite];
      return `${suite === "zhuangyuan" ? "状元" : "榜眼"}：${value ? `编辑 ${value.promptEdits?.length || 0}；自定义 ${value.customPrompts?.length || 0}；收藏 ${value.favoriteIds?.length || 0}；收藏组合 ${value.savedCompositions?.length || 0}；最近复制 ${value.recent?.length || 0}` : "未包含，不改变"}`;
    });
    $("#backup-preview").textContent = counts.join("\n") + "\n相同记录保留更新时间较新的版本，不覆盖内置 Prompt。确认时会先下载当前本机备份；同步码不会被替换。";
    pendingBackup = backup;
    $("#apply-backup").hidden = false;
  } catch (error) { $("#backup-preview").textContent = error.message; }
  finally { event.target.value = ""; }
});
$("#apply-backup").addEventListener("click", async () => {
  if (!pendingBackup) return;
  const button = $("#apply-backup");
  button.disabled = true;
  try {
    exportUserState();
    const next = clone(app.states);
    for (const suite of ["zhuangyuan", "bangyan"]) {
      if (!pendingBackup.suites[suite]) continue;
      const merged = mergeSyncedSuiteState(next[suite], pendingBackup.suites[suite]);
      merged.lastSyncedAt = next[suite].lastSyncedAt;
      next[suite] = suite === "zhuangyuan" ? normalizeZhuangyuanState(app.defaults.zhuangyuan, merged) : normalizeBangyanState(merged);
    }
    const storageMode = await writeStorageBundle({ ...next, meta: app.meta });
    app.states = next;
    app.storageMode = storageMode;
    pendingBackup = null;
    button.hidden = true;
    $("#backup-preview").textContent = "已合并导入并保存。内置数据保持不变。";
    render();
    showToast("备份已导入");
  } catch (error) { $("#backup-preview").textContent = `导入未完成：${error.message}`; }
  finally { button.disabled = false; }
});

$("#clear-search").addEventListener("click", () => {
  app.searchQuery = "";
  $("#search-input").value = "";
  app.visibleLimit = PAGE_SIZE;
  render();
});

const expandedFamilies = new Set();
let groupSimilar = true;
let pendingSearch = null;
const studio = {source:'all', only:false, workspace:'browse', category:'全部', type:'all', theme:'', mine:'favorites', legacy:false};
let catalogMap = {};
const kindLabels = {prompt:'直接 Prompt',direct:'直接 Prompt',custom:'我的 Prompt',preset:'推荐组合',component:'单项组件',composition:'收藏组合'};
function catalogMeta(kind, entry) {
  const stored = catalogMap[recordKey(app.activeSuite,kind,entry)];
  const view=effectiveEntry(kind,entry);
  if(Array.isArray(view.browseScopes)) {
    const base=classify({...entry,positive:displayFor(kind,entry).positive},kind,bangyanComponents());
    return {...base,scopes:view.browseScopes,category:view.browseScopes.length>1?'综合方案':view.browseScopes[0]||'未分类',status:'用户确认用途'};
  }
  if (stored && !hasPromptEdit(kind,entry.id)) return stored;
  const display = displayFor(kind,entry);
  const meta = classify({...entry,positive:display.positive},kind,bangyanComponents());
  if (!stored || hasPromptEdit(kind,entry.id)) meta.status = '本机内容 · 实时归类';
  return meta;
}
// Suite context is synchronous only; actions select their owning suite before async work.
function inSuite(suite, fn) {
  const previous=app.activeSuite;
  try { app.activeSuite=suite; return fn(); } finally { app.activeSuite=previous; }
}
function catalogUniverse() {
  const suites=studio.source==='all'?['zhuangyuan','bangyan']:[studio.source];
  return suites.filter(suite=>app.defaults[suite]&&app.states[suite]).flatMap(suite=>inSuite(suite,()=>allSuiteEntries().map(item=>({...item,suite}))));
}
function catalogItems() {
  if(!studio.legacy && !CATEGORIES.includes(studio.category))studio.category='全部';
  let items = catalogUniverse();
  if(studio.workspace === 'mine') {
    if(studio.mine === 'favorites') items = items.filter(({kind,entry,suite})=>inSuite(suite,()=>isFavorite(kind,entry.id)));
    if(studio.mine === 'custom') items = items.filter(({kind,entry,suite})=>kind!=='composition'&&inSuite(suite,()=>kind==='custom'||hasPromptEdit(kind,entry.id)||!catalogMap[recordKey(suite,kind,entry)]));
  }
  if(studio.workspace==='mine'&&studio.mine==='saved') items=items.filter(item=>item.kind==='composition');
  return items.filter(({kind,entry,suite})=> inSuite(suite,()=>{
    if(studio.type==='direct' && !['prompt','direct','custom','composition'].includes(kind)) return false;
    if(studio.type==='preset' && kind!=='preset') return false;
    if(studio.type==='component' && kind!=='component') return false;
    if(studio.type==='all' && studio.workspace!=='mine' && kind==='component') return false;
    const m=catalogMeta(kind,entry);
    if(!belongsToWorkspace(studio.workspace,kind,m))return false;
    if(studio.category!=='全部' && (studio.legacy ? categoryNameFor(kind,entry)!==studio.category : m.category!==studio.category && !m.scopes.includes(studio.category)))return false;
    if(studio.only&&studio.category!=='全部'&&m.scopes.length!==1)return false;
    if(studio.theme && !m.themes.includes(studio.theme))return false;
    const tokens=app.searchQuery.trim().toLocaleLowerCase().split(/\s+/).filter(Boolean);
    const family=familyFor(suite,kind,entry,hasPromptEdit(kind,entry.id));
    const text=[family?.family.title||'',family?.difference||'',displayFor(kind,entry).title,displayFor(kind,entry).positive,categoryNameFor(kind,entry),entry.subcategory,...m.scopes,...m.themes,...(entry.keywords||[]),...(effectiveEntry(kind,entry).tags||[]),effectiveEntry(kind,entry).description||''].join(' ').toLocaleLowerCase();
    return tokens.every(token=>text.includes(token));
  }));
}
function renderStudioCard(kind,entry) {
  const d=displayFor(kind,entry), m=catalogMeta(kind,entry), id=escapeHtml(entry.id);
  const favorite=isFavorite(kind,entry.id), readOnly=kind==='component'&&isDisplayOnlyComponent(entry);
  const labels = [...new Set(m.scopes)].slice(0,2);
  if(m.scopes.length>2)labels.push(`另 ${m.scopes.length-2} 项修改`);
  const view=effectiveEntry(kind,entry);
  const excerpt=view.description||d.positive||'';
  const member=familyFor(app.activeSuite,kind,entry,hasPromptEdit(kind,entry.id));
  return `<article class="prompt-card studio-card" data-entry-kind="${kind}" data-entry-id="${id}" data-owner-suite="${app.activeSuite}">
    <div class="studio-card-main"><div class="studio-entry-heading"><h3><button type="button" class="entry-title" data-action="open-detail" data-kind="${kind}" data-id="${id}">${escapeHtml(d.title)}</button></h3><span class="entry-type">${app.activeSuite==='bangyan'?'榜眼':'状元'} · ${contentLabel(kind,m)}${isPinned(kind,entry)?' · 置顶':''}${hasPromptEdit(kind,entry.id)?' · 已编辑':''}</span></div>
    <button type="button" class="studio-preview" data-action="open-detail" data-kind="${kind}" data-id="${id}" aria-label="查看 ${escapeHtml(d.title)} 详情"><span class="scope-tags">${labels.map(s=>`<span>${escapeHtml(s)}</span>`).join('')}</span><span class="variant-difference">${member?`区别 · ${escapeHtml(member.difference)}`:''}</span><span class="real-description"><small>${view.description?'说明':'原文节选'} · </small>${escapeHtml(excerpt)}</span></button></div>
    <div class="card-actions"><button type="button" class="favorite-button ${favorite?'is-active':''}" data-action="toggle-favorite" data-kind="${kind}" data-id="${id}" aria-label="${favorite?'取消收藏':'收藏'}" aria-pressed="${favorite}">${favorite?'★':'☆'}<span>${favorite?'已收藏':'收藏'}</span></button>
    ${readOnly?'<span class="readonly-label">仅供辨认</span>':`<button class="text-action is-copy" type="button" data-action="copy-entry" data-kind="${kind}" data-id="${id}" data-copy-type="all">${kind==='preset'?'复制组合 Prompt':'复制'}</button>`}</div></article>`;
}
function renderCatalog() {
  if(studio.workspace==='mine'&&studio.mine==='recent') {
    app.quickView='browse'; $('#recent-panel').hidden=true;
    const recent=(studio.source==='all'?['zhuangyuan','bangyan']:[studio.source]).flatMap(suite=>(app.states[suite]?.recent||[]).map(entry=>({...entry,suite}))).filter(entry=>app.searchQuery.trim().split(/\s+/).every(t=>(entry.title+' '+entry.content).toLowerCase().includes(t.toLowerCase()))).sort((a,b)=>new Date(b.copiedAt)-new Date(a.copiedAt));
    $('#prompt-sections').innerHTML=recent.length?`<div class="recent-list">${recent.map(entry=>`<button class="recent-item" data-owner-suite="${entry.suite}" data-action="copy-recent" data-id="${escapeHtml(entry.id)}"><span><strong>${escapeHtml(entry.title)}</strong><small>${escapeHtml(new Date(entry.copiedAt).toLocaleString('zh-CN'))}</small></span><b>复制</b></button>`).join('')}</div>`:'<div class="empty-state"><h3>还没有匹配的复制记录</h3><p>复制过的内容会在这里，方便接着用。</p></div>';
    if(recent.length)$('#prompt-sections').insertAdjacentHTML('afterbegin','<div class="recent-tools"><button class="quiet-button" data-action="studio-clear-recent">清空最近复制</button></div>');
    $('#category-title').textContent='最近复制';$('#category-count').textContent=`${recent.length} 条`;return;
  }
  app.quickView='browse'; $('#recent-panel').hidden=true;
  const rank=item=>inSuite(item.suite,()=>{
    const view=effectiveEntry(item.kind,item.entry);
    const terms=app.searchQuery.trim().toLowerCase().split(/\s+/).filter(Boolean);
    return {pinned:Number(isPinned(item.kind,item.entry)),match:terms.reduce((n,t)=>n+(String(view.title).toLowerCase().includes(t)?3:0)+((view.tags||[]).some(tag=>tag.toLowerCase().includes(t))?2:0),0),date:new Date(view.updatedAt||view.createdAt||0).getTime()||0};
  });
  const items=catalogItems().map(item=>({...item,rank:rank(item)})).sort((a,b)=>b.rank.pinned-a.rank.pinned||b.rank.match-a.rank.match||b.rank.date-a.rank.date);
  $('#category-title').textContent=studio.workspace==='mine'?(studio.mine==='custom'?'我的新增与修改':studio.mine==='saved'?'保存的组合':'我的收藏'):(studio.workspace==='browse'?'可直接使用':studio.workspace==='components'?'单项组件库':studio.category==='全部'?'按目标找':studio.category);
  $('#category-eyebrow').textContent=app.activeSuite==='bangyan'?'榜眼':'状元';
  $('#category-description').textContent='';
  $('#category-count').textContent=`${items.length} 条${app.searchQuery?'匹配':''}`;
  const memberFor=item=>inSuite(item.suite,()=>familyFor(item.suite,item.kind,item.entry,hasPromptEdit(item.kind,item.entry.id)));
  const units=groupSimilar&&['browse','goals','components'].includes(studio.workspace)?familyUnits(items,memberFor):items.map(item=>({items:[item]}));
  const groupCount=units.filter(unit=>unit.family&&unit.items.length>1).length;
  const card=item=>inSuite(item.suite,()=>renderStudioCard(item.kind,item.entry));
  const unitHtml=unit=>{
    if(!unit.family||unit.items.length<2)return unit.items.map(card).join('');
    const f=unit.family;
    return `<details class="prompt-family" data-family-id="${escapeHtml(f.id)}" ${expandedFamilies.has(f.id)?'open':''}><summary><span class="family-heading"><strong>${escapeHtml(f.title)}</strong><span class="family-count">${unit.items.length} 条独立内容</span></span><span class="family-basis">${escapeHtml(f.basis)}</span><span class="family-preview">${unit.items.map(item=>escapeHtml(memberFor(item).difference)).join(' / ')}</span><span class="family-disclosure">${expandedFamilies.has(f.id)?'收起同类内容':'展开逐条查看与复制'}</span></summary><div class="family-entries">${unit.items.map(card).join('')}</div></details>`;
  };
  const groupControl=['browse','goals','components'].includes(studio.workspace)?`<div class="family-toolbar"><span>${groupSimilar?`已归为 ${groupCount} 个同类组，其余逐条显示`:'逐条显示全部内容'}</span><button class="quiet-button" data-action="toggle-families" aria-pressed="${groupSimilar}">${groupSimilar?'逐条浏览':'同类归组'}</button></div>`:'';
  $('#prompt-sections').innerHTML=items.length?`${groupControl}<section class="prompt-section"><div class="prompt-list">${units.slice(0,app.visibleLimit).map(unitHtml).join('')}</div>${units.length>app.visibleLimit?'<button class="quiet-button load-more" data-action="load-more">显示更多</button>':''}</section>`:`<div class="empty-state"><h3>这里暂时没有匹配内容</h3><p>可以减少筛选条件，或试试另一个关键词。</p><button class="quiet-button" data-action="studio-reset">清除筛选</button></div>`;
}
function renderStudioChrome() {
  const builder=studio.workspace==='builder', mine=studio.workspace==='mine';
  document.body.dataset.workspace=studio.workspace;
  const entries=catalogUniverse();
  const navItem=(value,label,icon)=>`<button type="button" data-action="studio-workspace" data-value="${value}" aria-current="${studio.workspace===value?'page':'false'}"><span class="nav-icon" aria-hidden="true">${icon}</span><span>${label}</span></button>`;
  $('#studio-nav').innerHTML=navItem('browse','直接使用','⌕')+navItem('goals','按目标找','⌑')+navItem('builder','自由组合','⊞')+navItem('mine','我的','☆')+'<a class="pose-nav-link" href="pose-reference.html"><span aria-hidden="true">♧</span><span>动作参考</span></a>';
  const titles={browse:'选一条，带回图片对话。',goals:'这张图片，你想改什么？',builder:'选组件，组成你的 Prompt。',components:'单项组件库',mine:{favorites:'我的收藏',recent:'最近复制',custom:'新增与修改',saved:'保存的组合'}[studio.mine]};
  const shortTitle={browse:'直接使用',goals:'按目标找',builder:'自由组合',components:'单项组件库',mine:titles.mine}[studio.workspace]||'Prompt 库';
  $('#workspace-title').innerHTML=`<span class="title-wide">${escapeHtml(titles[studio.workspace]||'Prompt 库')}</span><span class="title-compact">${escapeHtml(shortTitle)}</span>`;
  $('#add-prompt-label').textContent='新增';
  $('#workspace-subtitle').textContent=builder?'沿用原榜眼组合规则；未选项目保持不变。':mine?'收藏、历史和个人修改，随时接着用。':studio.workspace==='goals'?'选一个目标；需要保留其他内容时，打开“仅修改此项”。':'多项修改方案和推荐组合；姿势、穿搭等单项从“按目标找”进入。';
  $('#category-tabs').hidden=!builder;$('#mode-tabs').hidden=true;$('#subcategory-tabs').hidden=true;
  $('.search-row').hidden=builder;
  $('#path-cards').hidden=mine||builder||studio.workspace==='components';
  $('#path-cards').querySelectorAll('button').forEach(button=>button.setAttribute('aria-pressed',String(button.dataset.value===studio.workspace)));
  const buttons=(values,action,selected)=>values.map(([value,label])=>`<button type="button" data-action="${action}" data-value="${escapeHtml(value)}" aria-pressed="${selected===value}">${escapeHtml(label)}</button>`).join('');
  const source=`<div class="source-filter" aria-label="数据来源"><span>来源</span>${buttons([['all','全部'],['zhuangyuan','状元'],['bangyan','榜眼']],'studio-source',studio.source)}</div>`;
  if(builder){$('#catalog-controls').innerHTML='<div class="builder-library-link"><span>组件只在这里组合，不与完整方案混排。</span><button class="quiet-button" data-action="studio-components">浏览单项组件库</button></div>';return;}
  const recent=mine&&studio.mine==='recent';
  const categories=studio.legacy?['全部',...new Set(entries.map(({suite,kind,entry})=>inSuite(suite,()=>categoryNameFor(kind,entry))))]:CATEGORIES.filter(c=>c!=='仅供辨认');
  const themes=[...new Set(entries.flatMap(({kind,entry,suite})=>inSuite(suite,()=>catalogMeta(kind,entry).themes)))];
  const target=studio.workspace==='goals'||studio.workspace==='components';
  const scopes=target?`<div class="scope-filter" aria-label="修改范围">${buttons(categories.map(c=>[c,c==='全部'?'全部目标':c]),'studio-category',studio.category)}</div>${studio.category!=='全部'?`<button class="quiet-button only-scope" data-action="studio-only" aria-pressed="${studio.only}">${studio.only?'✓ ':''}仅修改此项</button>`:''}`:'';
  const modes=studio.workspace==='browse'?`<div class="content-tabs" aria-label="内容类型">${buttons([['all','全部'],['direct','多项方案'],['preset','推荐组合']],'studio-type',studio.type)}</div>`:'';
  const myTabs=mine?`<div class="mine-tabs">${buttons([['favorites','收藏'],['recent','最近复制'],['custom','新增与修改'],['saved','保存的组合']],'studio-mine',studio.mine)}</div>`:'';
  $('#catalog-controls').innerHTML=`${myTabs}${scopes}<div class="catalog-filter-row">${modes}${source}</div><details class="advanced-filters"><summary>主题与原分类</summary><div class="filter-tools">${recent?'':`<details class="filter-popover"><summary>${escapeHtml(studio.theme||'全部主题')} ⌄</summary><div>${buttons([['','全部主题'],...themes.map(x=>[x,x])],'studio-theme',studio.theme)}</div></details><button class="quiet-button" data-action="studio-legacy" aria-pressed="${studio.legacy}">${studio.legacy?'返回用途分类':'按原分类查看'}</button>`}<button class="quiet-button" data-action="studio-reset">重置筛选</button></div></details>${!target&&studio.legacy&&!recent?`<div class="scope-filter" aria-label="原分类">${buttons(categories.map(c=>[c,c]),'studio-category',studio.category)}</div>`:''}`;
}
async function studioAction(action,target) {
  if(action==='studio-clear-recent') {
    if(!await confirmAction('清空当前来源的最近复制记录？Prompt 正文、收藏和编辑不会被删除。'))return;
    for(const suite of (studio.source==='all'?['zhuangyuan','bangyan']:[studio.source]))if(app.states[suite])app.states[suite].recent=[];
    if(!await persist())return;
    render();return;
  }

  if(action==='studio-shortcut') {
    const value=target.dataset.value;
    if(['browse','goals','builder','mine','components'].includes(value))return studioAction('studio-workspace',target);
    studio.workspace='mine';studio.mine=value;studio.category='全部';studio.theme='';studio.type='all';app.searchQuery='';
    $('#search-input').value='';window.scrollTo(0,0);
  }
  if(action==='studio-workspace') {
    studio.workspace=target.dataset.value; app.searchQuery=''; studio.category='全部'; studio.theme='';studio.type='all';studio.only=false;studio.legacy=false;
    if(studio.workspace==='builder') {
      app.activeSuite='bangyan';app.meta.activeSuite='bangyan';app.quickViewSuite='bangyan';
      app.states.bangyan.activeMode='builder';app.states.bangyan.activeCategoryId='姿势穿搭场景';app.quickView='browse';app.searchAll=false;
      await persist();
    }
    window.scrollTo(0,0);
  }
  if(action==='studio-components'){studio.workspace='components';studio.source='bangyan';studio.type='component';studio.category='全部';studio.theme='';}
  if(action==='studio-only')studio.only=!studio.only;
  if(action==='studio-source'){studio.source=target.dataset.value;studio.category='全部';studio.only=false;}
  if(action==='studio-category'){studio.category=target.dataset.value;studio.only=false;}
  if(action==='studio-theme'){studio.theme=target.dataset.value;target.closest('details')?.removeAttribute('open');}
  if(action==='studio-type'){studio.type=target.dataset.value;target.closest('details')?.removeAttribute('open');}
  if(action==='studio-mine'){studio.mine=target.dataset.value;studio.category='全部';studio.type='all';studio.theme='';}
  if(action==='studio-legacy'){studio.legacy=!studio.legacy;studio.category='全部';}
  if(action==='studio-reset'){studio.only=false;studio.source='all';studio.category='全部';studio.theme='';studio.type='all';app.searchQuery='';}
  app.visibleLimit=PAGE_SIZE;render();
}
document.addEventListener('click',event=>{if(event.target.closest('[data-action="toggle-families"]')){groupSimilar=!groupSimilar;renderCatalog();}});
document.addEventListener('toggle',event=>{const el=event.target;if(!el.matches?.('details.prompt-family'))return;el.open?expandedFamilies.add(el.dataset.familyId):expandedFamilies.delete(el.dataset.familyId);el.querySelector('.family-disclosure').textContent=el.open?'收起同类内容':'展开逐条查看与复制';},true);
document.addEventListener('click', event=>document.querySelectorAll('.filter-popover[open]').forEach(menu=>{if(!menu.contains(event.target))menu.open=false;}));
document.addEventListener('keydown', event=>{
  if(event.key==='Escape')document.querySelectorAll('.filter-popover[open]').forEach(menu=>menu.open=false);
  const menu=event.target.closest('.filter-popover');
  if(menu&&['ArrowDown','ArrowUp','Home','End'].includes(event.key)) {
    event.preventDefault();menu.open=true;const buttons=[...menu.querySelectorAll('button')];let i=buttons.indexOf(document.activeElement);
    i=event.key==='Home'?0:event.key==='End'?buttons.length-1:(i+(event.key==='ArrowDown'?1:-1)+buttons.length)%buttons.length;buttons[i]?.focus();
  }
});
const detailDialog = $('#detail-dialog');
let detailBackdropPress = false;
const outsideDetail = event => {
  const bounds = detailDialog.getBoundingClientRect();
  return event.clientX < bounds.left || event.clientX >= bounds.right
    || event.clientY < bounds.top || event.clientY >= bounds.bottom;
};
detailDialog.addEventListener('pointerdown', event => {
  detailBackdropPress = event.button === 0 && event.target === detailDialog && outsideDetail(event);
});
detailDialog.addEventListener('pointercancel', () => { detailBackdropPress = false; });
detailDialog.addEventListener('click', event => {
  const dismiss = detailBackdropPress && event.target === detailDialog && outsideDetail(event);
  detailBackdropPress = false;
  if (dismiss) detailDialog.close();
});
detailDialog.addEventListener('close',()=>{detailBackdropPress=false;app.detail=null;saveBrowsingState();});

initialize().catch((error) => {
  console.error(error);
  $("#prompt-sections").innerHTML = '<div class="empty-state"><h3>正式数据暂时无法加载</h3><p>请通过本地 HTTP 服务或部署后的 HTTPS 地址打开此 PWA。</p></div>';
});
