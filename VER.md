# NurseFlow Versioning

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
