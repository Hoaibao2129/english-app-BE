# Thiết kế: học từ vựng theo topic, chấm bằng AI

Ngày: 2026-10-26 · Trạng thái: chờ duyệt
Thay thế bản `2026-10-19-vocabulary-1k-db-design.md`. Bản đó dựa trên mockup có ôn lặp lại ngắt quãng; app thật không làm phần này.

## 1. Mục đích

Chủ dự án muốn một tính năng học khoảng 1000 từ vựng tiếng Anh cho người Việt:

- Chia bộ data thành các topic. Người học chọn từng topic để học.
- Theo dõi **mỗi topic đúng bao nhiêu từ, sai bao nhiêu từ**, và **tổng số từ đã học**.
- Chấm đúng/sai bằng **model AI** chứ không so khớp nguyên chuỗi. Ví dụ hiện `hello`, người học gõ `chào` thì vẫn tính đúng, không bắt buộc phải gõ `xin chào`.

FE đã có sẵn (`FE/study-english`, React 19 + Vite + MUI). Gồm 3 màn: danh sách topic (`/`), flashcard (`/topics/:topicId/flashcards`), quiz (`/topics/:topicId/quiz`). Hiện FE dùng dữ liệu giả (`src/features/vocabulary/data/mockVocabulary.ts`), lưu tiến độ trong localStorage, và chưa gọi API nào. `src/features/vocabulary/services/vocabularyService.ts` là chỗ dự kiến để nối API.

**Phạm vi đợt này: cả BE và FE.** Chủ dự án đã quyết làm cả hai.
- BE (repo này, NestJS 12 + Mongoose 9, ESM): dữ liệu, chấm điểm, lưu tiến độ, script import data.
- FE (`FE/study-english`): nối API, chọn chiều học, gõ đáp án ở flashcard, bỏ phần lưu tiến độ trong localStorage.

## 2. Mục tiêu / Không làm / Không được xảy ra

**Mục tiêu**
- Nạp bộ data (topic + từ `en`/`vn`) của chủ dự án vào MongoDB.
- API trả danh sách topic kèm số đúng/sai/chưa học của từng topic, và danh sách từ của một topic.
- API nhận câu trả lời: chấm (khớp sẵn hoặc nhờ AI), lưu kết quả, trả về đúng/sai kèm đáp án.
- API tổng quan: tổng số từ, số từ đã học.
- API xóa tiến độ, vì FE có nút "reset progress".

**Không làm (giai đoạn này)**
- Đăng nhập, nhiều người dùng. Chỉ chủ dự án dùng.
- Ôn lặp lại ngắt quãng, chuỗi ngày học, mục tiêu hằng ngày.
- Gọi AI để sinh nội dung lúc đang học. IPA, loại từ, ví dụ được sinh trước bằng script.
- Giao diện quản trị để sửa từ.

**Không được xảy ra**
- Một từ bị đếm nhiều lần khi học lại topic. FE hiện đang bị lỗi này, cộng dồn bộ đếm.
- Câu trả lời đúng nghĩa bị chấm sai chỉ vì khác chữ với data.
- Thiếu key AI hoặc AI lỗi làm app không chạy được.

## 3. Những gì chủ dự án đã quyết

1. Một người dùng, chưa có auth.
2. **Mỗi dòng trong data là một từ (thẻ) riêng.** `head` trong *Body Parts* và `head` trong *Occupations* là hai thẻ khác nhau.
3. **Hai chiều học**, người học chọn:
   - Anh → Việt: hiện `en`, người học gõ nghĩa tiếng Việt.
   - Việt → Anh: hiện `vn`, người học gõ từ tiếng Anh.
4. **Flashcard và quiz đều tính đúng/sai giống nhau.** Cả hai đều là gõ đáp án rồi chấm.
5. **Chấm bằng AI qua Groq API.** Thêm biến môi trường cho key; chủ dự án sẽ gắn key sau.
6. **Mỗi từ chỉ đếm một lần, theo lần trả lời gần nhất, và tính chung cho cả hai chiều.** Một topic hiện "X đúng · Y sai · Z chưa học". Tổng số từ đã học là số từ có lần trả lời gần nhất là đúng, cộng trên mọi topic.
7. IPA, loại từ, câu ví dụ do AI sinh (chạy script trước, lưu vào DB).

## 4. Các collection (MongoDB)

Tất cả nằm trong một feature module `VocabularyModule`, đăng ký bằng `MongooseModule.forFeature` rồi import vào `AppModule`. Mọi schema đều bật `timestamps: true`.

### 4.1 `topics`

| Trường | Kiểu | Ghi chú |
|---|---|---|
| `slug` | string, unique | Sinh từ `topic_name_en`, ví dụ `time-calendar`. Khóa ổn định khi nạp lại. |
| `order` | number | Thứ tự trong file, bắt đầu từ 1. FE hiện là "Chủ đề {id}". |
| `nameEn` | string | → FE `title` |
| `nameVi` | string | → FE `titleVi` |
| `wordCount` | number | Script seed cập nhật. → FE `totalWords`; thay cho số 50 đang ghi cứng trong FE. |

### 4.2 `words`

| Trường | Kiểu | Ghi chú |
|---|---|---|
| `key` | string, unique | `"<topicSlug>:<en đã chuẩn hóa>"`. Khóa ổn định khi nạp lại. Nếu trong cùng topic có hai dòng trùng `en`, dòng sau thêm hậu tố `#2`, `#3`… theo thứ tự xuất hiện. *(Mình quyết.)* |
| `topicId` | ObjectId → topics | |
| `order` | number | Thứ tự trong topic. |
| `en` | string | Chuỗi gốc, ví dụ `go/went/gone`, `theatre/theater`. → FE `word` |
| `vi` | string | Nghĩa gốc. → FE `meaning` |
| `ipa` | string \| null | AI sinh. → FE `pronunciation` |
| `pos` | string \| null | `noun`, `verb`, `adjective`, `adverb`, `preposition`, `conjunction`, `pronoun`, `phrase`. → FE `partOfSpeech` |
| `example` | `{ en, vi }` \| null | AI sinh. → FE `example`, `exampleMeaning` |
| `enrichment` | `{ status: 'pending'\|'done'\|'failed'\|'edited', model, at }` | `edited` nghĩa là đã sửa tay, script AI không được ghi đè. |

Index: `key` unique; `{ topicId: 1, order: 1 }`.

### 4.3 `wordprogresses`: một bản ghi cho mỗi từ đã từng trả lời

| Trường | Kiểu | Ghi chú |
|---|---|---|
| `wordId` | ObjectId, unique | |
| `topicId` | ObjectId | Lưu thêm để đếm theo topic không cần join. |
| `lastResult` | `'correct' \| 'wrong'` | Kết quả lần gần nhất, ở bất kỳ chiều nào. Đây là trường quyết định các con số trên UI. |
| `lastAnsweredAt` | Date | |
| `correctCount`, `wrongCount` | number | Tổng số lần đúng/sai từ trước tới nay, giữ lại để sau này làm thống kê. |

Từ **chưa có** bản ghi thì là "chưa học". Không tạo sẵn bản ghi rỗng.
Index: `wordId` unique; `{ topicId: 1, lastResult: 1 }`.

### 4.4 `answerlogs`: mỗi câu trả lời một dòng

| Trường | Kiểu | Ghi chú |
|---|---|---|
| `wordId`, `topicId` | ObjectId | |
| `mode` | `'flashcard' \| 'quiz'` | |
| `direction` | `'en_vi' \| 'vi_en'` | |
| `answer` | string | Câu người học gõ; chuỗi rỗng nghĩa là bỏ qua. |
| `isCorrect` | boolean \| null | `null` khi không chấm được (mục 5, bước 5). |
| `gradedBy` | `'exact' \| 'cache' \| 'ai' \| 'skipped' \| 'ungraded'` | Ai chấm câu này (xem mục 5). |
| `at` | Date | |

Index: `{ at: -1 }`, `{ wordId: 1, at: -1 }`.

### 4.5 `gradecaches`: kết quả AI đã chấm

| Trường | Kiểu | Ghi chú |
|---|---|---|
| `wordId` | ObjectId | |
| `direction` | `'en_vi' \| 'vi_en'` | |
| `normalizedAnswer` | string | |
| `isCorrect` | boolean | |
| `model` | string | |

Unique index: `{ wordId, direction, normalizedAnswer }`. Cache này **không** bị xóa khi reset tiến độ.

## 5. Chấm một câu trả lời

`POST` nhận `{ wordId, direction, mode, answer }` rồi chạy lần lượt:

1. **Bỏ qua:** `answer` rỗng sau khi trim → sai, `gradedBy='skipped'`. *(Mình quyết: bỏ qua tính là sai.)*
2. **Khớp sẵn:** chuẩn hóa câu gõ và đáp án (chữ thường, trim, gộp khoảng trắng, bỏ dấu tiếng Việt, `đ`→`d`; giống `normalizeAnswer` ở FE). Câu gõ khớp với bất kỳ phần nào của đáp án thì đúng, `gradedBy='exact'`.
   - Đáp án Anh→Việt là `vi` tách theo `,` và `/`, bỏ phần trong ngoặc.
   - Đáp án Việt→Anh là `en` tách theo `/`, bỏ phần trong ngoặc.
3. **Cache:** đã có trong `gradecaches` thì dùng kết quả đó, `gradedBy='cache'`.
4. **AI:** gọi Groq, gửi topic, `en`, `vi`, chiều học và câu gõ. Model chỉ trả về `{ "correct": true|false }` (JSON mode). Lưu vào cache, `gradedBy='ai'`.
   - Tiêu chí gửi kèm prompt: chấp nhận từ đồng nghĩa, cách diễn đạt khác cùng nghĩa, lỗi chính tả nhỏ, gõ không dấu; không chấp nhận nghĩa khác hoặc từ loại khác hẳn.
   - Với động từ dạng `go/went/gone`, gõ dạng nào cũng tính đúng.
5. **AI không dùng được** (chưa có key, timeout, lỗi): **không kết luận**. Trả `isCorrect: null`, `gradedBy='ungraded'`, không ghi cache, **không động vào `wordprogresses`**, chỉ ghi `answerlogs` với `isCorrect: null`. FE hiện "Chưa chấm được" kèm đáp án. Như vậy câu trả lời đúng nghĩa không bao giờ bị tính sai chỉ vì thiếu key. *(Mình quyết.)*

Sau khi chấm được (bước 1–4): upsert `wordprogresses` (cập nhật `lastResult`, `lastAnsweredAt`, tăng counter) và ghi một dòng `answerlogs`.

Response: `{ isCorrect: boolean | null, correctAnswer, gradedBy }`. `correctAnswer` là `vi` (chiều Anh→Việt) hoặc `en` (chiều Việt→Anh).

## 6. API

Dùng tiền tố `/api` có sẵn và document qua Swagger như repo đang làm.

| Method & path | Mục đích | Trả về |
|---|---|---|
| `GET /vocabulary/topics` | Danh sách topic cho trang chủ | `[{ id, order, title, titleVi, totalWords, correct, wrong, notStarted }]` |
| `GET /vocabulary/topics/:id` | Một topic cho flashcard/quiz | Như trên, kèm `words: [{ id, word, pronunciation, partOfSpeech, meaning, example, exampleMeaning, status: 'correct'\|'wrong'\|'new' }]` |
| `POST /vocabulary/answers` | Chấm và ghi một câu trả lời | Mục 5 |
| `GET /vocabulary/summary` | Tổng quan | `{ totalWords, learnedWords, wrongWords, notStarted }` (`learnedWords` = số từ có `lastResult='correct'`) |
| `DELETE /vocabulary/progress` | Nút reset của FE | Xóa `wordprogresses` và `answerlogs`; giữ `gradecaches`. |

**ID** *(mình quyết)*: mọi `id`/`wordId`/`:id` là chuỗi ObjectId của Mongo. FE đổi type `id: number` → `string` và bỏ `Number(topicId)` ở route. Số hiển thị "Chủ đề {n}" lấy từ trường `order`.

Tên trường trả về khớp với type FE (`types/vocabulary.ts`) để FE nối API ít phải sửa. `learnedWords` của topic lúc này nghĩa là số từ đúng (`correct`).

Trạng thái topic, theo đúng logic FE: không có từ nào đã trả lời → `not-started`; mọi từ đều `correct` → `completed`; còn lại → `in-progress`.

## 7. Cấu hình

Thêm vào `src/config/env.validation.ts` và `.env.example`:

- `GROQ_API_KEY`: **tùy chọn**. Không có thì chấm theo mục 5, bước 5.
- `GROQ_MODEL`: tùy chọn, có giá trị mặc định (builder chọn một model đang có trên Groq).

Gọi Groq qua endpoint tương thích OpenAI (`https://api.groq.com/openai/v1/chat/completions`), có timeout. Builder tự chọn dùng `fetch` hay SDK.

## 8. Nạp dữ liệu

- **File nguồn:** chủ dự án đặt file gốc tại `data/vocabulary.json` trong repo BE (script nhận thêm đường dẫn tùy chọn), định dạng `[{ topic_name_en, topic_name_vn, words: [{ en, vn }] }]`. ⚠️ Bản dán trong chat bị hỏng nhiều chỗ, cần file gốc.
- **`npm run seed`** (chạy được nhiều lần, kết quả như nhau): upsert topic theo `slug`, upsert word theo `key`, cập nhật `wordCount`. Từ có trong DB mà không còn trong file thì **in cảnh báo, không xóa**. Nếu `en`/`vi` của một từ thay đổi, đặt lại `enrichment.status='pending'` (trừ từ ở trạng thái `edited`).
- **`npm run enrich`**: lấy các từ có `enrichment.status ∈ {pending, failed}`, gửi Groq theo lô, nhận về `ipa`, `pos`, `example{en,vi}`, ghi với `status='done'`.
- Cả hai đều là CLI riêng, không chạy khi khởi động app.

## 9. Thay đổi phía FE (`FE/study-english/src/features/vocabulary`)

- **`services/vocabularyService.ts`**: bỏ mock, gọi API thật. Base URL lấy từ `VITE_API_URL`, mặc định `http://localhost:3000/api`. Thêm các hàm `getTopics`, `getTopic`, `submitAnswer`, `getSummary`, `resetProgress`. Xóa `data/mockVocabulary.ts`.
- **`types/vocabulary.ts`**: `id` đổi sang `string`. Topic thêm `order`, `correct`, `wrong`, `notStarted`. Word thêm `status`. Thêm type cho request và response của câu trả lời.
- **Bỏ localStorage tiến độ** (`'study-english:progress'` trong `useVocabulary.ts`, `useTopic.ts`). Mọi con số lấy từ API. Nút reset gọi `DELETE /vocabulary/progress`.
- **Chọn chiều học** *(mình quyết vị trí)*: một nút chuyển "Anh → Việt / Việt → Anh" ở đầu trang danh sách topic. Lựa chọn được nhớ trong localStorage (chỉ là tiện ích hiển thị, không phải tiến độ) và truyền sang flashcard và quiz.
- **Trang danh sách topic**: mỗi `TopicCard` hiện "X đúng · Y sai · Z chưa học" và thanh tiến độ theo số từ đúng. Header hiện tổng số từ đã học từ `/summary`. Bộ lọc trạng thái giữ nguyên, tính theo mục 6.
- **Flashcard**: bỏ hai nút "Chưa nhớ / Đã nhớ".
  - Mặt trước hiện đề theo chiều học, kèm ô gõ đáp án và nút "Kiểm tra" (Enter) hoặc "Bỏ qua".
  - Sau khi API trả kết quả: báo đúng / sai / chưa chấm được, lật thẻ hiện nghĩa, IPA, ví dụ, rồi bấm "Tiếp".
  - Màn kết thúc hiện số đúng / sai trong lượt vừa học.
- **Quiz**: giữ 10 câu ngẫu nhiên trong topic và giữ giao diện gõ đáp án, nhưng mỗi câu gọi `POST /vocabulary/answers` thay vì `normalizeAnswer` ở FE. Đề và đáp án đổi theo chiều học. Màn kết quả dùng `isCorrect` và `correctAnswer` từ API; câu "chưa chấm được" hiện riêng.
- Trong lúc chờ API chấm, khóa nút và hiện trạng thái đang chấm (gọi AI có thể mất khoảng 1 giây).

## 10. Chuẩn bị cho nhiều người dùng sau này

Thêm `userId` vào `wordprogresses` và `answerlogs`, rồi đổi unique index thành `{ userId, wordId }`. `topics`, `words`, `gradecaches` dùng chung cho mọi người nên giữ nguyên.

## 11. Để builder tự quyết

- Cấu trúc thư mục trong module, DTO, validation request.
- Prompt chấm điểm và prompt sinh nội dung (theo tiêu chí ở mục 5 và 8), cách chia lô.
- Model Groq mặc định và timeout.
- Viết test: hàm chuẩn hóa và tách đáp án, luồng chấm (mock Groq), đếm theo topic.

## 12. Các quyết định mình tự đưa ra (chủ dự án nên xem lại)

- Bỏ qua tính là **sai**.
- Câu gõ khớp sẵn thì chấm đúng luôn, không gọi AI. Kết quả AI được cache lại.
- Thiếu key hoặc AI lỗi: câu khớp sẵn vẫn chấm đúng, còn lại trả "chưa chấm được" và không ảnh hưởng tiến độ.
- ID trong API là chuỗi ObjectId; FE đổi type theo.
- Trùng `en` trong cùng topic thì thêm hậu tố `#2` vào khóa.
- Reset tiến độ xóa cả lịch sử trả lời, nhưng giữ cache chấm điểm.
- API trả tên trường theo type FE hiện tại.
- Khóa ổn định `topicSlug:en`; seed không bao giờ xóa từ.
- Nút chọn chiều học đặt ở trang danh sách topic, nhớ bằng localStorage.
- Flashcard: gõ → chấm → lật thẻ hiện nghĩa và ví dụ → Tiếp.
