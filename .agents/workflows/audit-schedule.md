---
description: Quy trình rà soát và kiểm toán lịch trực điều dưỡng tìm xung đột, ca trùng hoặc vi phạm định mức lao động y tế.
---

# /audit-schedule - Kiểm Toán Lịch Trực Y Tế

Quy trình sử dụng logic phân tích nội bộ kết hợp AI Assistant để đối soát tính hợp lệ của lịch trực tuần hoặc tháng.

---

## 1. Các Hạng Mục Kiểm Toán Cốt Lõi
1. **Xung đột ca trực vs Nghỉ phép:** Đối chiếu danh sách điều dưỡng được phân công vào ca làm việc với các đơn nghỉ phép đã được duyệt (`approved`).
2. **Khoảng cách giữa 2 ca trực liên tiếp:** Đảm bảo điều dưỡng có ít nhất 12 giờ nghỉ ngơi giữa 2 ca làm việc liên tiếp.
3. **Phân bổ công bằng & Xoay vòng vị trí:** Kiểm tra cảnh báo `RotationWarning` trong `src/lib/analysis.ts` để đảm bảo điều dưỡng không bị giữ tại một vị trí nặng quá số tháng quy định.
4. **Vị trí làm thêm ca Thứ 7:** Kiểm tra ca `SAT_OT` đã được gán cho nhân sự có nguyện vọng (`prefersOvertime = true`).

---

## 2. Kích Hoạt Kiểm Toán Nhanh Qua Mã Nguồn
Gọi endpoint `/api/ai/schedule` với tham số `action: "validate"` hoặc chạy script kiểm tra buổi sáng:
```powershell
node --env-file=.env.local scripts/notify-leaves.mjs
```
