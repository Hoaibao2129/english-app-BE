# Plan: <Tên tính năng>

> File này trả lời: **Sẽ triển khai bằng phương pháp kỹ thuật nào?** Theo rule trong `ai-rules/`.

## Tổng quan
<Hướng tiếp cận ngắn gọn.>

## Thành phần
| Loại | Thành phần | Ghi chú |
|---|---|---|
| Module | `src/<feature>/` | <mới hay sửa> |
| Schema/Index | <entity>, <index> | <collection, field> |
| Route | `<METHOD> <path>` | <guard, status code> |
| Parse | `parse_<...>` | <file `*.parse.ts`> |
| Service | `<method>` | <tên theo find_/get_/list_/create_...> |
| Migration | <nếu đổi/xóa field có dữ liệu> | <`src/migrations/`> |
| Config | <biến môi trường mới> | <`env.validation.ts`, `.env.example`> |

## Ánh xạ spec
| Spec | Thành phần thực hiện |
|---|---|
| S1 | <thành phần> |

## Rủi ro và điểm cần developer quyết định
- <Cần transaction, dependency mới, đổi rule... thì ghi ở đây và dừng hỏi>

