---
description: Pattern viết NestJS controller: mỏng, parse input, Swagger, guard, HTTP code
globs:
  - "src/**/*.controller.ts"
---

# Controller

## Pattern
```ts
@ApiTags('vocabulary')
@UseGuards(JwtAuthGuard)
@Controller('vocabulary')
export class VocabularyController {
  constructor(private readonly progress: ProgressService) {}

  @Post('answers')
  @HttpCode(200)
  @ApiOperation({ summary: 'Submit an answer, grade it and record progress' })
  submit_answer(
    @CurrentUser() user: AuthUser,
    @Body() body: unknown,
  ): Promise<SubmitAnswerResult> {
    return this.progress.submit_answer(user.user_id, parse_submit_answer(body));
  }
}
```

## Quy tắc
- Controller không chứa logic nghiệp vụ, không gọi Model trực tiếp.
- `@Body()` luôn có kiểu `unknown` và đi qua hàm `parse_*` (xem `04-validation.md`).
- Luôn khai báo kiểu trả về `Promise<...Dto>` rõ ràng.
- Mỗi route có `@ApiOperation({ summary })`; mỗi controller có `@ApiTags`.
- Route cần đăng nhập: `@UseGuards(JwtAuthGuard)` + lấy user bằng `@CurrentUser()`. Không đọc `user_id` từ body/query.
- Status code: `POST` không tạo mới → `@HttpCode(200)`; `DELETE` → `@HttpCode(204)`, trả `void`.
- Route path và param dùng snake_case, danh từ số nhiều: `topics/:topic_id/review`.
- Chưa đánh version API (không dùng `/api/v1`).
- `@ApiResponse` chỉ thêm cho các response lỗi quan trọng (401, 404, 409...).
- Phân trang (chỉ khi danh sách thật sự cần): query `page` (bắt đầu từ 1) và `limit` (mặc định 20, tối đa 100); response `{ items, total, page, limit }`.
