// Service Worker for ひらがな クイズ
// オフライン対応: 初回アクセス後、ネットなしでも動作する

const CACHE_VERSION = 'hiragana-v1';
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

// fetch時: キャッシュ優先、なければネット取得して保存
self.addEventListener('fetch', (event) => {
  const req = event.request;
  // GET以外はそのままパス
  if (req.method !== 'GET') return;

  event.respondWith(
    caches.match(req).then((cached) => {
      if (cached) return cached;

      return fetch(req)
        .then((res) => {
          // 同一オリジン or フォントは保存。それ以外もできるだけ保存。
          if (res && res.status === 200) {
            const clone = res.clone();
            caches.open(CACHE_VERSION).then((cache) => {
              cache.put(req, clone).catch(() => {});
            });
          }
          return res;
        })
        .catch(() => {
          // オフラインで未キャッシュの場合: HTML要求なら index.html を返す
          if (req.destination === 'document') {
            return caches.match('./index.html');
          }
          return new Response('', { status: 504 });
        });
    })
  );
});
