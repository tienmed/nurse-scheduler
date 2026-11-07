# NurseFlow Versioning

## v1.4.0 (2026-11-07)
### Cổng Nhân Sự Cá Nhân PWA, Lịch Vị Trí Buổi/Ngày & Tăng Cường Kháng Lỗi [QWEN3]
- **Tính năng mới - Cổng Nhân Sự Cá Nhân Mobile PWA:**
  - Xây dựng component `MyPersonalScheduleView` hiển thị lịch phân công vị trí theo buổi (sáng/chiều) và theo ngày (Thứ 2 đến Thứ 7) tối ưu cho điện thoại di động.
  - Thẻ nổi bật "Ca trực hôm nay": tra cứu tức thì vị trí phòng trực, khu vực, ghi chú và ca tăng ca Thứ 7.
  - Tích hợp nút hành động 1 chạm "Xin nghỉ ca này" liên kết trực tiếp vào Form đăng ký phép.
  - Nâng cấp cổng `/dang-ky-phep` thành Cổng Nhân Sự Đa Năng 4 tabs (`tab=my-schedule` làm mặc định).
  - Tích hợp Web App Shortcuts trong `src/app/manifest.ts` cho phép truy cập nhanh từ màn hình chính Android & iOS.
- **Kháng lỗi & Điều hướng (Resiliency & Error Boundary):**
  - Xây dựng `src/app/error.tsx` phong cách Teal Glassmorphism với nút "Thử tải lại trang" (`reset()`).
  - Xây dựng `src/app/not-found.tsx` hỗ trợ điều hướng thông minh khi truy cập sai URL.
  - Cập nhật `revalidateWorkspace()` trong `src/app/actions.ts` hỗ trợ revalidate `/room-assignment` và `/dang-ky-phep`.
- **Bảo mật hạ tầng & Tối ưu mạng:**
  - Cấu hình OWASP Security Headers trong `next.config.ts`: `X-Frame-Options`, `X-Content-Type-Options`, `Referrer-Policy`, `Permissions-Policy`.
  - Vô hiệu hóa `poweredByHeader` và kích hoạt nén `compress: true`.
- **Mở rộng kiểm thử tự động (Unit Tests):**
  - Mở rộng bộ kiểm thử lên **33 tests** bao phủ toàn diện: Bảng chấm công tháng (`buildMonthlyTimesheet`), thống kê ngày nghỉ (`calculateMonthlyLeaves`) và trích xuất lịch cá nhân di động.

## v1.3.0 (2026-11-07)
### Antigravity Agent Harness, Kiểm thử tự động & Tối ưu hóa Codebase [QWEN3]
- **Agent Harness & Bộ nhớ dài hạn:**
  - Thiết lập bộ nhớ dự án `.agents/memory/learnings.md` và `.agents/memory/workspace-quirks.md`.
  - Bổ sung cấu hình vai trò chuyên gia `.agents/agents/scheduler-architect.md`.
  - Tích hợp chốt chặn tự động `.agents/hooks.json` (bảo vệ Google Sheets `setup:sheet`, ngăn chặn chỉnh sửa tệp `.env`, chặn lệnh xóa Task Scheduler và tự động dọn tệp nháp).
  - Tích hợp Skill `vercel-react-best-practices` và các workflows tiện ích `/verify`, `/audit-schedule`.
- **Vá bảo mật (Security Patch):**
  - Đưa `AI_API_TOKEN` vào schema Zod `src/lib/env.ts` và `.env.local`, xóa bỏ hoàn toàn token gắn cứng trong mã nguồn.
- **Dọn dẹp & Chất lượng mã nguồn:**
  - Dọn sạch 28 cảnh báo ESLint đưa về trạng thái hoàn hảo 0 errors, 0 warnings.
  - Sửa lỗi font UTF-8 cho ký tự biểu tượng tick `"✔"` trong báo cáo chấm công.
  - Sửa lỗi tương thích TypeScript `tsc --noEmit` đạt 0 errors.
- **Bộ kiểm thử tự động (Testing Suite):**
  - Cài đặt và cấu hình `vitest` cùng cấu hình alias `@/*`.
  - Xây dựng 28 unit tests cho các hàm cốt lõi thời gian (`src/lib/date.ts`) và logic phân ca (`src/lib/schedule.ts`).
  - Tích hợp tự động bước `npm test` vào GitHub Actions CI (`.github/workflows/ci.yml`).

## v1.2.0 (2026-05-12)
### Tối ưu hóa & UI/UX Premium
- **Performance:** Loại bỏ `require` trong loop, memoize các phép tính phức tạp.
- **UI/UX:** Tích hợp Framer Motion cho animation mượt mà.
- **Tính năng:** Thêm thanh tìm kiếm thông minh trên bảng lịch tuần.
- **Design:** Nâng cấp giao diện Glassmorphism, thiết kế lại Sidebar và Mobile Nav.

## v1.1.0 (2026-05-11)
- Thiết lập Google Sheets API và Auth.js.
- Xây dựng thuật toán gợi ý nhân sự cơ bản.
- Triển khai giao diện bảng điều phối (Schedule Board).

## v1.0.0 (2026-05-10)
- Khởi tạo dự án NurseFlow.
- Cấu trúc thư mục Next.js App Router.
