const fallbackPath = "/index.html";
const MAX_PAYLOAD_LENGTH = 1500000;
const CREATE_SYNC_TABLE = "CREATE TABLE IF NOT EXISTS sync_records (sync_id TEXT PRIMARY KEY, auth_hash TEXT NOT NULL, payload TEXT NOT NULL, updated_at TEXT NOT NULL)";
let syncTablePromise;

function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store" }
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

async function ensureSyncTable(env) {
  if (!env.DB) throw new Error("同步数据库未配置");
  if (!syncTablePromise) syncTablePromise = env.DB.prepare(CREATE_SYNC_TABLE).run();
  await syncTablePromise;
}

function validPayload(payload) {
  return payload
    && payload.version === 1
    && typeof payload.iv === "string"
    && typeof payload.ciphertext === "string"
    && payload.iv.length <= 64
    && payload.ciphertext.length <= MAX_PAYLOAD_LENGTH;
}

async function handleSync(request, env) {
  if (request.method !== "GET" && request.method !== "POST") return json({ error: "只支持 GET 或 POST" }, 405);
  const syncId = request.headers.get("X-Sync-Id") || "";
  const auth = request.headers.get("X-Sync-Auth") || "";
  if (!validToken(syncId) || !validToken(auth)) return json({ error: "同步凭证格式不正确" }, 400);

  try {
    await ensureSyncTable(env);
    const existing = await env.DB.prepare("SELECT sync_id, auth_hash, payload, updated_at FROM sync_records WHERE sync_id = ?1").bind(syncId).first();
    if (existing && !sameToken(existing.auth_hash, auth)) return json({ error: "同步码不匹配" }, 401);

    if (request.method === "GET") {
      if (!existing) return json({ exists: false });
      return json({ exists: true, payload: JSON.parse(existing.payload), updatedAt: existing.updated_at });
    }

    const body = await request.json();
    if (!validPayload(body?.payload)) return json({ error: "同步数据格式不正确" }, 400);
    const serialized = JSON.stringify(body.payload);
    if (serialized.length > MAX_PAYLOAD_LENGTH) return json({ error: "同步内容过大" }, 413);
    const updatedAt = typeof body.updatedAt === "string" ? body.updatedAt : new Date().toISOString();

    if (existing) {
      await env.DB.prepare("UPDATE sync_records SET payload = ?1, updated_at = ?2 WHERE sync_id = ?3").bind(serialized, updatedAt, syncId).run();
    } else {
      await env.DB.prepare("INSERT INTO sync_records (sync_id, auth_hash, payload, updated_at) VALUES (?1, ?2, ?3, ?4)").bind(syncId, auth, serialized, updatedAt).run();
    }
    return json({ ok: true, updatedAt });
  } catch (error) {
    console.error("sync error", error);
    return json({ error: "免费同步服务暂时不可用，请稍后重试" }, 503);
  }
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    if (url.pathname === "/api/sync") return handleSync(request, env);

    const response = await env.ASSETS.fetch(request);

    if (response.status !== 404) {
      return response;
    }

    if (url.pathname === "/" || !url.pathname.includes(".")) {
      return env.ASSETS.fetch(new Request(new URL(fallbackPath, request.url), request));
    }

    return response;
  },
};
