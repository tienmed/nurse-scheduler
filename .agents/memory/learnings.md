# Nhật Ký Bài Học Kinh Nghiệm Dự Án (NurseFlow Learnings)

> **Mục đích:** Lưu trữ các bài học nguyên tử (Atomic Learnings) về nghiệp vụ điều phối điều dưỡng, cơ sở dữ liệu Google Sheets, và quy chuẩn giao diện để Agent Antigravity không bao giờ mắc lại sai lầm cũ và luôn hành động chính xác.

---

## 📌 Danh Mục Bài Học Cốt Lõi (P0)

### [P0-SHEETS-01] Kiến Trúc Cơ Sở Dữ Liệu Google Sheets
- **Bối cảnh:** Toàn bộ dữ liệu nhân sự, lịch nền, lịch tuần, nghỉ phép và phân quyền được lưu trữ trên bảng tính Google Sheets thông qua Google Sheets API (`googleapis`).
- **Nguyên nhân kỹ thuật & rủi ro:**
  1. Google Sheets có giới hạn kích thước (tối đa 10 triệu ô tính) và giới hạn tần suất gọi API (Rate Limits / Quota).
  2. Thứ tự cột trong từng tab phụ thuộc chặt chẽ vào mảng `SHEET_HEADERS` tại `src/lib/constants.ts`. Nếu đổi thứ tự hoặc xóa cột, serializer trong `src/lib/google-sheets.ts` sẽ ghi lệch dữ liệu.
- **Quy tắc bắt buộc:**
  - **KHÔNG** tự ý thay đổi tên tab (`SHEET_NAMES`) hoặc thứ tự các cột (`SHEET_HEADERS`).
  - Mọi thao tác đọc/ghi phải đi qua adapter `src/lib/google-sheets.ts` và tận dụng React Cache + `revalidateTag` để tối ưu số lần gọi API.
  - Luôn duy trì bộ lọc giới hạn lịch sử 180 ngày gần nhất trong `weeklySchedule` để bảng tính không bị phình to gây nghẽn hiệu năng.
  - Đảm bảo cơ chế tự động thử lại (Retry) với exponential backoff khi gặp mã lỗi HTTP `408`, `425`, `429`, `500`, `502`, `503`, `504`.

---

### [P0-TIME-01] Múi Giờ Việt Nam & Quy Tắc Lập Lịch Tuần
- **Bối cảnh:** Lịch trực của điều dưỡng tính theo tuần (bắt đầu từ Thứ Hai) và chia theo ca Sáng / Chiều.
- **Quy tắc bắt buộc:**
  - **Múi giờ:** Mọi so sánh thời gian và kiểm tra ca trực đã qua (`isPastShift`) phải sử dụng múi giờ Việt Nam (`Asia/Ho_Chi_Minh` / `UTC+7`).
  - **Chủ nhật tự động sang tuần mới:** Khi người dùng mở ứng dụng vào ngày Chủ nhật (`getDay() === 0`), hàm `getWeekStartFromInput` phải tự động trỏ tới Thứ Hai của tuần kế tiếp (`getNextWeekStart`) để điều dưỡng xem lịch tuần tới.
  - **Quy tắc ca làm mặc định:**
    - Thứ 2 đến Thứ 6: Bật cả 2 ca `Sáng` và `Chiều`.
    - Thứ 7: Mặc định **chỉ bật ca Sáng**, ca Chiều tắt.
    - Ca tăng ca Thứ 7 có mã vị trí cố định là `SAT_OT` (`SATURDAY_OT_POSITION_ID`).

---

### [P0-UI-01] Ngôn Ngữ Thiết Kế NurseFlow (Teal & Glassmorphism)
- **Bối cảnh:** Xây dựng giao diện ứng dụng điều phối y tế hiện đại, giảm mỏi mắt cho điều phối viên.
- **Quy tắc bắt buộc:**
  - **Bảng màu:** Màu chủ đạo là dải màu Xanh ngọc Teal (`--teal-500: #14b8a6`, `--teal-600: #0d9488`, `--teal-700: #0f766e`), kết hợp điểm nhấn cam/indigo cho trạng thái cảnh báo.
  - **Typography:** Bắt buộc sử dụng biến font `--font-be-vietnam-pro` cho văn bản giao diện và `--font-plex-mono` cho các mã vị trí, mã nhân sự và bảng số liệu.
  - **Hiệu ứng:** Sử dụng class `.glass-card` (`bg-white/70 backdrop-blur-md border border-white/40 shadow-glass`) cho các bảng lịch và thẻ vị trí để đảm bảo chiều sâu thị giác.

---

### [P0-OPS-01] Tác Vụ Lập Lịch Windows & Cụm AI Nội Bộ
- **Bối cảnh:** Ứng dụng tích hợp các tác vụ nền Windows Task Scheduler và cụm AI chuyên dụng của phòng khám.
- **Quy tắc bắt buộc:**
  - **3 Task Windows:**
    1. `Nusres_Daily_Notify` (`07:30` hằng ngày): Chạy `run-notify.bat` thông báo trực sáng.
    2. `Nusres_Daily_Email` (`19:00` hằng ngày trừ T6/T7): Chạy `run-email.bat` gửi email nhân sự nghỉ phép ngày mai.
    3. `Nusres_Generate_Weekly_Schedule` (`18:00` Chủ nhật): Chạy `run-generate-week.bat` tự động sinh lịch tuần mới.
  - **Cụm AI Nội Viện (`https://pnt.badt.vn`):**
    - `qwen3` (`thinking_mode: true`): Chuyên trách tối ưu hóa lịch trực tháng và báo cáo điều hành.
    - `qwen2.5`: Chuyên trách kiểm tra xung đột ca làm và chính sách lao động.
    - `gemma4`: Soạn tin nhắn thông báo thân thiện.

---

### [P0-OPS-02] Mã Hóa UTF-8 & Giao Diện Email Tương Thích Mobile
- **Ngày ghi nhận:** 2026-11-09
- **Bối cảnh & Lỗi:** Email gửi thông báo nghỉ phép tự động bị lỗi font chữ tiếng Việt (Mojibake: `Ã¡`, `á»‰`, `ðŸ“‹`), bảng dữ liệu 4 cột bị co rúm trên giao diện điện thoại.
- **Nguyên nhân gốc rễ:** 
  1. Tệp script `scripts/email-leaves.mjs` bị lưu dưới dạng mã hóa nhầm (Windows-1252 / ANSI) khiến các chuỗi tiếng Việt tĩnh bị biến thành ký tự rác.
  2. Bảng `<table>` truyền thống bị tràn ngang hoặc co ép các cột trên màn hình điện thoại dưới 400px.
- **Quy tắc phòng ngừa:**
  - Luôn đảm bảo tất cả tệp kịch bản `.mjs` được lưu dưới bảng mã `UTF-8 without BOM`.
  - Mẫu email bắt buộc có `<meta charset="UTF-8">`, `<meta name="viewport" content="width=device-width, initial-scale=1.0">`.
  - Thiết kế danh sách nghỉ phép theo dạng thẻ hàng (Card Item) bo góc, responsive 100% thay vì bảng nhiều cột để đảm bảo trải nghiệm đọc trên mobile mượt mà, không bị co kéo chữ.
- **Phạm vi:** [Windows Tasks | UI Design | Email Notification]

---

### [P0-RULES-01] Quy Chuẩn Điều Phối Vị Trí & Nhân Sự Cố Định
- **Ngày ghi nhận:** 2026-11-10
- **Bối cảnh & Nghiệp vụ:** Điều phối các vị trí then chốt (Tiếp nhận, Hồ sơ thời vụ, Hành chính KHNV).
- **Quy tắc bắt buộc:**
  1. **Tiếp nhận (Sảnh):**
     - **Vị trí Tiếp nhận đúng 2 nhân sự/ca** (không bố trí dư 3 người).
     - Hiện thời **xoay đều giữa 3 điều dưỡng: Lyna (DD21), Phúc Anh (DD20), Thủy (DD11)** để đảm bảo công bằng và sẵn sàng thay thế khi 1 người vắng.
     - Khi có ≥ 2 người trong nhóm xoay nghỉ cùng ca mới bổ sung người khác và phát cảnh báo.
  2. **Làm hồ sơ thời vụ (Nhập liệu KSK):**
     - **Thịnh (Nguyễn Phú Thịnh - DD10)** chỉ làm công việc hồ sơ theo thời vụ; các tuần tiếp theo vẫn tiếp tục duy trì làm hồ sơ (không điều chuyển sang phòng khám lâm sàng).
  3. **Hành chính KHNV:**
     - **Tú Trang (Đặng Lê Tú Trang - DD01)** CHỈ làm những công việc hành chính tại phòng KHNV (không điều động sang làm hồ sơ KSK hay tiếp nhận).
  4. **Cặp phòng Chăm sóc da (P2.4) & Da liễu (P2.6):**
     - `Phòng Chăm sóc da (P2.4)` đi theo lịch hoạt động của phòng `Da Liễu`.
     - Mặc nhiên phân công cho **Mỹ Nhiên (Đoàn Thị Mỹ Nhiên - DD06)** kiêm cả 2 phòng này khi đi làm; chỉ phân điều dưỡng khác vào 2 phòng này khi Mỹ Nhiên nghỉ phép/vắng trong ca đó.
     - Khi cần người hỗ trợ thay thế Mỹ Nhiên, **Chăm sóc da (P2.4) và Da liễu (P2.6) vẫn phải đi đồng bộ cùng 1 điều dưỡng** trong cùng ca (không tách 2 người khác nhau).
  5. **Siêu âm (P1.6), Cấp cứu (P1.7), ECG (P1.8), Phòng khám Chuyên gia, Thanh Trùng & RHM:**
     - **Siêu âm (P1.6), Cấp cứu (P1.7), Đo ECG (P1.8):** Thường trực tất cả các ngày/buổi phòng khám có làm việc (không tắt theo `schedule-embed`).
     - **Siêu âm (P1.6):** Thường trực mặc nhiên là **Bích Thảo (DD09)**; có thêm **Lyna (DD21)** hỗ trợ khi cần.
     - **Phòng khám Chuyên gia:** Thường trực mặc nhiên là **Kim Hoa (DD03)**.
     - **Thanh Trùng & Phòng khám YHCT (P2.5):** Thường trực mặc nhiên là **ĐD Nhân (Lê Thị Nhân - DD16)** (tránh nhầm Đặng Nhân Nghĩa - DD17); khi ĐD Nhân nghỉ phép hoặc cần thay đổi sẽ có **Điệp (Nguyễn Thị Ngọc Điệp - DD07)** hỗ trợ.
     - **Phòng cấp cứu (P1.7) & Phòng đo ECG (P1.8):** Thường trực mặc nhiên là **Ngọc Hạnh (DD02)**.
     - **Phòng khám CTCH (P1.9) & Phòng khám Nội 1 (P.13):** Thường trực mặc nhiên là **Nga (Nhữ Thị Phương Nga - DD04)**.
     - **Phòng khám Phụ - Sản (P1.12), Phòng khám Ngoại (P1.11) & Phòng khám Nội 2 (P1.10):** Thường trực mặc nhiên là **Vĩnh (Nguyễn Thị Vĩnh - DD05)**.
     - **Thứ tự ưu tiên khi cần người thay thế — Tâm thần kinh - Tâm lý, Mắt (P2.3), Da liễu (P2.6) & TMH (P2.7):**
       - Tâm thần kinh - Tâm lý: **Điệp (DD07) → Thủy (DD11) → Ái Liên (DD12) → Chuyền (DD08)**.
       - Mắt: **Chuyền (DD08) → Thủy (DD11) → Ái Liên (DD12)**.
       - Da liễu & CSD: **Mỹ Nhiên (DD06) → Ái Liên (DD12) → Thủy (DD11)** (đi đồng bộ cả 2 phòng).
       - TMH: **Điệp (DD07) → Ái Liên (DD12) → Thủy (DD11) → Chuyền (DD08)**.
     - **Nhóm phòng ít bệnh (tính 0.5 đơn vị tải kiêm nhiệm):** `Phòng khám Ngoại (P1.11)`, `Phòng khám Chuyên gia`, `Dị ứng - Miễn dịch`, `Nội thần kinh (P2.2)`, `Phòng khám Phụ - Sản / Phụ khoa (P1.12)` — ưu tiên ghép kiêm nhiệm cho điều dưỡng lân cận/tải nhẹ thay vì kéo người đang trực phòng đông bệnh.
     - **Phòng khám RHM (KTC):** Bỏ khỏi lịch phân phòng điều dưỡng tự động và email tuần.
  6. **Bảo toàn lịch tuần đã chốt & dự tính mở phòng tuần sau (`schedule-embed`):**
     - Lịch tuần hiện tại đã chốt trên Google Sheets giữ nguyên, tuyệt đối không ghi đè tự động.
     - Khi dự tính lịch tuần sau: nếu `nhansu/schedule-embed` tuần sau có lịch bác sĩ thì áp dụng lịch đó; nếu chưa có lịch bác sĩ thì tự động áp **lịch mở phòng của tuần hiện tại** (`weekStart - 7 ngày`).
- **Phạm vi:** [Schedule Rules | Room Assignment | AI Integration]

---

### [P0-RULES-02] Quy Chuẩn Điều Phối Dự Phòng KHNV & Tích Lũy Kinh Nghiệm Chuyên Môn
- **Ngày ghi nhận:** 2026-11-10
- **Bối cảnh & Nghiệp vụ:**
  1. **Quy chuẩn nhân sự phòng KHNV:**
     - **Thiên Trang** và **ĐD Nghĩa (nghiadn.pk@pnt.edu.vn)** làm việc toàn thời gian tại phòng KHNV.
     - Khi một nhân sự trong ca lâm sàng bị **quá tải (phụ trách $\ge 4$ vị trí trong 1 ca)**: Hệ thống kích hoạt chuỗi điều phối hỗ trợ.
  2. **Chuỗi điều phối hoán chuyển & giải phóng Đo sinh hiệu:**
     - Vị trí **Đo sinh hiệu** theo chuẩn luôn có **2 nhân sự/ca**.
     - **Điều động chi viện từ KHNV:** Ưu tiên **ĐD Nghĩa** (nếu không trùng lịch nghỉ phép hoặc cờ đi học `[DI_HOC]`), trường hợp Nghĩa bận học/phép thì điều động **Thiên Trang**. Nhân sự này sang hỗ trợ trám chỗ tại vị trí Đo sinh hiệu.
     - **Giải phóng nhân sự Đo sinh hiệu:** Trong 2 người đo sinh hiệu, rút người có thâm niên / số giờ làm quen thuộc nhất với vị trí đang quá tải sang phụ trách vị trí quá tải đó.
     - Đảm bảo vị trí Đo sinh hiệu luôn duy trì đủ 2 người và vị trí quá tải được chi viện kịp thời.
  3. **Quy chuẩn tích lũy kinh nghiệm & chuyên môn:**
     - Mỗi ca trực hoàn thành quy đổi thành **4 giờ làm việc chuyên môn**.
     - **Nguyên tắc chia đều khi kiêm nhiệm nhiều vị trí:** Nếu một điều dưỡng phụ trách $n$ vị trí trong cùng 1 ca trực, thì 4 giờ làm việc được chia đều cho $n$ vị trí đó (mỗi vị trí tích lũy $\frac{4}{n}$ giờ kinh nghiệm). Tổng thời gian làm việc thực tế của ca trực luôn bảo toàn đúng 4 giờ.
     - Bảng ma trận tích lũy kinh nghiệm theo lịch sử phân công vị trí (`weeklySchedule`) là cơ sở định lượng để xác định nhân sự "quen thuộc nhất" với từng vị trí công việc khi điều phối chi viện.
- **Phạm vi:** [Schedule Rules | Room Assignment | Workload Reports | AI Integration]

---

### [P0-RULES-03] Phạm Vi & Giới Hạn Của Nội Dung Góp Ý / Điều Chỉnh Lịch Tuần Sau
- **Ngày ghi nhận:** 2026-11-11
- **Bối cảnh & Nghiệp vụ:** Trong email gửi sáng Chủ nhật có nút `[✏️ Góp ý / Điều chỉnh lịch tuần sau →]` trỏ tới `/room-assignment?week=YYYY-MM-DD&openAdjust=1`. Khi người dùng click vào, giao diện sẽ mở cửa sổ đề xuất điều chỉnh thông minh bằng AI.
- **Quy tắc bắt buộc:**
  - **Chỉ phục vụ tham khảo cục bộ:** Nội dung phản hồi/góp ý trong biểu mẫu này CHỈ để AI và người điều phối tham khảo đưa ra các gợi ý hoán đổi ca cho riêng tuần được chỉ định.
  - **Không biến thành kinh nghiệm hay quy tắc chung:** Tuyệt đối KHÔNG đưa nội dung góp ý từ form này vào bảng tính kinh nghiệm giờ làm tích lũy (`calculatePositionExperienceStats` / `experienceLookup`) và KHÔNG tự động biến thành quy tắc bất biến chung (`FIXED_ROOM_STAFF_RULES` / `positionRules`) cho các tuần khác.
- **Phạm vi:** [Schedule Rules | Room Assignment | AI Integration | Email Notification]

---

## 📝 Mẫu Ghi Nhận Bài Học Mới (Template)

```markdown
### [TAG-ID] <Tiêu đề bài học ngắn gọn>
- **Ngày ghi nhận:** YYYY-MM-DD
- **Bối cảnh & Lỗi:** <Mô tả ngắn gọn vấn đề gặp phải>
- **Nguyên nhân gốc rễ:** <Lý do kỹ thuật cốt lõi>
- **Quy tắc phòng ngừa:** <Chỉ dẫn hành động bắt buộc cho các lần sau>
- **Phạm vi:** [Google Sheets | Date & Time | UI Design | Windows Tasks | AI Integration]
```
