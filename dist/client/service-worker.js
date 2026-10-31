const CACHE_NAME = "prompt-library-v4.2.0";
const CORE_ASSETS = [
  "./",
  "./index.html",
  "./css/prototype.css?v=4.2.0",
  "./css/studio.css?v=4.2.0",
  "./css/workbench.css?v=4.2.0",
  "./js/prototype.js?v=4.2.0",
  "./js/back-to-top.js?v=4.2.0",
  "./js/catalog.js?v=4.2.0",
  "./js/browse-model.js?v=4.2.0",
  "./js/families.js?v=4.2.0",
  "./js/suite-utils.js?v=4.2.0",
  "./js/storage.js?v=4.2.0",
  "./js/sync.js?v=4.2.0",
  "./data/catalog-map.json?v=4.2.0",
  "./data/img2img-prompts.json?v=4.2.0",
  "./data/bangyan-data.json?v=4.2.0",
  "./manifest.json?v=4.2.0",
  "./icons/icon.svg",
  "./pose-reference.html",
  "./css/pose-reference.css?v=4.2.0",
  "./js/pose-reference.js?v=4.2.0",
  "./js/pose-model.js?v=4.2.0",
  "./data/pose-reference/catalog.json",
  "./data/pose-reference/action-prompts.json"
];

const NETWORK_FIRST_PATHS = [
  "/index.html",
  "/data/catalog-map.json",
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
    const response = await fetch(request, { cache: "no-store" });
    if (!response.ok) throw new Error("Resource unavailable");
    return await rememberResponse(request, response);
  } catch {
    const cached = await (await caches.open(CACHE_NAME)).match(request);
    if (cached) return cached;
    if (request.mode === "navigate") return caches.match("./index.html");
    return Response.error();
  }
}

async function cacheFirst(request, navigation = false) {
  // Release-specific cache: a new worker precaches the next release atomically.
  const cache = await caches.open(CACHE_NAME);
  const cached = await cache.match(request, { ignoreSearch: navigation });
  if (cached) return cached;
  try {
    return await rememberResponse(request, await fetch(request));
  } catch {
    return Response.error();
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
      .then((keys) => Promise.all(keys.filter((key) => key.startsWith('prompt-library-') && key !== CACHE_NAME).map((key) => caches.delete(key))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", (event) => {
  if (event.request.method !== "GET") return;
  const requestUrl = new URL(event.request.url);
  if (requestUrl.origin !== self.location.origin) return;
  if (requestUrl.pathname.startsWith("/api/")) return;

  // Large original references use the browser HTTP cache, never the PWA cache.
  if (requestUrl.pathname.includes('/data/pose-reference/img/') || requestUrl.pathname.includes('/data/pose-reference/thumbs/')) return;
  const versioned = requestUrl.searchParams.has('v');
  const navigation = event.request.mode === 'navigate';
  const poseMetadata = requestUrl.pathname.includes('/data/pose-reference/');
  const networkData = NETWORK_FIRST_PATHS.some(path=>requestUrl.pathname.endsWith(path));
  event.respondWith(navigation || versioned || poseMetadata || !networkData
    ? cacheFirst(event.request, navigation)
    : networkFirst(event.request));
});
