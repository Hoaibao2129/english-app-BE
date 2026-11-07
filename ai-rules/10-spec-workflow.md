---
description: Quy trình spec cho tính năng mới (/agent-assistant, /speckit-implement)
globs: []
---

# Quy trình spec cho tính năng mới

Tính năng mới hoặc thay đổi schema/API đi theo bộ lệnh `/agent-assistant` và `/speckit-implement`. Chi tiết từng bước nằm trong lệnh (nguồn: `ai-rules/commands/`), không lặp lại ở đây.

## Nơi lưu
- Mỗi tính năng một thư mục: `docs/superpowers/features/<ten-tinh-nang>/` (kebab-case).
- Gồm 7 file, mỗi file một nhiệm vụ: `requirement.md` (xây gì, vì sao), `clarify.md` (câu hỏi và quyết định), `specify.md` (hệ thống hoạt động thế nào), `plan.md` (cách làm kỹ thuật), `tasks.md` (việc cần làm), `checklist.md` (điều kiện nghiệm thu), `analyze.md` (báo cáo kiểm định).
- Template ở `docs/superpowers/features/_templates/`. Spec cũ trong `docs/superpowers/specs` và `plans` giữ nguyên.

## Luồng
1. `/agent-assistant <mô tả>` chỉ tạo `requirement.md`, rồi **dừng** cho developer review.
2. Developer duyệt requirement, chạy lại `/agent-assistant <ten-tinh-nang>`: chạy lần lượt clarify → specify → plan → tasks → checklist → analyze, rồi **dừng** cho developer review cả bộ.
3. Developer duyệt, chạy `/speckit-implement <ten-tinh-nang>`.

## Quy tắc
- Mọi yêu cầu có ID để truy vết: `R*` (requirement), `S*` (specify), `T*` (task), `C*` (checklist).
- `clarify` hỏi developer trực tiếp, không tự đoán đáp án.
- Không implement khi `analyze.md` còn `FAIL` hoặc developer chưa duyệt.
- Không tự commit, push hay tạo PR (xem rule git).
- Sửa bug nhỏ không cần chạy quy trình này.

