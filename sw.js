/* MASTER ACTION LEARNING — service worker
   Mục đích duy nhất: app vẫn MỞ ĐƯỢC khi mất mạng.
   Lỡ bấm F5 hay rớt mạng giữa phiên thì vẫn vào lại được, dữ liệu nằm sẵn trong máy.

   Cách đặt: tải file này lên CÙNG THƯ MỤC với trang web (al.tomanhuong.com/sw.js).
   Không cần làm gì thêm — trang tự đăng ký khi mở.

   Nguyên tắc: MẠNG TRƯỚC, KHO SAU.
   - Còn mạng  -> luôn lấy bản mới nhất từ máy chủ, rồi cất vào kho.
   - Mất mạng  -> lấy bản đã cất trong kho ra dùng.
   Nhờ vậy anh không bao giờ bị kẹt ở một bản app cũ.
*/

const CACHE = 'mal-shell-v1';

self.addEventListener('install', (e) => {
  self.skipWaiting();                       // bản mới thay ngay, không chờ đóng hết tab
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys()
      .then(ks => Promise.all(ks.filter(k => k !== CACHE).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (e) => {
  const req = e.request;

  // Chỉ lo phần mở app. Mọi lời gọi Google Apps Script để KỆ cho trang tự xử lý —
  // trang đã có hàng đợi gửi lại riêng, service worker không được chen vào.
  if (req.method !== 'GET') return;
  if (req.url.indexOf('script.google.com') >= 0) return;
  if (req.url.indexOf('script.googleusercontent.com') >= 0) return;

  const sameOrigin = new URL(req.url).origin === self.location.origin;
  const isPage = req.mode === 'navigate' || (req.headers.get('accept') || '').indexOf('text/html') >= 0;
  if (!sameOrigin && !isPage) return;       // ảnh Drive, font ngoài… để trình duyệt tự lo

  e.respondWith(
    fetch(req)
      .then(res => {
        if (res && res.ok) {
          const copy = res.clone();
          caches.open(CACHE).then(c => c.put(req, copy)).catch(() => {});
        }
        return res;
      })
      .catch(() =>
        caches.match(req).then(hit =>
          hit ||
          caches.match('index.html') ||
          caches.match('./') ||
          new Response(
            '<!doctype html><meta charset="utf-8">' +
            '<div style="font-family:Arial;padding:40px;max-width:520px;margin:auto;line-height:1.6">' +
            '<h2 style="color:#2B296D">Đang mất mạng</h2>' +
            '<p>Lần đầu mở app cần có mạng một lần để máy nhớ lại. Sau đó mất mạng vẫn mở được.</p>' +
            '<p>Dữ liệu các phiên của anh vẫn nằm nguyên trong máy, không mất.</p></div>',
            { headers: { 'Content-Type': 'text/html; charset=utf-8' } }
          )
        )
      )
  );
});
