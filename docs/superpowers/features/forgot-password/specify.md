# Specify: Quên mật khẩu (forgot-password)

> File này trả lời: **Hệ thống phải hoạt động như thế nào?** Không nêu tên file hay class.

## Hành vi
| ID | Phục vụ | Mô tả |
|---|---|---|
| S1 | R1, R2 | Yêu cầu quên mật khẩu nhận `email`. Email (chuẩn hoá trim + lowercase) không có trong DB thì trả lỗi 404. |
| S2 | R3 | Email tồn tại thì tạo OTP gồm đúng 6 chữ số ngẫu nhiên (có thể bắt đầu bằng 0), hiệu lực 5 phút kể từ lúc tạo, và trả `200 { message: 'OTP sent', expires_in_seconds: 300 }`. |
| S3 | R9 | Mỗi user chỉ có một yêu cầu quên mật khẩu hoạt động. Tạo OTP mới thì OTP cũ và reset token cũ (nếu có) vô hiệu. |
| S4 | R4 | OTP được gửi tới chính email đó bằng template email của hệ thống (subject, bản text, bản HTML, nêu rõ mã và thời hạn 5 phút). Gửi lỗi thì OTP vừa tạo bị xoá và trả 503. Nếu SMTP không cấu hình (chỉ cho phép ngoài production) thì không gửi, chỉ log cảnh báo (không log OTP) và vẫn trả thành công. |
| S5 | R10 | OTP chỉ lưu dạng hash có khoá, không lưu thô, không xuất hiện trong log hay response. |
| S6 | R5, R9 | Xác thực OTP nhận `email` và `otp`. OTP đúng và còn hạn thì OTP bị tiêu thụ (không dùng lại được) và trả `200 { reset_token, expires_in_seconds: 300 }`. Reset token hiệu lực 5 phút kể từ lúc cấp, dùng 1 lần. |
| S7 | R6 | OTP sai, hết hạn, đã dùng, hoặc chưa được yêu cầu thì trả 400. Mỗi lần nhập sai tăng bộ đếm; đủ 5 lần sai thì yêu cầu bị vô hiệu và user phải xin OTP mới. Email không tồn tại thì trả 404 như S1. |
| S8 | R7, R8 | Đặt lại mật khẩu nhận `reset_token`, `new_password`, `confirm_password`. Token phải hợp lệ, còn hạn, chưa dùng. `new_password` theo luật mật khẩu của đăng ký (8 đến 72 byte). |
| S9 | R7 | `confirm_password` khác `new_password` thì trả 400, mật khẩu không đổi; đồng thời token cũ bị thay bằng token mới 5 phút và token mới được trả kèm trong body lỗi để user nhập lại. |
| S10 | R7, R9, R11 | Khớp nhau thì cập nhật mật khẩu (lưu hash), tiêu thụ token, thu hồi toàn bộ refresh token của user, trả `200 { message: 'Password reset successfully' }`. Không trả access/refresh token; user đăng nhập lại. |
| S11 | R12 | Cấu hình SMTP gồm host, port, user, pass, địa chỉ gửi (from). Production thiếu hoặc sai giá trị thì app không khởi động; dev/test được để trống. Port phải là số nguyên 1 đến 65535. |
| S12 | R1 | Cả ba route đều công khai (không cần đăng nhập). |

## Input và validation
| Field | Quy tắc | Lỗi (message tiếng Anh) |
|---|---|---|
| `email` | string, trim, ≤ 254 ký tự, đúng định dạng email | `email must be a valid email address` |
| `otp` | string đúng 6 chữ số | `otp must be a 6-digit code` |
| `reset_token` | string không rỗng | `reset_token must be a non-empty string` |
| `new_password` | string, 8 đến 72 byte | `new_password must be between 8 and 72 bytes` |
| `confirm_password` | string | `confirm_password must be a string` |
| body | JSON object | `Request body must be a JSON object` |

## Lỗi và status code
| Tình huống | Status | Message |
|---|---|---|
| Input sai định dạng | 400 | theo bảng validation |
| Email không tồn tại (S1, S7) | 404 | `Email is not registered` |
| OTP sai/hết hạn/đã dùng/bị vô hiệu | 400 | `OTP is invalid or expired` |
| Gửi mail lỗi | 503 | `Unable to send OTP email` |
| Reset token sai/hết hạn/đã dùng | 401 | `Reset token is invalid or expired` |
| Mật khẩu xác nhận không khớp | 400 | `confirm_password must match new_password` (kèm `reset_token`, `expires_in_seconds`) |

## Quyền truy cập
- Ba route công khai. Dữ liệu được ràng buộc theo `user_id` tìm ra từ email (S1, S6) hoặc từ reset token (S8); user chỉ đổi được mật khẩu của chính tài khoản gắn với OTP/token nhận được.
- Reset token và OTP của user A không đổi được mật khẩu user B.

## Quyết định từ clarify
- Q1 → S6, S8, S9, S10. Q2 → S7. Q3 → S1, S7. Q4 → S2. Q5 → S4, S11.
- Rủi ro đã chấp nhận: 404 cho email không tồn tại cho phép dò email có trong hệ thống; không rate limit gửi OTP (có thể bị lạm dụng gửi mail).

