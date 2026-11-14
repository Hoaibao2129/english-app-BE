# Checklist: Quên mật khẩu (forgot-password)

> File này trả lời: **Những điều kiện cần kiểm tra trước khi hoàn thành?** Mỗi mục gắn với một spec.

- [x] **C1** (S1) Email không tồn tại trả 404 `Email is not registered`
- [x] **C2** (S1) Email sai định dạng trả 400
- [x] **C3** (S2) Email tồn tại trả 200 `{ message: 'OTP sent', expires_in_seconds: 300 }`
- [x] **C4** (S2) OTP gồm đúng 6 chữ số, hết hạn sau 5 phút
- [x] **C5** (S3) Xin OTP mới thì OTP cũ không còn dùng được
- [x] **C6** (S4) Mail gửi tới đúng email user, dùng template, chứa OTP và thời hạn
- [x] **C7** (S4) Gửi mail lỗi trả 503 `Unable to send OTP email` và OTP bị xoá
- [x] **C8** (S4) SMTP trống ở dev/test: không gửi, log cảnh báo, vẫn trả thành công
- [x] **C9** (S5) OTP không lưu thô trong DB, không xuất hiện trong log hay response
- [x] **C10** (S6) OTP đúng trả `reset_token` 5 phút; OTP không dùng lại được
- [x] **C11** (S7) OTP sai hoặc hết hạn trả 400 `OTP is invalid or expired`
- [x] **C12** (S7) Sai 5 lần thì OTP bị vô hiệu, cả OTP đúng sau đó cũng bị từ chối
- [x] **C13** (S8) Reset token sai, hết hạn hoặc đã dùng trả 401
- [x] **C14** (S8) `new_password` ngoài 8 đến 72 byte trả 400
- [x] **C15** (S9) Mật khẩu không khớp trả 400 kèm `reset_token` mới 5 phút; token cũ không dùng được nữa; mật khẩu không đổi
- [x] **C16** (S10) Thành công: đăng nhập được bằng mật khẩu mới, mật khẩu cũ bị từ chối, token dùng lại bị từ chối
- [x] **C17** (S10) Thành công: mọi refresh token của user bị thu hồi, không trả token mới
- [x] **C18** (S11) Production thiếu hoặc sai biến SMTP thì app không khởi động; `.env.example` có đủ biến
- [x] **C19** (S12) Ba route gọi được không cần Authorization
- [x] **C20** (bảo mật) OTP/reset token của user A không đổi được mật khẩu user B; refresh token user B không bị thu hồi khi user A đổi mật khẩu
- [x] **C21** `npm run lint` pass
- [x] **C22** `npm test` pass
- [x] **C23** `npm run build` pass

