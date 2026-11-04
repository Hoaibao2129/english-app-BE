---
description: Biến môi trường, ConfigService và các quy tắc bảo mật
globs: []
---

# Config & bảo mật (luôn áp dụng)

## Config
- Biến môi trường mới: thêm vào `src/config/env.validation.ts` (interface `Environment` + validate) và `.env.example`.
- Đọc config bằng `ConfigService`: bắt buộc → `getOrThrow`, có default → `get(...) ?? DEFAULT`.
- Không đọc `process.env` trực tiếp ngoài `env.validation.ts` và `src/scripts/`.

## Bảo mật
- Không lưu mật khẩu, refresh token dạng thô; không log hay trả chúng trong response.
- Không commit `.env` hay secret.
- Thông báo lỗi đăng nhập không tiết lộ email có tồn tại hay không.
