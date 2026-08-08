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
    favorite: Boolean(entry.favorite),
    pinned: Boolean(entry.pinned),
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
  const result = new Map();
  for (const entry of [...local, ...remote]) {
    const normalized = normalizeEntry(entry);
    if (!normalized) continue;
    const current = result.get(normalized.id);
    if (!current || new Date(normalized.updatedAt).getTime() > new Date(current.updatedAt).getTime()) {
      result.set(normalized.id, normalized);
    }
  }
  return [...result.values()];
}

async function encryptEntries(entries, code) {
  const digest = await crypto.subtle.digest("SHA-256", encoder.encode(`prompt-library-key-v1:${code}`));
  const key = await crypto.subtle.importKey("raw", digest, { name: "AES-GCM" }, false, ["encrypt", "decrypt"]);
  const iv = new Uint8Array(12);
  crypto.getRandomValues(iv);
  const plaintext = encoder.encode(JSON.stringify({ version: 1, entries }));
  const ciphertext = await crypto.subtle.encrypt({ name: "AES-GCM", iv }, key, plaintext);
  return { version: 1, iv: bytesToBase64(iv), ciphertext: bytesToBase64(new Uint8Array(ciphertext)) };
}

async function decryptEntries(payload, code) {
  if (!payload || payload.version !== 1 || typeof payload.iv !== "string" || typeof payload.ciphertext !== "string") {
    throw new Error("同步数据格式不正确");
  }
  const digest = await crypto.subtle.digest("SHA-256", encoder.encode(`prompt-library-key-v1:${code}`));
  const key = await crypto.subtle.importKey("raw", digest, { name: "AES-GCM" }, false, ["encrypt", "decrypt"]);
  const plaintext = await crypto.subtle.decrypt({ name: "AES-GCM", iv: base64ToBytes(payload.iv) }, key, base64ToBytes(payload.ciphertext));
  const result = JSON.parse(new TextDecoder().decode(plaintext));
  if (result.version !== 1 || !Array.isArray(result.entries)) throw new Error("同步数据版本不兼容");
  return result.entries;
}

async function readRemote(code, syncId, auth) {
  let response;
  try {
    response = await fetch(SYNC_ENDPOINT, {
      headers: { "X-Sync-Id": syncId, "X-Sync-Auth": auth }
    });
  } catch {
    throw new Error("同步服务暂时无法连接，请检查网络；本机知识库仍然保留");
  }
  if (!response.ok) {
    const payload = await response.json().catch(() => ({}));
    throw new Error(payload.error || `同步读取失败（${response.status}）`);
  }
  const payload = await response.json();
  if (!payload.exists) return [];
  return decryptEntries(payload.payload, code);
}

async function writeRemote(code, syncId, auth, entries) {
  const payload = await encryptEntries(entries, code);
  let response;
  try {
    response = await fetch(SYNC_ENDPOINT, {
      method: "POST",
      headers: { "Content-Type": "application/json", "X-Sync-Id": syncId, "X-Sync-Auth": auth },
      body: JSON.stringify({ payload, updatedAt: new Date().toISOString() })
    });
  } catch {
    throw new Error("同步服务暂时无法连接，请检查网络；本机知识库仍然保留");
  }
  if (!response.ok) {
    const result = await response.json().catch(() => ({}));
    throw new Error(result.error || `同步写入失败（${response.status}）`);
  }
}

export async function syncKnowledge({ code: rawCode, entries = [] }) {
  const code = normalizeSyncCode(rawCode);
  if (!isValidSyncCode(code)) throw new Error("同步码应为 32 位字符，请先在设置中生成或填写同步码");
  if (!window.crypto?.subtle) throw new Error("当前浏览器不支持安全同步，请改用 HTTPS 地址打开");

  const syncId = await sha256Hex(`id:${code}`);
  const auth = await sha256Hex(`auth:${code}`);
  const remote = await readRemote(code, syncId, auth);
  const merged = mergeKnowledgeEntries(entries, remote);
  await writeRemote(code, syncId, auth, merged);
  return { entries: merged, syncedAt: new Date().toISOString() };
}
