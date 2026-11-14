# Handoff FE: Tách tiến độ học theo chiều Anh-Việt và Việt-Anh (separate-direction-progress)

> Tài liệu cho FE ráp API. Nguồn: `specify.md` của tính năng. Mọi API đều yêu cầu header `Authorization: Bearer <access_token>` như hiện tại.
> Format JSON: key `snake_case`. Chưa đánh version API (không có `/api/v1`).

## 1. Thay đổi chính
- Tiến độ học (đúng / sai / chưa học) giờ **tách riêng theo chiều**: `en_vi` (Anh → Việt) và `vi_en` (Việt → Anh). Học xong tab Anh-Việt thì tab Việt-Anh vẫn là "chưa học".
- 4 API đọc tiến độ **bắt buộc** query `direction`. Đây là **breaking change**: gọi thiếu `direction` sẽ nhận 400.
- 2 API xóa tiến độ nhận `direction` **tùy chọn**.
- Response của các API đọc có thêm field `direction`.
- `POST /vocabulary/answers` **không đổi** (body đã có `direction`). Câu trả lời ở chiều nào chỉ cập nhật tiến độ của chiều đó.

| API | `direction` | Thay đổi response |
|---|---|---|
| `GET /vocabulary/topics` | bắt buộc | mỗi phần tử thêm `direction` |
| `GET /vocabulary/topics/:topic_id` | bắt buộc | thêm `direction`; `words[].status` theo chiều |
| `GET /vocabulary/topics/:topic_id/review` | bắt buộc | thêm `direction`; chỉ từ sai ở chiều đó |
| `GET /vocabulary/summary` | bắt buộc | thêm `direction` |
| `DELETE /vocabulary/progress` | tùy chọn | không đổi (204) |
| `DELETE /vocabulary/topics/:topic_id/progress` | tùy chọn | không đổi (204) |
| `POST /vocabulary/answers` | trong body như cũ | không đổi |

Giá trị hợp lệ của `direction`: đúng chuỗi `en_vi` hoặc `vi_en` (phân biệt hoa thường). Chỉ truyền **một** giá trị.

## 2. API đọc tiến độ

### 2.1 `GET /vocabulary/topics?direction=en_vi`
Response `200`:
```json
[
  {
    "id": "6650...",
    "order": 1,
    "title": "Time",
    "title_vi": "Thời gian",
    "total_words": 20,
    "correct": 12,
    "wrong": 3,
    "not_started": 5,
    "status": "in_progress",
    "direction": "en_vi"
  }
]
```
- `correct`, `wrong`, `not_started`, `status` tính theo chiều được chọn.
- `total_words` giống nhau ở hai chiều.

### 2.2 `GET /vocabulary/topics/:topic_id?direction=vi_en`
Response `200`: như một phần tử ở 2.1 (có `direction`) cộng thêm `words`:
```json
{
  "id": "6650...",
  "title": "Time",
  "total_words": 2,
  "correct": 0,
  "wrong": 1,
  "not_started": 1,
  "status": "in_progress",
  "direction": "vi_en",
  "words": [
    { "id": "6651...", "word": "day", "meaning": "ngày", "status": "wrong", "pronunciation": null, "part_of_speech": null, "example": null, "example_meaning": null },
    { "id": "6652...", "word": "week", "meaning": "tuần", "status": "new", "pronunciation": null, "part_of_speech": null, "example": null, "example_meaning": null }
  ]
}
```
- `words[].status` (`correct` / `wrong` / `new`) là trạng thái ở chiều được chọn.

### 2.3 `GET /vocabulary/topics/:topic_id/review?direction=vi_en`
Như 2.2 nhưng `words` chỉ gồm các từ có kết quả gần nhất là sai **ở chiều được chọn**. Số liệu tổng hợp (`correct`, `wrong`...) vẫn là của cả chủ đề ở chiều đó.

### 2.4 `GET /vocabulary/summary?direction=en_vi`
Response `200`:
```json
{
  "total_words": 300,
  "learned_words": 120,
  "wrong_words": 15,
  "not_started": 165,
  "direction": "en_vi"
}
```
Muốn hiển thị tổng quan cả hai chiều thì gọi 2 lần (`en_vi` và `vi_en`).

### Lỗi chung của 4 API đọc
| Status | `message` | Khi nào | FE xử lý |
|---|---|---|---|
| 400 | `direction must be one of: en_vi, vi_en` | Thiếu `direction`, rỗng (`?direction=`), sai giá trị, hoặc truyền nhiều lần | Lỗi lập trình: luôn gửi chiều của tab đang chọn |
| 400 | `Invalid topic id` | `topic_id` sai định dạng | Như cũ |
| 404 | `Topic not found` | Chủ đề không tồn tại | Như cũ |
| 401 | | Thiếu/sai token | Như cũ |

## 3. API xóa tiến độ

### 3.1 `DELETE /vocabulary/progress[?direction=en_vi]`
- Có `direction` → chỉ xóa tiến độ và lịch sử trả lời của chiều đó.
- Không có `direction` → xóa cả hai chiều (giống hành vi cũ).
- Response `204` (không có body).

### 3.2 `DELETE /vocabulary/topics/:topic_id/progress[?direction=vi_en]`
- Có `direction` → chỉ xóa tiến độ và lịch sử của chủ đề đó ở chiều đó.
- Không có `direction` → xóa cả hai chiều của chủ đề.
- Response `204`.

Lỗi:
| Status | `message` | Khi nào |
|---|---|---|
| 400 | `direction must be one of: en_vi, vi_en` | `direction` có mặt nhưng rỗng hoặc sai giá trị |
| 400 | `Invalid topic id` | `topic_id` sai định dạng (3.2) |
| 404 | `Topic not found` | Chủ đề không tồn tại (3.2) |

Gợi ý UI: nút "Học lại" trong một tab nên gửi `direction` của tab đó; nút "Xóa toàn bộ tiến độ" (nếu có) thì bỏ `direction`.

## 4. Gợi ý cập nhật FE
- Lưu chiều đang chọn (tab) trong state và **gắn vào mọi lời gọi** 4 API đọc.
- Khi đổi tab, gọi lại API với `direction` mới (dữ liệu hai chiều độc lập, không cache chung).
- Có thể dùng field `direction` trong response để bỏ qua response trễ của tab cũ (tránh race khi user đổi tab nhanh).

## 5. Lưu ý deploy
- FE và BE phải lên **cùng đợt**: FE cũ không gửi `direction` sẽ nhận 400 ở 4 API đọc.
- Ngay sau khi deploy BE, người vận hành chạy `npm run migrate:progress-direction -- --confirm` để chuyển tiến độ cũ sang từng chiều. Trước khi migration chạy, tiến độ cũ chưa hiển thị và trả lời chiều thứ hai cho một từ đã có tiến độ có thể lỗi 500.
