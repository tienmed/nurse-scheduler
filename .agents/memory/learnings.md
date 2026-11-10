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
     - **Vị trí Tiếp nhận chỉ cần đúng 2 nhân sự** trong một ca làm việc (không cần phân bổ dư thừa 3 người).
     - **Phúc Anh (DD20)** và **Lyna (Lưu Đào Marry Lyna - DD21)** là 2 nhân sự CHÍNH ở vị trí Tiếp nhận.
     - Luôn phải có ít nhất 1 trong 2 người trực tại vị trí Tiếp nhận trong mọi ca làm việc.
     - Khi **cả 2 cùng nghỉ** trong cùng một ngày/ca, hệ thống BẮT BUỘC phải phát cảnh báo nghiêm trọng.
     - **Thủy (Trần Thanh Thủy - DD11)** là nhân sự HỖ TRỢ tiếp nhận tạm thời trong tháng này khi có người vắng.
  2. **Làm hồ sơ thời vụ (Nhập liệu KSK):**
     - **Thịnh (Nguyễn Phú Thịnh - DD10)** chỉ làm công việc hồ sơ theo thời vụ; các tuần tiếp theo vẫn tiếp tục duy trì làm hồ sơ (không điều chuyển sang phòng khám lâm sàng).
  3. **Hành chính KHNV:**
     - **Tú Trang (Đặng Lê Tú Trang - DD01)** CHỈ làm những công việc hành chính tại phòng KHNV (không điều động sang làm hồ sơ KSK hay tiếp nhận).
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

## 📝 Mẫu Ghi Nhận Bài Học Mới (Template)

```markdown
### [TAG-ID] <Tiêu đề bài học ngắn gọn>
- **Ngày ghi nhận:** YYYY-MM-DD
- **Bối cảnh & Lỗi:** <Mô tả ngắn gọn vấn đề gặp phải>
- **Nguyên nhân gốc rễ:** <Lý do kỹ thuật cốt lõi>
- **Quy tắc phòng ngừa:** <Chỉ dẫn hành động bắt buộc cho các lần sau>
- **Phạm vi:** [Google Sheets | Date & Time | UI Design | Windows Tasks | AI Integration]
```
