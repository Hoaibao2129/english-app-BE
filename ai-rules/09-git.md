---
description: Quy định commit, tên branch và checklist trước khi tạo PR
globs: []
---

# Git & commit

- **Không tự commit, push hay tạo PR.** Chủ dự án tự commit.
- Tên branch: `<type>/<kebab-case-mô-tả>`, `type` thuộc `feat | fix | refactor | chore | docs`. Ví dụ `feat/reset-and-study-again`.
- Trước khi tạo PR: `npm run lint`, `npm test`, `npm run build` đều phải pass.
