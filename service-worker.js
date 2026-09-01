const CACHE_NAME = "prompt-library-v2.6.12";
const CORE_ASSETS = [
  "./",
  "./index.html",
  "./css/prototype.css?v=2.6.12",
  "./js/prototype.js?v=2.6.12",
  "./js/suite-utils.js?v=2.6.12",
  "./js/storage.js?v=2.6.12",
  "./js/sync.js?v=2.6.12",
  "./data/img2img-prompts.json?v=2.6.12",
  "./data/bangyan-data.json?v=2.6.12",
  "./manifest.json?v=2.6.12",
  "./icons/icon.svg"
];

const NETWORK_FIRST_PATHS = [
  "/index.html",
  "/data/img2img-prompts.json",
  "/data/bangyan-data.json",
  "/manifest.json"
];

async function rememberResponse(request, response) {
  if (response?.ok) {
    const cache = await caches.open(CACHE_NAME);
    await cache.put(request, response.clone());
  }
  return response;
}

async function networkFirst(request) {
  try {
    return await rememberResponse(request, await fetch(request, { cache: "no-store" }));
  } catch {
    const cached = await caches.match(request);
    if (cached) return cached;
    if (request.mode === "navigate") return caches.match("./index.html");
    return Response.error();
  }
}

async function cacheFirst(request) {
  const cached = await caches.match(request);
  if (cached) return cached;
  try {
    return await rememberResponse(request, await fetch(request));
  } catch {
    return caches.match("./index.html");
  }
}

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => cache.addAll(CORE_ASSETS))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", (event) => {
  if (event.request.method !== "GET") return;
  const requestUrl = new URL(event.request.url);
  if (requestUrl.origin !== self.location.origin) return;
  if (requestUrl.pathname.startsWith("/api/")) return;

  const useNetworkFirst = event.request.mode === "navigate"
    || NETWORK_FIRST_PATHS.some((path) => requestUrl.pathname.endsWith(path));

  event.respondWith(useNetworkFirst ? networkFirst(event.request) : cacheFirst(event.request));
});
