import { SUITE_STATE_KEYS, clone } from "./suite-utils.js";

export const DB_NAME = "prompt-library-img2img-prototype";
export const DB_VERSION = 2;
export const STORE_NAME = "state";
export const LEGACY_FALLBACK_KEY = "prompt-library-state-v1";
export const SUITE_FALLBACK_KEY = "prompt-library-suite-state-v2";

function parseLocalStorage(key) {
  try {
    const value = window.localStorage.getItem(key);
    return value ? JSON.parse(value) : null;
  } catch {
    return null;
  }
}

function writeLocalStorage(key, value) {
  try {
    window.localStorage.setItem(key, JSON.stringify(value));
    return true;
  } catch {
    return false;
  }
}

function openDatabase(version = DB_VERSION) {
  return new Promise((resolve, reject) => {
    if (!("indexedDB" in window)) {
      reject(new Error("当前浏览器不支持 IndexedDB"));
      return;
    }

    const request = window.indexedDB.open(DB_NAME, version);
    request.onupgradeneeded = () => {
      if (!request.result.objectStoreNames.contains(STORE_NAME)) {
        request.result.createObjectStore(STORE_NAME);
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error || new Error("无法打开本地数据库"));
    request.onblocked = () => reject(new Error("本地数据库正在被旧页面占用"));
  });
}

async function readLegacyDatabaseState() {
  try {
    const database = await openDatabase(1);
    const records = await readFromDatabase(database, [SUITE_STATE_KEYS.legacy]);
    return records[SUITE_STATE_KEYS.legacy] || null;
  } catch {
    return null;
  }
}

function readFromDatabase(database, keys) {
  return new Promise((resolve, reject) => {
    const transaction = database.transaction(STORE_NAME, "readonly");
    const store = transaction.objectStore(STORE_NAME);
    const result = {};
    keys.forEach((key) => {
      const request = store.get(key);
      request.onsuccess = () => { result[key] = request.result || null; };
      request.onerror = () => reject(request.error || new Error("读取本地状态失败"));
    });
    transaction.oncomplete = () => {
      database.close();
      resolve(result);
    };
    transaction.onerror = () => reject(transaction.error || new Error("读取本地状态失败"));
    transaction.onabort = () => reject(transaction.error || new Error("读取本地状态失败"));
  });
}

function writeToDatabase(database, records) {
  return new Promise((resolve, reject) => {
    const transaction = database.transaction(STORE_NAME, "readwrite");
    const store = transaction.objectStore(STORE_NAME);
    Object.entries(records).forEach(([key, value]) => store.put(clone(value), key));
    transaction.oncomplete = () => {
      database.close();
      resolve();
    };
    transaction.onerror = () => reject(transaction.error || new Error("保存本地状态失败"));
    transaction.onabort = () => reject(transaction.error || new Error("保存本地状态失败"));
  });
}

export async function readStorageBundle() {
  const keys = [SUITE_STATE_KEYS.zhuangyuan, SUITE_STATE_KEYS.bangyan, SUITE_STATE_KEYS.meta, SUITE_STATE_KEYS.legacy];
  try {
    const database = await openDatabase();
    const records = await readFromDatabase(database, keys);
    return {
      ...records,
      fallback: parseLocalStorage(SUITE_FALLBACK_KEY),
      legacyFallback: parseLocalStorage(LEGACY_FALLBACK_KEY),
      storage: "indexeddb"
    };
  } catch (error) {
    const fallback = parseLocalStorage(SUITE_FALLBACK_KEY) || {};
    return {
      zhuangyuan: fallback.zhuangyuan || null,
      bangyan: fallback.bangyan || null,
      meta: fallback.meta || null,
      legacy: await readLegacyDatabaseState(),
      fallback,
      legacyFallback: parseLocalStorage(LEGACY_FALLBACK_KEY),
      storage: "localStorage-fallback",
      error
    };
  }
}

export async function writeStorageBundle({ zhuangyuan, bangyan, meta } = {}) {
  const records = {
    [SUITE_STATE_KEYS.zhuangyuan]: zhuangyuan,
    [SUITE_STATE_KEYS.bangyan]: bangyan,
    [SUITE_STATE_KEYS.meta]: meta
  };
  try {
    const database = await openDatabase();
    await writeToDatabase(database, records);
    return "indexeddb";
  } catch {
    const saved = writeLocalStorage(SUITE_FALLBACK_KEY, { zhuangyuan, bangyan, meta });
    if (!saved) throw new Error("本地状态无法保存");
    return "localStorage-fallback";
  }
}
