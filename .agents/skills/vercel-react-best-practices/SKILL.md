---
name: vercel-react-best-practices
description: Hướng dẫn tối ưu hóa hiệu năng React 19 và Next.js 16 (App Router) từ Vercel Engineering cho dự án NurseFlow. Sử dụng khi xây dựng component, tối ưu tải dữ liệu Google Sheets, loại bỏ waterfall, giảm kích thước bundle và tránh re-render thừa.
---

# Quy Chuẩn Hiệu Năng Vercel React & Next.js 16 (`NurseFlow`)

> **Triết lý:** Loại bỏ hiện tượng nghẽn tuần tự (*waterfalls*) đầu tiên, tối ưu kích thước gói *bundle* thứ hai, và tối ưu hóa hiển thị giao diện thứ ba.

---

## 1. Loại Bỏ Thác Dữ Liệu Tuần Tự (Eliminating Waterfalls)
- **Tải song song độc lập:** Khi gọi dữ liệu từ nhiều nguồn hoặc nhiều tab Google Sheets, luôn gom nhóm bằng `Promise.all()` thay vì `await` nối tiếp.
- **Tách nhánh `await`:** Chỉ đặt `await` bên trong nhánh logic thực sự cần dùng dữ liệu đó, tránh chặn toàn bộ luồng render phía trên.
- **Server Components làm việc nặng:** Giữ các tác vụ đọc dữ liệu Google Sheets nặng ở Server Components, truyền dữ liệu đã chuẩn hóa xuống Client Components qua props phẳng.

---

## 2. Tối Ưu Kích Thước Bundle (Bundle Size Optimization)
- **Tree-shaking Icon:** Import cụ thể từng icon từ `lucide-react` (ví dụ: `import { Calendar, Clock } from "lucide-react"`).
- **Tránh thư viện dư thừa:** Không cài đặt các thư viện định dạng ngày tháng trùng lặp; dự án đã chuẩn hóa 100% trên `date-fns v4`.
- **Tách biệt Client Boundaries:** Chỉ gắn directive `"use client"` ở component lá (leaf components) thực sự cần tương tác chuột hoặc state, không bọc `"use client"` trên toàn trang.

---

## 3. Tối Ưu Hóa Render & State (Re-render Optimization)
- **Bảng ma trận phân phòng (`RoomAssignmentManager`):** Sử dụng `useMemo` cho các bảng tra cứu phụ thuộc danh sách nhân sự và vị trí, tránh tính toán lại mỗi khi điều phối viên rê chuột kéo thả thẻ.
- **Cập nhật lạc quan (Optimistic UI):** Dùng `useTransition` khi lưu lịch trực tuần hoặc xác nhận nghỉ phép để giao diện phản hồi tức thì trong khi Server Action đang gửi yêu cầu lên Google Sheets.
