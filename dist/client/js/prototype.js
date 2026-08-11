import {
  createSyncCode,
  formatSyncCode,
  isValidSyncCode,
  normalizeSyncCode,
  syncKnowledge
} from "./sync.js";

const DB_NAME = "prompt-library-img2img-prototype";
const DB_VERSION = 1;
const STORE_NAME = "state";
const STATE_KEY = "prototype-state";
const THEME_KEY = "prompt-library-prototype-theme";
const PAGE_SIZE = 24;
const THEMES = new Set(["sage", "wine", "blue", "studio"]);
const THEME_COLORS = {
  sage: "#F3F5F2",
  wine: "#F5F2F2",
  blue: "#F3F5F7",
  studio: "#181B1A"
};

const app = {
  categories: [],
  prompts: [],
  activeCategoryId: "",
  expandedIds: new Set(),
  visibleLimit: PAGE_SIZE,
  syncCode: "",
  lastSyncedAt: "",
  defaultDataVersion: 0,
  syncBusy: false,
  theme: THEMES.has(document.documentElement.dataset.theme) ? document.documentElement.dataset.theme : "sage",
  toastTimer: null
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

function makeId() {
  return crypto.randomUUID?.() || `prompt-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function openDatabase() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = () => {
      if (!request.result.objectStoreNames.contains(STORE_NAME)) {
        request.result.createObjectStore(STORE_NAME);
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

async function readState() {
  const database = await openDatabase();
  return new Promise((resolve, reject) => {
    const transaction = database.transaction(STORE_NAME, "readonly");
    const request = transaction.objectStore(STORE_NAME).get(STATE_KEY);
    request.onsuccess = () => resolve(request.result || null);
    request.onerror = () => reject(request.error);
    transaction.oncomplete = () => database.close();
  });
}

async function writeState() {
  const database = await openDatabase();
  return new Promise((resolve, reject) => {
    const transaction = database.transaction(STORE_NAME, "readwrite");
    transaction.objectStore(STORE_NAME).put({
      categories: app.categories,
      prompts: app.prompts,
      activeCategoryId: app.activeCategoryId,
      syncCode: app.syncCode,
      lastSyncedAt: app.lastSyncedAt,
      defaultDataVersion: app.defaultDataVersion
    }, STATE_KEY);
    transaction.oncomplete = () => {
      database.close();
      resolve();
    };
    transaction.onerror = () => reject(transaction.error);
  });
}

function currentCategory() {
  return app.categories.find((category) => category.id === app.activeCategoryId) || app.categories[0];
}

function categoryEntries(categoryId = app.activeCategoryId) {
  return app.prompts
    .filter((entry) => entry.categoryId === categoryId && !entry.deletedAt)
    .sort((left, right) => {
      const leftDefault = String(left.id).startsWith("default-");
      const rightDefault = String(right.id).startsWith("default-");
      if (leftDefault !== rightDefault) return leftDefault ? 1 : -1;
      if (leftDefault) return String(left.id).localeCompare(String(right.id));
      return new Date(right.updatedAt) - new Date(left.updatedAt);
    });
}

function sortPinned(entries) {
  return [...entries].sort((left, right) => {
    const pinDifference = Number(left.pinOrder || 0) - Number(right.pinOrder || 0);
    if (pinDifference !== 0) return pinDifference;
    return new Date(right.updatedAt) - new Date(left.updatedAt);
  });
}

function composePrompt(entry) {
  const positive = entry.prompt.trim();
  const negative = entry.negativePrompt?.trim();
  return negative ? `${positive}\n\n反向提示词：${negative}` : positive;
}

function showToast(message) {
  const toast = $("#toast");
  toast.textContent = message;
  toast.classList.add("is-visible");
  window.clearTimeout(app.toastTimer);
  app.toastTimer = window.setTimeout(() => toast.classList.remove("is-visible"), 1800);
}

function applyTheme(theme, { save = false } = {}) {
  const nextTheme = THEMES.has(theme) ? theme : "sage";
  app.theme = nextTheme;
  document.documentElement.dataset.theme = nextTheme;
  document.querySelector('meta[name="theme-color"]')?.setAttribute("content", THEME_COLORS[nextTheme]);
  if (save) {
    try {
      localStorage.setItem(THEME_KEY, nextTheme);
    } catch {}
  }
  document.querySelectorAll(".theme-option").forEach((option) => {
    const active = option.dataset.theme === nextTheme;
    option.classList.toggle("is-active", active);
    option.setAttribute("aria-checked", String(active));
  });
}

async function copyText(value) {
  try {
    await navigator.clipboard.writeText(value);
  } catch {
    const textarea = document.createElement("textarea");
    textarea.value = value;
    textarea.style.position = "fixed";
    textarea.style.opacity = "0";
    document.body.append(textarea);
    textarea.select();
    document.execCommand("copy");
    textarea.remove();
  }
}

function renderTabs() {
  $("#category-tabs").innerHTML = app.categories
    .sort((left, right) => Number(left.order) - Number(right.order))
    .map((category) => `
      <button class="tab-button ${category.id === app.activeCategoryId ? "is-active" : ""}" type="button" data-action="change-category" data-id="${escapeHtml(category.id)}">
        ${escapeHtml(category.shortName || category.name)}
      </button>
    `)
    .join("");
}

function promptCard(entry, category) {
  const expanded = app.expandedIds.has(entry.id);
  const privatePreview = category.private && !expanded;
  const preview = privatePreview
    ? '<div class="privacy-preview">正文已隐藏，点击展开后查看。</div>'
    : `<p class="card-preview">${escapeHtml(entry.prompt)}</p>`;

  const detail = expanded
    ? `
      <div class="card-detail">
        <div class="prompt-block">
          <strong>完整 PROMPT</strong>
          <p>${escapeHtml(entry.prompt)}</p>
        </div>
        ${entry.negativePrompt ? `
          <div class="prompt-block is-negative">
            <strong>反向提示词</strong>
            <p>${escapeHtml(entry.negativePrompt)}</p>
          </div>
        ` : ""}
      </div>
    `
    : "";

  return `
    <article class="prompt-card ${entry.pinned ? "is-pinned" : ""}">
      <div class="card-topline">
        <div class="card-title-block">
          <h3>${escapeHtml(entry.title)}</h3>
          <span>${entry.pinned ? "已在本栏目置顶" : escapeHtml(category.name)}</span>
        </div>
        <button class="pin-button ${entry.pinned ? "is-active" : ""}" type="button" data-action="toggle-pin" data-id="${escapeHtml(entry.id)}" aria-label="${entry.pinned ? "取消置顶" : "置顶"}">
          ${entry.pinned ? "●" : "○"}
        </button>
      </div>
      ${preview}
      ${detail}
      <div class="card-actions">
        ${expanded ? `
          <button class="text-action" type="button" data-action="edit-prompt" data-id="${escapeHtml(entry.id)}">编辑</button>
          <button class="text-action is-danger" type="button" data-action="delete-prompt" data-id="${escapeHtml(entry.id)}">删除</button>
        ` : ""}
        <button class="text-action" type="button" data-action="toggle-expand" data-id="${escapeHtml(entry.id)}">${expanded ? "收起" : "展开"}</button>
        <button class="text-action is-copy" type="button" data-action="copy-prompt" data-id="${escapeHtml(entry.id)}">复制</button>
      </div>
    </article>
  `;
}

function sectionTemplate(title, entries, category) {
  if (!entries.length) return "";
  return `
    <section class="prompt-section">
      <div class="section-title-row">
        <h3>${escapeHtml(title)}</h3>
        <span>${entries.length} 条</span>
      </div>
      <div class="prompt-list">
        ${entries.map((entry) => promptCard(entry, category)).join("")}
      </div>
    </section>
  `;
}

function renderPrompts() {
  const category = currentCategory();
  const entries = categoryEntries(category.id);
  const pinned = sortPinned(entries.filter((entry) => entry.pinned));
  const regular = entries.filter((entry) => !entry.pinned);
  const visible = [...pinned, ...regular].slice(0, app.visibleLimit);
  const visiblePinned = visible.filter((entry) => entry.pinned);
  const visibleRegular = visible.filter((entry) => !entry.pinned);

  $("#category-title").textContent = category.name;
  $("#category-description").textContent = category.description;
  $("#category-count").textContent = `${entries.length} 条`;
  $("#category-eyebrow").textContent = category.private ? "内容默认隐藏" : "当前栏目";

  $("#prompt-sections").innerHTML = entries.length
    ? `${sectionTemplate("置顶", visiblePinned, category)}${sectionTemplate("其他 Prompt", visibleRegular, category)}${visible.length < entries.length ? `
      <div class="empty-state compact-load-more">
        <p>已显示 ${visible.length} / ${entries.length} 条</p>
        <button class="primary-button" type="button" data-action="load-more">继续加载</button>
      </div>` : ""}`
    : `
      <div class="empty-state">
        <h3>这个栏目还没有 Prompt</h3>
        <p>新增后会保存在当前设备的独立原型数据中。</p>
        <button class="primary-button" type="button" data-action="add-prompt">＋ 新增 Prompt</button>
      </div>
    `;
}

function render() {
  renderTabs();
  renderPrompts();
}

function fillCategoryOptions(selectedId) {
  $("#prompt-category").innerHTML = app.categories
    .map((category) => `<option value="${escapeHtml(category.id)}" ${category.id === selectedId ? "selected" : ""}>${escapeHtml(category.name)}</option>`)
    .join("");
}

function openPromptDialog(entryId = "") {
  const entry = app.prompts.find((item) => item.id === entryId);
  $("#prompt-dialog-title").textContent = entry ? "编辑 Prompt" : "新增 Prompt";
  $("#prompt-id").value = entry?.id || "";
  $("#prompt-title").value = entry?.title || "";
  $("#prompt-positive").value = entry?.prompt || "";
  $("#prompt-negative").value = entry?.negativePrompt || "";
  $("#prompt-pinned").checked = Boolean(entry?.pinned);
  fillCategoryOptions(entry?.categoryId || app.activeCategoryId);
  $("#prompt-dialog").showModal();
  window.setTimeout(() => $("#prompt-title").focus(), 0);
}

async function savePrompt() {
  const id = $("#prompt-id").value;
  const title = $("#prompt-title").value.trim();
  const categoryId = $("#prompt-category").value;
  const prompt = $("#prompt-positive").value.trim();
  const negativePrompt = $("#prompt-negative").value.trim();
  const pinned = $("#prompt-pinned").checked;
  if (!title || !prompt || !categoryId) return;

  const now = new Date().toISOString();
  const existing = app.prompts.find((entry) => entry.id === id);
  if (existing) {
    Object.assign(existing, {
      title,
      categoryId,
      prompt,
      negativePrompt,
      pinned,
      pinOrder: pinned ? existing.pinOrder || Date.now() : 0,
      updatedAt: now
    });
    showToast("Prompt 已更新");
  } else {
    app.prompts.push({
      id: makeId(),
      title,
      categoryId,
      prompt,
      negativePrompt,
      pinned,
      pinOrder: pinned ? Date.now() : 0,
      createdAt: now,
      updatedAt: now
    });
    showToast("Prompt 已保存");
  }

  app.activeCategoryId = categoryId;
  $("#prompt-dialog").close();
  await writeState();
  render();
}

async function togglePin(entryId) {
  const entry = app.prompts.find((item) => item.id === entryId);
  if (!entry) return;
  entry.pinned = !entry.pinned;
  entry.pinOrder = entry.pinned ? Date.now() : 0;
  entry.updatedAt = new Date().toISOString();
  await writeState();
  renderPrompts();
  showToast(entry.pinned ? `已置顶到「${currentCategory().name}」` : "已取消置顶");
}

async function deletePrompt(entryId) {
  const entry = app.prompts.find((item) => item.id === entryId);
  if (!entry || !window.confirm(`确定删除「${entry.title}」吗？`)) return;
  entry.deletedAt = new Date().toISOString();
  entry.updatedAt = entry.deletedAt;
  app.expandedIds.delete(entryId);
  await writeState();
  renderPrompts();
  showToast("Prompt 已删除");
}

function openSyncDialog() {
  $("#sync-code").value = formatSyncCode(app.syncCode);
  renderSyncStatus();
  $("#sync-dialog").showModal();
}

function renderSyncStatus(message = "") {
  const status = $("#sync-status");
  if (!status) return;
  if (message) status.textContent = message;
  else if (app.syncBusy) status.textContent = "正在安全合并两台设备的数据……";
  else if (app.lastSyncedAt) status.textContent = `已启用同步 · 上次更新 ${new Date(app.lastSyncedAt).toLocaleString("zh-CN")}`;
  else if (isValidSyncCode(app.syncCode)) status.textContent = "同步码已保存，可以在另一台设备填写同一个码。";
  else status.textContent = "尚未设置同步码。";
}

function mergeDefaults(defaults, storedPrompts, storedVersion) {
  const defaultsById = new Map(defaults.map((entry) => [entry.id, entry]));
  const storedById = new Map((storedPrompts || []).map((entry) => [entry.id, entry]));
  const mergedDefaults = defaults.map((entry) => {
    const stored = storedById.get(entry.id);
    if (!stored) return entry;
    if (Number(storedVersion || 0) < app.defaultDataVersion) {
      return { ...entry, pinned: Boolean(stored.pinned), pinOrder: Number(stored.pinOrder || 0), deletedAt: stored.deletedAt };
    }
    return stored;
  });
  const custom = (storedPrompts || []).filter((entry) => !defaultsById.has(entry.id));
  return [...mergedDefaults, ...custom];
}

async function syncNow() {
  const fieldCode = normalizeSyncCode($("#sync-code").value);
  const code = fieldCode || normalizeSyncCode(app.syncCode);
  if (!isValidSyncCode(code)) {
    renderSyncStatus("请先生成或填写正确的 32 位同步码。");
    return;
  }
  app.syncCode = code;
  app.syncBusy = true;
  renderSyncStatus();
  try {
    const result = await syncKnowledge({ code, entries: app.prompts });
    app.prompts = result.entries;
    app.lastSyncedAt = result.syncedAt;
    await writeState();
    render();
    renderSyncStatus();
    showToast("手机与电脑数据已同步");
  } catch (error) {
    renderSyncStatus(error.message || "同步失败，请稍后重试");
  } finally {
    app.syncBusy = false;
    renderSyncStatus();
  }
}

function openThemeDialog() {
  applyTheme(app.theme);
  $("#theme-dialog").showModal();
}

async function initialize() {
  const [defaults, stored] = await Promise.all([
    fetch("data/img2img-prompts.json", { cache: "no-store" }).then((response) => {
      if (!response.ok) throw new Error("原型数据加载失败");
      return response.json();
    }),
    readState()
  ]);

  app.defaultDataVersion = Number(defaults.version || 1);
  app.categories = defaults.categories;
  app.prompts = stored ? mergeDefaults(defaults.prompts, stored.prompts, stored.defaultDataVersion) : defaults.prompts;
  app.activeCategoryId = stored?.activeCategoryId && app.categories.some((category) => category.id === stored.activeCategoryId)
    ? stored.activeCategoryId
    : app.categories[0]?.id;
  app.syncCode = typeof stored?.syncCode === "string" ? stored.syncCode : "";
  app.lastSyncedAt = typeof stored?.lastSyncedAt === "string" ? stored.lastSyncedAt : "";
  applyTheme(app.theme);

  await writeState();
  render();
  if ("serviceWorker" in navigator) navigator.serviceWorker.register("service-worker.js").catch(() => {});
}

document.addEventListener("click", async (event) => {
  const target = event.target.closest("[data-action]");
  if (!target) return;
  const action = target.dataset.action;
  const id = target.dataset.id;

  if (action === "change-category") {
    app.activeCategoryId = id;
    app.expandedIds.clear();
    app.visibleLimit = PAGE_SIZE;
    await writeState();
    render();
  } else if (action === "add-prompt") {
    openPromptDialog();
  } else if (action === "edit-prompt") {
    openPromptDialog(id);
  } else if (action === "toggle-pin") {
    await togglePin(id);
  } else if (action === "toggle-expand") {
    app.expandedIds.has(id) ? app.expandedIds.delete(id) : app.expandedIds.add(id);
    renderPrompts();
  } else if (action === "copy-prompt") {
    const entry = app.prompts.find((item) => item.id === id);
    if (!entry) return;
    await copyText(composePrompt(entry));
    showToast("完整 Prompt 已复制");
  } else if (action === "delete-prompt") {
    await deletePrompt(id);
  } else if (action === "load-more") {
    app.visibleLimit += PAGE_SIZE;
    renderPrompts();
  } else if (action === "open-sync") {
    openSyncDialog();
  } else if (action === "generate-sync-code") {
    app.syncCode = createSyncCode();
    $("#sync-code").value = formatSyncCode(app.syncCode);
    app.lastSyncedAt = "";
    await writeState();
    renderSyncStatus();
    showToast("已生成同步码");
  } else if (action === "copy-sync-code") {
    const code = normalizeSyncCode($("#sync-code").value || app.syncCode);
    if (!isValidSyncCode(code)) return renderSyncStatus("请先生成或填写正确的同步码。");
    await copyText(formatSyncCode(code));
    showToast("同步码已复制");
  } else if (action === "sync-now") {
    await syncNow();
  } else if (action === "open-theme") {
    openThemeDialog();
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

$("#prompt-category").addEventListener("change", () => {
  const existing = app.prompts.find((entry) => entry.id === $("#prompt-id").value);
  if (existing && existing.categoryId !== $("#prompt-category").value) {
    $("#prompt-pinned").checked = false;
  }
});

$("#sync-form").addEventListener("submit", async (event) => {
  event.preventDefault();
  const code = normalizeSyncCode($("#sync-code").value);
  if (!isValidSyncCode(code)) return renderSyncStatus("同步码应为 32 位字符，请检查后再保存。");
  app.syncCode = code;
  await writeState();
  renderSyncStatus();
  showToast("同步码已保存");
});

initialize().catch((error) => {
  console.error(error);
  $("#prompt-sections").innerHTML = '<div class="empty-state"><h3>原型暂时无法加载</h3><p>请通过本地服务器打开这个页面。</p></div>';
});
