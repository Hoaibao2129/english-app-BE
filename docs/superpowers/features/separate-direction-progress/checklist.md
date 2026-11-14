# Checklist: Tách tiến độ học theo chiều Anh-Việt và Việt-Anh (separate-direction-progress)

> File này trả lời: **Những điều kiện cần kiểm tra trước khi hoàn thành?** Mỗi mục gắn với một spec.

- [x] **C1** (S1) Trả lời cùng một từ ở `en_vi` và `vi_en` tạo 2 bản ghi tiến độ riêng cho user đó.
- [x] **C2** (S2) Trả lời ở `en_vi` không thay đổi `last_result`, `correct_count`, `wrong_count` của bản ghi `vi_en` (và ngược lại).
- [x] **C3** (S2) Câu trả lời không được chấm (`is_correct = null`) chỉ ghi nhật ký, không tạo/sửa tiến độ.
- [x] **C4** (S3) `GET vocabulary/topics?direction=` trả `correct`, `wrong`, `not_started`, `status` theo chiều được chọn, mỗi phần tử có `direction`.
- [x] **C5** (S4) `GET vocabulary/topics/:topic_id?direction=` trả `status` từng từ và số liệu theo chiều được chọn, có `direction`.
- [x] **C6** (S5) `GET vocabulary/topics/:topic_id/review?direction=` chỉ gồm từ sai ở chiều được chọn.
- [x] **C7** (S6) `GET vocabulary/summary?direction=` tính theo chiều được chọn, có `direction`; `total_words` giống nhau ở hai chiều.
- [x] **C8** (S7) Học đúng toàn bộ một chủ đề ở `en_vi` → `topics?direction=vi_en` trả chủ đề đó `correct = 0`, `wrong = 0`, `status = not_started`.
- [x] **C9** (S8) 4 API đọc: thiếu, rỗng, sai hoặc lặp `direction` → 400 `direction must be one of: en_vi, vi_en`.
- [x] **C10** (S9) `DELETE vocabulary/progress?direction=en_vi` chỉ xóa tiến độ + nhật ký `en_vi`; không có `direction` xóa cả hai; grade cache còn nguyên; sai `direction` → 400; trả 204.
- [x] **C11** (S10) `DELETE vocabulary/topics/:topic_id/progress?direction=vi_en` chỉ xóa `vi_en` của chủ đề đó; không có `direction` xóa cả hai chiều của chủ đề; `topic_id` sai → 400; không tồn tại → 404; trả 204.
- [x] **C12** (S11) Migration: dòng cũ có log đã chấm được tách theo chiều với số liệu đếm lại từ log; dòng không có log được gán `en_vi`; log `is_correct = null` bị bỏ qua.
- [x] **C13** (S11) Migration mặc định dry-run không ghi; `--confirm` mới ghi; chạy lại cho kết quả như nhau.
- [x] **C14** (S12) Sau migration `--confirm`: không còn index `user_id_1_word_id_1`; có unique index `(user_id, word_id, direction)`. _(Gỡ index cũ có test trong migration spec. Index mới do Mongoose tự tạo khi app khởi động từ khai báo schema; chưa có test riêng cho ràng buộc unique, cần kiểm trên DB thật sau deploy.)_
- [x] **C15** (S13, bảo mật) User A không đọc/xóa được tiến độ của user B ở cả hai chiều; migration không trộn log của user khác.
- [x] **C16** (S8, S9, S10) Mỗi hàm parse `direction` có test case hợp lệ và từng case lỗi.
- [x] **C17** (S14) Có `handoff-fe.md` mô tả thay đổi API; `db-overview.md` cập nhật field và index mới.
- [x] **C18** `npm run lint` pass
- [x] **C19** `npm test` pass
- [x] **C20** `npm run build` pass
