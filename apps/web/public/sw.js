/**
 * kb-rag 前端 PWA 占位 Service Worker（v4）
 * - 仅预缓存 / 助推同源静态外壳（HTML、manifest、图标、构建产物 /assets/*）
 * - 绝不缓存 /v1/*（问答、会话、KB 替换等）；不拦截 POST（用户 PDF 上传不经 Cache API 写入）
 * - 不在此缓存跨域响应或用户私有文件内容
 */
const CACHE_SHELL = "kb-rag-shell-v1";

self.addEventListener("install", (event) => {
  event.waitUntil(
    (async () => {
      const cache = await caches.open(CACHE_SHELL);
      await cache
        .addAll(["/", "/index.html", "/manifest.webmanifest", "/pwa-icons/icon.svg"])
        .catch(() => {});
      await self.skipWaiting();
    })(),
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(self.clients.claim());
});

self.addEventListener("fetch", (event) => {
  const req = event.request;
  if (req.method !== "GET") {
    return;
  }

  let url;
  try {
    url = new URL(req.url);
  } catch {
    return;
  }

  if (url.origin !== self.location.origin) {
    return;
  }

  if (
    url.pathname.startsWith("/v1/") ||
    url.pathname === "/healthz" ||
    url.pathname === "/readyz"
  ) {
    return;
  }

  if (url.pathname.startsWith("/assets/")) {
    event.respondWith(networkFirstAsset(req));
    return;
  }

  if (req.mode === "navigate" || req.destination === "document") {
    event.respondWith(networkFirstDocument(req));
    return;
  }

  if (
    url.pathname.endsWith(".webmanifest") ||
    url.pathname.startsWith("/pwa-icons/")
  ) {
    event.respondWith(networkFirstSameOrigin(req));
  }
});

async function networkFirstAsset(req) {
  try {
    const net = await fetch(req);
    if (net.ok) {
      const cache = await caches.open(CACHE_SHELL);
      await cache.put(req, net.clone());
    }
    return net;
  } catch {
    const hit = await caches.match(req);
    if (hit) {
      return hit;
    }
    throw new Error("offline-asset");
  }
}

async function networkFirstDocument(req) {
  try {
    return await fetch(req);
  } catch {
    const shell = (await caches.match("/index.html")) || (await caches.match("/"));
    if (shell) {
      return shell;
    }
    throw new Error("offline-document");
  }
}

async function networkFirstSameOrigin(req) {
  try {
    return await fetch(req);
  } catch {
    const hit = await caches.match(req);
    if (hit) {
      return hit;
    }
    throw new Error("offline-manifest");
  }
}
