const DB_NAME = "prompt-library-db";
const DB_VERSION = 1;
const STORE_NAME = "app-state";
const STATE_KEY = "singleton";
const FALLBACK_KEY = "prompt-library-state-v1";

export const EMPTY_STATE = {
  version: 1,
  customKeywords: [],
  keywordOverrides: {},
  deletedKeywordIds: [],
  featuredOrder: [],
  fixedRequirements: null,
  templates: [],
  templateOverrides: {},
  deletedTemplateIds: [],
  recent: [],
  currentSelection: [],
  currentFixedIds: [],
  settings: {}
};

let databasePromise;

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function normalizeState(value) {
  const source = value && typeof value === "object" ? value : {};
  const state = { ...clone(EMPTY_STATE), ...source };

  state.customKeywords = Array.isArray(source.customKeywords) ? source.customKeywords : [];
  state.keywordOverrides = source.keywordOverrides && typeof source.keywordOverrides === "object" ? source.keywordOverrides : {};
  state.deletedKeywordIds = Array.isArray(source.deletedKeywordIds) ? source.deletedKeywordIds : [];
  state.featuredOrder = Array.isArray(source.featuredOrder) ? source.featuredOrder : [];
  state.fixedRequirements = Array.isArray(source.fixedRequirements) ? source.fixedRequirements : null;
  state.templates = Array.isArray(source.templates) ? source.templates : [];
  state.templateOverrides = source.templateOverrides && typeof source.templateOverrides === "object" ? source.templateOverrides : {};
  state.deletedTemplateIds = Array.isArray(source.deletedTemplateIds) ? source.deletedTemplateIds : [];
  state.recent = Array.isArray(source.recent) ? source.recent : [];
  state.currentSelection = Array.isArray(source.currentSelection) ? source.currentSelection : [];
  state.currentFixedIds = Array.isArray(source.currentFixedIds) ? source.currentFixedIds : [];
  state.settings = source.settings && typeof source.settings === "object" ? source.settings : {};
  return state;
}

function requestAsPromise(request) {
  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error || new Error("IndexedDB 请求失败"));
  });
}

function openDatabase() {
  if (databasePromise) return databasePromise;

  databasePromise = new Promise((resolve, reject) => {
    if (!("indexedDB" in window)) {
      reject(new Error("当前浏览器不支持 IndexedDB"));
      return;
    }

    const request = window.indexedDB.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME);
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error || new Error("无法打开本地数据库"));
  });

  return databasePromise;
}

function readFallback() {
  try {
    const raw = window.localStorage.getItem(FALLBACK_KEY);
    return raw ? normalizeState(JSON.parse(raw)) : normalizeState();
  } catch {
    return normalizeState();
  }
}

function writeFallback(state) {
  try {
    window.localStorage.setItem(FALLBACK_KEY, JSON.stringify(state));
  } catch {
    // 极少数隐私模式会禁用 localStorage；此时仍保留当前会话状态。
  }
}

export async function loadState() {
  try {
    const db = await openDatabase();
    const transaction = db.transaction(STORE_NAME, "readonly");
    const value = await requestAsPromise(transaction.objectStore(STORE_NAME).get(STATE_KEY));
    return normalizeState(value);
  } catch {
    return readFallback();
  }
}

export async function saveState(nextState) {
  const state = normalizeState(nextState);
  state.updatedAt = new Date().toISOString();

  try {
    const db = await openDatabase();
    const transaction = db.transaction(STORE_NAME, "readwrite");
    transaction.objectStore(STORE_NAME).put(state, STATE_KEY);
    await new Promise((resolve, reject) => {
      transaction.oncomplete = resolve;
      transaction.onerror = () => reject(transaction.error || new Error("保存本地数据失败"));
      transaction.onabort = () => reject(transaction.error || new Error("保存本地数据失败"));
    });
  } catch {
    writeFallback(state);
  }

  return state;
}

export function normalizeImportedState(value) {
  return normalizeState(value);
}
