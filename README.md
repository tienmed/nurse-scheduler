# NurseFlow

Ứng dụng web phân công lịch làm việc cho điều dưỡng, thiết kế để triển khai từ GitHub, lưu dữ liệu trên Google Sheets và mở rộng dần theo nhu cầu vận hành thực tế.

## Tính năng chính

- Lịch nền theo 3 chiều dữ liệu: nhân sự, thời gian, vị trí.
- Sinh lịch tuần từ lịch nền.
- Chỉnh lịch đột xuất cho tuần đang chạy hoặc tuần đã submit.
- Quản lý điều dưỡng, vị trí làm việc và nghỉ phép hoặc nghỉ ốm.
- Xuất lịch tuần ra Excel.
- Báo cáo tháng theo số ngày làm, số lượt nghỉ và phạm vi vị trí đã phụ trách.
- Đăng nhập Google OAuth theo phân quyền.
- Dùng được với dữ liệu mẫu hoặc dữ liệu thật trên Google Sheets.

## Stack kỹ thuật

- Next.js 16 App Router
- TypeScript
- Tailwind CSS 4
- Auth.js (`next-auth` beta) với Google Provider
- Google Sheets API (`googleapis`)
- ExcelJS để xuất `.xlsx`

## Quy tắc ca làm mặc định

Đang bật:
- Thứ 2 đến Thứ 6: `Sáng`, `Chiều`
- Thứ 7: `Sáng`

Đang tắt:
- `Chiều Thứ 7`

Các quy tắc này có thể chỉnh trong tab `schedule_rules` của Google Sheets hoặc trong giao diện `Lịch nền`.

## Chạy local

```bash
npm install
npm run dev
```

Mở [http://localhost:3000](http://localhost:3000).

## Cấu hình môi trường

Tạo `.env.local` từ `.env.example`.

### Google OAuth

Cần các biến:
- `AUTH_SECRET`
- `AUTH_GOOGLE_ID`
- `AUTH_GOOGLE_SECRET`

Redirect URI:
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

Script sẽ tạo hoặc chuẩn hóa các tab:
- `staff`
- `positions`
- `schedule_rules`
- `template_schedule`
- `weekly_schedule`
- `leave_requests`
- `access_control`

## Phân quyền

App xác định quyền theo thứ tự:
1. `AUTHORIZED_ADMIN_EMAILS`
2. `AUTHORIZED_COORDINATOR_EMAILS`
3. `AUTHORIZED_VIEWER_EMAILS`
4. Tab `access_control` trong Google Sheets

Các quyền hiện có:
- `admin`: quản trị toàn bộ
- `coordinator`: điều phối lịch, cập nhật dữ liệu vận hành
- `viewer`: chỉ xem

## Kiểm tra chất lượng

```bash
npm run lint
npm run typecheck
npm run build
```

## Deploy lên Vercel

1. Import repo GitHub vào Vercel.
2. Khai báo toàn bộ biến môi trường giống `.env.local`.
3. Đảm bảo redirect URI production đã thêm vào Google OAuth.
4. Deploy.

Nếu dùng domain riêng, cập nhật lại redirect URI production theo domain đó.

## Cấu trúc chính

- `src/app/page.tsx`: tổng quan vận hành
- `src/app/schedule/page.tsx`: lịch tuần
- `src/app/template/page.tsx`: lịch nền và quy tắc ca làm
- `src/app/staff/page.tsx`: nhân sự, vị trí, nghỉ phép
- `src/app/reports/page.tsx`: báo cáo tháng
- `src/auth.ts`: cấu hình Auth.js
- `src/lib/google-sheets.ts`: adapter Google Sheets
- `scripts/setup-google-sheet.mjs`: script khởi tạo Google Sheet

## Hướng mở rộng tiếp theo

- CRUD đầy đủ cho sửa và xóa trực tiếp từng bản ghi.
- Quản lý role ngay trên UI.
- Bộ lọc theo khoa hoặc nhóm điều dưỡng.
- Cảnh báo quá tải hoặc ca liên tiếp.
- Báo cáo xoay vòng vị trí theo khoảng liên tục.
