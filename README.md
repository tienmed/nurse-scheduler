# NurseFlow

Ứng dụng web phân công lịch làm việc cho điều dưỡng theo tuần, có thể triển khai từ GitHub và mở rộng dần theo nhu cầu vận hành thực tế.

## Tính năng hiện có

- Lịch nền với 3 chiều dữ liệu: nhân sự, thời gian, vị trí.
- Sinh lịch tuần từ lịch nền.
- Chỉnh lịch đột xuất cho tuần đang vận hành hoặc tuần đã submit.
- Quản lý nhân sự, vị trí và nhập nghỉ phép / nghỉ ốm.
- Xuất lịch tuần ra file Excel.
- Báo cáo tháng theo số ngày làm, số lượt nghỉ và phạm vi vị trí đã phụ trách.
- Đăng nhập Google OAuth theo allowlist / tab `access_control`.
- Quy tắc ca làm cấu hình được qua tab `schedule_rules`.
- Nguồn dữ liệu có thể chạy ở:
  - `demo mode`: dùng dữ liệu mẫu để xem luồng.
  - `live mode`: đọc ghi trực tiếp trên Google Sheets.

## Stack kỹ thuật

- Next.js 16 App Router
- TypeScript
- Tailwind CSS 4
- Auth.js (`next-auth` beta) với Google Provider
- Google Sheets API (`googleapis`)
- ExcelJS để xuất `.xlsx`

## Quy tắc nghiệp vụ hiện tại

App đang dùng `schedule_rules` để xác định những ca nào thật sự tồn tại trong tuần.

Mặc định đang bật:

- Thứ 2 đến Thứ 6: `Sáng`, `Chiều`
- Thứ 7: `Sáng`

Mặc định đang tắt:

- `Chiều thứ 7`

Bạn có thể bật / tắt trực tiếp trong UI ở trang [src/app/template/page.tsx](C:/Users/Thinkpad X280/Documents/Quản lý lịch điều dưỡng/src/app/template/page.tsx) hoặc sửa dữ liệu trong tab `schedule_rules` trên Google Sheets.

## Chạy local

```bash
npm install
npm run dev
```

Mở [http://localhost:3000](http://localhost:3000).

## Cấu hình môi trường

Tạo file `.env.local` từ `.env.example`.

### Google OAuth

Cần các biến:

- `AUTH_SECRET`
- `AUTH_GOOGLE_ID`
- `AUTH_GOOGLE_SECRET`

Redirect URI khi cấu hình OAuth nên bao gồm:

- local: `http://localhost:3000/api/auth/callback/google`
- production: `https://your-domain.com/api/auth/callback/google`

### Google Sheets

Cần các biến:

- `GOOGLE_SHEET_ID`
- `GOOGLE_SERVICE_ACCOUNT_EMAIL`
- `GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY`

Sau khi tạo service account, hãy share Google Sheet cho email service account đó.

Khởi tạo các tab cần thiết:

```bash
npm run setup:sheet
```

Script này sẽ tạo hoặc chuẩn hóa các tab:

- `staff`
- `positions`
- `schedule_rules`
- `template_schedule`
- `weekly_schedule`
- `leave_requests`
- `access_control`

## Cách phân quyền

App xác định quyền theo thứ tự:

1. `AUTHORIZED_ADMIN_EMAILS`
2. `AUTHORIZED_COORDINATOR_EMAILS`
3. `AUTHORIZED_VIEWER_EMAILS`
4. Tab `access_control` trong Google Sheets

Các quyền hiện có:

- `admin`: quản trị toàn bộ
- `coordinator`: điều phối lịch, cập nhật dữ liệu vận hành
- `viewer`: chỉ xem

## GitHub và deploy

### 1. Tạo branch làm việc

Khuyến nghị dùng branch có prefix `codex/`.

### 2. CI sẵn sàng

Repo đã có workflow [ci.yml](C:/Users/Thinkpad X280/Documents/Quản lý lịch điều dưỡng/.github/workflows/ci.yml) để chạy:

- `npm ci`
- `npm run lint`
- `npm run typecheck`
- `npm run build`

### 3. Deploy

Phù hợp nhất là Vercel vì dự án đang là Next.js.

Thiết lập biến môi trường trên Vercel giống `.env.local`.

## Cấu trúc chính

- [src/app/page.tsx](C:/Users/Thinkpad X280/Documents/Quản lý lịch điều dưỡng/src/app/page.tsx): dashboard tổng quan
- [src/app/schedule/page.tsx](C:/Users/Thinkpad X280/Documents/Quản lý lịch điều dưỡng/src/app/schedule/page.tsx): lịch tuần
- [src/app/template/page.tsx](C:/Users/Thinkpad X280/Documents/Quản lý lịch điều dưỡng/src/app/template/page.tsx): lịch nền và quy tắc ca làm
- [src/app/staff/page.tsx](C:/Users/Thinkpad X280/Documents/Quản lý lịch điều dưỡng/src/app/staff/page.tsx): nhân sự, vị trí, nghỉ phép
- [src/app/reports/page.tsx](C:/Users/Thinkpad X280/Documents/Quản lý lịch điều dưỡng/src/app/reports/page.tsx): báo cáo tháng
- [src/auth.ts](C:/Users/Thinkpad X280/Documents/Quản lý lịch điều dưỡng/src/auth.ts): cấu hình Auth.js
- [src/lib/google-sheets.ts](C:/Users/Thinkpad X280/Documents/Quản lý lịch điều dưỡng/src/lib/google-sheets.ts): adapter dữ liệu Google Sheets
- [scripts/setup-google-sheet.mjs](C:/Users/Thinkpad X280/Documents/Quản lý lịch điều dưỡng/scripts/setup-google-sheet.mjs): script khởi tạo Sheet

## Hướng mở rộng tiếp theo

- CRUD đầy đủ cho xóa / chỉnh sửa trực tiếp từng bản ghi.
- Role management ngay trên UI thay vì đọc tab `access_control`.
- Bộ lọc theo khoa / nhóm điều dưỡng.
- Tự động phát hiện quá tải ca liên tiếp.
- Thống kê xoay vòng vị trí theo khoảng liên tục thay vì tổng hợp toàn lịch sử.
- In mẫu biểu Excel theo layout của bệnh viện.
