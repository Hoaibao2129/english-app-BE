# Analyze: Tách tiến độ học theo chiều Anh-Việt và Việt-Anh (separate-direction-progress)

> File này trả lời: **Bộ spec có nhất quán và đủ không?** Đây là báo cáo kiểm định, chỉ đọc code, không sửa. Mỗi kết quả phải có bằng chứng.

## Kết quả
| Kiểm tra | Trạng thái | Bằng chứng | Đề xuất sửa |
|---|---|---|---|
| Requirement Coverage | PASS | R1→S1, S2; R2→S3; R3→S4; R4→S5; R5→S6; R6→S7; R7→S8; R8→S11, S12; R9→S13; R10→S9, S10 (đã chốt ở Q3); R11→S14. Không có R nào thiếu S. | Không. |
| Plan Consistency | PASS | Chỉ sửa trong `src/vocabulary/` (module hiện có, `vocabulary.module.ts` không đổi imports/exports); migration + script theo pattern `src/migrations/drop-version-key.migration.ts` và `src/scripts/migrate-drop-version-key.ts`; không thêm module, không import vòng, không dependency mới, không transaction (`ai-rules/05-service.md`). Index cũ ở `word-progress.schema.ts:34-35` được thay và gỡ trong migration. | Không. |
| Task Coverage | PASS | S1→T3; S2→T4; S3–S6→T2, T4, T5; S7→T4; S8→T1, T5; S9, S10→T1, T4, T5; S11→T6, T7; S12→T3, T6; S13→T4, T5, T6; S14→T8. Mọi T* đều ghi `Phục vụ: S*/R*` (T9 phục vụ toàn bộ). | Không. |
| Dependency | PASS | T1, T2, T3 không phụ thuộc; T4←T2, T3; T5←T1, T4; T6←T3; T7←T6; T8←T5, T6; T9←T1–T8. Không có vòng, thứ tự trong file khớp phụ thuộc. | Không. |
| Security | WARN | Mọi filter service giữ `user_id` (S13, `progress.service.ts` hiện lọc `user_id` ở mọi method); `direction` lấy từ query, `user_id` từ token (rule controller); input validate bằng parse (S8). Không có biến môi trường, không mật khẩu/token. Guard chạy trước handler nên request không token vẫn 401 dù thiếu `direction` (`vocabulary.controller.spec.ts:87-105` vẫn giữ được). WARN: dòng tiến độ cũ thiếu `user_id` (dữ liệu trước khi có tài khoản, xem `legacy-progress.service.ts`) chỉ được gán `en_vi`, không tách theo log. | Chấp nhận (rủi ro thấp, đã ghi trong plan). Người vận hành chạy claim legacy trước migration nếu còn dữ liệu đó. |
| Testing | PASS | T1 có test hợp lệ và từng case lỗi của `parse_direction`/`parse_optional_direction`; T4 có test cho S1–S7, S9, S10 và phân quyền A/B; T5 có test HTTP cho S3–S6, S8–S10, 401, A/B; T6 có test migration cho S11, S12, S13 (dry-run, idempotent, log user khác). Case cũ `progress.service.spec.ts:157` (cùng một dòng cho hai chiều) được thay theo T4. | Không. |
| Codebase Compatibility | WARN | Tên snake_case (`parse_direction`, `parse_optional_direction`, `run_progress_direction_migration`), hậu tố `*.parse.ts`, `*.migration.ts`, import `.js`, `@HttpCode(204)` giữ ở 2 route DELETE, message `<field> must be ...` khớp `ai-rules/04-validation.md`; `DIRECTIONS` dùng lại thay vì khai báo lần hai (`submit-answer.parse.ts:9`). WARN: `@Query()` và `@ApiQuery` chưa có tiền lệ trong `src/` (grep không thấy); dùng `@Query('direction') direction: unknown` + parse là cách áp rule `@Body() unknown` cho query. Đặt tên service giữ tên method hiện có (`reset`, `summary`) thay vì đổi sang `reset_*`/`get_*` để không refactor ngoài phạm vi. | Chấp nhận. Nếu developer muốn chuẩn hóa tên method, làm ở task riêng. |

## Rủi ro vận hành (ngoài bảng kiểm)
- Thứ tự deploy: phải chạy `npm run migrate:progress-direction -- --confirm` ngay sau deploy, nếu không index unique cũ chặn ghi chiều thứ hai (500) và API đọc chưa thấy dữ liệu cũ (plan, mục Rủi ro).
- Breaking change: FE phải gửi `direction` cho 4 API đọc cùng đợt deploy (handoff T8).

## Ma trận truy vết
| R | S | T | C |
|---|---|---|---|
| R1 | S1, S2 | T3, T4 | C1, C2, C3 |
| R2 | S3 | T2, T4, T5 | C4 |
| R3 | S4 | T2, T4, T5 | C5 |
| R4 | S5 | T4, T5 | C6 |
| R5 | S6 | T2, T4, T5 | C7 |
| R6 | S7 | T4 | C8 |
| R7 | S8 | T1, T5 | C9, C16 |
| R8 | S11, S12 | T3, T6, T7 | C12, C13, C14 |
| R9 | S13 | T4, T5, T6 | C15 |
| R10 | S9, S10 | T1, T4, T5 | C10, C11, C16 |
| R11 | S14 | T8 | C17 |

## Vòng sửa
- Không cần (không có FAIL ở vòng đầu).

## Kết luận: PASS
