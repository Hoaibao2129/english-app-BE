---
description: Validate input bằng hàm parse_* tự viết, không dùng class-validator
globs:
  - "src/**/*.parse.ts"
  - "src/**/*.controller.ts"
  - "src/**/*.types.ts"
---

# Validate input

Dự án **không** dùng class-validator / Joi. Input được validate bằng hàm `parse_*` viết tay.

## Pattern
```ts
export function parse_submit_answer(body: unknown): SubmitAnswerInput {
  const { word_id, answer } = as_object(body);
  if (!is_object_id_string(word_id)) {
    throw new BadRequestException('word_id must be a valid ObjectId');
  }
  ...
  return { word_id, answer };
}
```

## Quy tắc
- Đặt trong file `*.parse.ts`, nhận `unknown`, trả về kiểu `*Input` khai báo trong `*.types.ts`.
- Lỗi → `BadRequestException` với message dạng `<field> must be ...`.
- Giới hạn (độ dài, min/max) là hằng `UPPER_SNAKE_CASE` ở đầu file, dùng lại trong message.
- Chuỗi được `trim()`; chuỗi rỗng sau trim của field optional → `null`.
- Giá trị enum: khai báo mảng `readonly` rồi kiểm tra `includes`.
- Route param là ObjectId: kiểm tra bằng `is_object_id_string` trước khi query.
- Mỗi hàm parse có unit test cho cả case hợp lệ và từng case lỗi.
- Dùng helper chung trong `src/common/input.parse.ts`: `as_object(body)` và `is_object_id_string(value)`. Không viết lại.
