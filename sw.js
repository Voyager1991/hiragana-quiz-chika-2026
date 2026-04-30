// Service Worker for ひらがな クイズ
// オフライン対応: 初回アクセス後、ネットなしでも動作する

const CACHE_VERSION = 'hiragana-v2';
const CORE_ASSETS = [
  './',
  './index.html',
  './manifest.json',
  'https://fonts.googleapis.com/css2?family=Mochiy+Pop+One&family=Yusei+Magic&display=swap'
];

// インストール時: 重要ファイルを先読みキャッシュ
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_VERSION).then((cache) => {
      // フォントCSSは個別取得でエラー時もスキップ
      return Promise.all(
        CORE_ASSETS.map((url) =>
          cache.add(url).catch(() => {
            // 取得失敗しても install を止めない
          })
        )
      );
    })
  );
  self.skipWaiting();
});

// 有効化時: 古いキャッシュを削除
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys.filter((k) => k !== CACHE_VERSION).map((k) => caches.delete(k))
      )
    )
  );
  self.clients.claim();
});

// fetch時の戦略:
//  - HTML(navigation): ネットワーク優先 → 失敗したらキャッシュ
//    (これにより、index.htmlを更新したらすぐ反映される)
//  - その他(JS/CSS/フォント等): キャッシュ優先 → なければネットから取得して保存
self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;

  // HTML/ドキュメントはネットワーク優先
  if (req.mode === 'navigate' || req.destination === 'document') {
    event.respondWith(
      fetch(req)
        .then((res) => {
          if (res && res.status === 200) {
            const clone = res.clone();
            caches.open(CACHE_VERSION).then((cache) => {
              cache.put(req, clone).catch(() => {});
            });
          }
          return res;
        })
        .catch(() => caches.match(req).then((c) => c || caches.match('./index.html')))
    );
    return;
  }

  // それ以外はキャッシュ優先
  event.respondWith(
    caches.match(req).then((cached) => {
      if (cached) return cached;

      return fetch(req)
        .then((res) => {
          if (res && res.status === 200) {
            const clone = res.clone();
            caches.open(CACHE_VERSION).then((cache) => {
              cache.put(req, clone).catch(() => {});
            });
          }
          return res;
        })
        .catch(() => new Response('', { status: 504 }));
    })
  );
});
