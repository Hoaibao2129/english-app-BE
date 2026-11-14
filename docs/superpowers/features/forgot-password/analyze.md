# Analyze: Quên mật khẩu (forgot-password)

> File này trả lời: **Bộ spec có nhất quán và đủ không?** Đây là báo cáo kiểm định, chỉ đọc code, không sửa. Mỗi kết quả phải có bằng chứng.

## Kết quả
| Kiểm tra | Trạng thái | Bằng chứng | Đề xuất sửa |
|---|---|---|---|
| Requirement Coverage | PASS | R1→S1,S12; R2→S1; R3→S2; R4→S4; R5→S6; R6→S7; R7→S8,S9,S10; R8→S8; R9→S3,S6,S10; R10→S5; R11→S10; R12→S11 (bảng truy vết bên dưới) | Không |
| Plan Consistency | PASS | `src/auth/` đã có `AuthModule`/`AuthTokenModule`; Không thêm module hay model mới; thêm prop `password_reset` vào `User` (`user.schema.ts`); `MailModule` mới (`src/mail/`) không import `AuthModule`, `AuthModule` import `MailModule` nên không vòng. `RefreshToken` vẫn do `AuthTokenModule` sở hữu, gọi qua `RefreshTokenService` đã export (`auth-token.module.ts`). Không import vòng. Không cần transaction (update nguyên tử trên một document user). Field mới optional `default: null` nên không cần migration. | Không |
| Task Coverage | PASS | S1→T5,T8; S2→T8; S3→T4,T6; S4→T3,T8; S5→T4,T8; S6→T5,T6,T8; S7→T6,T8; S8→T5,T8; S9→T6,T8; S10→T6,T7,T8; S11→T2; S12→T9. Mọi task có `Phục vụ`. | Không |
| Dependency | PASS | T3←T1,T2; T6←T4,T5; T8←T3,T5,T6,T7; T9←T8; T10←tất cả. Không vòng, thứ tự đúng. | Không |
| Security | WARN | Lọc theo `user_id`/token (S12, C20). OTP lưu HMAC, token lưu hash, không log OTP (S5). Biến môi trường mới có trong T2. Rủi ro đã được developer chấp nhận: 404 cho phép dò email (`specify.md` mục Quyết định), không rate limit gửi OTP. Vi phạm tinh thần rule "không tiết lộ email tồn tại" (rule áp dụng cho đăng nhập). | Giữ nguyên theo quyết định của developer; cân nhắc rate limit ở phiên bản sau. |
| Testing | PASS | Mỗi S có test trong T3, T5, T7, T8, T9, T2 (S11). Mỗi hàm `parse_*` có case hợp lệ và từng lỗi (T5). Có test user A/B ở T6, T7, T8 (C20). Hiện chưa có `auth-input.parse.spec.ts` và `users.service.spec.ts` trong `src/auth/` nên T5, T6 tạo mới. | Không |
| Codebase Compatibility | WARN | snake_case, `.js` import, `find_*`/`update_*`, `@HttpCode(200)` đúng rule. Lệch nhỏ: hậu tố `*.template.ts` chưa có trong rule; route `auth/forgot-password` dạng động từ như `login`/`logout` hiện có; body lỗi 400 thêm `reset_token`. Đã nêu ở mục rủi ro của `plan.md`. | Developer xác nhận khi review; không chặn triển khai. |

## Ma trận truy vết
| R | S | T | C |
|---|---|---|---|
| R1 | S1, S12 | T5, T8, T9 | C1, C2, C19 |
| R2 | S1 | T5, T8 | C1 |
| R3 | S2 | T8 | C3, C4 |
| R4 | S4 | T1, T3, T8 | C6, C7, C8 |
| R5 | S6 | T5, T8 | C10 |
| R6 | S7 | T8 | C11, C12 |
| R7 | S8, S9, S10 | T5, T6, T8 | C13, C14, C15, C16 |
| R8 | S8 | T5, T8 | C14 |
| R9 | S3, S6, S10 | T4, T6, T8 | C5, C10, C16 |
| R10 | S5 | T4, T8 | C9 |
| R11 | S10 | T7, T8 | C17, C20 |
| R12 | S11 | T2 | C18 |

## Vòng sửa
- Vòng 1: developer yêu cầu bỏ module/schema riêng cho reset password, nhưng mail tách `MailModule`; đã sửa `plan.md`, `tasks.md`, `clarify.md` (A8), chạy lại analyze, không có FAIL.

## Kết luận: PASS

