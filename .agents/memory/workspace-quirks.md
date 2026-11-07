# Đặc Thù Môi Trường Làm Việc (Workspace Quirks)

> **Mục đích:** Ghi chép các đặc thù kỹ thuật về môi trường phát triển trên Windows, hạ tầng Google Sheets và Next.js 16 của dự án `nurse-scheduler` để Agent không đưa ra các giả định sai lệch.

---

## 🖥️ 1. Môi Trường Hệ Thống & Shell
- **Hệ điều hành:** Windows 10/11, sử dụng shell PowerShell.
- **Thực thi lệnh:**
  - Khi chạy các script `.bat` hoặc lệnh PowerShell có chứa khoảng trắng hoặc biến môi trường, luôn sử dụng dấu ngoặc kép hoặc dùng cú pháp PowerShell chuẩn.
  - Dự án sử dụng cờ `legacy-peer-deps=true` cấu hình tại `.npmrc` để đảm bảo tương thích giữa React 19 và các thư viện phụ thuộc.

---

## ⚙️ 2. Công Nghệ Ứng Dụng (Technology Stack)
1. **Next.js 16.2.1 (App Router) + React 19.2.4:**
   - Server Actions đặt tại `src/app/actions.ts` và `src/app/dang-ky-phep/actions.ts`.
   - Kiểm tra quyền hạn người dùng thông qua `src/lib/session.ts` (`assertAdmin`, `assertEditor`, `canEdit`).
2. **Xác thực Auth.js (`next-auth` beta 30):**
   - Đăng nhập bằng Google Provider với cấu hình tại `src/auth.ts`.
   - Phân quyền 3 cấp độ: `admin`, `coordinator`, `viewer` đối soát qua biến môi trường email allowlist hoặc tab `access_control` trên Google Sheets.
3. **Tailwind CSS 4:**
   - Sử dụng cú pháp mới của Tailwind v4: `@import "tailwindcss";` và `@theme inline` tại `src/app/globals.css`. Không sử dụng tệp `tailwind.config.js` truyền thống.
4. **Google Sheets API (`googleapis` v171):**
   - Xác thực qua Service Account (`GOOGLE_SERVICE_ACCOUNT_EMAIL` và `GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY`).
   - Private Key được định dạng lại ký tự xuống dòng `\n` trong `src/lib/env.ts` trước khi truyền vào `google.auth.JWT`.

---

## 📂 3. Vận Hành & Khởi Tạo
- **Khởi tạo dữ liệu Google Sheets:**
  - Lệnh `npm run setup:sheet` (`scripts/setup-google-sheet.mjs`) chỉ dùng khi thiết lập sheet mới hoàn toàn. Cẩn trọng khi chạy trên sheet đang có dữ liệu thật.
- **Cập nhật đồ thị tri thức:**
  - Dự án tích hợp `graphify` để quản lý kiến trúc. Sau khi chỉnh sửa mã nguồn, chạy `graphify update .` để đồng bộ lại đồ thị.
