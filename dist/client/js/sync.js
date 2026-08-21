import {
  buildCloudPayload,
  clone,
  mergePromptEntries,
  mergeSyncedSuiteState,
  normalizeCloudPayload
} from "./suite-utils.js";

const SYNC_ENDPOINT = "/api/sync";
const SYNC_CODE_BYTES = 16;
const encoder = new TextEncoder();

function bytesToHex(bytes) {
  return [...bytes].map((byte) => byte.toString(16).padStart(2, "0")).join("");
}

function bytesToBase64(bytes) {
  let binary = "";
  for (let index = 0; index < bytes.length; index += 1) binary += String.fromCharCode(bytes[index]);
  return btoa(binary);
}

function base64ToBytes(value) {
  const binary = atob(value);
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index += 1) bytes[index] = binary.charCodeAt(index);
  return bytes;
}

async function sha256Hex(value) {
  const digest = await crypto.subtle.digest("SHA-256", encoder.encode(value));
  return bytesToHex(new Uint8Array(digest));
}

function normalizeEntry(entry) {
  if (!entry || !entry.id || !entry.title || !entry.prompt) return null;
  return {
    id: String(entry.id),
    title: String(entry.title),
    prompt: String(entry.prompt),
    categoryId: String(entry.categoryId || "image-edit"),
    negativePrompt: String(entry.negativePrompt || ""),
    favorite: Boolean(entry.favorite),
    pinned: Boolean(entry.pinned),
    pinOrder: Number(entry.pinOrder || 0),
    createdAt: entry.createdAt || new Date(0).toISOString(),
    updatedAt: entry.updatedAt || entry.createdAt || new Date(0).toISOString(),
    ...(entry.deletedAt ? { deletedAt: entry.deletedAt } : {})
  };
}

export function normalizeSyncCode(value) {
  return String(value || "").replace(/[\s-]/g, "").toLowerCase();
}

export function isValidSyncCode(value) {
  return /^[a-f0-9]{32}$/.test(normalizeSyncCode(value));
}

export function formatSyncCode(value) {
  const code = normalizeSyncCode(value);
  return code.match(/.{1,4}/g)?.join("-") || "";
}

export function createSyncCode() {
  const bytes = new Uint8Array(SYNC_CODE_BYTES);
  crypto.getRandomValues(bytes);
  return bytesToHex(bytes);
}

export function mergeKnowledgeEntries(local = [], remote = []) {
  const normalizedLocal = local.map(normalizeEntry).filter(Boolean);
  const normalizedRemote = remote.map(normalizeEntry).filter(Boolean);
  return mergePromptEntries(normalizedLocal, normalizedRemote);
}

async function encryptPayload(payload, code) {
  const digest = await crypto.subtle.digest("SHA-256", encoder.encode(`prompt-library-key-v1:${code}`));
  const key = await crypto.subtle.importKey("raw", digest, { name: "AES-GCM" }, false, ["encrypt", "decrypt"]);
  const iv = new Uint8Array(12);
  crypto.getRandomValues(iv);
  const plaintext = encoder.encode(JSON.stringify(payload));
  const ciphertext = await crypto.subtle.encrypt({ name: "AES-GCM", iv }, key, plaintext);
  // Keep the encrypted wrapper at version 1 so old Netlify Functions can store it.
  return { version: 1, iv: bytesToBase64(iv), ciphertext: bytesToBase64(new Uint8Array(ciphertext)) };
}

async function decryptPayload(payload, code) {
  if (!payload || payload.version !== 1 || typeof payload.iv !== "string" || typeof payload.ciphertext !== "string") {
    throw new Error("同步数据格式不正确");
  }
  const digest = await crypto.subtle.digest("SHA-256", encoder.encode(`prompt-library-key-v1:${code}`));
  const key = await crypto.subtle.importKey("raw", digest, { name: "AES-GCM" }, false, ["encrypt", "decrypt"]);
  const plaintext = await crypto.subtle.decrypt({ name: "AES-GCM", iv: base64ToBytes(payload.iv) }, key, base64ToBytes(payload.ciphertext));
  return JSON.parse(new TextDecoder().decode(plaintext));
}

async function readRemote(code, syncId, auth) {
  let response;
  try {
    response = await fetch(SYNC_ENDPOINT, {
      headers: { "X-Sync-Id": syncId, "X-Sync-Auth": auth }
    });
  } catch {
    throw new Error("同步服务暂时无法连接，请检查网络；本机数据仍然保留");
  }
  if (!response.ok) {
    const payload = await response.json().catch(() => ({}));
    throw new Error(payload.error || `同步读取失败（${response.status}）`);
  }
  const payload = await response.json();
  if (!payload.exists) return null;
  return decryptPayload(payload.payload, code);
}

async function writeRemote(code, syncId, auth, data) {
  const payload = await encryptPayload(data, code);
  let response;
  try {
    response = await fetch(SYNC_ENDPOINT, {
      method: "POST",
      headers: { "Content-Type": "application/json", "X-Sync-Id": syncId, "X-Sync-Auth": auth },
      body: JSON.stringify({ payload, updatedAt: new Date().toISOString() })
    });
  } catch {
    throw new Error("同步服务暂时无法连接，请检查网络；本机数据仍然保留");
  }
  if (!response.ok) {
    const result = await response.json().catch(() => ({}));
    throw new Error(result.error || `同步写入失败（${response.status}）`);
  }
}

function mergeCloudSuites(local, remote) {
  const normalizedRemote = normalizeCloudPayload(remote);
  const localPayload = buildCloudPayload(local);
  if (!normalizedRemote) return localPayload;

  const remoteZhuangyuan = normalizedRemote.suites.zhuangyuan;
  const remoteBangyan = normalizedRemote.suites.bangyan;
  return {
    schemaVersion: 2,
    suites: {
      zhuangyuan: remoteZhuangyuan
        ? mergeSyncedSuiteState(localPayload.suites.zhuangyuan || {}, remoteZhuangyuan)
        : clone(localPayload.suites.zhuangyuan),
      bangyan: remoteBangyan
        ? mergeSyncedSuiteState(localPayload.suites.bangyan || {}, remoteBangyan)
        : clone(localPayload.suites.bangyan)
    },
    meta: { ...(normalizedRemote.meta || {}), ...(localPayload.meta || {}) }
  };
}

export async function syncSuites({ code: rawCode, zhuangyuan, bangyan, meta = {} } = {}) {
  const code = normalizeSyncCode(rawCode);
  if (!isValidSyncCode(code)) throw new Error("同步码应为 32 位字符，请先在设置中生成或填写同步码");
  if (!window.crypto?.subtle) throw new Error("当前浏览器不支持安全同步，请改用 HTTPS 地址打开");

  const syncId = await sha256Hex(`id:${code}`);
  const auth = await sha256Hex(`auth:${code}`);
  const localPayload = buildCloudPayload({ zhuangyuan, bangyan, meta });
  const remotePayload = await readRemote(code, syncId, auth);
  const merged = mergeCloudSuites({ zhuangyuan, bangyan, meta }, remotePayload);
  await writeRemote(code, syncId, auth, merged);
  return {
    suites: merged.suites,
    meta: merged.meta,
    syncedAt: new Date().toISOString(),
    hadRemotePayload: Boolean(remotePayload),
    localSchemaVersion: localPayload.schemaVersion
  };
}

// Kept for the inactive legacy app.js so an old client can only merge into 状元.
export async function syncKnowledge({ code, entries = [] } = {}) {
  const result = await syncSuites({
    code,
    zhuangyuan: { prompts: entries },
    bangyan: null,
    meta: { migratedFrom: "legacy-client" }
  });
  return { entries: result.suites.zhuangyuan?.prompts || entries, syncedAt: result.syncedAt };
}
