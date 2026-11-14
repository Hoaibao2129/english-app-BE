# Specify: Tách tiến độ học theo chiều Anh-Việt và Việt-Anh (separate-direction-progress)

> File này trả lời: **Hệ thống phải hoạt động như thế nào?** Không nêu tên file hay class.

## Hành vi
| ID | Phục vụ | Mô tả |
|---|---|---|
| S1 | R1 | Mỗi bản ghi tiến độ gắn với bộ ba (user, từ, chiều học). Một user có tối đa một bản ghi tiến độ cho mỗi cặp (từ, chiều học), tức tối đa 2 bản ghi cho một từ. |
| S2 | R1 | Gửi câu trả lời được chấm (`is_correct` khác `null`) chỉ cập nhật bản ghi tiến độ có chiều bằng `direction` trong request: đặt `last_result`, `last_answered_at`, tăng `correct_count` hoặc `wrong_count`. Bản ghi của chiều còn lại giữ nguyên. Câu trả lời không được chấm chỉ ghi nhật ký (giả định A1). Body và response không đổi. |
| S3 | R2 | `GET vocabulary/topics?direction=` trả danh sách chủ đề (sắp theo `order`), mỗi chủ đề có `correct`, `wrong`, `not_started`, `status` tính chỉ từ tiến độ của chiều được chọn. `total_words` không đổi theo chiều (A2). Mỗi phần tử có thêm `direction`. |
| S4 | R3 | `GET vocabulary/topics/:topic_id?direction=` trả chi tiết chủ đề; `status` của từng từ (`correct`/`wrong`/`new`) và số liệu tổng hợp lấy từ tiến độ của chiều được chọn. Response có thêm `direction`. |
| S5 | R4 | `GET vocabulary/topics/:topic_id/review?direction=` trả như S4 nhưng `words` chỉ gồm các từ có `last_result = wrong` ở chiều được chọn. Số liệu tổng hợp giống S4. |
| S6 | R5 | `GET vocabulary/summary?direction=` trả `total_words`, `learned_words`, `wrong_words`, `not_started` tính từ tiến độ của chiều được chọn, kèm `direction`. |
| S7 | R6 | Với cùng user, tiến độ của chiều này không xuất hiện trong kết quả của chiều kia: user trả lời đúng toàn bộ một chủ đề ở `en_vi` thì `GET vocabulary/topics?direction=vi_en` trả `correct = 0`, `wrong = 0`, `status = not_started` cho chủ đề đó. |
| S8 | R7 | Bốn API đọc ở S3–S6 bắt buộc có query `direction` thuộc `en_vi`, `vi_en`. Thiếu, sai giá trị hoặc lặp nhiều lần → 400. Kiểm tra `direction` trước khi truy vấn dữ liệu. |
| S9 | R10 | `DELETE vocabulary/progress` nhận `direction` tùy chọn: có → xóa tiến độ và nhật ký trả lời của user ở chiều đó; không có → xóa của cả hai chiều. Cache chấm điểm giữ nguyên. Trả 204. |
| S10 | R10 | `DELETE vocabulary/topics/:topic_id/progress` nhận `direction` tùy chọn: có → xóa tiến độ và nhật ký trả lời của user trong chủ đề ở chiều đó; không có → xóa cả hai chiều. Trả 204. `topic_id` sai định dạng → 400, chủ đề không tồn tại → 404. |
| S11 | R8 | Có lệnh migration chạy tay cho dữ liệu tiến độ cũ chưa có chiều học: (a) mỗi bộ (user, từ, chiều) có nhật ký đã chấm → tạo/ghi đè bản ghi tiến độ của chiều đó với `correct_count`, `wrong_count` đếm từ nhật ký, `last_result` và `last_answered_at` theo nhật ký mới nhất, `topic_id` giữ từ bản ghi cũ; (b) bản ghi cũ không có nhật ký đã chấm nào → gán `en_vi`, giữ nguyên số liệu; (c) bản ghi cũ đã được tách ở (a) thì bị xóa. Mặc định chạy dry-run (chỉ báo cáo); ghi khi có `--confirm`. Chạy lại nhiều lần cho kết quả như nhau. |
| S12 | R8 | Ràng buộc duy nhất cũ (user, từ) phải được gỡ bỏ để hai chiều cùng tồn tại; ràng buộc duy nhất mới là (user, từ, chiều). Việc gỡ ràng buộc cũ nằm trong migration S11 (chỉ khi `--confirm`). |
| S13 | R9 | Mọi truy vấn và thao tác xóa ở S2–S10 lọc theo `user_id` của user đăng nhập; migration S11 không trộn dữ liệu giữa các user (khớp nhật ký với tiến độ theo cùng `user_id` và `word_id`). |
| S14 | R11 | Có tài liệu handoff cho FE mô tả query `direction` mới, field `direction` mới trong response, lỗi 400 và hành vi xóa theo chiều. |

## Input và validation
| Field | Vị trí | Quy tắc | Lỗi (message tiếng Anh) |
|---|---|---|---|
| `direction` | query, bắt buộc (S3–S6) | Chuỗi, một trong `en_vi`, `vi_en`; không nhận mảng | `direction must be one of: en_vi, vi_en` |
| `direction` | query, tùy chọn (S9, S10) | Không có → cả hai chiều; có thì là một trong `en_vi`, `vi_en`; không nhận mảng | `direction must be one of: en_vi, vi_en` |
| `topic_id` | route param | ObjectId hợp lệ (như hiện tại) | `Invalid topic id` |
| Body `POST vocabulary/answers` | body | Không đổi | Không đổi |

Ghi chú: chuỗi rỗng (`?direction=`) ở API bắt buộc là lỗi 400; ở API tùy chọn cũng là lỗi 400 (không coi là "không có").

## Lỗi và status code
| Tình huống | Status | Message |
|---|---|---|
| Thiếu/sai `direction` ở S3–S6 | 400 | `direction must be one of: en_vi, vi_en` |
| Sai `direction` ở S9, S10 | 400 | `direction must be one of: en_vi, vi_en` |
| `topic_id` sai định dạng (S4, S5, S10) | 400 | `Invalid topic id` |
| Chủ đề không tồn tại (S4, S5, S10) | 404 | `Topic not found` |
| Không có/sai access token | 401 | Mặc định của guard hiện có |

## Quyền truy cập
- Tất cả route yêu cầu đăng nhập (JWT như hiện tại). `user_id` lấy từ token, không đọc từ query/body.
- Đọc và xóa tiến độ, nhật ký chỉ trên dữ liệu có `user_id` của user đăng nhập. User B xóa theo chiều không ảnh hưởng dữ liệu của user A.
- Migration là lệnh chạy tay của người vận hành, không có API.

## Quyết định từ clarify
- Q1 → S3, S4, S5, S6, S8.
- Q2 → S11, S12.
- Q3 → S9, S10.
- Q4 → S3, S4, S5, S6 (thêm field `direction`).
- A1 → S2; A2 → S3, S6.
