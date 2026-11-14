# Clarify: Quên mật khẩu (forgot-password)

> File này trả lời: **Những điểm chưa rõ, câu hỏi và quyết định đã thống nhất.** Hỏi developer trực tiếp, không tự đoán.

| ID | Liên quan | Câu hỏi | Trả lời của developer | Quyết định |
|---|---|---|---|---|
| Q1 | R5, R7 | Reset token cấp sau khi verify OTP làm thế nào? | Dùng 1 lần; nếu `new_password` và `confirm_password` không khớp thì trả một token mới (vẫn 5 phút) để user nhập lại. | Reset token là chuỗi ngẫu nhiên, 5 phút, dùng 1 lần. Khi mật khẩu không khớp: token cũ bị thay bằng token mới 5 phút, trả kèm trong body lỗi 400 (xem giả định A1). |
| Q2 | R6 | Giới hạn số lần nhập sai OTP? | Tối đa 5 lần sai thì OTP bị vô hiệu, user phải yêu cầu OTP mới. | Chấp nhận đề xuất. |
| Q3 | R2 | Email không tồn tại thì trả gì? | 404 `Email is not registered`. | Chấp nhận đề xuất. |
| Q4 | R3 | Response khi gửi OTP thành công? | `200 { message: 'OTP sent', expires_in_seconds: 300 }`. | Chấp nhận đề xuất. |
| Q5 | R4, R12 | Cấu hình SMTP và lỗi gửi mail? | Biến `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASS`, `SMTP_FROM`; bắt buộc ở production, dev/test cho phép trống (chỉ log cảnh báo, không gửi). Gửi mail lỗi thì xoá OTP vừa tạo và trả 503 `Unable to send OTP email`. Đồng ý thêm `nodemailer` + `@types/nodemailer`. | Chấp nhận đề xuất. |

## Giả định (điểm rủi ro thấp developer bỏ qua, chưa được xác nhận)
- **A1**: Body lỗi 400 khi mật khẩu không khớp giữ format mặc định của Nest và thêm hai field `reset_token`, `expires_in_seconds`. Không dùng exception filter riêng.
- **A2**: Lỗi validate mật khẩu mới theo luật đăng ký (độ dài) không đổi token; token cũ vẫn dùng được đến hết hạn.
- **A3**: Mỗi user chỉ có một yêu cầu quên mật khẩu đang hoạt động; yêu cầu mới xoá yêu cầu cũ (kể cả reset token chưa dùng).
- **A8** (theo yêu cầu developer sau review): không tạo module/schema riêng; trạng thái lưu trong object `password_reset` của user, logic làm chung trong module `auth` hiện có. Riêng mail tách thành `MailModule` mới (developer xác nhận).
- **A4**: Đổi mật khẩu xong không trả token; user gọi login lại.
- **A5**: OTP được lưu dạng HMAC-SHA256 (khoá lấy từ `JWT_SECRET`) vì OTP 6 chữ số dễ bị dò nếu chỉ hash thường.
- **A6**: Route đặt theo kiểu hiện có của `auth`: `POST auth/forgot-password`, `POST auth/forgot-password/verify`, `POST auth/reset-password`.
- **A7**: Template email viết bằng TypeScript (hàm trả subject/text/html), gửi cả bản text và HTML, tiếng Anh.

