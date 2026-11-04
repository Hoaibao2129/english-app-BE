---
description: Pattern service: query Mongoose, lọc theo user_id, map DTO, xử lý lỗi, logging
globs:
  - "src/**/*.service.ts"
---

# Service & xử lý lỗi

## Quy tắc
- Inject Model bằng `@InjectModel(X.name) private readonly <tên số nhiều>: Model<X>`.
- Đọc dữ liệu chỉ để trả về → dùng `.lean()`.
- Các query độc lập chạy song song bằng `Promise.all`.
- Mọi query dữ liệu của user phải lọc theo `user_id` (không được đọc/ghi dữ liệu của user khác).
- Map document → DTO trong service (`id: String(doc._id)`); không trả document Mongoose ra ngoài.
- Field optional trả về `null`, không trả `undefined`.
- Lỗi nghiệp vụ dùng exception có sẵn của Nest: `BadRequestException`, `NotFoundException`, `ConflictException`, `UnauthorizedException`.
- Log bằng `private readonly logger = new Logger(X.name)`; không dùng `console.*` ngoài `src/scripts/`.
- Gọi dịch vụ ngoài (ví dụ Groq): có timeout, lỗi thì log `warn` và fallback, không làm sập request.
- Không dùng exception filter riêng; giữ format lỗi mặc định của Nest `{ statusCode, message, error }`.
- Không dùng transaction: DB hiện là standalone (không phải replica set). Nếu một thao tác thực sự cần transaction thì **dừng lại và báo**, không tự thêm.
