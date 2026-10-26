# Vocabulary Topics + AI Grading Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Learners study vocabulary topic by topic, typing answers in either direction. Answers are graded by exact match, then a cache, then Groq AI. The app tracks per-topic correct/wrong counts and the total number of words learned. Everything is served by the NestJS API and consumed by the existing React FE.

**Architecture:** BE has one `VocabularyModule` (`src/vocabulary/`) with 5 Mongoose collections. It contains a pure text-normalisation layer, a `GroqService` that returns `null` instead of throwing, an `AnswerGrader` that runs the pipeline, a `ProgressService` with the read, write and reset logic, and one controller. Seed and enrich are standalone CLI scripts that boot a Nest application context. The FE (`FE/study-english`) swaps its mock service and localStorage progress for `fetch` calls to the API, and adds a direction toggle plus typed-answer flashcards.

**Tech Stack:** NestJS 12, Mongoose 9, native ESM (`.js` import suffixes), Jest via `node --experimental-vm-modules`, `mongodb-memory-server` (new devDependency) for service and controller specs, Groq's OpenAI-compatible REST through global `fetch`. FE: React 19, MUI 7, react-router-dom 7, Vite.

**Spec:** `docs/superpowers/specs/2026-10-26-vocabulary-topics-design.md`

## Global Constraints

- One user, no auth. Leave room for `userId` later, but add no user fields now.
- Progress is counted once per word, from the **latest** answer, and is shared by both directions (`en_vi`, `vi_en`).
- An empty or whitespace-only answer counts as wrong: `gradedBy: 'skipped'`.
- If the AI is unavailable (no key, timeout, HTTP error, unparsable reply), return `isCorrect: null` with `gradedBy: 'ungraded'`. In that case write **no** cache entry and **do not** touch `wordprogresses`, but **do** write an `answerlogs` row with `isCorrect: null`.
- `DELETE /vocabulary/progress` removes `wordprogresses` and `answerlogs`. It **keeps** `gradecaches`.
- Seed never deletes words. A word that is in the DB but missing from the file only triggers a warning.
- Word key is `"<topicSlug>:<normalized en>"`. When the same `en` appears twice in one topic, later rows get `#2`, `#3`, … in order of appearance.
- API ids are Mongo ObjectId strings. "Chủ đề {n}" shows `order`.
- Env vars: `GROQ_API_KEY` is optional. `GROQ_MODEL` is optional and has a default. The app must boot without either.
- BE: relative imports end in `.js`. Read config with `configService.get`/`getOrThrow`. Hand-written validation only, no class-validator or Joi, matching `env.validation.ts`. oxlint `no-floating-promises` is an error.
- Neither repo is a git repository yet. The commit steps assume the user has run `git init` in both. If they haven't, skip the commit steps.

## Review Focus

1. **The answer differs only by case, spaces or diacritics** (`"Xin Chao "` for `xin chào`). Expect `exact` and correct, with no Groq call. Test in Task 2 and Task 5.
2. **No `GROQ_API_KEY` at all**, which is the state the owner starts in. Expect the app to boot, exact matches to still be correct, other answers to come back `ungraded`, and topic counts to stay unchanged. Test in Task 5 and Task 6.
3. **Groq replies with junk** (not JSON, or `correct` is not a boolean). Expect `ungraded`, never `wrong`, and nothing cached. Test in Task 4.
4. **The seed runs again after progress exists**, or the same `en` appears twice in a topic. Expect progress and counts to be unchanged and duplicates to stay separate cards. Test in Task 3.
5. **The same word is answered many times, right then wrong.** Expect it to be counted once, by its latest result: one wrong, zero correct. Test in Task 6.
6. **Bad ids** (`wordId: "abc"`, or a valid ObjectId that doesn't exist) should return 400 or 404, never 500. Test in Task 6.

---

## Backend (`/Users/hoaibao/Desktop/WorkSpace/personal-project/BE/study-english`)

### File structure

```
src/vocabulary/
  vocabulary.module.ts
  vocabulary.types.ts              Direction, StudyMode, GradedBy, GradeResult, DTO shapes
  vocabulary.controller.ts
  schemas/{topic,word,word-progress,answer-log,grade-cache}.schema.ts
  text/answer-text.ts (+ .spec)    normalizeAnswer, acceptedAnswers, slugify, baseWordKey
  seed/vocabulary-file.ts (+ .spec) parseVocabularyFile
  seed/seed.service.ts (+ .spec)
  groq/groq.service.ts (+ .spec)
  grading/answer-grader.service.ts (+ .spec)
  progress/progress.service.ts (+ .spec)
  progress/submit-answer.parse.ts  hand-written body validation
  enrich/enrich.service.ts (+ .spec)
src/scripts/seed.ts, src/scripts/enrich.ts
src/test-utils/mongo-memory.ts
data/vocabulary.json               (owner provides; add data/README.md describing format)
```

### Task 1: Groq env config

**Files:**
- Modify: `src/config/env.validation.ts`, `.env.example`
- Test: `src/config/env.validation.spec.ts`

**Interfaces:**
- Produces: the `Environment` interface gains `GROQ_API_KEY?: string` and `GROQ_MODEL: string`.

- [ ] **Step 1: Write failing tests**
  - `accepts missing GROQ_API_KEY`: `validateEnvironment({ MONGODB_URI: 'mongodb://x' }).GROQ_API_KEY` is `undefined`.
  - `defaults GROQ_MODEL`: `.GROQ_MODEL` equals the exported `DEFAULT_GROQ_MODEL`.
  - `treats blank GROQ_API_KEY as missing`: `{ ..., GROQ_API_KEY: '  ' }` gives `undefined`.
  - `keeps provided values`: `GROQ_API_KEY: 'gsk_1'` and `GROQ_MODEL: 'm'` are returned unchanged.
- [ ] **Step 2:** Run `npm test -- src/config/env.validation.spec.ts`. Expect FAIL.
- [ ] **Step 3: Implement**
  - Export `DEFAULT_GROQ_MODEL`, set to a production model currently listed at console.groq.com/docs/models.
  - Add `GROQ_API_KEY=` (empty) and `GROQ_MODEL=` to `.env.example`, with a comment that the key is optional.
- [ ] **Step 4:** Run the same command. Expect PASS.
- [ ] **Step 5:** Commit `feat(config): optional Groq env vars`.

### Task 2: Answer text utilities

**Files:**
- Create: `src/vocabulary/vocabulary.types.ts`, `src/vocabulary/text/answer-text.ts`
- Test: `src/vocabulary/text/answer-text.spec.ts`

**Interfaces:**
- Produces:
  - `type Direction = 'en_vi' | 'vi_en'`
  - `type StudyMode = 'flashcard' | 'quiz'`
  - `type GradedBy = 'exact' | 'cache' | 'ai' | 'skipped' | 'ungraded'`
  - `interface GradeResult { isCorrect: boolean | null; gradedBy: GradedBy }`
  - `normalizeAnswer(s: string): string`
  - `acceptedAnswers(word: { en: string; vi: string }, direction: Direction): string[]`, which returns normalized, de-duplicated answers.
  - `slugify(s: string): string`
  - `baseWordKey(topicSlug: string, en: string): string`

- [ ] **Step 1: Write failing tests**

```ts
expect(normalizeAnswer('  Xin  Chào ')).toBe('xin chao');
expect(normalizeAnswer('Đường')).toBe('duong');
expect(acceptedAnswers({ en: 'period', vi: 'giai đoạn, thời kỳ' }, 'en_vi')).toEqual(['giai doan', 'thoi ky']);
expect(acceptedAnswers({ en: 'x', vi: 'mũ (có vành)' }, 'en_vi')).toEqual(['mu']);
expect(acceptedAnswers({ en: 'chị/em gái', vi: '' }, 'en_vi')).toEqual([]);
expect(acceptedAnswers({ en: 'theatre/theater', vi: 'rạp hát' }, 'vi_en')).toEqual(['theatre', 'theater']);
expect(acceptedAnswers({ en: 'go/went/gone', vi: 'đi' }, 'vi_en')).toEqual(['go', 'went', 'gone']);
expect(acceptedAnswers({ en: 'shelf (shelves)', vi: 'kệ' }, 'vi_en')).toEqual(['shelf']);
expect(acceptedAnswers({ en: 'x', vi: 'chị/em gái' }, 'en_vi')).toEqual(['chi', 'em gai']);
expect(slugify('Places, Buildings & Rooms')).toBe('places-buildings-rooms');
expect(baseWordKey('time-calendar', '  Living  Room ')).toBe('time-calendar:living room');
```

- [ ] **Step 2:** Run `npm test -- src/vocabulary/text`. Expect FAIL.
- [ ] **Step 3: Implement**
  - `normalizeAnswer`: lowercase, NFD then strip `\p{M}`, `đ`→`d`, collapse whitespace, trim. This matches FE `normalizeAnswer` in `QuizPage.tsx:30-36`.
  - `acceptedAnswers`: drop `(...)`, split on `,` and `/`, normalize, then drop empties.
  - `baseWordKey`: lowercase and collapse whitespace on `en`, **keeping** diacritics and `/`.
- [ ] **Step 4:** Run the same command. Expect PASS.
- [ ] **Step 5:** Commit `feat(vocabulary): answer text utilities`.

### Task 3: Schemas, module, file parser and seed

**Files:**
- Create: the five schema files, `vocabulary.module.ts`, `seed/vocabulary-file.ts`, `seed/seed.service.ts`, `src/scripts/seed.ts`, `src/test-utils/mongo-memory.ts`, `data/README.md`
- Modify: `src/app.module.ts` (import `VocabularyModule`), `package.json` (devDep `mongodb-memory-server`; script `"seed": "nest build && node dist/scripts/seed.js"`)
- Test: `seed/vocabulary-file.spec.ts`, `seed/seed.service.spec.ts`

**Interfaces:**
- Schemas use the field names and indexes in spec §4.1–4.5 exactly, with `timestamps: true`. The model class names are `Topic`, `Word`, `WordProgress`, `AnswerLog` and `GradeCache`.
- `interface SourceTopic { nameEn: string; nameVi: string; words: { en: string; vi: string }[] }`
- `parseVocabularyFile(json: unknown): SourceTopic[]` throws `Error` naming the bad topic index, or the topic and word index.
- `SeedService.seed(topics: SourceTopic[]): Promise<SeedReport>` where `SeedReport = { topics: number; inserted: number; updated: number; unchanged: number; missingKeys: string[] }`.
- `startMongo(): Promise<{ uri: string; stop(): Promise<void> }>` (test util).
- `VocabularyModule` exports `SeedService`, `EnrichService`, `ProgressService`. EnrichService is added in Task 7.

- [ ] **Step 1: Write failing parser tests**
  - `maps topic_name_en/topic_name_vn/words[].en/vn`
  - `trims strings`
  - `throws "topic 2: missing topic_name_en"`
  - `throws "topic 1 word 3: missing vn"`
  - `throws when root is not an array`
- [ ] **Step 2: Write failing seed tests.** Use `MongooseModule.forRoot(uri)` from `startMongo()` and the real `VocabularyModule`.
  - `inserts topics with order 1..n, slug, wordCount`
  - `inserts words with key, order, enrichment.status 'pending'`
  - `duplicate en in one topic gets keys k, k#2`
  - `same en in two topics gives two words`
  - `re-seed with same data reports unchanged and creates nothing`
  - `re-seed keeps existing WordProgress docs and their wordIds`: seed, insert a progress row for word A, seed again, then the progress row still references A's `_id`.
  - `changed vi resets enrichment to pending unless status is 'edited'`
  - `word removed from file stays in DB and appears in missingKeys`
- [ ] **Step 3:** Run `npm test -- src/vocabulary/seed`. Expect FAIL.
- [ ] **Step 4: Implement**
  - Schemas, module, parser and `SeedService`. Upsert topics by `slug` and words by `key`, then recompute `wordCount` from the DB.
  - `src/scripts/seed.ts` takes an optional path argument (default `data/vocabulary.json`). It runs `NestFactory.createApplicationContext(AppModule)`, calls `seed`, prints the report (one warning line per missing key), then closes. The exit code is 1 on a parse error.
  - `data/README.md` documents the JSON format.
- [ ] **Step 5:** Run the same command. Expect PASS. Then `npm run build` succeeds.
- [ ] **Step 6:** Commit `feat(vocabulary): schemas and idempotent seed`.

### Task 4: GroqService

**Files:**
- Create: `src/vocabulary/groq/groq.service.ts`
- Test: `groq.service.spec.ts`

**Interfaces:**
- `GroqService.isConfigured(): boolean`
- `GroqService.completeJson(system: string, user: string): Promise<Record<string, unknown> | null>`
  - POSTs to `https://api.groq.com/openai/v1/chat/completions` with `response_format: { type: 'json_object' }`, `temperature: 0`, and `GROQ_MODEL`.
  - Timeout is 8000 ms via `AbortSignal.timeout`.
  - Returns `null` with **no throw** on: missing key, non-2xx, abort, invalid JSON, or a non-object reply. Logs the reason with Nest `Logger`.

- [ ] **Step 1: Write failing tests** (`jest.spyOn(globalThis, 'fetch')`)
  - `returns null and never calls fetch without key`
  - `sends bearer key, model, json response_format`
  - `parses choices[0].message.content into an object`
  - `returns null on 500`
  - `returns null on content "not json"`
  - `returns null when fetch rejects (timeout)`
- [ ] **Step 2:** Run `npm test -- src/vocabulary/groq`. Expect FAIL.
- [ ] **Step 3:** Implement.
- [ ] **Step 4:** Run the same command. Expect PASS.
- [ ] **Step 5:** Commit `feat(vocabulary): Groq client`.

### Task 5: AnswerGrader

**Files:**
- Create: `src/vocabulary/grading/answer-grader.service.ts`
- Test: `answer-grader.service.spec.ts` (memory Mongo for the cache; `GroqService` mocked)

**Interfaces:**
- Consumes: `normalizeAnswer`, `acceptedAnswers` (Task 2); `GroqService.completeJson` (Task 4); the `GradeCache` model.
- Produces: `AnswerGrader.grade(input: { word: { _id: Types.ObjectId; en: string; vi: string }; topicName: string; direction: Direction; answer: string }): Promise<GradeResult>`

- [ ] **Step 1: Write failing tests**
  - `blank answer → { isCorrect: false, gradedBy: 'skipped' }, groq not called`
  - `"Xin Chao" for vi "xin chào" en_vi → exact true, groq not called`
  - `cached false for same normalized answer → { false, 'cache' }, groq not called`
  - `groq {correct:true} → { true, 'ai' } and cache row written with model`
  - `groq {correct:false} → { false, 'ai' } cached`
  - `groq null → { null, 'ungraded' }, no cache row`
  - `groq {correct:"yes"} → { null, 'ungraded' }, no cache row`
  - `cache key includes direction`: a cached `en_vi` entry is not used for `vi_en`.
- [ ] **Step 2:** Run `npm test -- src/vocabulary/grading`. Expect FAIL.
- [ ] **Step 3: Implement**
  - Steps run in the order skip → exact → cache → AI, per spec §5.
  - Prompt wording is the builder's call, but it must state: accept synonyms, paraphrases with the same meaning, minor typos and missing diacritics; reject other meanings and clearly different parts of speech; any form of `a/b/c` verbs counts; reply only `{"correct": boolean}`.
  - Write the cache with an upsert so concurrent submissions don't throw on the unique index.
- [ ] **Step 4:** Run the same command. Expect PASS.
- [ ] **Step 5:** Commit `feat(vocabulary): answer grading pipeline`.

### Task 6: ProgressService and controller (all 5 endpoints)

**Files:**
- Create: `progress/progress.service.ts`, `progress/submit-answer.parse.ts`, `vocabulary.controller.ts`
- Modify: `vocabulary.types.ts` (DTO shapes)
- Test: `progress/progress.service.spec.ts`, `vocabulary.controller.spec.ts` (supertest against `app.getHttpServer()` from a testing module, **no** `api` prefix)

**Interfaces:**
- DTOs, in `vocabulary.types.ts`:
  - `TopicStatus = 'not-started' | 'in-progress' | 'completed'`
  - `TopicSummaryDto { id; order; title; titleVi; totalWords; correct; wrong; notStarted; status }`
  - `WordDto { id; word; pronunciation: string | null; partOfSpeech: string | null; meaning; example: string | null; exampleMeaning: string | null; status: 'correct' | 'wrong' | 'new' }`
  - `TopicDetailDto = TopicSummaryDto & { words: WordDto[] }` (ordered by `order`)
  - `SubmitAnswerInput { wordId: string; direction: Direction; mode: StudyMode; answer: string }`
  - `SubmitAnswerResult { isCorrect: boolean | null; correctAnswer: string; gradedBy: GradedBy }`
  - `SummaryDto { totalWords; learnedWords; wrongWords; notStarted }`
- `parseSubmitAnswer(body: unknown): SubmitAnswerInput` throws `BadRequestException` naming the field. It checks that `wordId` is a valid ObjectId, that `direction` and `mode` are enum values, and that `answer` is a string of at most 200 chars.
- `ProgressService`:
  - `listTopics(): Promise<TopicSummaryDto[]>`
  - `getTopic(id: string): Promise<TopicDetailDto>` throws `BadRequestException` for an invalid id and `NotFoundException` for a missing one.
  - `submitAnswer(input): Promise<SubmitAnswerResult>` throws `NotFoundException` for an unknown word.
  - `summary(): Promise<SummaryDto>`
  - `reset(): Promise<void>`
- Routes: `GET /vocabulary/topics`, `GET /vocabulary/topics/:id`, `POST /vocabulary/answers` (HTTP 200), `GET /vocabulary/summary`, `DELETE /vocabulary/progress` (HTTP 204). Add Swagger `@ApiTags('vocabulary')` and `@ApiOperation` on each route.
- `status` rule: no answered words → `not-started`; `correct === totalWords` → `completed`; otherwise `in-progress`.
- `correctAnswer` is `word.vi` for `en_vi` and `word.en` for `vi_en`.

- [ ] **Step 1: Write failing service tests** (memory Mongo, seeded fixtures, `AnswerGrader` mocked)
  - `listTopics counts correct/wrong/notStarted per topic, ordered by order`
  - `same word right then wrong → correct 0, wrong 1` (Review Focus 5)
  - `answering in en_vi then vi_en updates the same progress row`
  - `ungraded answer writes answerlog with isCorrect null and leaves progress untouched`
  - `skipped answer marks word wrong`
  - `submitAnswer increments correctCount/wrongCount and sets lastAnsweredAt`
  - `summary.learnedWords counts lastResult correct across topics`
  - `reset clears progress and logs, keeps gradecaches`
  - `getTopic words carry status new/correct/wrong`
- [ ] **Step 2: Write failing controller tests** (Review Focus 6)
  - `POST /vocabulary/answers {wordId:'abc'} → 400`
  - `unknown valid ObjectId → 404`
  - `missing direction → 400`
  - `GET /vocabulary/topics/abc → 400`
  - `DELETE /vocabulary/progress → 204`
  - `happy path POST returns {isCorrect, correctAnswer, gradedBy}`
- [ ] **Step 3:** Run `npm test -- src/vocabulary/progress src/vocabulary/vocabulary.controller.spec.ts`. Expect FAIL.
- [ ] **Step 4: Implement.** Compute counts with one aggregation over `wordprogresses` grouped by `topicId` and `lastResult`, joined in code with the topics list.
- [ ] **Step 5:** Run the same command. Expect PASS. Then `npm test`, `npm run lint` and `npm run build` all pass.
- [ ] **Step 6:** Commit `feat(vocabulary): progress tracking and REST API`.

### Task 7: Enrich script

**Files:**
- Create: `enrich/enrich.service.ts`, `src/scripts/enrich.ts`
- Modify: `package.json` (`"enrich": "nest build && node dist/scripts/enrich.js"`), `vocabulary.module.ts`
- Test: `enrich/enrich.service.spec.ts` (memory Mongo, `GroqService` mocked)

**Interfaces:**
- `EnrichService.enrichPending(batchSize = 20): Promise<{ done: number; failed: number; skipped: boolean }>`
  - Returns `skipped: true` and touches nothing when `!groq.isConfigured()`.
  - Each request sends one batch: `[{ key, topic, en, vi }]`.
  - The reply is expected as `{ items: [{ key, ipa, pos, example: { en, vi } }] }`.
  - `pos` must be one of `noun | verb | adjective | adverb | preposition | conjunction | pronoun | phrase`, otherwise the field is stored as `null`.

- [ ] **Step 1: Write failing tests**
  - `fills ipa/pos/example and sets status done with model and at`
  - `word missing from reply → status failed`
  - `never touches status 'edited' or 'done'`
  - `retries 'failed' words on next run`
  - `groq null for a batch → whole batch failed, run continues`
  - `skipped when not configured`
- [ ] **Step 2:** Run `npm test -- src/vocabulary/enrich`. Expect FAIL.
- [ ] **Step 3: Implement.** The script prints `done/failed` and exits with 0.
- [ ] **Step 4:** Run the same command. Expect PASS. Then `npm run build` succeeds.
- [ ] **Step 5:** Commit `feat(vocabulary): AI enrichment script`.

---

## Frontend (`/Users/hoaibao/Desktop/WorkSpace/personal-project/FE/study-english`)

The FE has no test runner. Adding one is out of scope. Verify each FE task with `npm run build` (runs `tsc -b`), `npm run lint`, and the manual check listed in the task, with the BE running locally on seeded data.

### Task 8: API client, types, hooks

**Files:**
- Modify: `src/features/vocabulary/types/vocabulary.ts`, `services/vocabularyService.ts`, `hooks/useVocabulary.ts`, `hooks/useTopic.ts`, `src/vite-env.d.ts`
- Create: `hooks/useStudyDirection.ts`, `.env.example` (`VITE_API_URL=http://localhost:3000/api`)
- Delete: `data/mockVocabulary.ts`

**Interfaces:**
- Types mirror the BE DTOs from Task 6 (`id: string`, nullable `pronunciation`, `partOfSpeech`, `example`, `exampleMeaning`). Also add `Direction`, `StudyMode`, `GradedBy` and `SubmitAnswerResult`.
- `vocabularyService`:
  - `getTopics(): Promise<VocabularyTopic[]>`
  - `getTopic(id: string): Promise<VocabularyTopicDetail>`
  - `submitAnswer(input: { wordId: string; direction: Direction; mode: StudyMode; answer: string }): Promise<SubmitAnswerResult>`
  - `getSummary(): Promise<Summary>`
  - `resetProgress(): Promise<void>`
  - All of them use `fetch` with base URL `import.meta.env.VITE_API_URL ?? 'http://localhost:3000/api'`, and throw `Error` on non-2xx.
- `useVocabulary()` returns `{ topics, loading, error, query, setQuery, filter, setFilter, learnedWords, totalWords, resetProgress, reload }`. It filters by `topic.status` from the API and gets `learnedWords`/`totalWords` from `getSummary`.
- `useTopic(topicId: string)` returns `{ topic, loading, error, reload }`. It no longer has `updateProgress`.
- `useStudyDirection(): [Direction, (d: Direction) => void]`. It persists to localStorage key `'study-english:direction'` with default `'en_vi'`, and wraps reads and writes in try/catch.
- Remove every use of `'study-english:progress'`.

- [ ] **Step 1:** Implement the changes above. Pages will now fail to compile, and Tasks 9–11 fix them.
- [ ] **Step 2:** Don't commit yet. The FE build stays red until Task 11, and Tasks 8–11 are committed together at Task 11, Step 4.

### Task 9: Topic list page with counts, direction toggle and reset

**Files:**
- Modify: `pages/VocabularyPage.tsx`, `components/VocabularyHeader.tsx`, `components/TopicCard.tsx`

- [ ] **Step 1: Implement**
  - `TopicCard` shows "Chủ đề {order}", the status chip, the titles, a progress bar at `correct/totalWords`, and the line `"{correct} đúng · {wrong} sai · {notStarted} chưa học"`. Links use the string `id`.
  - The header shows `learnedWords/totalWords` and an MUI `ToggleButtonGroup` labelled "Anh → Việt" / "Việt → Anh" bound to `useStudyDirection`. Reset calls `resetProgress()` then `reload()`.
  - Show loading and error states. On error, show the message "Không kết nối được máy chủ" with a retry button.
- [ ] **Step 2:** Run `npm run build` and `npm run lint`. The topic page compiles, while errors may remain in the Flashcard and Quiz pages until Tasks 10–11.
- [ ] **Step 3: Manual check.** Topics come from the API, counts match `GET /api/vocabulary/topics`, the toggle survives a reload, and reset zeroes the counts.

### Task 10: Flashcard with typed answers

**Files:**
- Modify: `pages/FlashcardPage.tsx`, and `components/LearningHeader.tsx` if needed

- [ ] **Step 1: Implement this flow for each word**
  - The front shows the prompt for the current direction: `word` + IPA + TTS for `en_vi`, or `meaning` for `vi_en`. It has a text field, "Kiểm tra" (also on Enter, disabled while empty) and "Bỏ qua".
  - On submit, disable the inputs and show "Đang chấm…". Call `submitAnswer` with `mode: 'flashcard'` (Bỏ qua sends `answer: ''`).
  - Show the outcome:
    - Correct: green "Chính xác!"
    - Wrong: red "Chưa đúng. Đáp án: {correctAnswer}"
    - `isCorrect === null`: grey "Chưa chấm được. Đáp án: {correctAnswer}"
    - Network error: an error message with a retry button that keeps the answer.
  - Then flip to show `word`, `pronunciation`, `meaning`, `example`/`exampleMeaning` (hide null fields), plus a "Tiếp" button (also on Enter).
  - Remove the "Chưa nhớ"/"Đã nhớ" buttons and the Trước/Tiếp navigation that skipped grading.
  - The end screen shows `"{correct} đúng · {wrong} sai"` for this run (ungraded answers counted separately), with "Học lại" and "Làm quiz" buttons.
- [ ] **Step 2:** Run `npm run build` and `npm run lint`.
- [ ] **Step 3: Manual check, in both directions.**
  - `hello` → `chào` is correct (with a key) or "Chưa chấm được" (without a key).
  - An exact answer is correct without a key.
  - The topic card counts change after going back to the list.

### Task 11: Quiz via API

**Files:**
- Modify: `pages/QuizPage.tsx`, `utils/createQuiz.ts`

**Interfaces:**
- Replace `createQuiz` with `pickQuizWords(words: VocabularyWord[], count = 10): VocabularyWord[]`, a random sample without replacement. Delete the `options`/distractor code and `QuizQuestion.options`.

- [ ] **Step 1: Implement**
  - Prompts and answers follow the direction.
  - Each check calls `submitAnswer` with `mode: 'quiz'` and uses the same outcome states as Task 10.
  - The header counts are `đúng`, `bỏ qua`, plus `chưa chấm` when it's above 0.
  - The results screen uses the API's `isCorrect`/`correctAnswer`.
  - Delete the local `normalizeAnswer` and the "needs ≥4 words" guard. The new guard is ≥1 word.
- [ ] **Step 2:** Run `npm run build` and `npm run lint`. Expect both to pass with zero errors.
- [ ] **Step 3: Manual check.** 10 questions, a skip counts as wrong on the topic card, and the score matches the answers given.
- [ ] **Step 4:** Commit the FE: `feat(vocabulary): connect FE to API with AI-graded answers`.

### Task 12: End-to-end smoke check

- [ ] **Step 1:** Run the BE with `npm run seed` (needs `data/vocabulary.json` from the owner), then `npm run start:dev`. Run the FE with `npm run dev`.
- [ ] **Step 2: Without `GROQ_API_KEY`**
  - The app boots, the topics list loads, an exact answer is correct, and a synonym is "Chưa chấm được" with counts unchanged.
  - `npm run enrich` prints the skipped message.
- [ ] **Step 3: With the key**
  - Run `npm run enrich` and confirm the flashcards show IPA, part of speech and examples.
  - `hello` → `chào` is correct.
  - Answering the same synonym again returns `gradedBy: 'cache'` (check in the Network tab).
- [ ] **Step 4:** Run `npm run seed` again. Expect it to report everything unchanged, and the topic counts to be identical.
