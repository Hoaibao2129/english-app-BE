---
description: Quy tắc viết unit test và e2e test với Jest và mongo-memory
globs:
  - "src/**/*.spec.ts"
  - "test/**"
---

# Test

## Quy tắc
- Unit test đặt cạnh file nguồn: `x.service.ts` → `x.service.spec.ts`.
- Test có DB dùng `start_mongo()` + `mongoose_test_module()` trong `src/test-utils/mongo-memory.ts`; không gọi DB thật.
- Mock dịch vụ ngoài (Groq...) bằng `jest.fn` import từ `@jest/globals`.
- Test phải kiểm tra phân quyền dữ liệu: user A không thấy dữ liệu user B.
- Chạy test: `npm test -- <file>`; không chạy `npx jest` trực tiếp.
- `describe` là tên class/hàm được test; `it` viết tiếng Anh dạng `it('returns ... when ...')` / `it('throws ... when ...')`.
