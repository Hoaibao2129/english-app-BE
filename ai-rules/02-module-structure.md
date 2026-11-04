---
description: Cấu trúc thư mục và module NestJS của một feature
globs: []
---

# Cấu trúc module

Mỗi tính năng là một thư mục trong `src/`, ví dụ `src/auth`, `src/vocabulary`.

```
src/<feature>/
  <feature>.module.ts
  <feature>.controller.ts      # mỏng: nhận request, parse, gọi service
  <feature>.types.ts           # interface/type của input, output (DTO), union string
  <feature>.controller.spec.ts
  schemas/
    <entity>.schema.ts
  <sub-domain>/                # khi feature lớn, tách theo nghiệp vụ
    <name>.service.ts
    <name>.service.spec.ts
    <name>.parse.ts
```

## Quy tắc
- Module mới import vào `AppModule`. Schema đăng ký bằng `MongooseModule.forFeature` trong module sở hữu nó.
- Chỉ `exports` những provider mà module khác thật sự dùng.
- Code dùng chung cho nhiều feature đặt trong `src/common/` (ví dụ `src/common/input.parse.ts`). Trước khi viết helper mới, kiểm tra `src/common/` đã có chưa.
- Script CLI chạy tay đặt trong `src/scripts/`, dùng `NestFactory.createApplicationContext`, trả exit code.
- Migration dữ liệu đặt trong `src/migrations/`, có spec đi kèm, chạy qua script trong `src/scripts/`.
- Module **chỉ đăng ký Model của chính nó** trong `MongooseModule.forFeature`. Cần dữ liệu của module khác thì gọi qua service mà module đó `exports`.
- Không để module import vòng. Nếu A và B cần nhau, tách phần dùng chung ra module nhỏ hơn (ví dụ `AuthTokenModule` chứa JWT + `JwtAuthGuard`, để feature module dùng guard mà không phải import `AuthModule`).
