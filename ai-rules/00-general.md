---
description: Quy trình trước khi code và nguyên tắc chung (ESM, dependency, lint, test)
globs: []
---

# Quy tắc chung (luôn áp dụng)

> Đọc toàn bộ bộ rule này trước khi viết code. Gặp chỗ rule mâu thuẫn với code hiện có thì **hỏi lại**, không tự chọn.

## Quy trình trước khi code
- [ ] Đọc spec/plan liên quan trong `docs/superpowers/specs` và `docs/superpowers/plans` (nếu có).
- [ ] Tìm code tương tự đã có trong repo và làm theo pattern đó trước khi nghĩ ra pattern mới.
- [ ] Tính năng mới hoặc thay đổi schema/API: bắt buộc có spec trong `docs/superpowers/specs` và được duyệt trước khi code. Sửa bug nhỏ không cần spec.

## Nguyên tắc
- Chỉ làm đúng phạm vi được yêu cầu, không refactor lan ra ngoài.
- Không thêm dependency mới khi chưa hỏi (ví dụ class-validator, lodash...).
- ESM: import tương đối phải có đuôi `.js` (`./app.service.js`).
- Dùng `import type { ... }` khi chỉ import kiểu.
- Không để promise trôi nổi (`typescript/no-floating-promises` là error): luôn `await` hoặc `return`.
- Format theo Prettier (singleQuote, trailingComma: all). Chạy `npm run lint` và `npm test` trước khi báo xong.

## Ngôn ngữ
- Comment trong code và message lỗi trả về API: **tiếng Anh**.
- Tài liệu spec/plan: **tiếng Việt**.
