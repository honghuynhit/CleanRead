# CleanRead

Chế độ đọc cho Chrome (Manifest V3): trích nội dung chính của bài viết, bỏ quảng cáo, menu, popup, rồi trình bày lại bằng kiểu chữ dễ đọc.

## Cài đặt (chế độ nhà phát triển)

1. Giải nén thư mục `CleanRead`.
2. Mở `chrome://extensions`, bật **Developer mode** ở góc phải.
3. Bấm **Load unpacked**, chọn thư mục vừa giải nén (thư mục chứa `manifest.json`).
4. Ghim biểu tượng CleanRead lên thanh công cụ cho tiện.

## Dùng thế nào

- Bấm biểu tượng CleanRead, rồi bấm **Bật chế độ đọc** — hoặc nhấn **Alt+R**.
- Trong vùng đọc: chọn một đoạn rồi dùng các nút tô sáng, gạch dưới, nghiêng, đậm hoặc ghi chú; các đánh dấu được lưu theo từng bài viết.
- Nút **Aa** để chỉnh hiển thị, nút sao chép, nút in, nút thoát.
- Phím tắt khi đang đọc: `Esc` thoát, `+` / `−` đổi cỡ chữ, `T` đổi nền.

## Có gì

- Ba nền đọc: Ngày, Giấy, Đêm — cùng một tông mực xanh đậm để không chói mắt khi chuyển qua lại.
- Chỉnh cỡ chữ, giãn dòng, bề ngang cột chữ, chữ có chân / không chân, ẩn hiện ảnh. Cấu hình lưu bằng `chrome.storage.sync` nên theo tài khoản Chrome sang máy khác.
- Xem thử ngay trong popup: khung văn bản mẫu đổi theo lựa chọn trước khi bạn bật chế độ đọc.
- Thanh tiến độ đọc, ước lượng thời gian đọc, giữ chú thích ảnh, bảng, khối mã.
- Đánh dấu và ghi chú trực tiếp trong bài viết, lưu bằng `chrome.storage.local` theo URL.
- In sạch: lệnh in chỉ in bài viết, không in lại trang gốc.
- Trang không phải bài viết (trang chủ, trang danh mục) sẽ báo rõ thay vì hiển thị một mớ tiêu đề.

## Vì sao làm theo cách này

- **Không content script chạy nền.** Extension chỉ xin `activeTab`, và chỉ inject khi bạn bấm nút hoặc nhấn phím tắt. Không có host permission cho mọi trang, nên không đọc lén trang nào cả.
- **Không phá trang gốc.** Vùng đọc là một overlay gắn vào shadow DOM, trang bên dưới giữ nguyên. Thoát chế độ đọc là trang trở lại đúng vị trí cuộn cũ, không cần tải lại.
- **Shadow DOM + CSS nội tuyến.** CSS nằm trong chuỗi JS (`src/content/styles.js`) thay vì file tải qua `fetch`, nên không vướng CSP của trang và không bị CSS của trang đè lên.
- **Lọc HTML trước khi hiển thị.** Kết quả của Readability vẫn được rà lại: bỏ `script`, `iframe`, `form`…, gỡ mọi thuộc tính `on*`, chặn `href="javascript:"`, và chỉ giữ các thuộc tính cần cho việc đọc.

## Cấu trúc

```
manifest.json
src/background.js          service worker: nhận lệnh, inject, đặt huy hiệu ON
src/lib/settings.js        mặc định, giới hạn, bảng màu — dùng chung reader + popup
src/content/styles.js      CSS của vùng đọc (chuỗi, nhét vào shadow DOM)
src/content/reader.js      trích nội dung, lọc HTML, dựng giao diện đọc
src/popup/                 popup: bật/tắt + tuỳ chỉnh hiển thị
vendor/Readability.js      Mozilla Readability 0.6.0 (Apache-2.0)
icons/
```

Service worker inject `vendor/Readability.js` → `settings.js` → `styles.js` → `reader.js` đúng một lần cho mỗi tab; những lần bật/tắt sau chỉ gửi thông điệp, tránh khai báo trùng biến trong isolated world.

## Giới hạn

- Không chạy trên `chrome://`, Chrome Web Store, trang PDF và `view-source:` — đây là giới hạn của trình duyệt.
- Với `file://` cần tự bật "Allow access to file URLs" trong trang chi tiết extension.
- Trang dựng hoàn toàn bằng JS phải tải xong nội dung rồi mới bật chế độ đọc.

## Bản quyền phần dùng lại

`vendor/Readability.js` là thư viện của Mozilla, giấy phép Apache-2.0, giữ nguyên trong `vendor/Readability-LICENSE.md`.
