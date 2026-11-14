# Plan: Tách tiến độ học theo chiều Anh-Việt và Việt-Anh (separate-direction-progress)

> File này trả lời: **Sẽ triển khai bằng phương pháp kỹ thuật nào?** Theo rule trong `ai-rules/`.

## Tổng quan
Sửa trong module `vocabulary` hiện có, không tạo module mới, không thêm dependency, không dùng transaction.
- Thêm field `direction` vào schema `WordProgress`, đổi unique index thành `(user_id, word_id, direction)`.
- `ProgressService` nhận `direction` ở mọi method đọc/xóa và đưa vào filter cùng `user_id`; `submit_answer` đưa `input.direction` vào filter upsert.
- Thêm hàm parse cho query `direction` (bắt buộc và tùy chọn), dùng chung danh sách chiều với `parse_submit_answer`.
- Thêm field `direction` vào `TopicSummaryDto` (kéo theo `TopicDetailDto`) và `SummaryDto`.
- Viết migration dựng lại tiến độ theo chiều từ `answerlogs` + script chạy tay, theo pattern `drop-version-key`.

## Thành phần
| Loại | Thành phần | Ghi chú |
|---|---|---|
| Module | `src/vocabulary/` | Sửa. Không đổi `imports`/`exports`. |
| Schema | `WordProgress.direction` | `@Prop({ type: String, enum: ['en_vi', 'vi_en'], required: true }) direction: Direction`, collection `wordprogresses`. |
| Index | `wordprogresses` | Bỏ `{ user_id: 1, word_id: 1 }` unique → `{ user_id: 1, word_id: 1, direction: 1 }` unique. Bỏ `{ user_id: 1, topic_id: 1, last_result: 1 }` → `{ user_id: 1, direction: 1, topic_id: 1, last_result: 1 }` (phục vụ `counts_by_topic` lọc theo user + chiều, và đọc tiến độ một chủ đề). Index cũ không tự bị xóa: migration gỡ `user_id_1_word_id_1` (bắt buộc, chặn ghi chiều thứ hai) và `user_id_1_topic_id_1_last_result_1` (dọn dẹp). |
| Route | `GET vocabulary/topics?direction=` | Thêm `@Query('direction') direction: unknown` → `parse_direction`. Guard JWT như cũ. |
| Route | `GET vocabulary/topics/:topic_id?direction=` | Như trên. |
| Route | `GET vocabulary/topics/:topic_id/review?direction=` | Như trên. |
| Route | `GET vocabulary/summary?direction=` | Như trên. |
| Route | `DELETE vocabulary/progress?direction=` | `parse_optional_direction`, `@HttpCode(204)` như cũ. |
| Route | `DELETE vocabulary/topics/:topic_id/progress?direction=` | `parse_optional_direction`, `@HttpCode(204)` như cũ. |
| Route | `POST vocabulary/answers` | Không đổi controller/parse. |
| Parse | `parse_direction(value: unknown): Direction` | File mới `src/vocabulary/progress/direction.parse.ts`. Nhận đúng chuỗi `en_vi`/`vi_en`, còn lại (thiếu, rỗng, mảng, giá trị khác) → `BadRequestException('direction must be one of: en_vi, vi_en')`. |
| Parse | `parse_optional_direction(value: unknown): Direction \| null` | Cùng file. `undefined` → `null`; còn lại đi qua `parse_direction`. |
| Parse | `DIRECTIONS` | Chuyển hằng `DIRECTIONS` từ `submit-answer.parse.ts` sang `direction.parse.ts` và export; `parse_submit_answer` import lại (message giữ nguyên). |
| Types | `TopicSummaryDto.direction`, `SummaryDto.direction` | Kiểu `Direction`, trong `vocabulary.types.ts`. |
| Service | `list_topics(user_id, direction)` | `counts_by_topic(user_id, direction)`: `$match` thêm `direction`. |
| Service | `get_topic(user_id, topic_id, direction)` | Query tiến độ thêm `direction`; DTO thêm `direction`. |
| Service | `get_review(user_id, topic_id, direction)` | Gọi `get_topic` với `direction`. |
| Service | `submit_answer(user_id, input)` | Filter upsert `{ user_id, word_id, direction: input.direction }`. |
| Service | `summary(user_id, direction)` | Dùng `counts_by_topic(user_id, direction)`, trả thêm `direction`. |
| Service | `reset(user_id, direction: Direction \| null)` | Filter `{ user_id }` + `direction` khi khác `null`, áp cho cả `wordprogresses` và `answerlogs`. |
| Service | `reset_topic(user_id, topic_id, direction: Direction \| null)` | Như trên, thêm `topic_id`. |
| Mapper | `to_summary(t, c, direction, total_words)` | Thêm tham số `direction` vào DTO. |
| Migration | `run_progress_direction_migration(db, { confirm })` | File mới `src/migrations/progress-direction.migration.ts` + spec. Làm việc trực tiếp trên `db.collection(...)` như migration hiện có. |
| Script | `src/scripts/migrate-progress-direction.ts` | Copy pattern `migrate-drop-version-key.ts`: đọc `MONGODB_URI`, `--confirm`, in báo cáo, trả exit code. `package.json`: `"migrate:progress-direction": "nest build && node dist/scripts/migrate-progress-direction.js"`. |
| Config | Không có biến môi trường mới. | |
| Docs | `handoff-fe.md` (thư mục tính năng), cập nhật `docs/superpowers/db-overview.md` | R11 và tài liệu DB. |

## Thuật toán migration (S11, S12)
1. Đọc các dòng `wordprogresses` có `direction` không tồn tại (`{ direction: { $exists: false } }`) → `legacy_rows`. Nếu rỗng thì vẫn làm bước 5.
2. Aggregate `answerlogs` với `{ is_correct: { $ne: null } }`, sắp `at` tăng dần, group theo `{ user_id, word_id, direction }`: `correct_count` = số log đúng, `wrong_count` = số log sai, `last_is_correct` = `$last: '$is_correct'`, `last_at` = `$last: '$at'`. Lưu vào Map key `"<user_id>|<word_id>"` → danh sách theo chiều. `user_id` thiếu (dữ liệu trước khi có tài khoản) dùng key rỗng, nên khớp được với dòng tiến độ cũng thiếu `user_id`.
3. Nếu `confirm`: gỡ index `user_id_1_word_id_1` và `user_id_1_topic_id_1_last_result_1` nếu tồn tại (bỏ qua lỗi "index not found").
4. Với mỗi dòng cũ:
   - Có thống kê từ log: với mỗi chiều, `updateOne({ user_id, word_id, direction }, { $set: { topic_id (từ dòng cũ), last_result, last_answered_at, correct_count, wrong_count, updated_at }, $setOnInsert: { created_at } }, { upsert: true })`, rồi `deleteOne({ _id: dòng cũ })`. Dùng `$set` (không `$inc`) để chạy lại không cộng dồn. Đếm `rebuilt`.
   - Không có: `updateOne({ _id }, { $set: { direction: 'en_vi' } })`. Đếm `defaulted`.
   - Dry-run: chỉ đếm, không ghi.
5. Trả báo cáo `{ legacy_rows, rebuilt_rows, created_rows, defaulted_rows, dropped_indexes }`.

Tính idempotent: bước 1 chỉ chọn dòng chưa có `direction`; dừng giữa chừng thì chạy lại sẽ ghi đè cùng giá trị (từ log) rồi xóa dòng cũ.
Dòng cũ có `user_id` thiếu được upsert với filter `user_id: { $exists: false }` không tạo được dòng mới; vì vậy dòng thiếu `user_id` chỉ áp dụng nhánh "gán `en_vi`" (ghi chú trong báo cáo; người vận hành nên chạy claim legacy trước). Đây là dữ liệu trước thời có tài khoản, rủi ro thấp.

## Ánh xạ spec
| Spec | Thành phần thực hiện |
|---|---|
| S1 | Schema `WordProgress.direction` + unique index mới |
| S2 | `ProgressService.submit_answer` |
| S3 | Route `GET topics`, `parse_direction`, `list_topics`, `counts_by_topic`, `to_summary` |
| S4 | Route `GET topics/:topic_id`, `parse_direction`, `get_topic` |
| S5 | Route `GET topics/:topic_id/review`, `parse_direction`, `get_review` |
| S6 | Route `GET summary`, `parse_direction`, `summary` |
| S7 | Filter `direction` trong `counts_by_topic`, `get_topic` (kiểm bằng test tích hợp) |
| S8 | `parse_direction`, gọi trong controller trước service |
| S9 | Route `DELETE progress`, `parse_optional_direction`, `reset` |
| S10 | Route `DELETE topics/:topic_id/progress`, `parse_optional_direction`, `reset_topic` |
| S11 | `run_progress_direction_migration`, script `migrate-progress-direction.ts`, npm script |
| S12 | Index mới trong schema + bước 3 migration |
| S13 | Filter `user_id` trong mọi method service; key `user_id|word_id` trong migration |
| S14 | `handoff-fe.md`, `db-overview.md` |

## Rủi ro và điểm cần developer quyết định
- **Thứ tự deploy**: sau khi deploy code mới, index unique cũ `(user_id, word_id)` vẫn còn trong DB cho tới khi chạy migration với `--confirm`. Trong khoảng đó, trả lời chiều thứ hai cho một từ đã có tiến độ sẽ lỗi duplicate key (500). Cần chạy `npm run migrate:progress-direction -- --confirm` ngay sau deploy (hoặc trước khi mở lại traffic). Các API đọc sẽ chưa thấy dòng cũ (chưa có `direction`) cho tới khi migrate.
- **Breaking change cho FE**: 4 API đọc bắt buộc `direction` (Q1), FE phải cập nhật cùng đợt deploy.
- Không cần transaction (migration idempotent), không thêm dependency, không đổi rule.
