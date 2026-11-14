# Tasks: Quên mật khẩu (forgot-password)

> File này trả lời: **Cần thực hiện những công việc gì?** Xếp theo thứ tự phụ thuộc. Tick khi xong.

- [x] **T1** Cài `nodemailer` và `@types/nodemailer`
  - File: `package.json`, `package-lock.json`
  - Phục vụ: S4, R4
  - Phụ thuộc: không
  - Test: `npm run build`

- [x] **T2** Thêm biến môi trường SMTP và validate
  - File: `src/config/env.validation.ts`, `.env.example`
  - Phục vụ: S11, R12
  - Phụ thuộc: không
  - Test: `src/config/env.validation.spec.ts` (hợp lệ; thiếu biến ở production; port sai; dev/test để trống)

- [x] **T3** `MailModule`, `MailService` và template email OTP
  - File: `src/mail/mail.module.ts`, `src/mail/mail.service.ts`, `src/mail/otp-email.template.ts`
  - Phục vụ: S4, R3, R4
  - Phụ thuộc: T1, T2
  - Test: `src/mail/mail.service.spec.ts` (mock transport: đúng người nhận/nội dung; SMTP trống thì không gửi; lỗi gửi được ném lại), `src/mail/otp-email.template.spec.ts` (chứa OTP và 5 phút)

- [x] **T4** Thêm object `password_reset` vào schema `User` và index
  - File: `src/auth/schemas/user.schema.ts`
  - Phục vụ: S3, S5, S6
  - Phụ thuộc: không
  - Test: bao phủ qua `src/auth/users.service.spec.ts` (T6)

- [x] **T5** Types, hằng số và hàm parse mới
  - File: `src/auth/auth.types.ts`, `src/auth/auth.constants.ts`, `src/auth/auth-input.parse.ts`
  - Phục vụ: S1, S6, S8, R7
  - Phụ thuộc: không
  - Test: `src/auth/auth-input.parse.spec.ts` (mới hoặc bổ sung): hợp lệ và từng case lỗi cho `parse_forgot_password`, `parse_verify_otp`, `parse_reset_password`; login/register giữ nguyên hành vi

- [x] **T6** Method thao tác `password_reset` và đổi mật khẩu trong `UsersService`
  - File: `src/auth/users.service.ts`
  - Phục vụ: S3, S6, S7, S9, S10
  - Phụ thuộc: T4, T5
  - Test: `src/auth/users.service.spec.ts` (mới; mongo memory): ghi đè trạng thái, đếm lần sai, tiêu thụ OTP/token nguyên tử, xoay token, đổi mật khẩu; không ảnh hưởng user khác

- [x] **T7** `RefreshTokenService.revoke_all_for_user`
  - File: `src/auth/refresh-token.service.ts`
  - Phục vụ: S10, R11
  - Phụ thuộc: không
  - Test: `src/auth/refresh-token.service.spec.ts` (thu hồi mọi token của user A, không đụng user B)

- [x] **T8** Nghiệp vụ trong `AuthService` (`request_password_otp`, `verify_password_otp`, `reset_password`)
  - File: `src/auth/auth.service.ts`
  - Phục vụ: S1 đến S10, R1 đến R11
  - Phụ thuộc: T3, T5, T6, T7
  - Test: `src/auth/auth.service.spec.ts` (mock `MailService`, clock inject; email không tồn tại; OTP hợp lệ; hết hạn; sai 5 lần bị vô hiệu; OTP tái dùng; OTP mới vô hiệu OTP cũ; mail lỗi xoá trạng thái và 503; token hết hạn/đã dùng; mật khẩu không khớp xoay token; thành công đổi hash và thu hồi refresh token; phân quyền user A/B; OTP không nằm thô trong DB)

- [x] **T9** Route trong controller và import `MailModule` vào `AuthModule`
  - File: `src/auth/auth.controller.ts`, `src/auth/auth.module.ts`
  - Phục vụ: S1, S2, S6, S8, S12
  - Phụ thuộc: T8
  - Test: `src/auth/auth.controller.spec.ts` (3 route parse body rồi gọi service, 200, không cần guard)

- [x] **T10** Chạy kiểm tra cuối
  - File: không
  - Phục vụ: tất cả
  - Phụ thuộc: T1 đến T9
  - Test: `npm run lint`, `npm test`, `npm run build`
