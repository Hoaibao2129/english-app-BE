---
requirement_status: approved # draft | approved (developer đổi sau khi review)
spec_status: approved # pending | approved (developer đổi sau khi review cả bộ)
---

# Requirement: Tách tiến độ học theo chiều Anh-Việt và Việt-Anh (separate-direction-progress)

> File này trả lời: **Developer muốn xây dựng gì và tại sao?** Chỉ nói *cái gì*, không nói *làm thế nào*.

## Bối cảnh và lý do (Why)
Hiện tiến độ học (đã đúng, đã sai, chưa học) được lưu và tính chung cho mỗi cặp user + từ, không phân biệt chiều học. Mỗi từ chỉ có một trạng thái `correct`/`wrong`/`new`, nên:
- User học xong tab Anh-Việt (`en_vi`) rồi chuyển sang tab Việt-Anh (`vi_en`) vẫn thấy từ đó "đã học", dù chưa từng học theo chiều Việt-Anh.
- Trả lời chiều này ghi đè kết quả của chiều kia.

Hai chiều có độ khó và kỹ năng khác nhau (nhận biết nghĩa so với nhớ lại từ), cần theo dõi riêng.

Hiện trạng liên quan: `AnswerLog` đã lưu `direction` cho từng lần trả lời, còn `WordProgress` thì chưa có `direction`. Các API xem tiến độ (`topics`, `topics/:topic_id`, `topics/:topic_id/review`, `summary`) chưa nhận chiều học.

## Mục tiêu
- Mỗi chiều học (`en_vi`, `vi_en`) có tiến độ độc lập với nhau cho cùng một user và cùng một từ.
- Số từ đã học, số từ sai, số từ chưa học hiển thị theo đúng chiều user đang chọn.

## Yêu cầu
| ID | Yêu cầu |
|---|---|
| R1 | Kết quả trả lời một từ được ghi vào tiến độ của chiều học tương ứng; không ảnh hưởng tiến độ của chiều còn lại. |
| R2 | Danh sách chủ đề trả về số từ đúng, sai, chưa học của từng chủ đề theo chiều học được chọn. |
| R3 | Chi tiết chủ đề trả về trạng thái từng từ (đúng, sai, mới) và số liệu tổng hợp theo chiều học được chọn. |
| R4 | Danh sách từ ôn tập (từ trả lời sai gần nhất) của một chủ đề chỉ gồm các từ sai theo chiều học được chọn. |
| R5 | Tổng quan học tập (tổng số từ, đã học, sai, chưa học) được tính theo chiều học được chọn. |
| R6 | User học xong toàn bộ một chiều thì chiều còn lại vẫn hiển thị như chưa học (ví dụ 0 từ đã học) cho đến khi user học chiều đó. |
| R7 | Chiều học không hợp lệ hoặc thiếu (với API cần chiều học) bị từ chối với lỗi rõ ràng. |
| R8 | Dữ liệu tiến độ đã có trước khi thay đổi không bị mất và được gán về đúng chiều học. |
| R9 | Mọi truy vấn tiến độ vẫn chỉ trả dữ liệu của chính user đang đăng nhập. |
| R10 | Thao tác xóa tiến độ (toàn bộ hoặc theo chủ đề) có hành vi xác định theo chiều học, đã được developer chốt ở bước clarify. |
| R11 | Có tài liệu handoff mô tả thay đổi API để FE cập nhật. |

## Ngoài phạm vi
- Thay đổi cách chấm điểm (exact/cache/ai) hoặc cache chấm điểm.
- Thêm chiều học mới ngoài `en_vi`, `vi_en`.
- Thống kê nâng cao (streak, biểu đồ theo ngày...).
- Giao diện frontend.

## Câu hỏi mở
- API đọc tiến độ nhận chiều học qua đâu (query `direction`) và thiếu thì mặc định `en_vi` hay trả 400?
- Dữ liệu cũ: mỗi dòng tiến độ hiện có chưa biết chiều. Gán toàn bộ về `en_vi`, hay dựng lại từ `answerlogs` (có `direction` cho từng lần trả lời)? Nếu dựng lại thì `correct_count`/`wrong_count` tính lại từ log hay giữ nguyên?
- Xóa tiến độ (`DELETE vocabulary/progress` và `DELETE vocabulary/topics/:topic_id/progress`): xóa cả hai chiều, hay chỉ chiều được chọn (nhận `direction` tùy chọn)? Nhật ký trả lời xử lý ra sao?
- Chế độ `review` và `flashcard`: `flashcard` có `is_correct = null` (không chấm) và không ghi tiến độ, giữ nguyên hành vi này?
- `total_words` có đổi theo chiều không (đề xuất: không, vì cùng một tập từ)?
- Có cần trả cùng lúc số liệu của cả hai chiều trong một response (ví dụ cho màn tổng quan), hay mỗi lần gọi chỉ một chiều?

