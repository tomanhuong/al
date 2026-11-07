/* MASTER ACTION LEARNING — service worker
   Mục đích duy nhất: app vẫn MỞ ĐƯỢC khi mất mạng.
   Lỡ bấm F5 hay rớt mạng giữa phiên thì vẫn vào lại được, dữ liệu nằm sẵn trong máy.

   Cách đặt: tải file này lên CÙNG THƯ MỤC với trang web (al.tomanhuong.com/sw.js).
   Không cần làm gì thêm — trang tự đăng ký khi mở.

   Nguyên tắc: MẠNG TRƯỚC, KHO SAU.
   - Còn mạng  -> luôn lấy bản mới nhất từ máy chủ, rồi cất vào kho.
   - Mất mạng  -> lấy bản đã cất trong kho ra dùng.
   Nhờ vậy không bao giờ bị kẹt ở một bản app cũ.

   v2 — sửa hai lỗi của v1:
   1. v1 chỉ cất trang vào kho SAU khi nó đã chạy, nên lần mở đầu tiên kho rỗng
      -> nay cất ngay lúc cài đặt (precache), mất mạng là dùng được liền.
   2. v1 dò kho bằng chuỗi `a || b || c` trên các Promise — Promise luôn "đúng"
      nên không bao giờ rơi xuống nhánh cuối, kết quả trả về rỗng và Chrome
      báo ERR_FAILED -> nay dò tuần tự bằng async/await.
*/

const CACHE = 'mal-shell-v2';
const SHELL = ['./', 'index.html'];

self.addEventListener('install', (e) => {
  e.waitUntil((async () => {
    const c = await caches.open(CACHE);
    // Cất sẵn vỏ app ngay khi cài. Lỗi một đường dẫn không được làm hỏng cả bước cài.
    await Promise.all(SHELL.map(u =>
      fetch(new Request(u, { cache: 'reload' }))
        .then(r => (r && r.ok) ? c.put(u, r.clone()) : null)
        .catch(() => null)
    ));
    await self.skipWaiting();          // bản mới thay ngay, không chờ đóng hết tab
  })());
});

self.addEventListener('activate', (e) => {
  e.waitUntil((async () => {
    const ks = await caches.keys();
    await Promise.all(ks.filter(k => k !== CACHE).map(k => caches.delete(k)));
    await self.clients.claim();        // điều khiển luôn tab đang mở
  })());
});

/* Tìm trong kho theo nhiều đường dẫn, trả về cái đầu tiên có */
async function fromCache(req) {
  const c = await caches.open(CACHE);
  const tries = [req, './', 'index.html', '/', '/index.html'];
  for (const t of tries) {
    try {
      const hit = await c.match(t, { ignoreSearch: true });
      if (hit) return hit;
    } catch (e) { /* bỏ qua, thử đường dẫn kế */ }
  }
  return null;
}

self.addEventListener('fetch', (e) => {
  const req = e.request;

  // Chỉ lo phần mở app. Mọi lời gọi Google Apps Script để KỆ cho trang tự xử lý —
  // trang đã có hàng đợi gửi lại riêng, service worker không được chen vào.
  if (req.method !== 'GET') return;
  if (req.url.indexOf('script.google.com') >= 0) return;
  if (req.url.indexOf('script.googleusercontent.com') >= 0) return;

  let sameOrigin = false;
  try { sameOrigin = new URL(req.url).origin === self.location.origin; } catch (err) {}
  const isPage = req.mode === 'navigate'
    || (req.headers.get('accept') || '').indexOf('text/html') >= 0;
  if (!sameOrigin && !isPage) return;   // ảnh Drive, font ngoài… để trình duyệt tự lo

  e.respondWith((async () => {
    try {
      const res = await fetch(req);
      if (res && res.ok) {
        const copy = res.clone();
        caches.open(CACHE).then(c => c.put(req, copy)).catch(() => {});
      }
      return res;
    } catch (err) {
      const hit = await fromCache(req);
      if (hit) return hit;
      return new Response(
        '<!doctype html><meta charset="utf-8">' +
        '<div style="font-family:Arial;padding:40px;max-width:520px;margin:auto;line-height:1.6">' +
        '<h2 style="color:#2B296D">Đang mất mạng</h2>' +
        '<p>Lần đầu mở app cần có mạng một lần để máy nhớ lại. Sau đó mất mạng vẫn mở được.</p>' +
        '<p>Dữ liệu các phiên vẫn nằm nguyên trong máy, không mất.</p></div>',
        { status: 200, headers: { 'Content-Type': 'text/html; charset=utf-8' } }
      );
    }
  })());
});
