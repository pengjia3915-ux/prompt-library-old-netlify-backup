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
  migrateLegacyPrototypeState,
  normalizeBuilder,
  normalizeFavoriteIds,
  normalizeRecent,
  searchMatches,
  selectBuilderComponent,
  removeBuilderComponent
} from "./suite-utils.js";

const APP_ASSET_VERSION = "2.1.0";
const PAGE_SIZE = 48;
const THEME_KEY = "prompt-library-prototype-theme";
const THEMES = new Set(["sage", "wine", "blue", "studio"]);
const THEME_COLORS = {
  sage: "#F3F5F2",
  wine: "#F5F2F2",
  blue: "#F3F5F7",
  studio: "#181B1A"
};

const BANGYAN_CATEGORIES = [
  { id: "原图处理", name: "原图处理", shortName: "原图处理", description: "保持人物身份与场景关系，处理原图中的遮挡、结构和画面问题。", order: 1 },
  { id: "发型发色", name: "发型发色", shortName: "发型发色", description: "按发型、发色和眼镜 slot 自由选择，不改变未选择的项目。", order: 2 },
  { id: "姿势穿搭场景", name: "姿势穿搭场景", shortName: "姿势穿搭场景", description: "姿势、穿搭、领口和环境完全由用户自由组合。", order: 3 }
];

const BANGYAN_MODES = [
  { id: "presets", label: "推荐组合" },
  { id: "builder", label: "自由拼装" },
  { id: "components", label: "单项库" }
];

const app = {
  defaults: { zhuangyuan: null, bangyan: null },
  states: { zhuangyuan: null, bangyan: null },
  meta: { schemaVersion: 2, migrationVersion: 0, activeSuite: "zhuangyuan", syncCode: "", lastSyncedAt: "" },
  activeSuite: "zhuangyuan",
  searchQuery: "",
  visibleLimit: PAGE_SIZE,
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
  return {
    version: 2,
    suite: "zhuangyuan",
    categories: clone(defaultData?.categories || []),
    prompts: [...mergedDefaults, ...customPrompts],
    customPrompts,
    activeCategoryId: validCategoryIds.has(source.activeCategoryId) ? source.activeCategoryId : defaultData?.categories?.[0]?.id || "",
    defaultDataVersion: defaultVersion,
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
  return {
    version: 2,
    suite: "bangyan",
    customPrompts,
    activeCategoryId: validCategoryIds.has(source.activeCategoryId) ? source.activeCategoryId : BANGYAN_CATEGORIES[0].id,
    activeMode,
    builder: normalizeBuilder(source.builder),
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

function bangyanPresets() {
  return (app.defaults.bangyan?.presets || []).filter((entry) => entry.enabled !== false);
}

function bangyanCustomPrompts() {
  return (app.states.bangyan?.customPrompts || []).filter((entry) => !entry.deletedAt);
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
  if (kind === "custom") return bangyanCustomPrompts().find((entry) => entry.id === id);
  return null;
}

function displayFor(kind, entry) {
  if (!entry) return { title: "", positive: "", negative: "", all: "" };
  if (kind === "preset") {
    const composed = composeBangyanPreset(entry, bangyanComponents());
    return { ...composed, all: composed.negative ? `${composed.positive}\n\n反向提示词：${composed.negative}` : composed.positive };
  }
  const positive = kind === "component" ? entry.positive : entry.prompt;
  const negative = kind === "component" ? entry.negative : entry.negativePrompt;
  return {
    title: entry.title,
    positive: String(positive || ""),
    negative: String(negative || ""),
    all: negative ? `${positive}\n\n反向提示词：${negative}` : String(positive || "")
  };
}

function categoryNameFor(kind, entry) {
  if (!entry) return "";
  if (kind === "prompt") return categoryById(entry.categoryId, "zhuangyuan")?.name || entry.categoryId;
  if (kind === "custom") return categoryById(entry.categoryId, "bangyan")?.name || entry.categoryId;
  return entry.category || "";
}

function subcategoryFor(kind, entry) {
  if (kind === "component") return entry.subcategory || "单项组件";
  if (kind === "preset") return "推荐组合";
  return kind === "custom" ? "自定义 Prompt" : "完整 Prompt";
}

function searchEntry(kind, entry) {
  const display = displayFor(kind, entry);
  const extra = kind === "preset"
    ? Object.values(entry.slots || {}).map((id) => bangyanComponents().find((component) => component.id === id)).filter(Boolean).flatMap((component) => [component.title, component.subcategory, ...(component.keywords || [])]).join(" ")
    : "";
  return searchMatches({
    ...entry,
    category: categoryNameFor(kind, entry),
    positive: display.positive,
    negative: display.negative
  }, app.searchQuery, extra);
}

function isFavorite(kind, id) {
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
    const leftDate = new Date(left.entry.updatedAt || left.entry.createdAt || 0).getTime();
    const rightDate = new Date(right.entry.updatedAt || right.entry.createdAt || 0).getTime();
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

async function copyEntry(kind, id, copyType = "all") {
  const entry = findEntry(kind, id);
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

function renderIntro() {
  const title = $("#intro-title");
  const description = $("#intro-description");
  if (app.activeSuite === "bangyan") {
    title.textContent = "榜眼：组件、组合与自由拼装。";
    description.textContent = "正式数据包含 90 个组件和 24 个推荐组合；preset 只引用组件，不复制成静态 Prompt。";
  } else {
    title.textContent = "状元：选一条旧站 Prompt，打开详情后复制。";
    description.textContent = "保留原站 251 条默认 Prompt，并与榜眼的组件、收藏和最近复制数据隔离。";
  }
}

function modeCount(mode, categoryId) {
  if (mode === "presets") return bangyanPresets().filter((entry) => entry.category === categoryId).length;
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

function renderCategoryTabs() {
  const state = currentState();
  const categories = categoryList();
  $("#category-tabs").innerHTML = categories
    .sort((left, right) => Number(left.order || 0) - Number(right.order || 0))
    .map((category) => {
      const count = app.activeSuite === "bangyan" ? modeCount(app.states.bangyan.activeMode, category.id) : zhuangyuanEntries().filter((entry) => entry.categoryId === category.id).length;
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
  } else {
    count = zhuangyuanEntries().filter((entry) => entry.categoryId === categoryId).length;
  }
  $("#category-eyebrow").textContent = app.activeSuite === "bangyan" ? "榜眼正式数据" : "状元旧站数据";
  $("#category-title").textContent = category?.name || "Prompt";
  $("#category-description").textContent = description;
  $("#category-count").textContent = `${count} 条`;
}

function renderEntryCard(kind, entry, { builderAction = false } = {}) {
  const display = displayFor(kind, entry);
  const favorite = isFavorite(kind, entry.id);
  const pinned = isPinned(kind, entry);
  const selected = kind === "component" && isBuilderSelected(entry.id);
  const categoryName = categoryNameFor(kind, entry);
  const subcategory = subcategoryFor(kind, entry);
  const id = escapeHtml(entry.id);
  const addBuilder = kind === "component" || kind === "preset";
  return `
    <article class="prompt-card ${pinned ? "is-pinned" : ""}" data-entry-kind="${kind}" data-entry-id="${id}">
      <div class="card-topline">
        <div class="card-title-block">
          <h3><button class="entry-title" type="button" data-action="open-detail" data-kind="${kind}" data-id="${id}">${escapeHtml(entry.title)}</button></h3>
          <span>${escapeHtml(categoryName)} · ${escapeHtml(subcategory)}${pinned ? " · 已置顶" : ""}${favorite ? " · 已收藏" : ""}</span>
        </div>
        <button class="favorite-button ${favorite ? "is-active" : ""}" type="button" data-action="toggle-favorite" data-kind="${kind}" data-id="${id}" aria-label="${favorite ? "取消收藏" : "收藏"}">${favorite ? "★" : "☆"}</button>
      </div>
      <p class="card-preview">${escapeHtml(display.positive)}</p>
      <div class="card-actions">
        ${builderAction ? `<button class="text-action ${selected ? "is-selected" : ""}" type="button" data-action="select-component" data-id="${id}">${selected ? "已加入" : "加入拼装"}</button>` : ""}
        ${addBuilder && !builderAction ? `<button class="text-action" type="button" data-action="add-to-builder" data-kind="${kind}" data-id="${id}">放入拼装区</button>` : ""}
        ${(kind === "prompt" || kind === "custom") ? `<button class="text-action pin-action ${pinned ? "is-active" : ""}" type="button" data-action="toggle-pin" data-kind="${kind}" data-id="${id}">${pinned ? "取消置顶" : "置顶"}</button>` : ""}
        <button class="text-action is-copy" type="button" data-action="copy-entry" data-kind="${kind}" data-id="${id}" data-copy-type="all">复制</button>
        <details class="entry-menu">
          <summary>更多</summary>
          <div class="entry-menu-panel">
            <button type="button" data-action="copy-entry" data-kind="${kind}" data-id="${id}" data-copy-type="positive">复制正向</button>
            <button type="button" data-action="copy-entry" data-kind="${kind}" data-id="${id}" data-copy-type="negative">复制反向</button>
            <button type="button" data-action="copy-entry" data-kind="${kind}" data-id="${id}" data-copy-type="all">复制全部</button>
            <button type="button" data-action="toggle-favorite" data-kind="${kind}" data-id="${id}">${favorite ? "取消收藏" : "收藏"}</button>
            ${addBuilder ? `<button type="button" data-action="add-to-builder" data-kind="${kind}" data-id="${id}">放入拼装区</button>` : ""}
            ${(kind === "prompt" || kind === "custom") ? `<button type="button" data-action="edit-prompt" data-kind="${kind}" data-id="${id}">编辑</button><button class="is-danger" type="button" data-action="delete-prompt" data-kind="${kind}" data-id="${id}">删除</button>` : ""}
          </div>
        </details>
      </div>
    </article>
  `;
}

function renderList(title, items, { builderAction = false } = {}) {
  const visible = items.slice(0, app.visibleLimit);
  return `
    <section class="prompt-section">
      <div class="section-title-row"><h3>${escapeHtml(title)}</h3><span>${items.length} 条</span></div>
      <div class="prompt-list">${visible.map(({ kind, entry }) => renderEntryCard(kind, entry, { builderAction })).join("")}</div>
      ${visible.length < items.length ? `<div class="empty-state compact-load-more"><p>已显示 ${visible.length} / ${items.length} 条</p><button class="primary-button" type="button" data-action="load-more">继续加载</button></div>` : ""}
    </section>
  `;
}

function renderCustomSection() {
  if (app.activeSuite !== "bangyan") return "";
  const state = app.states.bangyan;
  const items = bangyanCustomPrompts()
    .filter((entry) => entry.categoryId === state.activeCategoryId)
    .filter((entry) => searchEntry("custom", entry))
    .map((entry) => ({ kind: "custom", entry }));
  return items.length ? renderList("自定义 Prompt", items) : "";
}

function isBuilderSelected(id) {
  const builder = normalizeBuilder(app.states.bangyan.builder);
  return [
    ...builder.original,
    ...BANGYAN_SYNTHESIS_ORDER.filter((slot) => slot !== "original").map((slot) => builder[slot]).filter(Boolean)
  ].includes(id);
}

function renderBuilder() {
  const state = app.states.bangyan;
  const builder = normalizeBuilder(state.builder);
  const components = bangyanComponents();
  const byId = new Map(components.map((component) => [component.id, component]));
  const selectedIds = [
    ...builder.original,
    ...BANGYAN_SYNTHESIS_ORDER.filter((slot) => slot !== "original").map((slot) => builder[slot]).filter(Boolean)
  ];
  const selected = [...new Set(selectedIds)].map((id) => byId.get(id)).filter(Boolean);
  const result = composeBangyanSelection({ components, selection: builder });
  const available = components
    .filter((component) => component.category === state.activeCategoryId)
    .filter((component) => searchEntry("component", component))
    .sort((left, right) => String(left.subcategory).localeCompare(String(right.subcategory), "zh-CN") || String(left.title).localeCompare(String(right.title), "zh-CN"));
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
          <button class="primary-button" type="button" data-action="copy-builder" data-copy-type="all" ${result.positive ? "" : "disabled"}>复制全部</button>
        </div>
      </div>
    </section>
    ${renderList("当前分类组件", available.map((entry) => ({ kind: "component", entry })), { builderAction: true })}
  `;
}

function renderContent() {
  const state = currentState();
  let content = "";
  if (app.activeSuite === "zhuangyuan") {
    const items = sortEntries(zhuangyuanEntries()
      .filter((entry) => entry.categoryId === state.activeCategoryId)
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
  } else {
    const items = bangyanComponents()
      .filter((entry) => entry.category === state.activeCategoryId)
      .filter((entry) => searchEntry("component", entry))
      .map((entry) => ({ kind: "component", entry }));
    content = items.length ? renderList("单项组件", items) : `<div class="empty-state"><h3>没有匹配的组件</h3><p>换一个关键词，或清空搜索条件。</p></div>`;
  }
  $("#prompt-sections").innerHTML = content + renderCustomSection();
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
  renderIntro();
  renderModeTabs();
  renderCategoryTabs();
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

function openPromptDialog(entryId = "", kind = app.activeSuite === "bangyan" ? "custom" : "prompt") {
  const entry = entryId ? findEntry(kind, entryId) : null;
  if (entry && kind !== "prompt" && kind !== "custom") return;
  $("#prompt-dialog-title").textContent = entry ? "编辑 Prompt" : "新增 Prompt";
  $("#prompt-suite-hint").textContent = app.activeSuite === "bangyan" ? "榜眼自定义内容 · 与正式组件和状元数据隔离" : "状元自定义内容 · 保留旧站数据结构";
  $("#prompt-id").value = entry?.id || "";
  $("#prompt-kind").value = kind;
  $("#prompt-title").value = entry?.title || "";
  $("#prompt-positive").value = entry?.prompt || "";
  $("#prompt-negative").value = entry?.negativePrompt || "";
  $("#prompt-pinned").checked = Boolean(entry?.pinned);
  fillCategoryOptions(entry?.categoryId || currentState().activeCategoryId);
  $("#prompt-dialog").showModal();
  window.setTimeout(() => $("#prompt-title").focus(), 0);
}

async function savePrompt() {
  const state = currentState();
  const id = $("#prompt-id").value;
  const title = $("#prompt-title").value.trim();
  const categoryId = $("#prompt-category").value;
  const prompt = $("#prompt-positive").value.trim();
  const negativePrompt = $("#prompt-negative").value.trim();
  const pinned = $("#prompt-pinned").checked;
  if (!title || !prompt || !categoryId) return;
  const now = nowIso();
  if (app.activeSuite === "bangyan") {
    const existing = state.customPrompts.find((entry) => entry.id === id);
    if (existing) {
      Object.assign(existing, { title, categoryId, prompt, negativePrompt, pinned, updatedAt: now });
    } else {
      state.customPrompts.push({ id: makeId("bangyan-custom"), title, categoryId, prompt, negativePrompt, pinned, pinOrder: pinned ? Date.now() : 0, createdAt: now, updatedAt: now });
    }
  } else {
    const existing = state.prompts.find((entry) => entry.id === id);
    if (existing) {
      Object.assign(existing, { title, categoryId, prompt, negativePrompt, pinned, pinOrder: pinned ? existing.pinOrder || Date.now() : 0, updatedAt: now });
    } else {
      state.prompts.push({ id: makeId("zhuangyuan-custom"), title, categoryId, prompt, negativePrompt, pinned, pinOrder: pinned ? Date.now() : 0, createdAt: now, updatedAt: now });
    }
    syncZhuangyuanCustomPrompts();
  }
  state.activeCategoryId = categoryId;
  $("#prompt-dialog").close();
  await persist();
  render();
  showToast(id ? "Prompt 已更新" : "Prompt 已保存");
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
  app.detail = { kind, id };
  $("#detail-eyebrow").textContent = `${categoryNameFor(kind, entry)} · ${subcategoryFor(kind, entry)}`;
  $("#detail-title").textContent = display.title;
  $("#detail-meta").textContent = kind === "preset" ? "推荐组合 · 可直接复制，也可放入自由拼装区继续修改" : kind === "component" ? `${entry.keywords?.join(" · ") || "单项组件"}` : "可编辑的自定义内容";
  $("#detail-positive").textContent = display.positive;
  $("#detail-negative").textContent = display.negative;
  $("#detail-negative-block").hidden = !display.negative;
  $("#detail-actions").innerHTML = `
    <button class="quiet-button" type="button" data-action="detail-copy" data-copy-type="positive">复制正向</button>
    <button class="quiet-button" type="button" data-action="detail-copy" data-copy-type="negative" ${display.negative ? "" : "disabled"}>复制反向</button>
    <button class="primary-button" type="button" data-action="detail-copy" data-copy-type="all">复制全部</button>
    ${(kind === "component" || kind === "preset") ? `<button class="quiet-button" type="button" data-action="detail-add-builder">放入拼装区</button>` : ""}
  `;
  $("#detail-dialog").showModal();
}

async function addToBuilder(kind, id) {
  const entry = findEntry(kind, id);
  if (!entry || app.activeSuite !== "bangyan") return;
  if (kind === "component") {
    app.states.bangyan.builder = selectBuilderComponent(app.states.bangyan.builder, entry);
  } else if (kind === "preset") {
    let builder = emptyBuilder();
    for (const componentId of Object.values(entry.slots || {}).filter(Boolean)) {
      const component = bangyanComponents().find((item) => item.id === componentId);
      if (component) builder = selectBuilderComponent(builder, component);
    }
    app.states.bangyan.builder = builder;
  }
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
  await persist();
  render();
}

async function resetBuilder() {
  app.states.bangyan.builder = emptyBuilder();
  await persist();
  render();
}

async function copyBuilder(copyType) {
  const result = composeBangyanSelection({ components: bangyanComponents(), selection: app.states.bangyan.builder });
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

function openSyncDialog() {
  $("#sync-code").value = formatSyncCode(app.meta.syncCode);
  renderSyncStatus();
  $("#sync-dialog").showModal();
}

function suiteSyncState(suite) {
  const state = app.states[suite];
  if (suite === "zhuangyuan") {
    return { prompts: state.prompts, customPrompts: state.customPrompts, favoriteIds: state.favoriteIds, recent: state.recent };
  }
  return { customPrompts: state.customPrompts, favoriteIds: state.favoriteIds, recent: state.recent, builder: state.builder };
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
      app.states.zhuangyuan.favoriteIds = normalizeFavoriteIds(remoteZhuangyuan.favoriteIds);
      app.states.zhuangyuan.recent = normalizeRecent(remoteZhuangyuan.recent);
    }
    if (remoteBangyan) {
      app.states.bangyan.customPrompts = (remoteBangyan.customPrompts || []).map((entry) => normalizeCustomPrompt(entry, "bangyan")).filter(Boolean);
      app.states.bangyan.favoriteIds = normalizeFavoriteIds(remoteBangyan.favoriteIds);
      app.states.bangyan.recent = normalizeRecent(remoteBangyan.recent);
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
    app.visibleLimit = PAGE_SIZE;
    await persist();
    render();
  } else if (action === "change-mode") {
    if (BANGYAN_MODES.some((mode) => mode.id === target.dataset.mode)) {
      app.states.bangyan.activeMode = target.dataset.mode;
      app.visibleLimit = PAGE_SIZE;
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
  } else if (action === "select-component") {
    const component = bangyanComponents().find((entry) => entry.id === id);
    if (component) {
      app.states.bangyan.builder = selectBuilderComponent(app.states.bangyan.builder, component);
      await persist();
      render();
      showToast("已加入拼装区");
    }
  } else if (action === "remove-builder") {
    await removeFromBuilder(id);
  } else if (action === "reset-builder") {
    await resetBuilder();
  } else if (action === "copy-builder") {
    await copyBuilder(target.dataset.copyType || "all");
  } else if (action === "add-to-builder") {
    await addToBuilder(kind, id);
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
