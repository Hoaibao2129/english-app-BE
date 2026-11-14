# Tasks: Tách tiến độ học theo chiều Anh-Việt và Việt-Anh (separate-direction-progress)

> File này trả lời: **Cần thực hiện những công việc gì?** Xếp theo thứ tự phụ thuộc. Tick khi xong.

- [x] **T1** Thêm hàm parse `direction` cho query: `parse_direction` (bắt buộc) và `parse_optional_direction` (tùy chọn, `undefined` → `null`). Chuyển hằng `DIRECTIONS` sang file mới và export; `parse_submit_answer` import lại, message không đổi.
  - File: tạo `src/vocabulary/progress/direction.parse.ts`; sửa `src/vocabulary/progress/submit-answer.parse.ts`
  - Phục vụ: S8, S9, S10, R7
  - Phụ thuộc: không
  - Test: `src/vocabulary/progress/direction.parse.spec.ts`: hợp lệ `en_vi`, `vi_en`; lỗi khi thiếu (`undefined`), chuỗi rỗng, giá trị khác (`EN_VI`, `foo`), mảng (`['en_vi', 'vi_en']`), số; `parse_optional_direction(undefined)` trả `null`, giá trị sai vẫn ném 400.

- [x] **T2** Thêm field `direction: Direction` vào `TopicSummaryDto` và `SummaryDto`.
  - File: `src/vocabulary/vocabulary.types.ts`
  - Phục vụ: S3, S4, S5, S6, R2, R3, R5
  - Phụ thuộc: không
  - Test: kiểm qua T4, T5 (type-check bằng `npm run build`)

- [x] **T3** Schema `WordProgress`: thêm `direction` (enum `en_vi`/`vi_en`, required); thay unique index thành `{ user_id: 1, word_id: 1, direction: 1 }`; thay index đếm thành `{ user_id: 1, direction: 1, topic_id: 1, last_result: 1 }`.
  - File: `src/vocabulary/schemas/word-progress.schema.ts`
  - Phục vụ: S1, S12, R1
  - Phụ thuộc: không
  - Test: trong `progress.service.spec.ts` (T4): trả lời cùng từ ở hai chiều tạo 2 dòng tiến độ.

- [x] **T4** `ProgressService` nhận chiều học: `list_topics`, `get_topic`, `get_review`, `summary` nhận `direction: Direction`; `reset`, `reset_topic` nhận `direction: Direction | null`; `submit_answer` đưa `input.direction` vào filter upsert; `counts_by_topic` lọc thêm `direction`; `to_summary` thêm `direction`. Mọi filter giữ `user_id`.
  - File: `src/vocabulary/progress/progress.service.ts`
  - Phục vụ: S2, S3, S4, S5, S6, S7, S9, S10, S13, R1, R2, R3, R4, R5, R6, R9, R10
  - Phụ thuộc: T2, T3
  - Test: sửa `src/vocabulary/progress/progress.service.spec.ts`:
    - Thay case `answering in en_vi then vi_en updates the same progress row` bằng `creates separate progress rows per direction` (2 dòng, số liệu độc lập).
    - `submit_answer` ở `en_vi` không đổi `correct_count`/`wrong_count`/`last_result` của dòng `vi_en`.
    - Câu trả lời không chấm (`is_correct = null`) không ghi tiến độ chiều nào.
    - `list_topics`/`summary` theo `vi_en` trả 0 sau khi học xong toàn bộ `en_vi` (S7); `summary` trả đúng `direction`, `total_words` như nhau ở hai chiều.
    - `get_topic` trả `status` từng từ theo chiều; `get_review` chỉ gồm từ sai của chiều được chọn.
    - `reset(user, 'en_vi')` chỉ xóa tiến độ + log `en_vi`, giữ `vi_en` và grade cache; `reset(user, null)` xóa cả hai.
    - `reset_topic(user, topic, 'vi_en')` chỉ xóa `vi_en` của chủ đề đó, chủ đề khác giữ nguyên; `null` xóa cả hai chiều của chủ đề.
    - Phân quyền: user B `reset(..., 'en_vi')` không xóa dữ liệu `en_vi` của user A; `list_topics` của B không thấy tiến độ của A.

- [x] **T5** Controller: 4 route đọc thêm `@Query('direction') direction: unknown` → `parse_direction`; 2 route `DELETE` thêm `@Query('direction')` → `parse_optional_direction`; truyền vào service. Cập nhật `@ApiOperation` summary nhắc theo chiều và thêm `@ApiQuery` cho `direction` (enum, required tương ứng).
  - File: `src/vocabulary/vocabulary.controller.ts`
  - Phục vụ: S3, S4, S5, S6, S8, S9, S10, S13, R2, R3, R4, R5, R7, R9, R10
  - Phụ thuộc: T1, T4
  - Test: sửa `src/vocabulary/vocabulary.controller.spec.ts`:
    - 4 API đọc thiếu `direction` → 400 `direction must be one of: en_vi, vi_en`; sai giá trị → 400; lặp `?direction=en_vi&direction=vi_en` → 400.
    - `GET topics?direction=en_vi` trả 200, mỗi phần tử có `direction: 'en_vi'`; `GET summary?direction=vi_en` có `direction: 'vi_en'`.
    - `DELETE progress?direction=foo` → 400; `DELETE progress?direction=en_vi` → 204 và chỉ xóa `en_vi`; không có query → 204 xóa cả hai.
    - `DELETE topics/:topic_id/progress?direction=vi_en` → 204; `topic_id` sai → 400; không tồn tại → 404.
    - Không có token → 401 (giữ case hiện có); user A/B tách biệt.
    - Cập nhật mọi request cũ trong spec để kèm `direction`.

- [x] **T6** Migration dựng lại tiến độ theo chiều từ `answerlogs` (thuật toán trong `plan.md`): dry-run mặc định, `confirm` mới ghi, gỡ index cũ, idempotent, trả báo cáo.
  - File: tạo `src/migrations/progress-direction.migration.ts`
  - Phục vụ: S11, S12, S13, R8, R9
  - Phụ thuộc: T3
  - Test: `src/migrations/progress-direction.migration.spec.ts` (mongo-memory, theo pattern `drop-version-key.migration.spec.ts`):
    - Dòng cũ có log cả hai chiều → tạo 2 dòng với `correct_count`/`wrong_count` đếm từ log, `last_result`/`last_answered_at` theo log mới nhất từng chiều; dòng cũ bị xóa.
    - Log `is_correct = null` không được tính.
    - Dòng cũ không có log đã chấm → được gán `en_vi`, số liệu giữ nguyên.
    - Dry-run không ghi gì, báo cáo đúng số lượng.
    - Chạy `confirm` hai lần cho kết quả như nhau (idempotent).
    - Log của user B không ảnh hưởng tiến độ user A cùng từ.
    - Index `user_id_1_word_id_1` bị gỡ khi `confirm`, giữ nguyên khi dry-run; không lỗi khi index không tồn tại.

- [x] **T7** Script chạy migration và npm script.
  - File: tạo `src/scripts/migrate-progress-direction.ts`; sửa `package.json` (thêm `"migrate:progress-direction": "nest build && node dist/scripts/migrate-progress-direction.js"`)
  - Phục vụ: S11, R8
  - Phụ thuộc: T6
  - Test: không có unit test (theo pattern các script hiện có); kiểm bằng `npm run build`.

- [x] **T8** Tài liệu: tạo `handoff-fe.md` (query `direction` bắt buộc ở 4 API đọc, tùy chọn ở 2 API xóa, field `direction` mới trong response, lỗi 400, ví dụ request/response, ghi chú thứ tự deploy); cập nhật `docs/superpowers/db-overview.md` (field `direction` và index mới của `wordprogresses`).
  - File: `docs/superpowers/features/separate-direction-progress/handoff-fe.md`, `docs/superpowers/db-overview.md`
  - Phục vụ: S14, R11
  - Phụ thuộc: T5, T6
  - Test: không áp dụng (tài liệu)

- [x] **T9** Chạy `npm run lint`, `npm test`, `npm run build`; sửa đến khi pass.
  - File: không
  - Phục vụ: tất cả
  - Phụ thuộc: T1–T8
  - Test: toàn bộ

## Ghi chú khi implement
- Ngoài file đã liệt kê, sửa thêm fixture `src/vocabulary/seed/seed.service.spec.ts` (thêm `direction: 'en_vi'` khi tạo `WordProgress`) vì `direction` giờ là field bắt buộc (hệ quả trực tiếp của T3, không đổi hành vi).
- Migration bỏ qua nhánh tách theo log với dòng tiến độ cũ thiếu `user_id` (gán `en_vi`), đúng như mục ghi chú trong `plan.md`.
