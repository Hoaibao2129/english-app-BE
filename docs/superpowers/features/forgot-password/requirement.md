---
requirement_status: approved # draft | approved (developer đổi sau khi review)
spec_status: approved # pending | approved (developer đổi sau khi review cả bộ)
---

# Requirement: Quên mật khẩu (forgot-password)

> File này trả lời: **Developer muốn xây dựng gì và tại sao?** Chỉ nói *cái gì*, không nói *làm thế nào*.

## Bối cảnh và lý do (Why)
Hiện module `auth` chỉ có đăng ký, đăng nhập, refresh, logout. User quên mật khẩu thì không có cách tự khôi phục tài khoản. Cần luồng quên mật khẩu qua OTP gửi về email đã đăng ký.

## Mục tiêu
- User tự đặt lại mật khẩu khi quên, chứng minh quyền sở hữu email bằng OTP.
- OTP có thời hạn ngắn để hạn chế rủi ro lộ mã.

## Yêu cầu
| ID | Yêu cầu |
|---|---|
| R1 | User chưa đăng nhập bấm quên mật khẩu và nhập email; hệ thống kiểm tra email có tồn tại trong DB. |
| R2 | Email không tồn tại thì hệ thống trả lỗi. |
| R3 | Email tồn tại thì hệ thống tạo OTP 6 chữ số, hiệu lực 5 phút kể từ lúc tạo, rồi trả message thành công để FE bắt đầu đếm ngược. |
| R4 | OTP được gửi tới email đó bằng Nodemailer, dùng một template email do hệ thống định nghĩa. |
| R5 | User gửi email và OTP để xác thực; OTP đúng và còn hạn thì hệ thống cấp một reset token có hiệu lực 5 phút. |
| R6 | OTP sai hoặc hết hạn thì bị từ chối và không cấp reset token. |
| R7 | User gửi reset token kèm mật khẩu mới và xác nhận mật khẩu; chỉ đổi khi token hợp lệ, còn hạn và hai mật khẩu khớp nhau. |
| R8 | Mật khẩu mới tuân theo cùng quy tắc validate mật khẩu như khi đăng ký. |
| R9 | OTP chỉ dùng được một lần; dùng xong hoặc khi tạo OTP mới thì OTP cũ vô hiệu. |
| R10 | OTP không được lưu hay log dạng thô. |
| R11 | Đổi mật khẩu thành công thì mọi refresh token hiện có của user bị thu hồi; user phải đăng nhập lại để nhận token mới. |
| R12 | Cấu hình SMTP lấy từ biến môi trường mới, được validate và có trong `.env.example`. |

## Ngoài phạm vi
- Đổi mật khẩu khi đang đăng nhập (biết mật khẩu cũ).
- Gửi OTP qua SMS.
- Giao diện frontend.

## Câu hỏi mở
- Không áp dụng rate limit ở phiên bản này (đã quyết định).
- Việc trả lỗi khi email không tồn tại cho phép dò email có trong hệ thống; developer đã chấp nhận (ghi nhận làm rủi ro ở bước analyze).
- Cấu hình SMTP cụ thể (host, port, user, pass, from) sẽ chốt ở bước plan.
