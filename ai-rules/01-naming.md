---
description: Quy tắc đặt tên: snake_case cho code/DB/API, PascalCase cho class, kebab-case cho file
globs: []
---

# Đặt tên

Theo quyết định trong `docs/superpowers/specs/2026-10-29-auth-jwt-snake-case-design.md` (mục 4).

| Đối tượng | Kiểu | Ví dụ |
|---|---|---|
| Biến, hằng cục bộ, tham số, hàm, method, property | `snake_case` | `list_topics()`, `user_id`, `parse_login()` |
| Hằng module-level | `UPPER_SNAKE_CASE` | `MAX_ANSWER_LENGTH`, `BCRYPT_COST` |
| Class, interface, type, enum | `PascalCase` | `ProgressService`, `TopicDetailDto` |
| Field MongoDB, key JSON request/response, route param, query | `snake_case` | `created_at`, `:topic_id` |
| Biến môi trường | `UPPER_SNAKE_CASE` | `MONGODB_URI` |
| Tên file / thư mục | `kebab-case.<loại>.ts` | `word-progress.schema.ts`, `submit-answer.parse.ts` |

## Ngoại lệ
- Method bắt buộc của framework giữ nguyên tên gốc: `canActivate`, `onModuleInit`, `createParamDecorator`...
- Option của thư viện (Mongoose, Nest, Swagger) giữ nguyên camelCase: `versionKey`, `isGlobal`, `useFactory`.

## Hậu tố file
- `*.module.ts`, `*.controller.ts`, `*.service.ts`, `*.guard.ts`, `*.decorator.ts`
- `*.schema.ts` (trong `schemas/`), `*.types.ts`, `*.parse.ts`, `*.migration.ts`
- `*.spec.ts` (unit, cạnh file nguồn), `*.e2e-spec.ts` (trong `test/`)
- `*.constants.ts`: hằng dùng chung trong một feature.
- `*.mapper.ts`: hàm chuyển document → DTO, khi phần map dài hoặc dùng ở nhiều service.

## Đặt tên có nghĩa
Động từ đầu tên method của service:

| Tiền tố | Ý nghĩa |
|---|---|
| `find_*` | Trả về entity hoặc `null` nếu không có |
| `get_*` | Trả về entity, ném `NotFoundException` nếu không có |
| `list_*` | Trả về mảng (có thể rỗng) |
| `create_*` / `update_*` / `delete_*` | Thao tác ghi |
| `reset_*` | Nghiệp vụ xóa tiến độ |
