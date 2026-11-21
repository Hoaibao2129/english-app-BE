---
description: Validate input bằng Zod Schemas và ZodValidationPipe
globs:
  - "src/**/*.dto.ts"
  - "src/**/*.controller.ts"
  - "src/common/zod-validation.pipe.ts"
---

# Validate input (Zod DTO Pattern)

Dự án sử dụng **Zod** để định nghĩa schema và validate input thông qua `ZodValidationPipe`.

## Pattern
```ts
// src/<feature>/<feature>.dto.ts
import { z } from 'zod';

export const SubmitAnswerDtoSchema = z.object({
  word_id: z.string({ message: 'word_id must be a valid ObjectId' }),
  direction: z.enum(['en_vi', 'vi_en'], {
    message: 'direction must be one of: en_vi, vi_en',
  }),
  answer: z.string().max(200),
});
export type SubmitAnswerDto = z.infer<typeof SubmitAnswerDtoSchema>;

// src/<feature>/<feature>.controller.ts
@Post('answers')
submit_answer(
  @Body(new ZodValidationPipe(SubmitAnswerDtoSchema)) dto: SubmitAnswerDto,
) {
  return this.service.submit_answer(dto);
}
```

## Quy tắc
- Schemas và DTO types đặt trong file `<feature>.dto.ts`.
- Lỗi validation → `BadRequestException` với message tiếng Anh rõ ràng (dùng `{ message: '...' }` trong Zod).
- Chuỗi string cần trim() và ép kiểu phù hợp; trường optional nếu rỗng chuyển về `null`.
- Route param là ObjectId: kiểm tra bằng `is_object_id_string` hoặc Zod refine.
- Controller sử dụng `@Body(new ZodValidationPipe(Schema))` hoặc `@Query(..., new ZodValidationPipe(Schema))` để tự động validate.
