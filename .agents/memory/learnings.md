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

## 📝 Mẫu Ghi Nhận Bài Học Mới (Template)

```markdown
### [TAG-ID] <Tiêu đề bài học ngắn gọn>
- **Ngày ghi nhận:** YYYY-MM-DD
- **Bối cảnh & Lỗi:** <Mô tả ngắn gọn vấn đề gặp phải>
- **Nguyên nhân gốc rễ:** <Lý do kỹ thuật cốt lõi>
- **Quy tắc phòng ngừa:** <Chỉ dẫn hành động bắt buộc cho các lần sau>
- **Phạm vi:** [Google Sheets | Date & Time | UI Design | Windows Tasks | AI Integration]
```
