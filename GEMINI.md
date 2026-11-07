# GEMINI.md

## NGUYÊN TẮC TUYỆT ĐỐI
- Mặc định luôn ở chế độ PLANNING
- KHÔNG được sửa code, tạo file, chạy lệnh nếu chưa được yêu cầu rõ ràng
- KHÔNG được lập kế hoạch triển khai khi chưa hiểu rõ vấn đề
- Chỉ phân tích, hỏi, làm rõ trong PLANNING
---

## NGÔN NGỮ GIAO TIẾP (BẮT BUỘC)

- TẤT CẢ phản hồi PHẢI sử dụng TIẾNG VIỆT kể cả Implementation Plan.
- KHÔNG được chuyển sang tiếng Anh trong bất kỳ trường hợp nào.
- KHÔNG trộn Việt – Anh, trừ khi:
  - Tên thư viện
  - Tên framework
  - Tên biến / function / file
  - Thuật ngữ kỹ thuật không có bản dịch phổ biến

Nếu người dùng vô tình dùng tiếng Anh:
- BẠN VẪN PHẢI trả lời bằng TIẾNG VIỆT.

Việc trả lời bằng tiếng Anh khi không được yêu cầu
được xem là VI PHẠM NGHIÊM TRỌNG.

---

## ƯU TIÊN NGÔN NGỮ

Thứ tự ưu tiên khi có xung đột:
1. Quy định ngôn ngữ trong GEMINI.md
2. Ngôn ngữ người dùng đang dùng
3. Mặc định của model

Quy định trong GEMINI.md LUÔN thắng.

---

## BỘ NHỚ DỰ ÁN (BẮT BUỘC TRA CỨU)
Trước khi sửa đổi mã nguồn, tính toán ca trực hoặc thao tác dữ liệu Google Sheets, Agent PHẢI đối chiếu nhanh với:
1. `.agents/memory/learnings.md`: Danh mục các bài học nguyên tử, quy tắc Google Sheets, múi giờ Việt Nam và quy chuẩn giao diện y tế.
2. `.agents/memory/workspace-quirks.md`: Các đặc thù môi trường Windows, Task Scheduler và API nội bộ.

---

## NGUYÊN TẮC LÀM VIỆC
1. Luôn phải tìm kiếm pattern chung của dự án, phân chia tổ chức thư mục, global, constants,...
2. Áp dụng chuẩn React/Next.js Best Practices của Vercel cho hiệu năng (Caching, Bundle Size).

## NGUYÊN TẮC LÀM VIỆC VỚI BUG
1. Khi tôi yêu cầu làm việc với bug thì phải tìm ra nguyên nhân gốc rễ của bug.
2. Nếu không chắc chắn 100% về bug bắt buộc phải search trên internet về bug và tổng hợp kiến thức.

## NGUYÊN TẮC KHI PHÁT TRIỂN TÍNH NĂNG
1. Khi bắt đầu làm việc với tính năng mới bắt buộc phải tìm hiểu kỹ lưỡng về tính năng đó.
2. Nếu không chắc chắn 100% về tính năng bắt buộc phải search trên internet về tính năng và tổng hợp kiến thức.
3. **BẮT BUỘC** sử dụng `graphify` (ví dụ: `graphify query`, `graphify explain`, `graphify path` hoặc kiểm tra `graphify-out/GRAPH_REPORT.md`) để tìm hiểu kiến trúc, tìm code liên quan và đánh giá sự phụ thuộc TRƯỚC KHI bắt đầu triển khai code mới.
4. **Bảo vệ toàn vẹn Google Sheets:** Nghiêm cấm tự ý thay đổi tên tab hoặc thứ tự các cột đã định nghĩa trong `SHEET_HEADERS` tại `src/lib/constants.ts`. Mọi thao tác ghi phải thông qua `src/lib/google-sheets.ts` và kiểm tra logic giới hạn lịch sử 180 ngày.

## NGUYÊN TẮC KHI PHÁT TRIỂN UI
1. Các UI style phải đồng bộ với những gì đã có: nút, màu sắc, font, kích thước, v.v.
2. Tuân thủ Design Guidelines cho giao diện NurseFlow: Bảng màu chủ đạo Teal (`#14b8a6` / `#0d9488`), phông chữ `Be Vietnam Pro` + `IBM Plex Mono`, thẻ kính mờ `glass-card`.

## NGUYÊN TẮC SAU KHI ĐIỀU CHỈNH CODE
1. KHÔNG được tự động mở browser để test sau khi sửa code.
2. Người dùng sẽ tự kiểm tra kết quả trên browser.
3. **Cập nhật VER.md:** BẮT BUỘC cập nhật tệp `VER.md` mỗi khi có yêu cầu nâng phiên bản version (trong `package.json`) hoặc hoàn thành một tính năng lớn.
4. **Xóa tệp tạm:** Sau khi hoàn tất công việc, BẮT BUỘC phải dọn dẹp và xóa bỏ các tệp test, tệp nháp (như `test*.*`, `debug*.*`, `temp*.*`) không nằm trong danh sách cần lưu trữ.
5. **Cập nhật đồ thị tri thức:** Chạy lệnh `graphify update .` sau khi hoàn thành sửa code để đồ thị kiến trúc luôn mới nhất.
