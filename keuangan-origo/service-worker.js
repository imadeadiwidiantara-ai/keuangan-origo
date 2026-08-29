// ============================================================
// SERVICE WORKER MINIMAL
// Tujuannya hanya supaya browser mengizinkan aplikasi ini
// "dipasang" sebagai PWA (ikon di desktop/taskbar). Cache di
// sini sengaja sederhana — aplikasi tetap butuh internet untuk
// membaca/menulis data ke Supabase.
// ============================================================

const CACHE_NAME = "keuangan-origo-v1";
const CORE_FILES = [
  "./",
  "./index.html",
  "./css/style.css",
  "./manifest.json",
  "./icons/icon-192.png",
  "./icons/icon-512.png",
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(CORE_FILES))
  );
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k)))
    )
  );
  self.clients.claim();
});

self.addEventListener("fetch", (event) => {
  // Hanya file inti (shell) yang diambil dari cache; permintaan ke
  // Supabase (data) selalu langsung ke jaringan, tidak di-cache,
  // supaya data yang tampil selalu yang terbaru.
  if (event.request.url.includes("supabase.co")) return;

  event.respondWith(
    caches.match(event.request).then((cached) => cached || fetch(event.request))
  );
});
