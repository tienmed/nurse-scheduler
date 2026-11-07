---
description: Quy trình kiểm tra toàn diện chất lượng mã nguồn (TypeScript, Lint, Unit Tests) và cập nhật đồ thị tri thức kiến trúc graphify.
---

# /verify - Kiểm Tra Toàn Diện & Đồng Bộ Kiến Trúc

Quy trình tự động hóa xác thực mã nguồn trước khi bàn giao tác vụ hoặc đẩy code lên kho lưu trữ.

---

## 1. Các Bước Thực Thi Tuần Tự

```powershell
# Bước 1: Kiểm tra kiểu dữ liệu tĩnh TypeScript
npm run typecheck

# Bước 2: Kiểm tra chuẩn định dạng mã nguồn ESLint
npm run lint

# Bước 3: Chạy toàn bộ các ca kiểm thử tự động
npm test

# Bước 4: Đồng bộ hóa đồ thị tri thức mã nguồn graphify
graphify update .
```

---

## 2. Tiêu Chí Đạt Chuẩn
- `typecheck`: 0 lỗi.
- `lint`: 0 lỗi, 0 cảnh báo.
- `test`: 100% test cases pass.
- `graphify`: Cập nhật thành công số node và edge mới nhất.
