import { getStore } from "@netlify/blobs";

const MAX_PAYLOAD_LENGTH = 1_500_000;
let syncStore;
const CREATE_HEADERS = {
  "Cache-Control": "no-store",
  "Content-Type": "application/json; charset=utf-8"
};

function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: CREATE_HEADERS
  });
}

function validToken(value) {
  return typeof value === "string" && /^[a-f0-9]{64}$/.test(value);
}

function sameToken(left, right) {
  if (!validToken(left) || !validToken(right) || left.length !== right.length) return false;
  let difference = 0;
  for (let index = 0; index < left.length; index += 1) difference |= left.charCodeAt(index) ^ right.charCodeAt(index);
  return difference === 0;
}

function validPayload(payload) {
  return payload
    && payload.version === 1
    && typeof payload.iv === "string"
    && payload.iv.length <= 128
    && typeof payload.ciphertext === "string"
    && payload.ciphertext.length <= MAX_PAYLOAD_LENGTH;
}

function getSyncStore() {
  if (!syncStore) syncStore = getStore({ name: "prompt-library-sync", consistency: "strong" });
  return syncStore;
}

async function readRecord(syncId) {
  return getSyncStore().get(syncId, { consistency: "strong", type: "json" });
}

export default async function sync(request) {
  if (request.method !== "GET" && request.method !== "POST") {
    return json({ error: "不支持的请求方法" }, 405);
  }

  const syncId = request.headers.get("X-Sync-Id")?.toLowerCase() || "";
  const authHash = request.headers.get("X-Sync-Auth")?.toLowerCase() || "";
  if (!validToken(syncId) || !validToken(authHash)) return json({ error: "同步身份无效" }, 400);

  try {
    const existing = await readRecord(syncId);
    if (existing && !sameToken(existing.authHash, authHash)) return json({ error: "同步码不匹配" }, 401);

    if (request.method === "GET") {
      if (!existing) return json({ exists: false });
      return json({ exists: true, payload: existing.payload, updatedAt: existing.updatedAt });
    }

    const rawBody = await request.text();
    if (rawBody.length > MAX_PAYLOAD_LENGTH + 4_000) return json({ error: "同步数据过大" }, 413);
    const body = JSON.parse(rawBody);
    if (!validPayload(body?.payload)) return json({ error: "同步数据格式不正确" }, 400);

    await getSyncStore().setJSON(syncId, {
      authHash,
      payload: body.payload,
      updatedAt: typeof body.updatedAt === "string" ? body.updatedAt : new Date().toISOString()
    });
    return json({ ok: true });
  } catch (error) {
    console.error("Netlify knowledge sync failed", error);
    return json({ error: "免费同步服务暂时不可用，请稍后重试" }, 503);
  }
}
