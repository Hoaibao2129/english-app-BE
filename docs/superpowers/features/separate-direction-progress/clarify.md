# Clarify: Tách tiến độ học theo chiều Anh-Việt và Việt-Anh (separate-direction-progress)

> File này trả lời: **Những điểm chưa rõ, câu hỏi và quyết định đã thống nhất.** Hỏi developer trực tiếp, không tự đoán.

| ID | Liên quan | Câu hỏi | Trả lời của developer | Quyết định |
|---|---|---|---|---|
| Q1 | R2, R3, R4, R5, R7 | Các API đọc tiến độ (`topics`, `topics/:topic_id`, `topics/:topic_id/review`, `summary`) nhận chiều học qua đâu? Đề xuất: query `direction` bắt buộc, thiếu hoặc sai thì 400. | Query bắt buộc. | `?direction=en_vi\|vi_en` bắt buộc. Thiếu, sai giá trị hoặc truyền nhiều giá trị → 400 `direction must be one of: en_vi, vi_en`. |
| Q2 | R8 | Migrate dữ liệu `wordprogresses` cũ (chưa có `direction`) thế nào? Đề xuất: dựng lại từ `answerlogs`. | Dựng lại từ `answerlogs`. | Mỗi bộ (user, từ, chiều) có log đã chấm (`is_correct` khác `null`) → tạo dòng tiến độ riêng: `correct_count`/`wrong_count` tính lại từ log, `last_result`/`last_answered_at` lấy theo log mới nhất. Dòng cũ không có log đã chấm nào → gán `en_vi`, giữ nguyên số liệu. Có chế độ dry-run và `--confirm` như migration hiện có. |
| Q3 | R10 | Xóa tiến độ xử lý chiều học ra sao? Đề xuất: `direction` tùy chọn. | `direction` tùy chọn. | `DELETE vocabulary/progress` và `DELETE vocabulary/topics/:topic_id/progress` nhận `?direction` tùy chọn. Có → chỉ xóa tiến độ và nhật ký trả lời của chiều đó. Không có → xóa cả hai chiều (như hiện tại). Sai giá trị → 400. |
| Q4 | R2, R5 | Mỗi response trả số liệu một chiều hay cả hai? Đề xuất: một chiều mỗi lần gọi, thêm field `direction`. | Một chiều mỗi lần gọi. | Giữ shape response hiện tại, thêm field `direction` vào response của `topics`, `topics/:topic_id`, `topics/:topic_id/review`, `summary`. |

## Giả định (điểm rủi ro thấp developer bỏ qua, chưa được xác nhận)
- **A1**: Câu trả lời không được chấm (`is_correct = null`, ví dụ chế độ `flashcard`) vẫn chỉ ghi nhật ký, không ghi tiến độ của chiều nào. Giữ nguyên hành vi hiện tại.
- **A2**: `total_words` không phụ thuộc chiều học (cùng một tập từ cho cả hai chiều).
- **A3**: Chế độ `review` ghi tiến độ như `quiz`, theo `direction` gửi kèm câu trả lời.
- **A4**: Body `POST vocabulary/answers` không đổi (đã có `direction` bắt buộc), response không đổi.
- **A5**: Đổi thứ tự hay tên field cũ trong response không nằm trong phạm vi; chỉ thêm field `direction`.
