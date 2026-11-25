# NurseFlow Versioning

## v1.5.0 (2026-11-25)
### Bổ Sung Giao Diện Duyệt Phép Chờ Xử Lý Trực Tiếp Trên Mobile Cho Quản Lý
- **Tính năng Duyệt phép Mobile-First (`src/components/leave-portal/manager-pending-approvals.tsx`):**
  - Bổ sung tab **"Duyệt phép"** trên cổng `/dang-ky-phep` hiển thị riêng cho Quản lý (`role === 'admin' | 'coordinator'`, `tienmed@gmail.com`, `nghiadn.pk@pnt.edu.vn`).
  - Hiển thị huy hiệu đỏ đếm số lượng ca nghỉ đang chờ duyệt (`pending`) ngay trên thanh điều hướng tabs.
  - Thiết kế dạng thẻ bo tròn tối ưu 100% cảm ứng trên điện thoại (Touch-friendly), hiển thị đầy đủ thông tin nhân sự, ngày, ca, lý do và thời gian nộp đơn.
  - Cho phép Quản lý duyệt 1 chạm hoặc từ chối đơn trực tiếp trên web khi bị trôi/sót email, đồng thời tự động cập nhật Google Sheets và gửi email thông báo kết quả cho nhân sự.
- **Server Actions Quản trị (`src/app/dang-ky-phep/actions.ts`):**
  - Cung cấp `approveLeaveFromWebAction` và `rejectLeaveFromWebAction` bảo mật với cơ chế phân quyền Quản lý nghiêm ngặt.
- **Trang Cổng Nhân Sự (`src/app/dang-ky-phep/page.tsx`):**
  - Tích hợp điều hướng 5 tabs linh hoạt cho Quản lý, tự động phân phối dữ liệu ca chờ duyệt.
- **Kiểm thử & Chất lượng:**
  - `npx tsc --noEmit`: **0 lỗi** kiểu dữ liệu.

## v1.4.9 (2026-11-23)
### Chuyển Đổi Số Duyệt Ký Nghỉ Phép Qua E-Office PNT (Chấm Dứt Bảng Giấy)
- **Chuẩn hóa Quy trình Duyệt ký Nghỉ phép qua E-Office PNT:**
  - Chấm dứt hoàn toàn việc lập và nộp phiếu xin nghỉ phép bằng bảng giấy.
  - Sau khi đăng ký ca nghỉ trên link `/dang-ky-phep` của NurseFlow để hệ thống kiểm soát hạn ngạch (≤ 2 người/ca phép thường, ≤ 3 người/ca đi học) và điều phối tua trực, người làm đơn bắt buộc phải lên hệ thống **E-Office PNT** (`https://e-office.pnt.edu.vn/app/create-jobs`) để lập phiếu xin nghỉ điện tử theo đúng quy định hành chính của Trường ĐH Y khoa Phạm Ngọc Thạch.
- **Cập nhật Toàn Diện Hệ Thống:**
  - **Hằng số hệ thống (`src/lib/constants.ts`):** Khai báo `EOFFICE_PNT_CREATE_JOB_URL = "https://e-office.pnt.edu.vn/app/create-jobs"`.
  - **Dịch vụ Email (`src/lib/email-service.ts`):** Thay thế toàn bộ nội dung hướng dẫn làm phiếu giấy bằng khối hướng dẫn quy định E-Office PNT kèm nút liên kết ngoài mở trực tiếp trang tạo phiếu nghỉ trên E-Office; cập nhật ghi chú email gửi Ban Quản lý.
  - **Cổng Đăng Ký Nghỉ Phép (`src/components/leave-portal/flexible-leave-form.tsx`):** Bổ sung khối thông báo hướng dẫn quy trình duyệt ký E-Office PNT nổi bật kèm nút bấm liên kết; cập nhật chú thích dưới nút gửi đơn.
  - **Server Actions (`src/app/dang-ky-phep/actions.ts`):** Cập nhật thông điệp phản hồi sau khi nộp đơn, nhắc nhở nhân sự hoàn tất thủ tục tạo phiếu trên E-Office PNT.
  - **Trang Duyệt 1-Chạm (`src/app/api/leave/approve/route.ts`):** Cập nhật nội dung thông báo xác nhận duyệt của Quản lý.
  - **Tab Thống Kê Phép (`src/components/leave-portal/my-leave-stats-view.tsx`):** Bổ sung quy định duyệt ký qua E-Office PNT trong danh mục quy chế đơn vị.
  - **Bộ nhớ dự án (`.agents/memory/learnings.md`):** Ghi nhận bài học nguyên tử nghiệp vụ `[P0-LEAVE-EOFFICE-01]`.

## v1.4.8 (2026-11-22)
### Đồng Bộ Lịch Tuần Sau (23/11 - 27/11/2026) & Dời Phòng Khám Nội Thần Kinh Về Cùng Phòng Khám Nội 1 (P.13)
- **Đồng Bộ Lịch Tuần Sau Lên Hệ Thống (`weekly_schedule`):**
  - Đồng bộ chuẩn xác 169 ca trực từ ảnh phân công tuần 23/11/2026 – 27/11/2026 lên Google Sheets.
  - Tích hợp ngày nghỉ lễ Thứ Ba (24/11/2026) không bố trí ca trực.
  - Phân bổ chính xác các ca nghỉ phép / ốm của nhân sự: T2 (Liên, Thủy, Chuyền nghỉ phép; Lyna nghỉ ốm), T4 (Phúc Anh nghỉ phép, Lyna nghỉ ốm), T5 (Phúc Anh nghỉ phép), T6 (Phúc Anh nghỉ cả ngày, Ngọc Hạnh nghỉ ca chiều).
  - Tự động thay thế 183 ca nháp sinh tự động bằng 169 ca trực thực tế (`source: "manual"`, `status: "published"`).
- **Điều Chỉnh Hệ Thống: Phòng Khám Nội Thần Kinh Dời Về Cùng Phòng Khám Nội 1:**
  - **Cơ sở dữ liệu Google Sheets (`positions`):** Cập nhật `position-noi-than-kinh` từ `Nội thần kinh (P2.2)` - `Tầng 1 (cánh T)` thành `Nội thần kinh (P.13)` - `Trệt (cánh P)`, mô tả `Phòng khám Nội thần kinh (dời về ghép chung phòng Nội 1 P.13)`.
  - **Ánh xạ Lịch Bác sĩ (`src/lib/clinic-schedule-api.ts`):** Bổ sung ánh xạ tên chuẩn hóa `nội thần kinh (p.13)` và `nội thần kinh` về `Phòng khám Nội thần kinh` trên Cổng thông tin PNT.
  - **Khu vực và Kiêm nhiệm (`src/lib/schedule.ts`, `src/app/api/schedule/adjust/route.ts`):** Chuyển khu vực phân phòng của Nội thần kinh về Trệt cánh P cùng phòng P.13; cập nhật logic kiểm tra nhân sự Nga (`isNgaStaff`) tránh nhầm lẫn mã DD04 của ĐD Nghĩa.
  - **Bộ nhớ dự án (`.agents/memory/learnings.md`):** Ghi nhận bài học nguyên tử nghiệp vụ `[P0-RULES-01]` cập nhật quy chuẩn phòng Nội thần kinh tại P.13 Trệt cánh P.
- **Dọn dẹp mã nguồn & Xác thực chất lượng toàn diện:**
  - Loại bỏ các biến cảnh báo unused trong `scripts/email-monthly-timesheet.mjs`, `src/app/api/export/monthly/route.ts`, `src/app/reports/page.tsx`, `src/components/room-assignment/smart-export-adjust-modal.tsx`, `src/lib/monthly-email-html.ts`.
  - `npm run typecheck`: **0 lỗi**.
  - `npm run lint`: **0 lỗi, 0 cảnh báo**.
  - `npm test`: **95/95 test cases passed (100%)**.
  - `graphify update .`: Tái cấu trúc thành công đồ thị tri thức mã nguồn (**927 nodes, 2813 edges, 51 communities**).
### Tự Động Duyệt Nghỉ Phép (Người Thứ 1 & 2 Trong Buổi) & Kế Hoạch Gợi Ý Thay Thế Vị Trí Phép Đột Xuất
- **Quy tắc Tự động Duyệt Nghỉ Phép (`src/lib/leave-logic.ts`, `src/app/dang-ky-phep/actions.ts`):**
  - Trích xuất module lõi chuẩn hóa `evaluateSlotQuota` (`src/lib/leave-logic.ts`) dùng chung cho cả Server Action, Form Client và bộ kiểm thử đơn vị.
  - Khi điều dưỡng nộp phiếu xin nghỉ phép (`phep`), nếu buổi đó (Sáng hoặc Chiều) của ngày đó hiện có `< 2` người đã đăng ký/duyệt (tức người đăng ký mới là người đầu tiên hoặc người thứ 2 trong buổi):
    - Hệ thống **tự động phê duyệt chính thức ngay lập tức** (`status: "approved"`).
    - Tự động đính kèm ghi chú hệ thống `[Tự động duyệt nghỉ phép - Định mức ≤ 2 người/buổi]`.
  - Trường hợp buổi đó đã có $\ge 2$ người đăng ký (người mới là người thứ 3 trở đi):
    - Đơn vượt định mức, yêu cầu người gửi đánh dấu "Nghỉ cấp thiết" và điền giải trình.
    - Lưu trạng thái tạm `status: "pending"`, gửi email yêu cầu duyệt 1 chạm tới Quản lý `tienmed@gmail.com`.
  - Hỗ trợ xử lý thông minh đơn nộp nhiều ca hỗn hợp (mixed batch): Các ca người thứ 1-2 được tự động duyệt và gửi email xác nhận ngay lập tức, các ca vượt định mức được chuyển email duyệt tới Quản lý.
  - Khắc phục lỗi tính gộp định mức ca cả ngày (`full-day`) trong bảng tóm tắt gửi Quản lý.
- **Kế Hoạch Gợi Ý Thay Thế Vị Trí Phép Đột Xuất Trong Tuần (`src/lib/substitution-logic.ts`, `src/lib/email-service.ts`):**
  - Tự động phát hiện các ca xin nghỉ phép rơi vào **tuần hiện tại đang trực** (phép đột xuất trong tuần).
  - Truy xuất các vị trí chuyên môn nhân sự đang đảm nhiệm từ `weekly_schedule` (hoặc lịch nền `template_schedule` nếu chưa gán tuần).
  - Tích hợp thuật toán xếp hạng ứng viên thông minh `generateLeaveSubstitutionPlan`:
    - Loại trừ các nhân sự bận nghỉ phép hoặc đi học trong cùng ca.
    - Áp dụng các quy chuẩn vàng theo phòng (`FIXED_ROOM_STAFF_RULES` & `SPECIALTY_POOL_RULES`): Siêu âm (Bích Thảo/Lyna), Tiếp nhận (nhóm xoay Lyna, Phúc Anh, Thủy), Cặp Da liễu & CSD (Mỹ Nhiên, Ái Liên, Thủy), Tâm thần kinh (Điệp, Thủy, Ái Liên, Chuyền), Mắt (Chuyền, Thủy, Ái Liên), TMH (Điệp, Ái Liên, Thủy, Chuyền), Thanh trùng & YHCT (Điệp hỗ trợ ĐD Nhân), Chuyên gia (Kim Hoa).
    - Ưu tiên nhân sự rảnh ca hoàn toàn (`Rảnh chưa có ca`), nhân sự kiêm nhiệm phòng ít bệnh ($\le 0.5$ tải) hoặc điều động dự phòng KHNV (ĐD Nghĩa / Thiên Trang trám Đo sinh hiệu).
    - Cung cấp số giờ kinh nghiệm tích lũy tại vị trí đó làm cơ sở tham khảo thuyết phục.
  - **Giao diện Email Gửi Riêng Cho ĐD Nghĩa & Quản lý Tiến:**
    - Gắn khối giao diện nổi bật `🔄 Kế hoạch gợi ý thay thế vị trí phép đột xuất (Tuần này)` vào email gửi riêng tới **ĐD Nghĩa** (`nghiadn.pk@pnt.edu.vn`) và **Quản lý Tiến** (`tienmed@gmail.com`).
    - Email gửi cho cá nhân điều dưỡng xin nghỉ được bảo mật, chỉ chứa xác nhận lịch nghỉ cá nhân mà không hiển thị khối gợi ý điều hành nội bộ này.
    - Cung cấp liên kết trực tiếp 1-chạm mở bảng Phân phòng tuần (`/room-assignment?week=...&openAdjust=1`) để Ban Quản lý thuận tiện điều chỉnh ngay trên hệ thống.
- **Thông Báo Đã Duyệt Kèm Cho tienmed & ĐD Nghĩa (`src/lib/email-service.ts`, `src/app/api/leave/approve/route.ts`):**
  - Mở rộng hàm `sendLeaveApprovedNotificationEmail`: khi gửi thông báo duyệt thành công (cả tự động duyệt lẫn quản lý duyệt 1 chạm), danh sách BCC được đồng gửi tới **cả Quản lý tienmed (`tienmed@gmail.com`) bên cạnh ĐD Nghĩa (`nghiadn.pk@pnt.edu.vn`)**.
  - Thiết kế tiêu đề email riêng `[TỰ ĐỘNG PHÊ DUYỆT]` hoặc `[ĐIỀU PHỐI PHÉP ĐỘT XUẤT]` khi có ca nghỉ trong tuần.
  - Tự động lọc trùng lặp nếu người nhận chính (`to`) là chính Quản lý hoặc ĐD Nghĩa.
  - Chuẩn hóa màu sắc y tế (bỏ hoàn toàn mã màu tím `purple` trong thẻ ca).
- **Cập nhật Giao diện Cổng Đăng Ký (`src/components/leave-portal/flexible-leave-form.tsx`):**
  - Tích hợp trực tiếp module chuẩn `evaluateSlotQuota`, đảm bảo đồng bộ 100% giữa giao diện và server.
  - Nhãn hiển thị định mức từng ca thông báo trực quan: `Định mức ca: X/2 người đã nghỉ (Người thứ X+1 - Tự động duyệt ngay)`.
  - Nút bấm và thông tin trợ giúp phân biệt rõ ràng giữa ca được tự động duyệt ngay và ca vượt định mức cần quản lý phê duyệt.
- **Kiểm thử Đơn vị (`tests/unit/leave-approval.test.ts`, `tests/unit/leave-substitution.test.ts`):**
  - Bổ sung 11 ca kiểm thử mới trong `tests/unit/leave-substitution.test.ts`: kiểm tra nhận diện ngày trong tuần vs ngoài tuần, đối chiếu vị trí từ `weekly_schedule`, fallback sang `template_schedule`, loại trừ nhân sự bận nghỉ/học, ca cả ngày `full-day`, render bảng HTML Teal chuẩn y tế không màu tím, và xác thực email người nhận.
  - Toàn bộ **95/95 unit tests** vượt qua (6/6 test files), **0 lỗi TypeScript**.

## v1.4.6 (2026-11-15)
### Tự Động Xuất & Gửi Email Bảng Chấm Công Tháng Cũ Vào Ngày Đầu Tháng Mới
- **Kịch bản tự động xuất Excel & gửi Email (`scripts/email-monthly-timesheet.mjs`):**
  - Tự động xác định tháng vừa qua theo múi giờ Việt Nam (`Asia/Ho_Chi_Minh` / `UTC+7`) khi chạy vào ngày đầu tháng, hoặc tùy biến tháng qua đối số CLI `--month=YYYY-MM` / `--month YYYY-MM`.
  - Kết nối trực tiếp Google Sheets API, tải dữ liệu bảng `weekly_schedule`, `leave_requests`, `leave_cancellations`, `staff`, `positions`, `schedule_rules`, `holidays`.
  - Tích hợp module tạo file Excel chuẩn [monthly-timesheet-excel.ts](file:///E:/App%20Nurses/src/lib/monthly-timesheet-excel.ts) (`ExcelJS`): chia 2 ca Sáng/Chiều từng ngày, đánh dấu ký hiệu trực (`✔`, `T`, `P`, `H`, `O`), viền ô và tô màu phân loại.
  - Tự động tính toán loại trừ phép đã hủy (`leave_cancellations`) đồng bộ tuyệt đối với logic hệ thống.
  - Soạn nội dung email HTML trang trọng mang phong cách thương hiệu NurseFlow (bảng màu Teal & responsive card) tóm tắt nhanh số ngày công, số phép và thông báo đính kèm file Excel chi tiết: `Bao_Cao_Cham_Cong_Thang_MM_YYYY.xlsx`.
- **Danh sách người nhận mặc định:**
  - ĐD Đặng Lê Tú Trang: `trangdlt@pnt.edu.vn` (DD01)
  - ĐD Đặng Nhân Nghĩa: `nghiadn.pk@pnt.edu.vn` (DD17)
  - BS. Trịnh Trung Tiến: `tienmed@gmail.com`
  - Hỗ trợ ghi đè linh hoạt qua cờ dòng lệnh `--to=email1,email2` hoặc biến môi trường `MONTHLY_TIMESHEET_RECIPIENTS`.
- **Tập lệnh thực thi & Tác vụ Windows Task Scheduler:**
  - [scripts/run-monthly-timesheet.bat](file:///E:/App%20Nurses/scripts/run-monthly-timesheet.bat): Điều hướng về thư mục gốc dự án, ép cổng SMTP SSL 465 và nạp `.env.local` cùng `email.env`.
  - [scripts/install-monthly-timesheet-task.bat](file:///E:/App%20Nurses/scripts/install-monthly-timesheet-task.bat): Đăng ký tác vụ **`Nusres_Monthly_Timesheet_Email`** trên Windows Task Scheduler kích hoạt vào lúc **08:00** sáng ngày 1 hàng tháng (`/sc monthly /d 1 /st 08:00 /f`), xử lý an toàn đường dẫn chứa khoảng trắng.
- **Kiểm thử & Độ tin cậy:**
  - Mở rộng bộ kiểm thử đơn vị với 17 test cases mới trong [tests/unit/monthly-timesheet.test.ts](file:///E:/App%20Nurses/tests/unit/monthly-timesheet.test.ts).
  - Toàn bộ 63/63 unit tests vượt qua, 0 lỗi TypeScript, 0 tệp tạm phát sinh.

## v1.4.5 (2026-11-11)
### Phân Bổ Lịch Tuần Tự Động Theo Kinh Nghiệm & Thói Quen + Email Sáng Chủ Nhật
- **Thuật toán sinh lịch thông minh (`src/lib/schedule.ts`, `src/lib/repository.ts`):**
  - Tự động chấm điểm và phân bố nhân sự tuần mới dựa trên **kinh nghiệm tích lũy** ($4/n$ giờ từ `calculatePositionExperienceStats`) kết hợp **thói quen phân công 1–2 tuần gần đây** (`buildRecentHabitStats`, trọng số tuần $t-1$ cao hơn $t-2$) và lịch nền.
  - Giữ nguyên các quy tắc vàng: Tiếp nhận đúng 2 người/ca **xoay đều giữa Lyna, Phúc Anh, Thủy**, Thịnh cố định KSK, Tú Trang cố định KHNV, tự động giải phóng quá tải ($\ge 4$ vị trí/ca) qua Đo sinh hiệu và KHNV (ưu tiên Nghĩa nếu không bận phép/học, sau đó Thiên Trang).
  - Bổ sung bảng quy tắc điều dưỡng thường trực cố định theo phòng (`FIXED_ROOM_STAFF_RULES`):
    - `Phòng Chăm sóc da (P2.4)` & `Phòng khám Da liễu (P2.6)`: mặc nhiên Mỹ Nhiên, luôn đi đồng bộ cùng 1 điều dưỡng kể cả khi thay thế Nhiên.
    - `Phòng Siêu âm (P1.6)`: thường trực Bích Thảo (hỗ trợ Lyna khi cần).
    - `Phòng khám Chuyên gia`: thường trực Kim Hoa.
    - `Thanh Trùng` & `Phòng khám YHCT (P2.5)`: mặc nhiên ĐD Nhân (`Lê Thị Nhân` - `DD16`), khi nghỉ/thay đổi có Điệp (`DD07`) hỗ trợ.
    - `Phòng cấp cứu (P1.7)` & `Phòng đo ECG (P1.8)`: mặc nhiên Ngọc Hạnh (`DD02`).
    - `Phòng khám CTCH (P1.9)` & `Phòng khám Nội 1 (P.13)`: mặc nhiên Nga (`DD04`).
    - `Phòng khám Phụ - Sản (P1.12)`, `Phòng khám Ngoại (P1.11)` & `Phòng khám Nội 2 (P1.10)`: mặc nhiên Vĩnh (`DD05`).
    - Thứ tự ưu tiên mặc nhiên & khi cần người thay thế: **Tâm thần kinh - Tâm lý** (Điệp → Thủy → Ái Liên → Chuyền); **Mắt (P2.3)** (Chuyền → Thủy → Ái Liên); **Da liễu / CSD** (Nhiên → Ái Liên → Thủy); **TMH (P2.7)** (Điệp → Ái Liên → Thủy → Chuyền).
    - **Nhóm phòng ít bệnh** (`Ngoại P1.11`, `Chuyên gia`, `Dị ứng - Miễn dịch`, `Nội thần kinh P2.2`, `Phụ khoa / Phụ - Sản P1.12`): tính 0.5 đơn vị tải khi kiêm nhiệm để ưu tiên ghép chung nhẹ nhàng thay vì dồn sang phòng đông bệnh.
    - `Siêu âm (P1.6)`, `Phòng cấp cứu (P1.7)`, `Phòng đo ECG (P1.8)` luôn mở ở mọi ngày/buổi phòng khám làm việc; **bỏ `Phòng khám RHM (KTC)`** khỏi lịch phân phòng và email.
  - Cập nhật `suggestStaffForSlot` và `/api/schedule/adjust` dùng cùng số liệu kinh nghiệm tích lũy và thói quen 14 ngày gần nhất.
- **Đối chiếu phòng khám hoạt động từ `nhansu/schedule-embed` (`src/lib/clinic-schedule-api.ts`):**
  - Tự động đọc lịch bác sĩ tuần mới từ `schedule-embed?week_start=YYYY-MM-DD` cho 17 vị trí phòng khám (gồm `Phòng Chăm sóc da (P2.4)` đi theo `Da Liễu`, `Phòng khám CTCH (P1.9)` theo `Cơ xương khớp - Y học thể dục thể thao`, và không gộp `BHYT Nội`/`BHYT Ngoại`, không tính `Phòng khám RHM (KTC)`, giữ `Siêu âm`/`Cấp cứu`/`ECG` thường trực).
  - Không thay đổi/ghi đè lịch tuần hiện tại đã chốt; khi dự tính tuần sau mà `schedule-embed` tuần sau chưa có lịch bác sĩ, tự động áp lịch mở phòng của tuần hiện tại (`weekStart - 7 ngày`) trước khi fallback về lịch nền.
- **Email dự thảo lịch tuần sau sáng Chủ nhật (`scripts/email-weekly-schedule.mjs`, `src/lib/weekly-email-html.ts`):**
  - Dựng HTML 2 bảng nửa tuần (`Thứ 2 – Thứ 4` và `Thứ 5 – Thứ 7`) giữ màu theo khu vực và dòng `Phép`, tối ưu hiển thị Gmail di động & máy tính.
  - Gửi trực tiếp tới Nghĩa và Tiến vào `08:00` sáng Chủ nhật qua script độc lập Google Sheets (không phụ thuộc `localhost:3000`) và **không ghi tên/email người nhận trong nội dung email**.
  - Tích hợp nút **Xác nhận chốt lịch chính thức** (`/api/schedule/confirm` xác thực HMAC-SHA256 chuyển `status: "published"`) và link **Góp ý / Điều chỉnh** (`/room-assignment?week=...&openAdjust=1`).
  - **Giới hạn phạm vi Góp ý / Điều chỉnh:** Nội dung góp ý từ link email này chỉ mang tính tham khảo để AI đề xuất hoán đổi ca cho riêng tuần đó, tuyệt đối không đưa vào dữ liệu kinh nghiệm tích lũy lâu dài hay quy tắc chung.

## v1.4.4 (2026-11-10)
### Thống Kê Tích Lũy Kinh Nghiệm Chuyên Môn & Điều Phối Dự Phòng KHNV - Đo Sinh Hiệu [QWEN3]
- **Thống kê tích lũy kinh nghiệm, chuyên môn theo vị trí việc làm (`src/lib/schedule.ts`, `/reports`):**
  - Định lượng hóa năng lực chuyên môn: Mỗi ca trực hoàn thành quy đổi thành 4 giờ làm việc chuyên môn.
  - **Nguyên tắc chia đều khi kiêm nhiệm n vị trí:** Nếu 1 điều dưỡng làm $n$ vị trí trong cùng 1 ca thì 4 giờ được chia đều (mỗi vị trí nhận $\frac{4}{n}$ giờ kinh nghiệm), bảo toàn tổng thời lượng thực tế của ca trực.
  - Xây dựng hàm `calculatePositionExperienceStats` gom nhóm theo từng ca (`date + shift`) để phân bổ chính xác số giờ kinh nghiệm theo công thức $\frac{4}{n}$ và xác định vị trí nòng cốt/sở trường.
  - Thiết kế bảng ma trận trực quan phong cách Teal Glassmorphism tại trang Báo cáo (`/reports`) với 2 chế độ xem: Toàn bộ lịch sử hoặc Theo tháng đang chọn.
  - Phủ màu nhiệt (heatmap) nhận diện cấp bậc kinh nghiệm: `< 20h` (làm quen), `20h - 80h` (thuần thục), `> 80h` (nòng cốt / chuyên gia vị trí).
- **Xuất Excel ma trận tích lũy chuyên môn độc lập (`/api/export/experience`):**
  - Tích hợp endpoint xuất file `.xlsx` đầy đủ tiêu chuẩn và định dạng chuyên nghiệp với các cột chi tiết từng vị trí, tổng số ca, tổng số giờ quy đổi và vị trí sở trường.
- **Nghiệp vụ điều phối dự phòng KHNV & Giải phóng Đo sinh hiệu khi quá tải (`/api/schedule/adjust`):**
  - Quy định nhân sự phòng KHNV: Thiên Trang và ĐD Nghĩa (`nghiadn.pk@pnt.edu.vn`) làm việc toàn thời gian tại KHNV.
  - Phát hiện quá tải: Khi 1 nhân sự phụ trách $\ge 4$ vị trí trong 1 ca trực.
  - Cơ chế hoán chuyển:
    - Rút 1 nhân sự từ vị trí Đo sinh hiệu (chuẩn 2 người/ca) có số giờ làm / chuyên môn quen thuộc nhất với vị trí bị quá tải để chi viện cho vị trí đó.
    - Điều động nhân sự từ KHNV vào trám chỗ tại Đo sinh hiệu: Ưu tiên ĐD Nghĩa (nếu không có lịch nghỉ phép hoặc đi học `[DI_HOC]`), trường hợp Nghĩa bận học/phép thì điều động Thiên Trang.
    - Đảm bảo vị trí Đo sinh hiệu luôn duy trì đủ 2 người và vị trí quá tải được san sẻ tức thì.
- **Cảnh báo quá tải trực quan trên ma trận phân phòng (`matrix-cell.tsx`):**
  - Tự động hiển thị nhãn cảnh báo đỏ "Quá tải (X phòng)" khi 1 điều dưỡng được gán $\ge 4$ vị trí trong cùng 1 ca.
- **Chất lượng mã nguồn:**
  - 100% Next.js 16 production build pass, 19/19 routes compiled successfully.

## v1.4.3 (2026-11-10)
### Điều chỉnh lịch thông minh (AI) & Xuất Excel Ma trận theo khu vực theo phân quyền [QWEN3]
- **Tích hợp nút điều chỉnh đa cổng theo phân quyền (`SmartAdjustTriggerButton`):**
  - Tích hợp tại Cổng Nhân Sự Cá Nhân (`/dang-ky-phep`), Cổng Lịch Tuần (`/schedule`) và Cổng Phân Phòng (`/room-assignment`).
  - Kiểm soát phân quyền: Chỉ hiển thị cho `tienmed@gmail.com`, `nghiadn.pk@pnt.edu.vn`, `bstien@pnt.edu.vn` và các vai trò `admin`/`coordinator`. Nhân sự thông thường tự động ẩn nút.
- **Hệ thống phản hồi ngôn ngữ tự nhiên & Tính toán tối ưu (`/api/schedule/adjust`):**
  - Cho phép người dùng nhập góp ý bằng văn bản tự nhiên kèm 2 tùy chọn phạm vi: Tuần hiện tại (chỉ điều chỉnh ca/ngày chưa diễn ra trong tương lai theo múi giờ Việt Nam UTC+7) hoặc Tuần tiếp theo.
  - Tự động áp dụng các ràng buộc nghiệp vụ: Vị trí Tiếp nhận đúng 2 nhân sự/ca, cảnh báo đỏ khi cả Phúc Anh và Lyna cùng vắng mặt, Thủy hỗ trợ tiếp nhận tạm, Thịnh làm hồ sơ KSK thời vụ, Tú Trang cố định hành chính KHNV.
  - Trả về bảng Diff so sánh các điểm thay đổi trực quan và danh sách khuyến nghị điều phối.
- **Xuất Excel ma trận theo khu vực & dòng nghỉ phép (`/api/export/room-matrix`):**
  - Hỗ trợ xuất file Excel `.xlsx` trực tiếp theo Phương án A để người dùng tải về máy tính rà soát ngoại tuyến trước khi lưu vào hệ thống.
  - Tự động gom nhóm theo Khu vực màu sắc (Tiếp nhận, Khám chuyên khoa, Thủ thuật,...) và tổng hợp danh sách nghỉ phép theo ca.
- **Chất lượng mã nguồn:**
  - 100% TypeScript compile pass (`tsc --noEmit`), 18/18 Next.js routes optimized production build.

## v1.4.2 (2026-11-10)
### Tự động phê duyệt lịch nghỉ đi học & Quản lý nhân sự diện đào tạo [QWEN3]
- **Nhận diện nhân sự diện đi học (`src/lib/study-staff.ts`):**
  - Tự động nhận diện nhân sự thuộc diện đào tạo/đi học thông qua cờ `[DI_HOC]` trong ghi chú nhân sự (`notes`) hoặc cấu hình mặc định (bao gồm ĐD Nghĩa `nghiadn.pk@pnt.edu.vn`).
- **Giao diện Cổng Portal (`/dang-ky-phep`):**
  - Mở quyền đăng ký lý do "Đi học" (`dihoc`) trên Form đăng ký linh hoạt cho nhân sự thuộc diện đào tạo.
  - Cập nhật hiển thị định mức theo buổi: hiển thị rõ trạng thái tự động duyệt (định mức $\le 3$ người/buổi) hoặc cảnh báo chuyển Quản lý duyệt nếu buổi đó đã có $\ge 3$ người nghỉ trước đó.
- **Cơ chế Tự động duyệt & Phân luồng gửi email:**
  - Logic đếm số người nghỉ theo từng buổi (Sáng / Chiều): Nếu đăng ký đi học vào buổi có $\le 3$ người nghỉ $\rightarrow$ Tự động duyệt ngay (`status: approved`), chỉ gửi email xác nhận thành công riêng cho cá nhân người đăng ký (không gửi Quản lý, không gửi BCC).
  - Nếu đăng ký đi học vào buổi có $> 3$ người nghỉ (từ người thứ 4 trở lên) $\rightarrow$ Chuyển trạng thái chờ duyệt (`status: pending`) và gửi email duyệt 1 chạm tới Quản lý (`tienmed@gmail.com`).
- **Chất lượng mã nguồn:**
  - Đạt 100% TypeScript type check (`tsc --noEmit`).

## v1.4.1 (2026-11-07)
### Vá khẩn cấp: Khôi phục bảng mã UTF-8 chuẩn cho toàn bộ 12 tệp giao diện [QWEN3]
- Khắc phục hoàn toàn lỗi font chữ (Mojibake Double-UTF8) trên trang Đăng ký phép (`flexible-leave-form.tsx`), Bảng phân ca (`schedule-board.tsx`), Phân phòng (`room-assignment/`), và các hàm tính toán (`schedule.ts`).
- Bảo đảm 100% tệp tin nguồn hiển thị tiếng Việt có dấu chuẩn xác trên tất cả thiết bị di động và máy tính.
- Đạt chuẩn kiểm thử 33/33 unit tests passed, 0 ESLint warnings, 0 TypeScript errors.

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
