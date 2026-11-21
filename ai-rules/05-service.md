---
description: Pattern Service & Repository: tách biệt DAL và Business Logic
globs:
  - "src/**/*.service.ts"
  - "src/**/repositories/*.repository.ts"
---

# Service & Repository (Data Access Layer)

## Repository Pattern
- Mọi thao tác truy vấn DB đều thông qua Repository trong `repositories/`.
- Repository kế thừa `BaseRepository<T>` từ `src/common/base.repository.ts`.
- `BaseRepository` cung cấp sẵn các thao tác CRUD cơ bản (`find`, `findOne`, `findById`, `create`, `updateOne`, `deleteOne`, `countDocuments`) và mặc định gọi `.lean()`.
- Chứa các helper bảo đảm an toàn dữ liệu đa người dùng: `findOneForUser`, `findForUser`, `deleteForUser`.

## Service Pattern
- Service chỉ chứa logic nghiệp vụ thuần túy, inject các Repository tương ứng thay vì `@InjectModel()`.
- Mọi query dữ liệu của user phải lọc theo `user_id` (không được đọc/ghi dữ liệu của user khác).
- Map document → DTO trong service (`id: String(doc._id)`); không trả document Mongoose ra ngoài.
- Field optional trả về `null`, không trả `undefined`.
- Lỗi nghiệp vụ dùng exception có sẵn của Nest: `BadRequestException`, `NotFoundException`, `ConflictException`, `UnauthorizedException`.
- Log bằng `private readonly logger = new Logger(X.name)`; không dùng `console.*` ngoài `src/scripts/`.
- Gọi dịch vụ ngoài (ví dụ Groq): có timeout, lỗi thì log `warn` và fallback, không làm sập request.
- Không dùng exception filter riêng; giữ format lỗi mặc định của Nest `{ statusCode, message, error }`.
