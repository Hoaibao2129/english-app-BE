---
description: Cấu trúc thư mục và module NestJS của một feature theo mô hình 3-Tier
globs: []
---

# Cấu trúc module (3-Tier Architecture)

Mỗi tính năng là một thư mục trong `src/`, ví dụ `src/auth`, `src/vocabulary`.

```
src/<feature>/
  <feature>.module.ts
  <feature>.controller.ts      # mỏng: nhận DTO (đã validate qua ZodValidationPipe), gọi service
  <feature>.dto.ts             # Zod schemas và inferred DTO types (sẵn sàng chia sẻ cho FE)
  <feature>.types.ts           # interfaces/types nội bộ hoặc kết quả nghiệp vụ
  <feature>.controller.spec.ts
  repositories/                # Tầng Data Access Layer (DAL)
    <entity>.repository.ts     # Kế thừa BaseRepository<T>, chứa query có ngữ nghĩa
  schemas/
    <entity>.schema.ts         # Mongoose schema
  <sub-domain>/                # khi feature lớn, tách theo nghiệp vụ
    <name>.service.ts          # Logic nghiệp vụ thuần, inject Repository (không inject Model trực tiếp)
    <name>.service.spec.ts
```

## Quy tắc
- Module mới import vào `AppModule`. Schema đăng ký bằng `MongooseModule.forFeature` trong module sở hữu nó.
- Tầng Repository kế thừa `BaseRepository` đặt trong `repositories/`, được đăng ký trong `providers` và `exports` của module.
- Tầng Service inject Repository thay vì inject `@InjectModel()` trực tiếp.
- Chỉ `exports` những provider mà module khác thật sự dùng.
- Code dùng chung cho nhiều feature đặt trong `src/common/` (ví dụ `base.repository.ts`, `zod-validation.pipe.ts`, `object-id.util.ts`).
- Script CLI chạy tay đặt trong `src/scripts/`, dùng `NestFactory.createApplicationContext`, trả exit code.
- Migration dữ liệu đặt trong `src/migrations/`, có spec đi kèm, chạy qua script trong `src/scripts/`.
- Không để module import vòng. Tách phần dùng chung ra submodule nhỏ hơn (ví dụ `AuthTokenModule`).
