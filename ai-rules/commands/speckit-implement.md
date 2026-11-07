---
description: Implement tính năng theo bộ spec đã được developer duyệt (tasks.md)
---

# /speckit-implement

Đầu vào: tên thư mục tính năng trong `docs/superpowers/features/`. Bỏ trống mà chỉ có một tính năng thì dùng tính năng đó; có nhiều thì hỏi developer.

## Điều kiện bắt buộc
Đọc `requirement.md`, `analyze.md`. **Dừng và báo lý do** nếu một trong các điều kiện sau không đạt:
- `requirement_status: approved` và `spec_status: approved`. Nếu developer vừa xác nhận duyệt trong chat mà frontmatter chưa cập nhật thì cập nhật rồi tiếp tục.
- `analyze.md` có `Kết luận: PASS` (không còn `FAIL`).
- Đủ 7 file spec.
- Đang không ở `main`/`master`. Nếu có, nhắc developer tạo branch `<type>/<kebab-case>` (`feat | fix | refactor | chore | docs`); không tự commit.

## Thực hiện
1. Đọc đủ `specify.md`, `plan.md`, `tasks.md`, `checklist.md` và các rule của repo.
2. Làm từng task trong `tasks.md` theo thứ tự `Phụ thuộc`. Xong task nào thì tick checkbox task đó.
3. Viết test cùng lúc với code, chạy `npm test -- <file>` (không chạy `npx jest` trực tiếp).
4. Sau mỗi nhóm task liên quan, chạy lại test của nhóm đó.
5. Cuối cùng chạy `npm run lint`, `npm test`, `npm run build`. Phải pass hết.
6. Đi qua `checklist.md`, tick từng `C*` đã kiểm chứng. Mục nào chưa kiểm chứng được thì ghi lý do bên cạnh.

## Khi gặp lệch so với spec
Không tự ý đổi hướng. Dừng, báo developer, rồi cập nhật spec liên quan (và chạy lại kiểm tra `analyze` nếu thay đổi lớn) trước khi code tiếp.

## Cấm
- Tự commit, push, tạo PR.
- Thêm dependency, dùng transaction, hoặc đổi rule khi chưa được developer đồng ý.
- Làm ngoài phạm vi `tasks.md`, refactor lan ra ngoài.

## Kết thúc
Báo cáo ngắn: task đã xong, kết quả lint/test/build, các mục `checklist.md` còn mở, file đã tạo/sửa.

