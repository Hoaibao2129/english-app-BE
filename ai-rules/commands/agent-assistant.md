---
description: Tạo requirement.md từ mô tả tính năng; sau khi duyệt thì sinh bộ spec clarify, specify, plan, tasks, checklist, analyze
---

# /agent-assistant

Đầu vào: phần developer nhập sau tên lệnh, là mô tả tính năng mới hoặc tên thư mục của một tính năng đã có.

## Chuẩn bị (mọi pha)
- Đọc toàn bộ rule của repo (`AGENTS.md`/`GEMINI.md` hoặc thư mục rules của agent) và `ai-rules/10-spec-workflow.md`.
- Thư mục đầu ra: `docs/superpowers/features/<ten-tinh-nang>/`. Template: `docs/superpowers/features/_templates/`.
- Viết tài liệu bằng **tiếng Việt**. Message lỗi API và comment code (nếu có ví dụ) bằng tiếng Anh.
- Không sửa code trong `src/`, không commit, push hay tạo PR.

## Chọn pha
1. Đầu vào rỗng: hỏi developer muốn xây gì, rồi dừng.
2. Đầu vào trùng tên một thư mục trong `docs/superpowers/features/` (bỏ qua `_templates`): **Pha 2**.
3. Còn lại: **Pha 1** (mô tả tính năng mới).

## Pha 1: Requirement
1. Tìm code và spec cũ liên quan (`src/`, `docs/superpowers/`) để hiểu bối cảnh. Làm theo pattern đã có.
2. Đặt tên tính năng dạng kebab-case, ngắn gọn (ví dụ `reset-and-study-again`). Tạo thư mục.
3. Tạo **chỉ** `requirement.md` từ `_templates/requirement.md`:
   - Why (vì sao), mục tiêu, ngoài phạm vi.
   - Yêu cầu đánh ID `R1`, `R2`... Mỗi yêu cầu là một câu kiểm chứng được, nói *cái gì*, không nói *làm thế nào*.
   - Điểm chưa chắc ghi vào mục "Câu hỏi mở", không tự bịa đáp án.
   - Frontmatter: `requirement_status: draft`, `spec_status: pending`.
4. **DỪNG.** Báo developer: review và sửa `requirement.md`. Khi đồng ý, nói "approve" hoặc chạy `/agent-assistant <ten-tinh-nang>`.

## Pha 2: Bộ spec
Điều kiện: `requirement_status: approved`. Nếu đang `draft` và developer vừa xác nhận duyệt trong chat, đổi thành `approved`. Nếu chưa duyệt thì dừng và nhắc.

Chạy lần lượt, mỗi bước đọc các file trước đó, dùng template tương ứng, tham chiếu bằng ID thay vì chép lại nội dung:

1. **clarify.md**: liệt kê điểm mơ hồ từ requirement và từ code hiện tại. Hỏi developer **trực tiếp trong chat**, tối đa 5 câu mỗi lượt, mỗi câu kèm đề xuất mặc định. **Chờ trả lời** rồi mới sang bước sau. Ghi Câu hỏi, Trả lời, Quyết định. Điểm rủi ro thấp mà developer bỏ qua thì ghi thành giả định, đánh dấu rõ.
2. **specify.md**: hệ thống phải hoạt động thế nào. Đánh ID `S1`... mỗi mục ghi `Phục vụ: R*`. Gồm hành vi, input và validation, lỗi (status code, message tiếng Anh), quyền truy cập theo `user_id`. Không nêu tên file hay class.
3. **plan.md**: cách làm kỹ thuật theo rule repo: module, schema và index, route, hàm `parse_*`, service, migration, biến môi trường. Bảng ánh xạ `S* -> thành phần`. Nếu cần transaction, dependency mới hay đổi rule: **dừng và hỏi developer**.
4. **tasks.md**: mỗi task có `T*`, mô tả, file sẽ tạo/sửa, `Phục vụ: S*/R*`, `Phụ thuộc: T*`, test đi kèm. Dạng checkbox, xếp theo thứ tự phụ thuộc.
5. **checklist.md**: điều kiện nghiệm thu `C*`, mỗi mục gắn `S*`. Luôn có `npm run lint`, `npm test`, `npm run build`.
6. **analyze.md**: bước kiểm định (xem dưới).

### Bước analyze (Validation)
Chỉ đọc code, không sửa. Với mỗi kiểm tra ghi `PASS`, `WARN` hoặc `FAIL`, kèm **bằng chứng** (file, dòng, ID) và đề xuất sửa:

| Kiểm tra | Nội dung |
|---|---|
| Requirement Coverage | Mọi `R*` có `S*` tương ứng? |
| Plan Consistency | Plan khớp kiến trúc hiện tại (`src/`, quy tắc cấu trúc module, không import vòng)? |
| Task Coverage | Mọi `S*` có task; mọi task truy về được `S*`/`R*`? |
| Dependency | `Phụ thuộc` hợp lệ, không vòng, thứ tự đúng? |
| Security | Lọc `user_id`, không lộ email tồn tại, không log hay trả mật khẩu/token, validate input, biến môi trường mới? |
| Testing | Mỗi `S*` có test; mỗi `parse_*` có case hợp lệ và từng case lỗi; có test phân quyền user A/B? |
| Codebase Compatibility | Đặt tên snake_case, hậu tố file, `.js` trong import, `get_*`/`find_*`/`list_*`, `@HttpCode`, v.v. theo `ai-rules/`? |

Kết thúc bằng `Kết luận`: `PASS` (không FAIL) hoặc `FAIL`.

### Vòng sửa
Nếu có `FAIL`: sửa file spec liên quan (không phải code), chạy lại `analyze`. Tối đa **2 vòng**. Còn `FAIL` thì dừng và báo developer. Nếu lỗi do thiếu thông tin, quay lại hỏi developer qua `clarify.md`.

### Kết thúc Pha 2
Tóm tắt ngắn: số `R/S/T/C`, kết luận analyze, các câu hỏi còn treo. **DỪNG** cho developer review cả bộ. Khi developer duyệt, đổi `spec_status: approved` trong `requirement.md` và nhắc chạy `/speckit-implement <ten-tinh-nang>`.

