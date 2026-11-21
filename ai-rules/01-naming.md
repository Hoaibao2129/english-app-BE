---
description: Quy tắc đặt tên: camelCase cho hàm/method, snake_case cho biến/DB/API, PascalCase cho class, kebab-case cho file
globs: []
---

# Đặt tên

Theo tiêu chuẩn TypeScript/JavaScript kết hợp nhất quán dữ liệu snake_case.

| Đối tượng | Kiểu | Ví dụ |
|---|---|---|
| Hàm, method (function, class method) | `camelCase` | `listTopics()`, `findByEmail()`, `submitAnswer()` |
| Biến, hằng cục bộ, tham số, property data/DTO | `snake_case` | `user_id`, `topic_id`, `created_at` |
| Hằng module-level | `UPPER_SNAKE_CASE` | `MAX_ANSWER_LENGTH`, `BCRYPT_COST` |
| Class, interface, type, enum | `PascalCase` | `ProgressService`, `TopicDetailDto` |
| Field MongoDB, key JSON request/response, route param, query | `snake_case` | `created_at`, `:topic_id`, `word_id` |
| Biến môi trường | `UPPER_SNAKE_CASE` | `MONGODB_URI` |
| Tên file / thư mục | `kebab-case.<loại>.ts` | `word-progress.schema.ts`, `auth.dto.ts` |

## Ngoại lệ
- Method bắt buộc của framework giữ nguyên tên gốc: `canActivate`, `onModuleInit`, `createParamDecorator`...
- Option của thư viện (Mongoose, Nest, Swagger) giữ nguyên camelCase: `versionKey`, `isGlobal`, `useFactory`.

## Hậu tố file
- `*.module.ts`, `*.controller.ts`, `*.service.ts`, `*.guard.ts`, `*.decorator.ts`
- `*.schema.ts` (trong `schemas/`), `*.types.ts`, `*.dto.ts`, `*.migration.ts`
- `*.spec.ts` (unit, cạnh file nguồn), `*.e2e-spec.ts` (trong `test/`)
- `*.constants.ts`: hằng dùng chung trong một feature.
- `*.mapper.ts`: hàm chuyển document → DTO, khi phần map dài hoặc dùng ở nhiều service.

## Đặt tên có nghĩa
Động từ đầu tên method của service/repository:

| Tiền tố | Ý nghĩa | Ví dụ |
|---|---|---|
| `find*` | Trả về entity hoặc `null` nếu không có | `findByEmail()`, `findById()` |
| `get*` | Trả về entity, ném `NotFoundException` nếu không có | `getTopic()`, `getMe()` |
| `list*` | Trả về mảng (có thể rỗng) | `listTopics()`, `listByTopicOrdered()` |
| `create*` / `update*` / `delete*` | Thao tác ghi | `createUser()`, `updateOne()` |
| `reset*` | Nghiệp vụ xóa tiến độ | `resetTopic()`, `reset()` |
