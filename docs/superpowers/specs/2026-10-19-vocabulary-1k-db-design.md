# Thiết kế DB: tính năng "1000 từ vựng"

Ngày: 2026-10-19 · Trạng thái: chờ duyệt

## 1. Mục đích

Chủ dự án đang làm tính năng học khoảng 1000 từ vựng tiếng Anh theo chủ đề, dành cho người Việt. UI (bản mockup) gồm 4 màn:

- **Trang chủ**: tổng tiến độ "X/1000 từ đã thuộc"; số chủ đề hoàn thành / đang học / chưa bắt đầu; mục tiêu hôm nay (15/20 từ mới); chuỗi ngày học; "Cần ôn hôm nay: N từ"; thẻ "Tiếp tục học" (chủ đề gần nhất, x/y từ); lưới chủ đề có bộ lọc Tất cả / Đang học / Hoàn thành / Chưa học; ô tìm từ.
- **Flashcard**: từ, loại từ, IPA, nút phát âm (TTS của trình duyệt, không cần lưu audio); lật thẻ ra nghĩa và câu ví dụ (Anh + Việt, từ khóa được in đậm); 3 nút Chưa nhớ / Hơi nhớ / Đã nhớ kèm thời gian ôn lại kế tiếp; đếm số từ đã nhớ / cần ôn trong phiên.
- **Quiz ôn tập**: 3 dạng câu hỏi gõ đáp án: Anh→Việt (gõ có dấu hoặc không dấu đều được), Việt→Anh, Nghe & gõ. Có nút bỏ qua. Câu sai hoặc bỏ qua được đưa vào danh sách ôn lại.
- **Kết quả**: số câu đúng / sai / bỏ qua, chủ đề, số câu, thời lượng, chuỗi ngày; danh sách từ cần ôn kèm câu trả lời của người học; biểu đồ số từ học mỗi ngày trong 7 ngày gần nhất.

Tài liệu này mô tả cấu trúc MongoDB cho tính năng trên, cùng cách nạp dữ liệu và cách tính tiến độ, đủ để lên plan cài đặt.

## 2. Mục tiêu / Không làm / Không được xảy ra

**Mục tiêu**
- Lưu toàn bộ chủ đề và thẻ từ vựng từ file data của chủ dự án.
- Lưu tiến độ ôn lặp lại ngắt quãng cho từng thẻ, đủ để tính mọi con số trên UI.
- Ghi lịch sử từng câu trả lời để làm trang kết quả, biểu đồ 7 ngày và chuỗi ngày học.

**Không làm (giai đoạn này)**
- Đăng nhập, nhiều người dùng, phân quyền. Chủ dự án nói: *"phase này chỉ 1 mình tui dùng nên chưa phân quyền"*.
- Giao diện quản trị để sửa từ. Sửa bằng file data và chạy lại script, hoặc sửa thẳng trong DB.
- Gọi AI lúc người dùng đang học.
- Module Ngữ pháp và Luyện nghe (trên UI đang hiện "Sắp có").

**Không được xảy ra**
- Nạp lại hoặc sửa file data mà làm mất tiến độ đã học.
- Thiết kế chỉ chạy được với một người dùng, đến lúc thêm user phải đập đi làm lại.

## 3. Những gì chủ dự án đã quyết

1. **Một người dùng, chưa có auth.**
2. **IPA, loại từ, câu ví dụ do AI sinh ra.**
3. **Mỗi dòng trong data là một thẻ riêng.** `head` trong *Body Parts* và `head` trong *Occupations* là hai thẻ khác nhau, tiến độ học tính riêng.
4. **Tiến độ học** (mình đề xuất, chủ dự án đã đồng ý):
   - Thẻ có 3 trạng thái: `new` (chưa học), `learning` (đang học), `mastered` (đã thuộc).
   - Thẻ là `mastered` khi khoảng cách tới lần ôn kế tiếp **≥ 7 ngày**.
   - Bậc ôn và khoảng cách tương ứng: `0: 1 phút`, `1: 1 ngày`, `2: 3 ngày`, `3: 7 ngày`, `4: 14 ngày`, `5: 30 ngày`, `6: 60 ngày`.
   - **Chưa nhớ** → về bậc 0. **Hơi nhớ** → giữ nguyên bậc. **Đã nhớ** → lên 1 bậc, tối đa bậc 6.
   - *(Mình quyết)* Thẻ mới (chưa có progress): Chưa nhớ → bậc 0 (1 phút), Hơi nhớ → bậc 1 (1 ngày), Đã nhớ → bậc 2 (3 ngày).
   - Quiz cũng tính: **đúng** như Đã nhớ; **sai** hoặc **bỏ qua** như Chưa nhớ.
   - Mỗi câu trả lời, ở flashcard hay quiz, được ghi một dòng lịch sử.
   - Mục tiêu từ mới mỗi ngày mặc định là 20, lưu trong DB để đổi được.

## 4. Các collection

Có 6 collection, đặt tên theo kiểu mặc định của Mongoose (số nhiều). Mỗi collection là một schema thuộc một feature module (`VocabularyModule`) đăng ký bằng `MongooseModule.forFeature`, rồi import vào `AppModule` theo đúng quy ước của repo.

### 4.1 `topics`

| Trường | Kiểu | Ghi chú |
|---|---|---|
| `_id` | ObjectId | |
| `slug` | string, unique | Sinh từ `topic_name_en`, ví dụ `time-calendar`. Đây là khóa ổn định khi nạp lại dữ liệu. |
| `order` | number | Thứ tự hiển thị, bắt đầu từ 1. Lấy theo thứ tự trong file. Trên UI là "Chủ đề 05". |
| `nameEn` | string | `topic_name_en` |
| `nameVi` | string | `topic_name_vn` |
| `cardCount` | number | Số thẻ trong chủ đề, script seed cập nhật. Dùng để hiện "x/**y** từ" mà không cần đếm lại mỗi lần. |
| `createdAt`, `updatedAt` | Date | `timestamps: true` |

Index: `{ slug: 1 }` unique, `{ order: 1 }`.

### 4.2 `cards`: mỗi dòng trong data là một thẻ

| Trường | Kiểu | Ghi chú |
|---|---|---|
| `_id` | ObjectId | |
| `key` | string, unique | `"<topicSlug>:<en đã chuẩn hóa>"` (chữ thường, gộp khoảng trắng). Khóa ổn định, nạp lại không tạo trùng và không mất tiến độ. |
| `topicId` | ObjectId → topics | |
| `order` | number | Thứ tự trong chủ đề, theo file. |
| `en` | string | Giữ nguyên chuỗi gốc, ví dụ `go/went/gone`, `theatre/theater`, `shelf (shelves)`. Dùng để hiển thị. |
| `headword` | string | Dạng chính để hiện to trên thẻ, phát âm và hỏi trong quiz Việt→Anh / Nghe & gõ. Ví dụ `go`, `theatre`, `shelf`. |
| `forms` | string[] | Các dạng liên quan, ví dụ `["go","went","gone"]`, `["theatre","theater"]`, `["shelf","shelves"]`. Để hiển thị. |
| `acceptedEn` | string[] | Đáp án tiếng Anh được chấm đúng, lưu ở dạng chữ thường. Biến thể chính tả (`theatre`/`theater`, `everybody`/`everyone`) đều được chấp nhận. Động từ bất quy tắc chỉ chấp nhận nguyên mẫu (`go`). |
| `vi` | string | Nghĩa gốc, ví dụ `"giai đoạn, thời kỳ"`. |
| `acceptedVi` | string[] | Đáp án tiếng Việt được chấm đúng: tách `vi` theo `,` và `/`, bỏ phần trong ngoặc. Lưu **cả bản có dấu và bản bỏ dấu**, chữ thường. Ví dụ `["giai đoạn","giai doan","thời kỳ","thoi ky"]`. AI có thể thêm từ đồng nghĩa ngắn. |
| `ipa` | string \| null | AI sinh, ví dụ `/ˈbrek.fəst/`. |
| `pos` | enum \| null | `noun`, `verb`, `adjective`, `adverb`, `preposition`, `conjunction`, `pronoun`, `phrase`. AI sinh. UI tự dịch sang "danh từ"… |
| `example` | object \| null | `{ en, vi, highlight }`. `highlight` là đoạn trong `en` cần in đậm, ví dụ `"vegetables"`. FE tách `en` theo `highlight` để render. |
| `enrichment` | object | `{ status: 'pending' \| 'done' \| 'failed' \| 'edited', model, at }`. `edited` nghĩa là đã sửa tay, script AI không được ghi đè. |
| `createdAt`, `updatedAt` | Date | |

Index: `{ key: 1 }` unique; `{ topicId: 1, order: 1 }`; text index trên `en`, `vi` cho ô "Tìm từ" (hoặc builder dùng regex không phân biệt hoa thường, vì dữ liệu chỉ khoảng 1000 dòng).

### 4.3 `cardprogresses`: tiến độ của từng thẻ

Tách riêng khỏi `cards` để nội dung từ vựng và tiến độ học độc lập với nhau. Nạp lại nội dung không động đến tiến độ, và sau này thêm `userId` là có nhiều người dùng.

| Trường | Kiểu | Ghi chú |
|---|---|---|
| `_id` | ObjectId | |
| `cardId` | ObjectId → cards, unique | (Sau này có user thì unique theo `{userId, cardId}`.) |
| `topicId` | ObjectId | Lưu thêm từ thẻ để đếm tiến độ theo chủ đề không cần join. |
| `state` | `'learning' \| 'mastered'` | Thẻ **chưa có** bản ghi progress thì là `new`. Không tạo sẵn 1000 bản ghi rỗng. |
| `stage` | number 0–6 | Bậc ôn hiện tại (mục 3.4). |
| `dueAt` | Date | Lúc cần ôn tiếp. |
| `firstSeenAt` | Date | Lần đầu học thẻ này, dùng để đếm "từ mới hôm nay". |
| `lastReviewedAt` | Date | |
| `reviewCount` | number | Tổng số lần ôn. |
| `lapseCount` | number | Số lần bị đẩy về bậc 0 sau khi đã qua bậc 0. |

`state` luôn suy ra từ `stage`: `stage >= 3` (khoảng cách ≥ 7 ngày) thì là `mastered`, còn lại là `learning`. Lưu sẵn để lọc và đếm cho nhanh.

Index: `{ cardId: 1 }` unique; `{ dueAt: 1 }` cho "Cần ôn hôm nay"; `{ topicId: 1, state: 1 }` cho tiến độ theo chủ đề; `{ firstSeenAt: 1 }`; `{ lastReviewedAt: -1 }` cho "Tiếp tục học".

### 4.4 `studysessions`: một buổi học

| Trường | Kiểu | Ghi chú |
|---|---|---|
| `_id` | ObjectId | |
| `mode` | `'flashcard' \| 'quiz'` | |
| `topicId` | ObjectId \| null | `null` khi ôn trộn nhiều chủ đề ("Ôn tập hôm nay"). |
| `startedAt` | Date | |
| `endedAt` | Date \| null | `null` khi buổi học chưa kết thúc. |
| `totals` | object | `{ again, hard, good, correct, wrong, skipped }`, cập nhật mỗi lần trả lời. Dùng cho bộ đếm trong phiên và trang kết quả. |
| `plannedCount` | number \| null | Số câu dự kiến của quiz (UI: "Câu 8/10"). |

Thời lượng buổi học bằng `endedAt - startedAt` ("12 phút").

### 4.5 `reviewlogs`: mỗi câu trả lời một dòng

| Trường | Kiểu | Ghi chú |
|---|---|---|
| `_id` | ObjectId | |
| `cardId` | ObjectId | |
| `topicId` | ObjectId | Lưu thêm từ thẻ. |
| `sessionId` | ObjectId → studysessions | |
| `source` | `'flashcard' \| 'quiz'` | |
| `rating` | `'again' \| 'hard' \| 'good'` \| null | Chỉ có ở flashcard. |
| `quizType` | `'en_vi' \| 'vi_en' \| 'listen'` \| null | Chỉ có ở quiz. |
| `result` | `'correct' \| 'wrong' \| 'skipped'` \| null | Chỉ có ở quiz. |
| `answer` | string \| null | Câu người học gõ, để trang kết quả hiện "Bạn trả lời: ~~delicous~~". |
| `wasNew` | boolean | `true` nếu đây là lần đầu học thẻ (lúc đó chưa có progress). |
| `stageBefore` | number \| null | `null` khi `wasNew`. |
| `stageAfter` | number | |
| `at` | Date | |

Index: `{ sessionId: 1 }`, `{ at: -1 }`, `{ cardId: 1, at: -1 }`.

### 4.6 `settings`: một document duy nhất

| Trường | Kiểu | Mặc định |
|---|---|---|
| `_id` | string | `'default'` |
| `dailyNewGoal` | number | `20` |
| `timezone` | string | `'Asia/Ho_Chi_Minh'` |

`timezone` quyết định ranh giới "một ngày" khi tính mục tiêu hôm nay, chuỗi ngày học và biểu đồ 7 ngày.

## 5. Các con số trên UI được tính thế nào

| Trên UI | Cách tính |
|---|---|
| "248 / 1000 từ đã thuộc" | `count(cardprogresses, state='mastered')` / `count(cards)` |
| Chủ đề hoàn thành / đang học / chưa bắt đầu | Gom `cardprogresses` theo `topicId`. **Hoàn thành**: mọi thẻ đều `mastered`. **Chưa bắt đầu**: không có bản ghi progress nào. **Đang học**: còn lại. |
| Thanh tiến độ trên thẻ chủ đề "x/y" | x = số `mastered` trong chủ đề, y = `topics.cardCount` |
| Mục tiêu hôm nay "15/20" | `count(cardprogresses, firstSeenAt ≥ đầu ngày theo timezone)` / `settings.dailyNewGoal` |
| "Cần ôn hôm nay: 32" | `count(cardprogresses, dueAt ≤ cuối ngày hôm nay theo timezone)`. Lượt "Ôn tập hôm nay" lấy cùng tập thẻ này. *(Mình quyết.)* |
| Chuỗi học "7 ngày" | Số ngày liên tiếp tính lùi từ hôm nay (hoặc hôm qua nếu hôm nay chưa học) mà có ít nhất 1 `reviewlog`, theo timezone |
| Biểu đồ 7 ngày | Gom `reviewlogs` theo ngày (timezone), đếm số `cardId` khác nhau mỗi ngày |
| "Tiếp tục học" | Chủ đề của `cardprogresses` có `lastReviewedAt` mới nhất mà chưa hoàn thành |
| Trang kết quả | `studysessions` theo id, cộng với `reviewlogs` của session đó có `result ∈ {wrong, skipped}` hoặc `rating='again'` |

Mọi con số đều tính trực tiếp khi gọi API (chỉ khoảng 1000 thẻ, một người dùng). Không làm bảng thống kê tổng hợp sẵn.

## 6. Ghi nhận một câu trả lời

Mỗi lần trả lời chạy theo một luồng duy nhất:

1. Đọc progress của thẻ. Chưa có thì đây là thẻ mới: `stageBefore = null`, `wasNew = true`.
2. Quy kết quả về một mức đánh giá: quiz đúng → `good`; sai hoặc bỏ qua → `again`.
3. Tính `stageAfter` theo mục 3.4 và `dueAt = now + khoảng cách của stageAfter`. Tăng `lapseCount` nếu thẻ bị đẩy từ bậc ≥ 1 về 0.
4. Upsert progress (đặt `firstSeenAt` nếu là thẻ mới), ghi một dòng `reviewlogs`, tăng `totals` của session.

Hàm chuyển bậc là hàm thuần (nhận stage cũ và mức đánh giá, trả về stage mới), viết unit test riêng.

## 7. Nạp dữ liệu và sinh nội dung bằng AI

- **File nguồn:** chủ dự án đặt bản JSON sạch vào repo, ví dụ `data/vocabulary.json`, đúng định dạng `[{topic_name_en, topic_name_vn, words:[{en, vn}]}]`. ⚠️ Bản dán trong chat bị hỏng nhiều chỗ (dòng bị cắt, thiếu `topic_name_en`), nên cần file gốc.
- **Script seed** (chạy được nhiều lần, kết quả như nhau): upsert `topics` theo `slug`, upsert `cards` theo `key`. Thẻ có trong DB mà không còn trong file thì **in cảnh báo, không xóa**, để không mất tiến độ. Cập nhật `topics.cardCount`.
- **Seed sinh `headword`/`forms`/`acceptedEn`** *(mình quyết, theo luật cố định, không dựa vào AI)*:
  - Thẻ thuộc chủ đề động từ (`Verbs: Irregular Verbs`, `Verbs: Double Consonant & Y-to-I Rules`): `a/b/c` là các dạng chia. `headword = a`, `forms = [a,b,c]`, `acceptedEn = [a]`.
  - Các chủ đề khác: `a/b` là biến thể chính tả hoặc đồng nghĩa. `headword = a`, `forms = acceptedEn = [a,b]`.
  - `x (y)`: `headword = x`, `forms = [x,y]`, `acceptedEn = [x]`.
- **Quyền ghi khi chạy lại seed** *(mình quyết)*: seed luôn ghi `topicId`, `order`, `en`, `vi`. Các trường suy ra (`headword`, `forms`, `acceptedEn`, `acceptedVi`) chỉ tính lại khi `en` hoặc `vi` thay đổi so với DB **và** thẻ không ở trạng thái `edited`. Khi đó seed cũng đặt `enrichment.status = 'pending'` để AI sinh lại.
- **Script sinh nội dung bằng AI** (chạy riêng): lấy các thẻ có `enrichment.status ∈ {pending, failed}`, gửi theo lô (gồm topic, `en`, `vi`), nhận về `ipa`, `pos`, `example{en,vi,highlight}`, có thể kèm từ đồng nghĩa cho `acceptedVi`. Ghi vào DB với `status='done'`. Không ghi đè thẻ `edited`. Kiểm tra `highlight` có thật sự nằm trong `example.en`; nếu không thì đánh dấu `failed`.
- Hai script là CLI riêng (ví dụ `npm run seed`, `npm run enrich`), không chạy khi khởi động app.

## 8. Chuẩn bị cho nhiều người dùng sau này

Khi có auth, chỉ cần thêm `userId` vào `cardprogresses`, `studysessions`, `reviewlogs`, `settings`, rồi đổi các unique index thành `{userId, …}`. `topics` và `cards` dùng chung cho mọi người nên giữ nguyên.

## 9. Để builder tự quyết

- Thiết kế endpoint REST: đường dẫn, phân trang, DTO, Swagger.
- Thuật toán chọn câu cho một lượt quiz: chọn thẻ nào, dạng câu nào, bao nhiêu câu. Mặc định gợi ý: ưu tiên thẻ đến hạn ôn, 10 câu, dạng câu ngẫu nhiên.
- Thứ tự thẻ mới trong flashcard (mặc định theo `order`).
- Cách so khớp đáp án: chuẩn hóa chữ thường, bỏ khoảng trắng thừa, bỏ dấu ở cả hai phía khi chấm tiếng Việt.
- Chọn nhà cung cấp và model AI, cách chia lô cho script sinh nội dung.

## 10. Các quyết định mình tự đưa ra (chủ dự án nên xem lại)

- Tách tiến độ thành collection riêng (`cardprogresses`) thay vì nhúng vào `cards`.
- Khóa ổn định `key = topicSlug:en`, và nạp lại không xóa thẻ.
- Không tạo sẵn progress cho thẻ mới: chưa có bản ghi nghĩa là `new`.
- Động từ bất quy tắc: quiz chỉ hỏi và chấm nguyên mẫu.
- Tiếng Việt chấp nhận cả có dấu và không dấu.
- Múi giờ `Asia/Ho_Chi_Minh` cho mọi tính toán theo ngày.
- Tính số liệu trực tiếp, không làm bảng thống kê tổng hợp sẵn.
