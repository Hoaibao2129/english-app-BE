# Thiết kế: đăng nhập JWT, tiến độ theo user và chuyển sang snake_case

Ngày: 2026-10-29 · Trạng thái: chờ duyệt (đã chốt các câu hỏi của reviewer)
Dựa trên tính năng đã có trong `2026-10-26-vocabulary-topics-design.md`.

## 1. Mục đích

App học từ vựng hiện chưa có tài khoản: chỉ có một bộ tiến độ chung. Chủ dự án muốn:

1. **Bắt buộc đăng nhập.** Người dùng vào web thì phải đăng nhập mới học tiếp được. Sau khi đăng nhập, mọi bài học và tiến độ đi theo `user_id` của người đó.
2. **Refresh token:**
   - Đang dùng web mà access token hết hạn thì tự refresh, người học không bị gián đoạn.
   - Đã đóng web rồi mở lại: nếu access token hết hạn hoặc bị xóa khỏi localStorage thì phải đăng nhập lại.
3. **Đồng bộ snake_case** ở mọi nơi: field trong DB, JSON của API, tên biến, hàm và method trong code BE lẫn FE.

**Thứ tự làm:** BE trước, xong rồi mới đến FE.

## 2. Mục tiêu / Không làm / Không được xảy ra

**Mục tiêu**
- Đăng ký, đăng nhập, refresh, đăng xuất, xem thông tin tài khoản.
- Mọi API `/vocabulary/*` yêu cầu access token hợp lệ. Tiến độ, lịch sử và nút reset tính riêng theo user.
- Toàn bộ field trong DB và JSON của API là snake_case. Code tự viết đặt tên snake_case.
- Chuyển dữ liệu hiện có sang tên field mới mà không mất dữ liệu.

**Không làm (giai đoạn này)**
- Chức năng dành riêng cho admin. Chỉ lưu sẵn field `role`.
- Quên mật khẩu, xác thực email, đăng nhập bằng Google hoặc Facebook, đổi mật khẩu.
- Giới hạn số lần đăng nhập sai (rate limiting).

**Không được xảy ra**
- Người dùng này đọc hoặc ghi được tiến độ của người khác.
- Mật khẩu hoặc refresh token lưu dạng chữ thường trong DB, hoặc xuất hiện trong log hay response.
- Mất 1000 từ hoặc tiến độ đã có khi đổi tên field.
- Còn sót tên camelCase trong DB hoặc JSON của API.

## 3. Những gì chủ dự án đã quyết

1. Bắt buộc đăng nhập; tiến độ đi theo `user_id`.
2. Dùng JWT kèm refresh token, chạy theo luồng ở mục 6.
3. snake_case cho tất cả: DB, JSON của API, biến, hàm, method, tham số, ở cả BE lẫn FE.
4. Làm BE trước, rồi đến FE.
5. Đồng ý với các đề xuất mình đưa ra trong cuộc trao đổi:
   - Đăng nhập bằng email và mật khẩu; người dùng tự đăng ký; mật khẩu băm bằng bcrypt.
   - Field `role` mặc định `user`, chưa có chức năng admin.
   - Tiến độ đã có (chưa gắn user) được gắn vào tài khoản đầu tiên đăng ký.
   - Access token sống 15 phút, lưu ở localStorage. Refresh token sống tối đa 1 ngày, lưu ở sessionStorage.
   - Refresh token lưu dạng băm, xoay vòng mỗi lần dùng; nếu token cũ bị dùng lại thì thu hồi toàn bộ token của user đó.

## 4. Quy tắc đặt tên snake_case

**Đổi sang snake_case**
- Field của document MongoDB, kể cả timestamps: `created_at`, `updated_at` (dùng `timestamps: { createdAt: 'created_at', updatedAt: 'updated_at' }`).
- Mọi key JSON trong request, response, query string và route param của API, ví dụ `:topic_id`.
- Biến, hằng cục bộ, hàm, method, tham số và property của object do mình tự viết, ở cả BE và FE. Ví dụ `submit_answer()`, `list_topics()`, `normalize_answer()`, `access_token`.
- Key trong localStorage và sessionStorage, ví dụ `study_english:access_token`.
- Biến môi trường vẫn giữ dạng `UPPER_SNAKE_CASE` như hiện tại.

**Tên file và thư mục giữ nguyên** (chủ dự án quyết), ví dụ `progress.service.ts`, `vocabularyService.ts`, `FlashcardPage.tsx`. Chỉ đổi tên các export bên trong file khi export đó là hàm hoặc biến, ví dụ `createQuiz` → `create_quiz`.

**Giữ nguyên, vì thuộc framework, thư viện hoặc ngôn ngữ**
- Tên class, type, interface, enum và React component: PascalCase (`ProgressService`, `TopicCard`).
- API của framework và thư viện: `useState`, `findOne`, `updateOne`, `canActivate`, `onClick`, `JwtService.signAsync`…
- **Tên React hook vẫn là `useXxx` (camelCase)**, vì React và `eslint-plugin-react-hooks` bắt buộc như vậy. Ví dụ `useVocabulary`, `useAuth`.
- Tên method lifecycle của NestJS (`onModuleInit`…) và các method bắt buộc của interface (`canActivate`, `intercept`).

Nếu lint của BE (oxlint) hoặc FE (eslint) có rule bắt camelCase thì tắt rule đó. Hiện tại BE chưa bật rule nào như vậy.

## 5. Thay đổi trong DB

### 5.1 Collection mới
**`users`**

| Field | Kiểu | Ghi chú |
|---|---|---|
| `email` | string, unique | Lưu dạng chữ thường và đã trim |
| `password_hash` | string | bcrypt, cost 10 |
| `display_name` | string \| null | Tùy chọn khi đăng ký |
| `role` | `'user' \| 'admin'` | Mặc định `user` |
| `created_at`, `updated_at` | Date | |

**`refresh_tokens`**

| Field | Kiểu | Ghi chú |
|---|---|---|
| `user_id` | ObjectId → users | |
| `token_hash` | string, unique | SHA-256 của refresh token |
| `expires_at` | Date | TTL index để MongoDB tự xóa token hết hạn |
| `revoked_at` | Date \| null | |
| `replaced_by` | ObjectId \| null | Token mới cấp khi refresh |
| `created_at` | Date | |

Refresh token là một chuỗi ngẫu nhiên 256-bit, **không phải JWT**. BE chỉ lưu bản băm.

### 5.2 Collection hiện có: đổi tên field và thêm `user_id`

| Collection | Đổi tên field | Thêm | Index mới |
|---|---|---|---|
| `topics` | `nameEn`→`name_en`, `nameVi`→`name_vi`, `wordCount`→`word_count` | | `slug` unique (giữ) |
| `words` | `topicId`→`topic_id` | | `key` unique; `{topic_id, order}` |
| `wordprogresses` | `wordId`→`word_id`, `topicId`→`topic_id`, `lastResult`→`last_result`, `lastAnsweredAt`→`last_answered_at`, `correctCount`→`correct_count`, `wrongCount`→`wrong_count` | `user_id` | **`{user_id, word_id}` unique**; `{user_id, topic_id, last_result}` |
| `answerlogs` | `wordId`→`word_id`, `topicId`→`topic_id`, `isCorrect`→`is_correct`, `gradedBy`→`graded_by` | `user_id` | `{user_id, at: -1}`; `{user_id, word_id, at: -1}` |
| `gradecaches` | `wordId`→`word_id`, `normalizedAnswer`→`normalized_answer`, `isCorrect`→`is_correct` | | `{word_id, direction, normalized_answer}` unique (vẫn dùng chung cho mọi user) |

Tất cả collection: `createdAt`→`created_at`, `updatedAt`→`updated_at`. Field con trong `words.enrichment` và `words.example` hiện đã là một từ (`status`, `model`, `at`, `en`, `vi`) nên giữ nguyên. Tên collection giữ nguyên để không phải chuyển dữ liệu (*mình quyết*).

### 5.3 Chuyển dữ liệu
Script `npm run migrate:snake-case`, chạy một lần, chạy lại nhiều lần vẫn an toàn:
1. Dùng `$rename` để đổi tên field ngay trên document hiện có, **giữ nguyên `_id`**, nhờ đó các liên kết `word_id` và `topic_id` không bị gãy.
2. Xóa các index cũ đặt theo tên camelCase. Index mới do Mongoose tự tạo khi app khởi động (hoặc gọi `syncIndexes()` trong script).
3. Không gắn `user_id` cho dữ liệu cũ ở bước này. Các dòng `wordprogresses` và `answerlogs` chưa có `user_id` sẽ được gắn cho **user đầu tiên đăng ký** (mục 7.1). Trong lúc chờ, các dòng này bị bỏ qua mọi truy vấn.
4. In ra số document đã đổi ở mỗi collection.
5. Tên collection giữ nguyên bằng cách khai báo tường minh `@Schema({ collection: 'wordprogresses' })`, tương tự cho các collection khác.

**Cách chạy an toàn** *(mình quyết)*:
- Tắt server BE, chạy migration, rồi khởi động code mới. App chạy ở local nên chấp nhận vài phút gián đoạn.
- Script chỉ chạy thật khi có cờ `--confirm`; không có cờ thì chỉ in ra sẽ đổi những gì (dry-run).
- README ghi rõ: nên bật snapshot hoặc export dữ liệu trên Atlas trước khi chạy.
- `topics` và `words` khôi phục được bằng `npm run seed` từ `data.json`. Dữ liệu tiến độ hiện còn rất ít.
- Không cần xử lý trùng lặp cho index unique `{user_id, word_id}`, vì `word_id` đã unique từ trước.

Script seed và enrich cũng chuyển sang tên field mới.

## 6. Luồng xác thực

### 6.1 API mới (tiền tố `/api` như hiện tại)

| Method & path | Body | Response | Ghi chú |
|---|---|---|---|
| `POST /auth/register` | `{ email, password, display_name? }` | `{ access_token, refresh_token, user }` | 201. Email trùng → 409. Đăng ký xong tự đăng nhập. Kiểm tra input *(mình quyết)*: email đúng dạng cơ bản, tối đa 254 ký tự; mật khẩu 8–72 byte (bcrypt cắt bỏ phần sau 72 byte); `display_name` được trim, tối đa 50 ký tự. Sai → 400. |
| `POST /auth/login` | `{ email, password }` | `{ access_token, refresh_token, user }` | Sai email hoặc mật khẩu → 401, cùng một thông báo cho cả hai trường hợp. |
| `POST /auth/refresh` | `{ refresh_token }` | `{ access_token, refresh_token }` | Xoay vòng token. Token không hợp lệ, hết hạn hoặc đã thu hồi → 401. |
| `POST /auth/logout` | `{ refresh_token }` | 204 | Thu hồi token này. |
| `GET /auth/me` | (Bearer) | `{ id, email, display_name, role }` | |

Trong response, `user` có dạng `{ id, email, display_name, role }` và **không bao giờ** chứa `password_hash`.

### 6.2 Access token
- JWT HS256, ký bằng `JWT_SECRET`.
- Payload: `{ sub: user_id, email, role }` (`sub` là tên chuẩn của JWT nên giữ nguyên).
- Sống `JWT_ACCESS_TTL`, mặc định 15 phút.
- Một guard dùng chung kiểm tra header `Authorization: Bearer`. Guard áp dụng cho toàn bộ `VocabularyController` và `GET /auth/me`, và gắn `{ user_id, email, role }` vào request.

### 6.3 Refresh token
- Chuỗi ngẫu nhiên, sống `JWT_REFRESH_TTL`, mặc định 1 ngày. BE lưu SHA-256 của nó trong `refresh_tokens`.
- **Khi refresh:**
  - Tìm token theo hash.
  - Không có, hết hạn hoặc đã thu hồi → 401.
  - Nếu token đó đã bị thu hồi **và có `replaced_by`** thì đây là dấu hiệu bị đánh cắp: thu hồi mọi refresh token còn hiệu lực của user đó, rồi trả 401.
  - Hợp lệ thì thu hồi token cũ (`revoked_at`, `replaced_by`) và cấp cặp token mới.
  - **Khoảng ân hạn 10 giây** *(mình quyết)*: nếu token bị dùng lại trong vòng 10 giây sau khi vừa được xoay (ví dụ người dùng tải lại trang đúng lúc đang refresh) thì chỉ trả 401, không thu hồi toàn bộ.
- `POST /auth/logout` với token không tồn tại hoặc đã thu hồi vẫn trả 204.

### 6.4 Phía FE
- `access_token` lưu ở **localStorage** (`study_english:access_token`).
- `refresh_token` lưu ở **sessionStorage** (`study_english:refresh_token`): còn khi tải lại trang, mất khi đóng tab hoặc trình duyệt.
- **Khi app khởi động:**
  - Có access token chưa hết hạn (đọc `exp` trong JWT) thì gọi `GET /auth/me`, thành công thì vào app.
  - Còn lại (không có token, hết hạn, hoặc `/auth/me` trả 401 mà không có refresh token) thì xóa token và chuyển tới `/login`.
- **Trong lúc dùng:**
  - API client gắn Bearer vào mọi request.
  - Gặp 401 và đang có refresh token thì gọi `/auth/refresh` **một lần duy nhất**, kể cả khi nhiều request cùng lỗi; các request đó chờ chung lần refresh này. Refresh xong thì gửi lại request vừa lỗi.
  - Refresh thất bại thì xóa token và chuyển tới `/login`.
- **Đăng xuất:** gọi `/auth/logout`, xóa cả hai token, về `/login`.
- **Nhiều tab** (chủ dự án chọn cách a): mỗi tab có refresh token riêng trong sessionStorage. Tab mở thêm dùng chung access token cho đến khi hết hạn, rồi bị đưa về `/login`. Không chia sẻ refresh token giữa các tab.
- **Đăng xuất ở một tab:** các tab khác nghe sự kiện `storage` (access token bị xóa khỏi localStorage) và chuyển về `/login`.

## 7. Tiến độ theo user

### 7.1 Gắn dữ liệu cũ
Khi `register` tạo **user đầu tiên**: sau khi insert, nếu `users.countDocuments() === 1` thì gán `user_id` của user này cho mọi `wordprogresses` và `answerlogs` chưa có `user_id` (`updateMany({ user_id: { $exists: false } })`). Các user sau không nhận dữ liệu cũ. App chỉ chạy ở local nên việc hai người cùng đăng ký đầu tiên một lúc gần như không xảy ra; *mình quyết* không thêm cơ chế khóa.

### 7.2 Các API `/vocabulary/*`
Giữ nguyên chức năng như thiết kế cũ, chỉ đổi những điểm sau:
- Bắt buộc access token.
- Mọi truy vấn và ghi `wordprogresses`, `answerlogs` đều lọc theo `user_id` lấy từ token. Client không bao giờ tự gửi `user_id`.
- `DELETE /vocabulary/progress` chỉ xóa dữ liệu của user hiện tại.
- Route param đổi thành `:topic_id`.
- JSON đổi sang snake_case:
  - `TopicSummary`: `{ id, order, title, title_vi, total_words, correct, wrong, not_started, status }`
  - `Word`: `{ id, word, pronunciation, part_of_speech, meaning, example, example_meaning, status }`
  - `POST /answers` request: `{ word_id, direction, mode, answer }`
  - `POST /answers` response: `{ is_correct, correct_answer, graded_by }`
  - `Summary`: `{ total_words, learned_words, wrong_words, not_started }`
- Giá trị enum: `en_vi`, `vi_en`, `flashcard`, `quiz`, `correct`, `wrong`, `new`, `exact`, `cache`, `ai`, `skipped`, `ungraded` giữ nguyên, vì đã là snake_case hoặc chỉ một từ. `TopicStatus` đổi từ `not-started`/`in-progress` thành `not_started`/`in_progress`/`completed`. Giá trị này được tính lúc gọi API, không lưu trong DB, nên không cần chuyển dữ liệu. *(Mình quyết.)*

## 8. Cấu hình
Thêm vào `env.validation.ts` và `.env.example`:
- `JWT_SECRET`: **bắt buộc**, tối thiểu 32 ký tự. Thiếu thì app không khởi động.
- `JWT_ACCESS_TTL`: mặc định `15m`.
- `JWT_REFRESH_TTL`: mặc định `1d`.

Thư viện: `@nestjs/jwt` và `bcryptjs` (viết thuần JS, không phải build native). *Mình quyết:* không dùng Passport, chỉ viết một guard nhỏ.

## 9. Phía FE (làm sau khi BE xong)
- Thêm trang `/login` và `/register` theo phong cách MUI hiện có: email, mật khẩu, nút gửi, hiện lỗi từ API, có link qua lại giữa hai trang.
- Các route học (`/`, `/topics/:topic_id/...`) được bảo vệ: chưa đăng nhập thì chuyển tới `/login`; đăng nhập xong quay lại trang đang định vào.
- `AuthProvider` và `useAuth()` giữ `user`, `login`, `register`, `logout`.
- API client gắn Bearer, xử lý 401 và refresh như mục 6.4.
- Sidebar hiện email hoặc tên người dùng và nút Đăng xuất.
- Đổi toàn bộ type và field sang snake_case khớp với API mới. Tên biến và hàm theo mục 4.
- **Bước 0 của phần FE:** repo FE (git, nhánh `feature/vocabulary-topics`) đang có thay đổi chưa commit do format nhầm ở `FlashcardPage.tsx`, `QuizPage.tsx`, `VocabularyPage.tsx`. Hủy các thay đổi đó (cần chủ dự án đồng ý lúc thực hiện), rồi làm hai chỗ sửa nhỏ còn treo:
  - Bỏ qua Enter khi `event.nativeEvent.isComposing`.
  - Nút "tiếp" ở quiz nhận Enter (`key` để mount lại kèm `autoFocus`).

## 10. Để builder tự quyết
- Cấu trúc module, ví dụ `AuthModule`, `UsersModule`, chỗ đặt guard.
- Cách viết validator cho body, theo kiểu tự viết tay sẵn có (không dùng class-validator).
- Thông báo lỗi tiếng Việt trên FE.
- Cách test: tiếp tục dùng mongodb-memory-server; test cả luồng xoay vòng refresh token và phát hiện token cũ bị dùng lại. Các spec hiện có viết lại theo field snake_case, kèm helper tạo user và token cho các test cần đăng nhập. *(Mình quyết.)*

## 11. Các quyết định mình tự đưa ra (chủ dự án nên xem lại)
- Đăng ký xong tự đăng nhập luôn.
- Refresh token là chuỗi ngẫu nhiên lưu dạng băm, không phải JWT.
- Không dùng Passport.
- `TopicStatus` đổi thành `not_started` / `in_progress` / `completed`.
- Tên collection giữ nguyên, chỉ đổi tên field.
- Mật khẩu tối thiểu 8 ký tự, không có yêu cầu nào khác.
- Đăng nhập sai không phân biệt sai email hay sai mật khẩu.
- Khoảng ân hạn 10 giây khi refresh token vừa xoay bị dùng lại.
- Migration có chế độ dry-run và cờ `--confirm`; chạy khi đã tắt server.
- Dùng `bcryptjs` thay cho `bcrypt`.
- Dữ liệu cũ gắn cho user đầu tiên, không thêm cơ chế khóa.
