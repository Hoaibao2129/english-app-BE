# Plan: Quên mật khẩu (forgot-password)

> File này trả lời: **Sẽ triển khai bằng phương pháp kỹ thuật nào?** Theo rule trong `ai-rules/`.

## Tổng quan
Không tạo module hay schema riêng cho quên mật khẩu. Trạng thái quên mật khẩu được lưu ngay trong document `User` ở một object con `password_reset` (mặc định `null`). Logic nghiệp vụ nằm trong `AuthService`/`UsersService` hiện có; 3 route thêm vào `AuthController`. Gửi mail bằng `MailService` trong module mới `MailModule` (`src/mail/`), `AuthModule` import module này. Reset token là chuỗi ngẫu nhiên lưu dạng hash SHA-256; OTP lưu dạng HMAC-SHA256 khoá `JWT_SECRET`. Không dùng transaction: các bước kiểm tra và tiêu thụ dùng `findOneAndUpdate` nguyên tử trên document user.

## Thành phần
| Loại | Thành phần | Ghi chú |
|---|---|---|
| Module | `src/auth/` (sửa) | `AuthModule` import `MailModule`; không thêm model |
| Module | `src/mail/` (mới) | `MailModule` provides và exports `MailService`; không import `AuthModule` nên không vòng |
| Schema | `User` (`src/auth/schemas/user.schema.ts`, sửa) | Thêm prop `password_reset` kiểu object con (sub-schema khai báo trong cùng file, `_id: false`, `default: null`), gồm: `otp_hash` (string\|null), `otp_expires_at` (Date\|null), `attempts` (number, mặc định 0), `reset_token_hash` (string\|null), `reset_token_expires_at` (Date\|null) |
| Index | `{ 'password_reset.reset_token_hash': 1 }` (sparse) | khai báo ngay dưới `UserSchema`, phục vụ tra cứu theo reset token |
| Route | `POST auth/forgot-password` | `@HttpCode(200)`, công khai |
| Route | `POST auth/forgot-password/verify` | `@HttpCode(200)`, công khai |
| Route | `POST auth/reset-password` | `@HttpCode(200)`, công khai |
| Parse | `parse_forgot_password`, `parse_verify_otp`, `parse_reset_password` | trong `src/auth/auth-input.parse.ts`; tách helper `parse_email`, `parse_password_field` dùng chung với login/register (không đổi hành vi cũ) |
| Types | `ForgotPasswordInput`, `VerifyOtpInput`, `ResetPasswordInput`, `OtpSentResult`, `ResetTokenResult`, `MessageResult` | trong `src/auth/auth.types.ts` |
| Service | `AuthService.request_password_otp`, `verify_password_otp`, `reset_password` | nghiệp vụ |
| Service | `UsersService.save_password_reset`, `clear_password_reset`, `record_failed_otp`, `consume_otp`, `rotate_reset_token`, `consume_reset_token` (đồng thời đặt hash mật khẩu mới) | thao tác nguyên tử trên `password_reset` (theo `user_id`/token hash) |
| Service | `RefreshTokenService.revoke_all_for_user` | thu hồi mọi refresh token của user |
| Service | `MailService.send_otp_email` | `src/mail/mail.service.ts`, Nodemailer |
| Template | `src/mail/otp-email.template.ts` | hàm `build_otp_email(otp, ttl_minutes)` trả `{ subject, text, html }` |
| Migration | Không | field mới là optional với `default: null`; không đổi tên/xoá field có dữ liệu. User cũ chưa có field được coi như `null` |
| Config | `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASS`, `SMTP_FROM` | `env.validation.ts` + `.env.example`; bắt buộc khi `NODE_ENV=production`, ngược lại cho phép trống |
| Dependency | `nodemailer`, `@types/nodemailer` | developer đã đồng ý (Q5) |

### Chi tiết thuật toán
- **Hằng**: `OTP_TTL_MS = 300_000`, `RESET_TOKEN_TTL_MS = 300_000`, `MAX_OTP_ATTEMPTS = 5` (đặt trong `auth.constants.ts`).
- **request_password_otp**: `find_by_email` → 404 nếu không có. `crypto.randomInt(0, 1_000_000)` + `padStart(6, '0')`. Ghi đè `password_reset` (thay mọi trạng thái cũ, kể cả reset token chưa dùng). Gửi mail; lỗi gửi → `clear_password_reset`, ném `ServiceUnavailableException`.
- **verify_password_otp**: 404 nếu email không có. Điều kiện hợp lệ: `password_reset` có `otp_hash`, `otp_expires_at > now`, `attempts < 5`. Không hợp lệ → 400. So khớp bằng `timingSafeEqual`. Sai → `$inc password_reset.attempts` nguyên tử; đạt 5 thì xoá `password_reset`; ném 400. Đúng → `findOneAndUpdate` (điều kiện còn nguyên `otp_hash` và `attempts < 5`) đặt `otp_hash = null`, `otp_expires_at = null`, `reset_token_hash`, `reset_token_expires_at`; trả token thô.
- **reset_password**: tìm user theo `password_reset.reset_token_hash` và `reset_token_expires_at > now`, không có → 401. Không khớp mật khẩu → `rotate_reset_token` nguyên tử (điều kiện hash cũ) rồi ném `BadRequestException` với object response `{ statusCode, message, error, reset_token, expires_in_seconds }`. Khớp → `bcrypt.hash`, rồi `consume_reset_token` nguyên tử: điều kiện hash và hạn còn đúng, đặt `password_hash` mới và `password_reset = null` trong cùng một update; sau đó `revoke_all_for_user`. Nếu consume thất bại (race) → 401.
- **MailService**: transport tạo từ `ConfigService`; thiếu `SMTP_HOST` thì log `warn` và không gửi. Gửi có timeout 10s; lỗi thì log `warn` (không log OTP) rồi ném lại.

## Ánh xạ spec
| Spec | Thành phần thực hiện |
|---|---|
| S1 | `parse_forgot_password`, `AuthService.request_password_otp`, `UsersService.find_by_email` |
| S2 | `request_password_otp` (sinh OTP, `OtpSentResult`) |
| S3 | `UsersService.save_password_reset` (ghi đè object `password_reset`) |
| S4 | `MailService.send_otp_email`, `build_otp_email`, xử lý lỗi trong `request_password_otp` |
| S5 | `password_reset.otp_hash` (HMAC), logger không ghi OTP |
| S6 | `parse_verify_otp`, `verify_password_otp`, `UsersService.consume_otp` |
| S7 | `verify_password_otp`, `UsersService.record_failed_otp` |
| S8 | `parse_reset_password`, `reset_password` |
| S9 | `reset_password`, `UsersService.rotate_reset_token` |
| S10 | `reset_password`, `UsersService.consume_reset_token`, `RefreshTokenService.revoke_all_for_user` |
| S11 | `env.validation.ts`, `.env.example` |
| S12 | `AuthController` không dùng `JwtAuthGuard` cho 3 route |

## Rủi ro và điểm cần developer quyết định
- Hậu tố `*.template.ts` chưa có trong rule đặt tên; đề xuất dùng (hoặc đổi sang hậu tố sẵn có).
- Route `auth/forgot-password` theo kiểu động từ hiện có của `auth` (như `login`, `logout`).
- 404 cho email không tồn tại cho phép dò email; không rate limit nên có thể bị lạm dụng gửi mail. Đã được developer chấp nhận.
- Trả `reset_token` trong body lỗi 400 (A1) lệch nhẹ format lỗi mặc định.
- Dữ liệu `password_reset` hết hạn vẫn nằm trong document user cho tới khi bị ghi đè hoặc xoá (không có TTL index vì không còn collection riêng); chỉ chứa hash, chấp nhận được.
- Không cần transaction. Không có thay đổi rule.
