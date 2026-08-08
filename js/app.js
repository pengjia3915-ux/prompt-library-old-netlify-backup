import { loadState, saveState, normalizeImportedState } from "./db.js";
import { buildPrompt, summarizeSelection } from "./prompt-builder.js";
import { mergeTemplates, describeTemplate } from "./templates.js";
import {
  DEFAULT_FIXED_REQUIREMENTS,
  normalizeFixedRequirements,
  createBackup,
  validateBackup,
  mergeBackup
} from "./settings.js";
import {
  createSyncCode,
  formatSyncCode,
  isValidSyncCode,
  mergeKnowledgeEntries,
  normalizeSyncCode,
  syncKnowledge
} from "./sync.js";

const $ = (selector) => document.querySelector(selector);
const $$ = (selector) => [...document.querySelectorAll(selector)];
const APP_ASSET_VERSION = "1.2.0";

const app = {
  config: { groups: [] },
  presets: [],
  user: null,
  selectedIds: new Set(),
  view: "home",
  promptExpanded: false,
  editingTemplateId: null,
  editingKeywordId: null,
  editingKnowledgeId: null,
  syncBusy: false,
  toastTimer: null
};

function escapeHtml(value) {
  return String(value ?? "").replace(/[&<>"']/g, (character) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;"
  })[character]);
}

function slugify(value) {
  const slug = String(value || "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9\u4e00-\u9fa5]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 24);
  return slug || `keyword-${Date.now()}`;
}

function normalizeConfig(config) {
  const groups = Array.isArray(config?.groups) ? config.groups : [];
  return {
    groups: groups
      .filter((group) => group && group.id && group.name)
      .map((group) => ({
        id: String(group.id),
        name: String(group.name),
        multiple: Boolean(group.multiple),
        items: Array.isArray(group.items) ? group.items.filter((item) => item?.id && (item.label || item.text)) : []
      }))
  };
}

function groupById(groupId) {
  return app.config.groups.find((group) => group.id === groupId) || app.config.groups[app.config.groups.length - 1];
}

function normalizeGroupId(groupId) {
  return app.config.groups.some((group) => group.id === groupId) ? groupId : (app.config.groups[0]?.id || "other");
}

function baseItems() {
  return app.config.groups.flatMap((group) => group.items.map((item) => ({
    ...item,
    id: String(item.id),
    label: String(item.label || item.text),
    text: String(item.text || item.label),
    group: group.id,
    groupName: group.name,
    builtIn: true
  })));
}

function effectiveItems({ includeHidden = false } = {}) {
  const deleted = new Set(app.user?.deletedKeywordIds || []);
  const overrides = app.user?.keywordOverrides || {};
  const defaultItems = baseItems()
    .filter((item) => !deleted.has(item.id))
    .map((item) => ({ ...item, ...(overrides[item.id] || {}) }));
  const customItems = (app.user?.customKeywords || [])
    .filter((item) => item?.id && !deleted.has(item.id))
    .map((item) => ({ ...item, builtIn: false }));

  return [...defaultItems, ...customItems]
    .map((item) => {
      const group = groupById(normalizeGroupId(item.group));
      return {
        ...item,
        group: group?.id || item.group,
        groupName: group?.name || "其他",
        label: String(item.label || item.text || item.id),
        text: String(item.text || item.label || item.id),
        order: Number.isFinite(Number(item.order)) ? Number(item.order) : 999,
        featured: Boolean(item.featured),
        hidden: Boolean(item.hidden)
      };
    })
    .filter((item) => includeHidden || !item.hidden)
    .sort((a, b) => a.order - b.order || a.label.localeCompare(b.label, "zh-CN"));
}

function itemMap({ includeHidden = false } = {}) {
  return new Map(effectiveItems({ includeHidden }).map((item) => [item.id, item]));
}

function featuredItems() {
  const order = Array.isArray(app.user.featuredOrder) ? app.user.featuredOrder : [];
  const orderMap = new Map(order.map((id, index) => [id, index]));
  return effectiveItems()
    .filter((item) => item.featured)
    .sort((a, b) => (orderMap.get(a.id) ?? 9999) - (orderMap.get(b.id) ?? 9999) || a.order - b.order);
}

function currentFixedRequirements() {
  return normalizeFixedRequirements(app.user.fixedRequirements);
}

function currentPrompt() {
  return buildPrompt({
    groups: app.config.groups,
    items: effectiveItems({ includeHidden: true }),
    selectedIds: [...app.selectedIds],
    fixedRequirements: currentFixedRequirements()
  });
}

function currentTemplates() {
  return mergeTemplates(app.presets, app.user);
}

function persist() {
  if (!app.user) return;
  app.user.currentSelection = [...app.selectedIds];
  app.user.currentFixedIds = currentFixedRequirements().filter((item) => item.enabled !== false).map((item) => item.id);
  saveState(app.user).catch(() => showToast("本地保存失败，请稍后重试"));
}

function showToast(message) {
  const toast = $("#toast");
  if (!toast) return;
  window.clearTimeout(app.toastTimer);
  toast.textContent = message;
  toast.classList.add("is-visible");
  app.toastTimer = window.setTimeout(() => toast.classList.remove("is-visible"), 2100);
}

function formatDate(value) {
  if (!value) return "刚刚";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "刚刚";
  return new Intl.DateTimeFormat("zh-CN", { month: "numeric", day: "numeric", hour: "2-digit", minute: "2-digit" }).format(date);
}

function renderChip(item, size = "") {
  const selected = app.selectedIds.has(item.id);
  return `<button class="chip ${size} ${selected ? "is-selected" : ""}" type="button" data-action="select-keyword" data-id="${escapeHtml(item.id)}" aria-pressed="${selected}"><span class="chip-check" aria-hidden="true">✓</span>${escapeHtml(item.label)}</button>`;
}

function renderFeatured() {
  const container = $("#featured-keywords");
  const items = featuredItems();
  container.innerHTML = items.length
    ? items.map((item) => renderChip(item, "")).join("")
    : `<div class="empty-state">还没有主关键词。去设置里的“关键词管理”勾选几项常用词。</div>`;
}

function renderRecent() {
  const container = $("#recent-list");
  const recent = [...(app.user.recent || [])].sort((a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0)).slice(0, 6);
  container.innerHTML = recent.length
    ? recent.map((record) => `<button class="recent-item" type="button" data-action="use-recent" data-id="${escapeHtml(record.id)}">
        <span class="recent-item-main">
          <span class="recent-item-title">${escapeHtml(record.label || "未命名组合")}</span>
          <span class="recent-item-meta">${escapeHtml((record.labels || []).slice(0, 5).join(" · ") || "基础 Prompt")} · ${escapeHtml(formatDate(record.createdAt))}</span>
        </span>
        <span class="recent-item-arrow" aria-hidden="true">›</span>
      </button>`).join("")
    : `<div class="empty-state">复制一次后，最近用过的组合会出现在这里。</div>`;
}

function renderTemplateShortcuts() {
  const container = $("#template-shortcuts");
  const templates = currentTemplates().slice(0, 4);
  const map = itemMap({ includeHidden: true });
  container.innerHTML = templates.length
    ? templates.map((template) => `<button class="shortcut-item" type="button" data-action="use-template" data-id="${escapeHtml(template.id)}">
        <span class="shortcut-item-main">
          <span class="shortcut-item-title">${template.pinned ? "📌 " : ""}${escapeHtml(template.name)}</span>
          <span class="shortcut-item-meta">${escapeHtml(template.description || describeTemplate(template, map))}</span>
        </span>
        <span class="recent-item-arrow" aria-hidden="true">›</span>
      </button>`).join("")
    : `<div class="empty-state">还没有模板。先选几个关键词，再点击“保存为模板”。</div>`;
}

function renderGroups() {
  const container = $("#category-groups");
  container.innerHTML = app.config.groups.map((group) => {
    const items = effectiveItems().filter((item) => item.group === group.id);
    if (!items.length) return "";
    return `<section class="category-group" aria-labelledby="group-${escapeHtml(group.id)}">
      <div class="category-group-header">
        <h3 id="group-${escapeHtml(group.id)}">${escapeHtml(group.name)}</h3>
        <span class="mode-label">${group.multiple ? "多选" : "单选"}</span>
      </div>
      <div class="chip-row">${items.map((item) => renderChip(item)).join("")}</div>
    </section>`;
  }).join("");
}

function renderSelection() {
  const container = $("#selection-summary");
  const selected = summarizeSelection({ items: effectiveItems({ includeHidden: true }), selectedIds: [...app.selectedIds] });
  container.innerHTML = selected.length
    ? selected.map((item) => `<span class="selection-pill"><span>${escapeHtml(item.groupName)}</span><strong>${escapeHtml(item.label)}</strong></span>`).join("")
    : `<div class="empty-state">还没有选择额外关键词，当前会使用固定要求和主体要求。</div>`;
}

function renderPrompt() {
  const preview = $("#prompt-preview");
  const prompt = currentPrompt();
  const selectedCount = app.selectedIds.size;
  preview.textContent = prompt || "选择关键词后，这里会生成完整 Prompt。";
  preview.classList.toggle("is-collapsed", !app.promptExpanded);
  $("#prompt-count").textContent = `${selectedCount} 项选择`;
  $("#expand-prompt").textContent = app.promptExpanded ? "收起" : "展开全文";
  $("#fixed-summary").textContent = `已启用 ${currentFixedRequirements().filter((item) => item.enabled !== false).length} 项`;
}

function renderFixedRequirements() {
  const container = $("#fixed-requirements-list");
  const requirements = currentFixedRequirements();
  container.innerHTML = requirements.length
    ? requirements.map((item) => `<div class="fixed-requirement-item">
        <input type="checkbox" data-fixed-id="${escapeHtml(item.id)}" ${item.enabled !== false ? "checked" : ""} aria-label="启用 ${escapeHtml(item.label)}" />
        <label>${escapeHtml(item.label)}</label>
        ${item.builtIn ? `<small>内置</small>` : `<button class="row-action-button" type="button" data-action="delete-fixed" data-id="${escapeHtml(item.id)}">删除</button>`}
      </div>`).join("")
    : `<div class="empty-state">还没有固定要求。可以在下方添加。</div>`;
}

function renderTemplatesPage() {
  const container = $("#template-list");
  const templates = currentTemplates();
  const map = itemMap({ includeHidden: true });
  container.innerHTML = templates.length
    ? templates.map((template) => `<article class="template-card ${template.pinned ? "is-pinned" : ""}">
        <div class="template-card-header">
          <div>
            <h3 class="template-card-title">${template.pinned ? "📌 " : ""}${escapeHtml(template.name)}</h3>
            <p class="template-card-description">${escapeHtml(template.description || (template.source === "default" ? "默认模板" : "自定义模板"))}</p>
          </div>
          <span class="template-source">${template.source === "default" ? "默认" : "本地"}</span>
        </div>
        <p class="template-card-selection">${escapeHtml(describeTemplate(template, map))}</p>
        <div class="template-card-footer">
          <button class="primary-button" type="button" data-action="use-template" data-id="${escapeHtml(template.id)}">使用模板</button>
          <div class="template-card-actions">
            <button class="row-action-button ${template.favorite ? "is-active" : ""}" type="button" data-action="toggle-template-favorite" data-id="${escapeHtml(template.id)}">${template.favorite ? "★ 已收藏" : "☆ 收藏"}</button>
            <button class="row-action-button ${template.pinned ? "is-active" : ""}" type="button" data-action="toggle-template-pin" data-id="${escapeHtml(template.id)}">${template.pinned ? "取消置顶" : "置顶"}</button>
            <button class="row-action-button" type="button" data-action="rename-template" data-id="${escapeHtml(template.id)}">重命名</button>
            <button class="row-action-button" type="button" data-action="delete-template" data-id="${escapeHtml(template.id)}">删除</button>
          </div>
        </div>
      </article>`).join("")
    : `<div class="empty-state">还没有模板。回到首页组合一套关键词后保存。</div>`;
}

function renderKeywordManager() {
  const container = $("#keyword-manager-list");
  const items = effectiveItems({ includeHidden: true });
  container.innerHTML = items.length
    ? items.map((item) => `<div class="keyword-row ${item.hidden ? "is-hidden" : ""}">
        <div class="keyword-row-main">
          <div class="keyword-row-label">${escapeHtml(item.label)}${item.featured ? `<span class="keyword-badge">主关键词</span>` : ""}</div>
          <div class="keyword-row-meta">${escapeHtml(item.groupName)} · 排序 ${escapeHtml(item.order)} · ${item.builtIn ? "内置" : "自定义"}${item.hidden ? " · 已隐藏" : ""}</div>
        </div>
        <div class="keyword-row-actions">
          <button class="row-action-button" type="button" data-action="edit-keyword" data-id="${escapeHtml(item.id)}">编辑</button>
          <button class="row-action-button ${item.featured ? "is-active" : ""}" type="button" data-action="toggle-keyword-featured" data-id="${escapeHtml(item.id)}">${item.featured ? "取消主关键词" : "设为主关键词"}</button>
          ${item.featured ? `<button class="row-action-button" type="button" data-action="move-featured" data-direction="up" data-id="${escapeHtml(item.id)}" aria-label="${escapeHtml(item.label)}上移">↑</button><button class="row-action-button" type="button" data-action="move-featured" data-direction="down" data-id="${escapeHtml(item.id)}" aria-label="${escapeHtml(item.label)}下移">↓</button>` : ""}
          <button class="row-action-button" type="button" data-action="toggle-keyword-hidden" data-id="${escapeHtml(item.id)}">${item.hidden ? "显示" : "隐藏"}</button>
          <button class="row-action-button" type="button" data-action="delete-keyword" data-id="${escapeHtml(item.id)}">删除</button>
        </div>
      </div>`).join("")
    : `<div class="empty-state">没有可管理的关键词。</div>`;
}

function currentKnowledgeEntries() {
  return (app.user?.knowledgeEntries || [])
    .filter((entry) => entry?.id && entry.title && entry.prompt && !entry.deletedAt)
    .sort((a, b) => {
      const pinned = Number(Boolean(b.pinned)) - Number(Boolean(a.pinned));
      const favorite = Number(Boolean(b.favorite)) - Number(Boolean(a.favorite));
      return pinned || favorite || new Date(b.updatedAt || b.createdAt || 0) - new Date(a.updatedAt || a.createdAt || 0);
    });
}

function renderKnowledge() {
  const container = $("#knowledge-list");
  if (!container) return;
  const entries = currentKnowledgeEntries();
  container.innerHTML = entries.length
    ? entries.map((entry) => `<article class="knowledge-card ${entry.pinned ? "is-pinned" : ""}">
        <div class="knowledge-card-header">
          <div>
            <h3 class="knowledge-card-title">${entry.pinned ? "📌 " : ""}${escapeHtml(entry.title)}</h3>
            <p class="knowledge-card-meta">${entry.favorite ? "★ 已收藏 · " : ""}更新于 ${escapeHtml(formatDate(entry.updatedAt || entry.createdAt))}</p>
          </div>
          <span class="template-source">自定义</span>
        </div>
        <p class="knowledge-card-prompt">${escapeHtml(entry.prompt)}</p>
        <div class="knowledge-card-footer">
          <button class="primary-button" type="button" data-action="copy-knowledge" data-id="${escapeHtml(entry.id)}">复制完整 Prompt</button>
          <div class="template-card-actions">
            <button class="row-action-button ${entry.favorite ? "is-active" : ""}" type="button" data-action="toggle-knowledge-favorite" data-id="${escapeHtml(entry.id)}">${entry.favorite ? "★ 已收藏" : "☆ 收藏"}</button>
            <button class="row-action-button ${entry.pinned ? "is-active" : ""}" type="button" data-action="toggle-knowledge-pin" data-id="${escapeHtml(entry.id)}">${entry.pinned ? "取消置顶" : "置顶"}</button>
            <button class="row-action-button" type="button" data-action="edit-knowledge" data-id="${escapeHtml(entry.id)}">编辑</button>
            <button class="row-action-button" type="button" data-action="delete-knowledge" data-id="${escapeHtml(entry.id)}">删除</button>
          </div>
        </div>
      </article>`).join("")
    : `<div class="empty-state">还没有知识库内容。点击“新增完整 Prompt”，把以后想直接复制的内容保存下来。</div>`;
}

function renderSyncSettings() {
  const code = normalizeSyncCode(app.user?.sync?.code);
  const input = $("#sync-code");
  const status = $("#sync-status");
  if (input && document.activeElement !== input) input.value = formatSyncCode(code);
  if (!status) return;
  if (!code) {
    status.textContent = "尚未设置同步码。先生成一个，再在另一台设备输入同一个同步码。";
  } else if (app.syncBusy) {
    status.textContent = "正在合并两台设备的知识库……";
  } else if (app.user?.sync?.lastSyncedAt) {
    status.textContent = `已启用同步 · 上次更新 ${formatDate(app.user.sync.lastSyncedAt)}`;
  } else {
    status.textContent = "已设置同步码，打开知识库后点击“同步更新”即可。";
  }
}

function renderAll() {
  renderFeatured();
  renderRecent();
  renderTemplateShortcuts();
  renderGroups();
  renderSelection();
  renderPrompt();
  renderFixedRequirements();
  renderTemplatesPage();
  renderKeywordManager();
  renderKnowledge();
  renderSyncSettings();
}

function setView(view) {
  const nextView = ["home", "templates", "knowledge", "settings"].includes(view) ? view : "home";
  app.view = nextView;
  $$(".view").forEach((element) => {
    const active = element.id === `view-${nextView}`;
    element.hidden = !active;
    element.classList.toggle("is-active", active);
  });
  $$(".nav-button").forEach((button) => button.classList.toggle("is-active", button.dataset.view === nextView));
  window.scrollTo({ top: 0, behavior: "smooth" });
}

function selectKeyword(id) {
  const item = itemMap({ includeHidden: true }).get(id);
  if (!item || item.hidden) return;
  const group = groupById(item.group);
  if (!group) return;

  if (group.multiple) {
    if (app.selectedIds.has(id)) app.selectedIds.delete(id);
    else app.selectedIds.add(id);
  } else {
    const idsInGroup = effectiveItems({ includeHidden: true }).filter((entry) => entry.group === group.id).map((entry) => entry.id);
    idsInGroup.forEach((entryId) => app.selectedIds.delete(entryId));
    if (!app.selectedIds.has(id)) app.selectedIds.add(id);
  }

  renderAll();
  persist();
}

function restoreSelection(ids = []) {
  const map = itemMap({ includeHidden: true });
  app.selectedIds = new Set((Array.isArray(ids) ? ids : []).filter((id) => map.has(id)));
}

function useTemplate(templateId) {
  const template = currentTemplates().find((entry) => entry.id === templateId);
  if (!template) return;
  restoreSelection(template.selectedIds || []);
  const templateFixedIds = Array.isArray(template.fixedIds) ? new Set(template.fixedIds) : null;
  if (templateFixedIds) {
    app.user.fixedRequirements = currentFixedRequirements().map((item) => ({ ...item, enabled: templateFixedIds.has(item.id) }));
  }
  renderAll();
  persist();
  setView("home");
  showToast(`已使用「${template.name}」`);
}

function useRecent(recentId) {
  const record = (app.user.recent || []).find((entry) => entry.id === recentId);
  if (!record) return;
  restoreSelection(record.selectedIds || []);
  if (Array.isArray(record.fixedIds)) {
    const fixedIds = new Set(record.fixedIds);
    app.user.fixedRequirements = currentFixedRequirements().map((item) => ({ ...item, enabled: fixedIds.has(item.id) }));
  }
  renderAll();
  persist();
  setView("home");
  showToast("已恢复最近组合");
}

function recordRecent() {
  const map = itemMap({ includeHidden: true });
  const selected = [...app.selectedIds].map((id) => map.get(id)).filter(Boolean);
  const labels = selected.map((item) => item.label);
  const fixedIds = currentFixedRequirements().filter((item) => item.enabled !== false).map((item) => item.id);
  const signature = `${[...app.selectedIds].sort().join(",")}|${fixedIds.sort().join(",")}`;
  const record = {
    id: `recent-${Date.now()}`,
    signature,
    label: labels.slice(0, 3).join(" · ") || "基础 Prompt",
    labels,
    selectedIds: [...app.selectedIds],
    fixedIds,
    createdAt: new Date().toISOString()
  };
  app.user.recent = [record, ...(app.user.recent || []).filter((entry) => entry.signature !== signature)].slice(0, 12);
}

async function copyText(value) {
  try {
    await navigator.clipboard.writeText(value);
  } catch {
    const textarea = document.createElement("textarea");
    textarea.value = value;
    textarea.style.position = "fixed";
    textarea.style.opacity = "0";
    document.body.appendChild(textarea);
    textarea.select();
    document.execCommand("copy");
    textarea.remove();
  }
}

async function copyPrompt() {
  const prompt = currentPrompt();
  await copyText(prompt);
  recordRecent();
  renderRecent();
  persist();
  showToast("已复制");
}

function openTemplateDialog(templateId = null) {
  app.editingTemplateId = templateId;
  const template = templateId ? currentTemplates().find((entry) => entry.id === templateId) : null;
  $("#template-dialog-title").textContent = template ? "重命名模板" : "新建模板";
  $("#template-name").value = template?.name || "";
  const dialog = $("#template-dialog");
  if (typeof dialog.showModal === "function") dialog.showModal();
  else dialog.setAttribute("open", "");
  window.setTimeout(() => $("#template-name").focus(), 0);
}

function saveTemplateForm() {
  const name = $("#template-name").value.trim();
  if (!name) return;
  if (app.editingTemplateId) {
    const template = currentTemplates().find((entry) => entry.id === app.editingTemplateId);
    if (!template) return;
    if (template.source === "custom") {
      const target = app.user.templates.find((entry) => entry.id === template.id);
      if (target) target.name = name;
    } else {
      app.user.templateOverrides[template.id] = { ...(app.user.templateOverrides[template.id] || {}), name };
    }
    showToast("模板名称已更新");
  } else {
    const map = itemMap({ includeHidden: true });
    const selected = [...app.selectedIds].filter((id) => map.has(id));
    app.user.templates.push({
      id: `custom-template-${Date.now()}`,
      name,
      description: describeTemplate({ selectedIds: selected }, map),
      selectedIds: selected,
      fixedIds: currentFixedRequirements().filter((item) => item.enabled !== false).map((item) => item.id),
      order: Date.now(),
      favorite: false,
      pinned: false,
      createdAt: new Date().toISOString()
    });
    showToast("模板已保存");
  }
  $("#template-dialog").close?.();
  app.editingTemplateId = null;
  renderAll();
  persist();
}

function updateTemplateFlag(templateId, field) {
  const template = currentTemplates().find((entry) => entry.id === templateId);
  if (!template) return;
  const nextValue = !Boolean(template[field]);
  if (template.source === "custom") {
    const target = app.user.templates.find((entry) => entry.id === templateId);
    if (target) target[field] = nextValue;
  } else {
    app.user.templateOverrides[templateId] = { ...(app.user.templateOverrides[templateId] || {}), [field]: nextValue };
  }
  renderAll();
  persist();
}

function deleteTemplate(templateId) {
  const template = currentTemplates().find((entry) => entry.id === templateId);
  if (!template || !window.confirm(`确定删除「${template.name}」吗？`)) return;
  if (template.source === "custom") {
    app.user.templates = app.user.templates.filter((entry) => entry.id !== templateId);
  } else {
    app.user.deletedTemplateIds = [...new Set([...(app.user.deletedTemplateIds || []), templateId])];
  }
  renderAll();
  persist();
  showToast("模板已删除");
}

function updateFeaturedOrder(id, enabled) {
  const order = Array.isArray(app.user.featuredOrder) ? app.user.featuredOrder.filter((entry) => entry !== id) : [];
  if (enabled) order.push(id);
  app.user.featuredOrder = order;
}

function updateKeywordField(id, field, value) {
  const base = itemMap({ includeHidden: true }).get(id);
  if (!base) return;
  if (base.builtIn) {
    app.user.keywordOverrides[id] = { ...(app.user.keywordOverrides[id] || {}), [field]: value };
  } else {
    const target = app.user.customKeywords.find((entry) => entry.id === id);
    if (target) target[field] = value;
  }
}

function toggleKeywordFeatured(id) {
  const item = itemMap({ includeHidden: true }).get(id);
  if (!item) return;
  const next = !item.featured;
  updateKeywordField(id, "featured", next);
  updateFeaturedOrder(id, next);
  renderAll();
  persist();
}

function moveFeatured(id, direction) {
  const ids = featuredItems().map((item) => item.id);
  const index = ids.indexOf(id);
  const nextIndex = direction === "up" ? index - 1 : index + 1;
  if (index < 0 || nextIndex < 0 || nextIndex >= ids.length) return;
  [ids[index], ids[nextIndex]] = [ids[nextIndex], ids[index]];
  app.user.featuredOrder = ids;
  renderAll();
  persist();
}

function toggleKeywordHidden(id) {
  const item = itemMap({ includeHidden: true }).get(id);
  if (!item) return;
  const next = !item.hidden;
  updateKeywordField(id, "hidden", next);
  if (next) app.selectedIds.delete(id);
  renderAll();
  persist();
}

function deleteKeyword(id) {
  const item = itemMap({ includeHidden: true }).get(id);
  if (!item || !window.confirm(`确定删除关键词「${item.label}」吗？`)) return;
  if (item.builtIn) {
    app.user.deletedKeywordIds = [...new Set([...(app.user.deletedKeywordIds || []), id])];
    delete app.user.keywordOverrides[id];
  } else {
    app.user.customKeywords = app.user.customKeywords.filter((entry) => entry.id !== id);
  }
  app.user.featuredOrder = (app.user.featuredOrder || []).filter((entry) => entry !== id);
  app.selectedIds.delete(id);
  renderAll();
  persist();
  showToast("关键词已删除");
}

function fillKeywordGroupOptions(selectedGroup) {
  $("#keyword-group").innerHTML = app.config.groups.map((group) => `<option value="${escapeHtml(group.id)}" ${group.id === selectedGroup ? "selected" : ""}>${escapeHtml(group.name)}</option>`).join("");
}

function openKeywordDialog(keywordId = null) {
  app.editingKeywordId = keywordId;
  const item = keywordId ? itemMap({ includeHidden: true }).get(keywordId) : null;
  $("#keyword-dialog-title").textContent = item ? "编辑关键词" : "新增关键词";
  $("#keyword-label").value = item?.label || "";
  $("#keyword-text").value = item?.text || "";
  $("#keyword-order").value = item?.order ?? 50;
  $("#keyword-featured").checked = Boolean(item?.featured);
  $("#keyword-hidden").checked = Boolean(item?.hidden);
  fillKeywordGroupOptions(item?.group || app.config.groups[0]?.id);
  const dialog = $("#keyword-dialog");
  if (typeof dialog.showModal === "function") dialog.showModal();
  else dialog.setAttribute("open", "");
  window.setTimeout(() => $("#keyword-label").focus(), 0);
}

function saveKeywordForm() {
  const label = $("#keyword-label").value.trim();
  const text = $("#keyword-text").value.trim();
  const group = normalizeGroupId($("#keyword-group").value);
  const order = Math.max(0, Number($("#keyword-order").value) || 50);
  const featured = $("#keyword-featured").checked;
  const hidden = $("#keyword-hidden").checked;
  if (!label || !text) return;

  const id = app.editingKeywordId || `custom-${slugify(label)}-${Date.now()}`;
  if (app.editingKeywordId) {
    updateKeywordField(id, "label", label);
    updateKeywordField(id, "text", text);
    updateKeywordField(id, "group", group);
    updateKeywordField(id, "order", order);
    updateKeywordField(id, "featured", featured);
    updateKeywordField(id, "hidden", hidden);
  } else {
    app.user.customKeywords.push({ id, label, text, group, order, featured, hidden, createdAt: new Date().toISOString() });
  }
  updateFeaturedOrder(id, featured);
  if (hidden) app.selectedIds.delete(id);
  $("#keyword-dialog").close?.();
  app.editingKeywordId = null;
  renderAll();
  persist();
  showToast("关键词已保存");
}

function openKnowledgeDialog(entryId = null) {
  app.editingKnowledgeId = entryId;
  const entry = entryId ? (app.user.knowledgeEntries || []).find((item) => item.id === entryId) : null;
  $("#knowledge-dialog-title").textContent = entry ? "编辑知识库内容" : "新增完整 Prompt";
  $("#knowledge-title").value = entry?.title || "";
  $("#knowledge-prompt").value = entry?.prompt || "";
  const dialog = $("#knowledge-dialog");
  if (typeof dialog.showModal === "function") dialog.showModal();
  else dialog.setAttribute("open", "");
  window.setTimeout(() => $("#knowledge-title").focus(), 0);
}

function saveKnowledgeForm() {
  const title = $("#knowledge-title").value.trim();
  const prompt = $("#knowledge-prompt").value.trim();
  if (!title || !prompt) return;
  const now = new Date().toISOString();
  app.user.knowledgeEntries = Array.isArray(app.user.knowledgeEntries) ? app.user.knowledgeEntries : [];
  if (app.editingKnowledgeId) {
    const target = app.user.knowledgeEntries.find((entry) => entry.id === app.editingKnowledgeId);
    if (!target) return;
    target.title = title;
    target.prompt = prompt;
    target.updatedAt = now;
    delete target.deletedAt;
    showToast("知识库内容已更新");
  } else {
    app.user.knowledgeEntries.push({
      id: `knowledge-${Date.now()}`,
      title,
      prompt,
      favorite: false,
      pinned: false,
      createdAt: now,
      updatedAt: now
    });
    showToast("知识库内容已保存");
  }
  $("#knowledge-dialog").close?.();
  app.editingKnowledgeId = null;
  renderAll();
  persist();
}

function updateKnowledgeFlag(entryId, field) {
  const entry = (app.user.knowledgeEntries || []).find((item) => item.id === entryId && !item.deletedAt);
  if (!entry) return;
  entry[field] = !Boolean(entry[field]);
  entry.updatedAt = new Date().toISOString();
  renderKnowledge();
  persist();
}

async function copyKnowledge(entryId) {
  const entry = currentKnowledgeEntries().find((item) => item.id === entryId);
  if (!entry) return;
  await copyText(entry.prompt);
  showToast("完整 Prompt 已复制");
}

function deleteKnowledge(entryId) {
  const entry = (app.user.knowledgeEntries || []).find((item) => item.id === entryId && !item.deletedAt);
  if (!entry || !window.confirm(`确定删除「${entry.title}」吗？`)) return;
  entry.deletedAt = new Date().toISOString();
  entry.updatedAt = entry.deletedAt;
  renderKnowledge();
  persist();
  showToast("知识库内容已删除");
}

function saveSyncCode() {
  const rawCode = $("#sync-code").value;
  const code = normalizeSyncCode(rawCode);
  if (!isValidSyncCode(code)) {
    showToast("同步码应为 32 位字符，请检查后再保存");
    return;
  }
  app.user.sync = { ...(app.user.sync || {}), code, lastSyncedAt: app.user.sync?.lastSyncedAt || null };
  renderSyncSettings();
  persist();
  showToast("同步码已保存");
}

function generateSyncCode() {
  app.user.sync = { ...(app.user.sync || {}), code: createSyncCode(), lastSyncedAt: null };
  renderSyncSettings();
  persist();
  showToast("已生成同步码，请复制到另一台设备");
}

async function copySyncCode() {
  const code = normalizeSyncCode(app.user.sync?.code);
  if (!isValidSyncCode(code)) {
    showToast("请先生成或保存同步码");
    return;
  }
  await copyText(formatSyncCode(code));
  showToast("同步码已复制");
}

async function syncKnowledgeNow() {
  if (app.syncBusy) return;
  const code = normalizeSyncCode(app.user.sync?.code);
  if (!isValidSyncCode(code)) {
    setView("settings");
    showToast("请先在设置中生成或填写同步码");
    return;
  }
  if (!navigator.onLine) {
    showToast("当前离线，知识库仍可本地使用；联网后再点同步更新");
    return;
  }
  app.syncBusy = true;
  renderKnowledge();
  renderSyncSettings();
  try {
    const result = await syncKnowledge({ code, entries: app.user.knowledgeEntries || [] });
    app.user.knowledgeEntries = mergeKnowledgeEntries(app.user.knowledgeEntries || [], result.entries);
    app.user.sync = { ...(app.user.sync || {}), code, lastSyncedAt: result.syncedAt };
    renderAll();
    persist();
    showToast("知识库已同步更新");
  } catch (error) {
    showToast(error.message || "同步失败，请稍后重试");
  } finally {
    app.syncBusy = false;
    renderKnowledge();
    renderSyncSettings();
  }
}

function deleteFixed(id) {
  const requirement = currentFixedRequirements().find((item) => item.id === id);
  if (!requirement || requirement.builtIn || !window.confirm(`确定删除固定要求「${requirement.label}」吗？`)) return;
  app.user.fixedRequirements = currentFixedRequirements().filter((item) => item.id !== id);
  renderAll();
  persist();
}

function addFixedRequirement() {
  const input = $("#new-fixed-requirement");
  const label = input.value.trim();
  if (!label) return;
  const id = `fixed-${slugify(label)}-${Date.now()}`;
  app.user.fixedRequirements = [...currentFixedRequirements(), { id, label, text: label, enabled: true, builtIn: false }];
  input.value = "";
  renderAll();
  persist();
  showToast("固定要求已添加");
}

function setFixedEnabled(id, enabled) {
  app.user.fixedRequirements = currentFixedRequirements().map((item) => item.id === id ? { ...item, enabled } : item);
  renderAll();
  persist();
}

function downloadBackup(backup, filename = null) {
  const date = new Date().toISOString().slice(0, 10);
  const blob = new Blob([JSON.stringify(backup, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename || `prompt-library-backup-${date}.json`;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 500);
}

function exportBackup(silent = false) {
  downloadBackup(createBackup(app.user));
  if (!silent) showToast("备份已导出");
}

async function importBackup(file) {
  if (!file) return;
  try {
    const payload = JSON.parse(await file.text());
    const validation = validateBackup(payload);
    if (!validation.ok) {
      showToast(validation.error);
      return;
    }
    const mode = $("input[name='import-mode']:checked")?.value || "merge";
    if (mode === "replace") {
      downloadBackup(createBackup(app.user), `prompt-library-backup-before-replace-${new Date().toISOString().slice(0, 10)}.json`);
    }
    app.user = normalizeImportedState(mergeBackup(app.user, validation.data, mode));
    app.user.fixedRequirements = normalizeFixedRequirements(app.user.fixedRequirements);
    restoreSelection(app.user.currentSelection || []);
    renderAll();
    persist();
    showToast(mode === "replace" ? "已覆盖恢复，旧数据也已自动备份" : "已合并恢复");
  } catch {
    showToast("文件无法读取，当前数据未改变");
  }
}

function updateConnectionStatus() {
  const status = $("#connection-status");
  const online = navigator.onLine;
  status.classList.toggle("is-offline", !online);
  status.querySelector("span:last-child").textContent = online ? "本地可用" : "离线可用";
}

async function loadConfig() {
  const [keywordsResponse, presetsResponse] = await Promise.all([
    fetch(`data/keywords.json?v=${APP_ASSET_VERSION}`),
    fetch(`data/presets.json?v=${APP_ASSET_VERSION}`)
  ]);
  if (!keywordsResponse.ok || !presetsResponse.ok) throw new Error("配置文件加载失败");
  const [keywords, presets] = await Promise.all([keywordsResponse.json(), presetsResponse.json()]);
  app.config = normalizeConfig(keywords);
  app.presets = Array.isArray(presets?.presets) ? presets.presets : [];
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

    const registration = await navigator.serviceWorker.register(`service-worker.js?v=${APP_ASSET_VERSION}`, {
      updateViaCache: "none"
    });
    await registration.update();
  } catch {
    // 本地 file:// 或不支持 Service Worker 的环境不影响核心组合功能。
  }
}

function bindEvents() {
  document.addEventListener("click", (event) => {
    const target = event.target.closest("[data-action], [data-view]");
    if (!target) return;
    const action = target.dataset.action;

    if (target.dataset.view && !action) {
      setView(target.dataset.view);
      return;
    }

    switch (action) {
      case "navigate":
        setView(target.dataset.view);
        break;
      case "select-keyword":
        selectKeyword(target.dataset.id);
        break;
      case "use-template":
        useTemplate(target.dataset.id);
        break;
      case "use-recent":
        useRecent(target.dataset.id);
        break;
      case "copy-prompt":
        copyPrompt();
        break;
      case "toggle-prompt":
        app.promptExpanded = !app.promptExpanded;
        renderPrompt();
        break;
      case "clear-selection":
        app.selectedIds.clear();
        renderAll();
        persist();
        break;
      case "clear-recent":
        app.user.recent = [];
        renderRecent();
        persist();
        showToast("最近使用已清空");
        break;
      case "save-template":
        openTemplateDialog();
        break;
      case "rename-template":
        openTemplateDialog(target.dataset.id);
        break;
      case "toggle-template-favorite":
        updateTemplateFlag(target.dataset.id, "favorite");
        break;
      case "toggle-template-pin":
        updateTemplateFlag(target.dataset.id, "pinned");
        break;
      case "delete-template":
        deleteTemplate(target.dataset.id);
        break;
      case "add-keyword":
        openKeywordDialog();
        break;
      case "edit-keyword":
        openKeywordDialog(target.dataset.id);
        break;
      case "toggle-keyword-featured":
        toggleKeywordFeatured(target.dataset.id);
        break;
      case "move-featured":
        moveFeatured(target.dataset.id, target.dataset.direction);
        break;
      case "toggle-keyword-hidden":
        toggleKeywordHidden(target.dataset.id);
        break;
      case "delete-keyword":
        deleteKeyword(target.dataset.id);
        break;
      case "add-knowledge":
        openKnowledgeDialog();
        break;
      case "edit-knowledge":
        openKnowledgeDialog(target.dataset.id);
        break;
      case "copy-knowledge":
        copyKnowledge(target.dataset.id);
        break;
      case "toggle-knowledge-favorite":
        updateKnowledgeFlag(target.dataset.id, "favorite");
        break;
      case "toggle-knowledge-pin":
        updateKnowledgeFlag(target.dataset.id, "pinned");
        break;
      case "delete-knowledge":
        deleteKnowledge(target.dataset.id);
        break;
      case "delete-fixed":
        deleteFixed(target.dataset.id);
        break;
      case "sync-knowledge":
        syncKnowledgeNow();
        break;
      case "generate-sync-code":
        generateSyncCode();
        break;
      case "copy-sync-code":
        copySyncCode();
        break;
      case "export-backup":
        exportBackup();
        break;
      case "trigger-import":
        $("#import-file").click();
        break;
      case "close-dialog":
        target.closest("dialog")?.close();
        break;
      default:
        break;
    }
  });

  $("#template-form").addEventListener("submit", (event) => {
    event.preventDefault();
    saveTemplateForm();
  });

  $("#keyword-form").addEventListener("submit", (event) => {
    event.preventDefault();
    saveKeywordForm();
  });

  $("#knowledge-form").addEventListener("submit", (event) => {
    event.preventDefault();
    saveKnowledgeForm();
  });

  $("#sync-code-form").addEventListener("submit", (event) => {
    event.preventDefault();
    saveSyncCode();
  });

  $("#fixed-requirement-form").addEventListener("submit", (event) => {
    event.preventDefault();
    addFixedRequirement();
  });

  $("#import-file").addEventListener("change", (event) => {
    importBackup(event.target.files?.[0]);
    event.target.value = "";
  });

  document.addEventListener("change", (event) => {
    const checkbox = event.target.closest("[data-fixed-id]");
    if (checkbox) setFixedEnabled(checkbox.dataset.fixedId, checkbox.checked);
  });

  window.addEventListener("online", updateConnectionStatus);
  window.addEventListener("offline", updateConnectionStatus);
}

async function init() {
  try {
    await loadConfig();
    app.user = await loadState();
    app.user.fixedRequirements = normalizeFixedRequirements(app.user.fixedRequirements);
    restoreSelection(app.user.currentSelection || []);
    bindEvents();
    renderAll();
    updateConnectionStatus();
    registerServiceWorker();
    persist();
  } catch (error) {
    console.error(error);
    document.querySelector("main").innerHTML = `<section class="empty-state">配置文件暂时无法加载。请通过本地 HTTP 服务打开，而不是直接双击 index.html。</section>`;
  }
}

init();
