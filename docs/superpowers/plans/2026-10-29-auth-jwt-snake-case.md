# Auth (JWT + refresh) & snake_case Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the whole stack snake_case. Add email/password accounts with a JWT access token and a rotating refresh token, and scope all vocabulary progress to the logged-in user. BE ships first, then FE.

**Architecture:**
- BE: rename everything in `src/vocabulary` to snake_case without changing behaviour, plus a one-off `$rename` migration script.
- New `src/auth` module: `users` and `refresh_tokens` schemas, `AuthService`, `TokenService`, `JwtAuthGuard`.
- `ProgressService` takes `user_id` on every method.
- FE: switch to snake_case types, add an `auth` layer (token storage, a fetch wrapper with single-flight refresh, `AuthProvider`/`useAuth`, login and register pages, a protected-route wrapper).

**Tech Stack:** NestJS 12, Mongoose 9, native ESM (`.js` imports), `@nestjs/jwt`, `bcryptjs`, Jest with `mongodb-memory-server`. FE: React 19, MUI 7, react-router-dom 7, Vite.

**Spec:** `docs/superpowers/specs/2026-10-29-auth-jwt-snake-case-design.md`

## Global Constraints

- **snake_case** applies to every Mongo field (timestamps are `created_at` and `updated_at` via `timestamps: { createdAt: 'created_at', updatedAt: 'updated_at' }`), every API JSON key, query and route param (`:topic_id`), and every variable, function, method, parameter, object property and exported function written by us, in both repos.
- These **stay as they are**: file and folder names; PascalCase classes, types, interfaces and components; React hook names `useXxx`; framework or library APIs (`useState`, `findOne`, `canActivate`, `onModuleInit`, `signAsync`…); Nest decorators, including our own param decorator `CurrentUser`; JWT claim `sub`; env var names.
- Enum values are unchanged except `TopicStatus`, which becomes `not_started | in_progress | completed`.
- Collection names are unchanged. Declare them explicitly: `@Schema({ collection: 'topics' | 'words' | 'wordprogresses' | 'answerlogs' | 'gradecaches' | 'users' | 'refresh_tokens' })`.
- Env vars:
  - `JWT_SECRET` is required, at least 32 chars, and the app must refuse to boot without it.
  - `JWT_ACCESS_TTL` defaults to `15m`.
  - `JWT_REFRESH_TTL` defaults to `1d`.
  - Both TTLs use the format `^\d+[smhd]$`.
  - The existing GROQ vars are unchanged.
- Passwords are stored only as a bcryptjs hash (cost 10). Refresh tokens are stored only as a SHA-256 hash. Neither ever appears in a response or a log.
- The access token is a JWT HS256 with payload `{ sub, email, role }`. The refresh token is 32 random bytes encoded as base64url, and is not a JWT.
- **Every** `/vocabulary/*` route requires `Authorization: Bearer <access_token>`, and every progress or log read and write filters on the token's user. The client never sends `user_id`.
- `gradecaches`, `topics` and `words` stay shared across users.
- Validation is hand-written, with no class-validator, Joi or Passport. oxlint `no-floating-promises` is an error.
- Mongo-backed specs use `startMongo()` and `mongooseTestModule(uri)` from `src/test-utils/mongo-memory.ts`, plus `ConfigModule.forRoot({ isGlobal: true, ignoreEnvFile: true, load: [() => ({ JWT_SECRET: 'x'.repeat(32) })] })` when auth is involved. Run them with the Bash sandbox disabled if mongod can't bind. Always run the FULL `npm test` before committing.
- Commit messages end with a blank line and then `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`. No push.

## Review Focus

1. **User A's token must never read, write or reset user B's progress.** Expect isolated counts. Test in Task 5.
2. **An expired, malformed or wrong-signature access token, and a missing header,** must all give 401, never 500. Test in Task 3.
3. **A refresh token reused after rotation.** Within 10 s it gives 401 and nothing else is revoked. After 10 s every refresh token of that user is revoked. Test in Task 4.
4. **Running the migration twice, or on already-snake_case data,** must be a no-op that keeps `_id` and every value. Test in Task 2.
5. **Email case and whitespace:** register `Bao@Mail.com `, log in with `bao@mail.com`, and it works. Registering `BAO@mail.com` again gives 409. Test in Task 3.

---

## Backend (`/Users/hoaibao/Desktop/WorkSpace/personal-project/BE/study-english`, branch `feature/vocabulary-topics`)

### Task 1: snake_case refactor of the vocabulary module (no behaviour change)

**Files:**
- Modify: all of `src/vocabulary/**` (schemas, services, controller, types, parse, specs), `src/scripts/seed.ts`, `src/scripts/enrich.ts`, `src/config/env.validation.ts` (identifiers only, plus `DEFAULT_GROQ_MODEL` stays), `src/test-utils/mongo-memory.ts` (`start_mongo`, `mongoose_test_module`)

**Interfaces (produces):**
- Schema fields:
  - `topics`: `name_en`, `name_vi`, `word_count`
  - `words`: `topic_id`
  - `wordprogresses`: `word_id`, `topic_id`, `last_result`, `last_answered_at`, `correct_count`, `wrong_count`
  - `answerlogs`: `word_id`, `topic_id`, `is_correct`, `graded_by`
  - `gradecaches`: `word_id`, `normalized_answer`, `is_correct`
  - every collection: `created_at`, `updated_at`
  - Index definitions follow the new names.
- DTOs (`vocabulary.types.ts`):
  - `TopicSummaryDto { id, order, title, title_vi, total_words, correct, wrong, not_started, status: 'not_started'|'in_progress'|'completed' }`
  - `WordDto { id, word, pronunciation, part_of_speech, meaning, example, example_meaning, status }`
  - `SubmitAnswerInput { word_id, direction, mode, answer }`
  - `SubmitAnswerResult { is_correct, correct_answer, graded_by }`
  - `SummaryDto { total_words, learned_words, wrong_words, not_started }`
  - `GradeResult { is_correct, graded_by }`
- Method renames:

  | Class / file | New names |
  |---|---|
  | `ProgressService` | `list_topics()`, `get_topic(topic_id)`, `submit_answer(input)`, `summary()`, `reset()` |
  | `AnswerGrader` | `grade(input)` |
  | `GroqService` | `is_configured()`, `complete_json(system, user, timeout_ms?)` |
  | `SeedService` | `seed(topics)` |
  | `EnrichService` | `enrich_pending(batch_size?)` |
  | `answer-text.ts` | `normalize_answer`, `accepted_answers`, `slugify`, `base_word_key` |
  | `vocabulary-file.ts` | `parse_vocabulary_file` |
  | `submit-answer.parse.ts` | `parse_submit_answer` |
  | `env.validation.ts` | `validate_environment` |

- Route `GET /vocabulary/topics/:topic_id`. `POST /answers` body `{ word_id, direction, mode, answer }`.
- `SourceTopic { name_en, name_vi, words: { en, vi }[] }`. `SeedReport` keys are unchanged (`topics`, `inserted`, `updated`, `unchanged`, `missing_keys`).

- [ ] **Step 1:** Update every spec's assertions and fixtures to the new names first, including the controller spec's request and response bodies and `status: 'not_started'`. Run `npm test` and expect FAIL.
- [ ] **Step 2: Rename the code**
  - Rename the code to match the Interfaces above.
  - `app.module.ts` keeps `validate: validate_environment`.
  - Add `collection:` to each `@Schema` per the Global Constraints.
- [ ] **Step 3:** Run `grep -rnE "\b(topicId|wordId|nameEn|nameVi|wordCount|lastResult|isCorrect|gradedBy|normalizedAnswer|createdAt|updatedAt|totalWords|titleVi|notStarted|partOfSpeech|exampleMeaning|correctAnswer)\b" src`. Expect hits only inside the timestamps option mapping.
- [ ] **Step 4:** Run `npm test`, `npm run lint` and `npm run build`. Expect all to pass.
- [ ] **Step 5:** Commit `refactor: snake_case across vocabulary module`.

### Task 2: Migration script `migrate:snake-case`

**Files:**
- Create: `src/migrations/snake-case.migration.ts`, `src/scripts/migrate-snake-case.ts`
- Modify: `package.json` (`"migrate:snake-case": "nest build && node dist/scripts/migrate-snake-case.js"`), `data/README.md` (how to run it, with an Atlas snapshot first)
- Test: `src/migrations/snake-case.migration.spec.ts`

**Interfaces:**
- `RENAMES: Record<collection, Record<old_field, new_field>>`, taken from spec §5.2 plus `createdAt`/`updatedAt` on all five collections.
- `run_snake_case_migration(db: mongoose.mongo.Db, options: { confirm: boolean }): Promise<MigrationReport>`
  - `MigrationReport = Record<collection, { matched: number; renamed: number }>`.
  - With `confirm: false` it only counts documents having any old field, and writes nothing.
  - With `confirm: true` it runs `updateMany({ $or: [{old: {$exists: true}}…] }, { $rename })` per collection.
  - Then it drops every index whose key contains an old field name.
- The script connects with `MONGODB_URI` via plain `mongoose.connect` (no Nest app, so `JWT_SECRET` isn't needed). It runs dry unless argv includes `--confirm`, prints the report and exits 0. On error it exits 1.

- [ ] **Step 1: Write failing tests** (raw `insertMany` of camelCase docs into a memory DB)
  - `dry run reports counts and changes nothing`
  - `confirm renames all mapped fields and keeps _id and values`
  - `second confirmed run renames 0` (Review Focus 4)
  - `drops old camelCase index { wordId: 1 } but keeps _id_`
  - `already snake_case documents are untouched`
- [ ] **Step 2:** Run `npm test -- src/migrations`. Expect FAIL.
- [ ] **Step 3:** Implement.
- [ ] **Step 4:** Run the full `npm test`, `npm run lint` and `npm run build`. Expect PASS.
- [ ] **Step 5:** Commit `feat: snake_case data migration script`.

### Task 3: Users, register, login, me, and the access-token guard

**Files:**
- Create in `src/auth/`: `auth.module.ts`, `schemas/user.schema.ts`, `users.service.ts`, `token.service.ts`, `auth.service.ts`, `auth.controller.ts`, `jwt-auth.guard.ts`, `current-user.decorator.ts`, `auth.types.ts`, `auth-input.parse.ts`
- Modify: `src/config/env.validation.ts` (+ spec), `.env.example`, `src/app.module.ts`, `package.json` (deps `@nestjs/jwt`, `bcryptjs`, `@types/bcryptjs` if needed)
- Test: `src/auth/auth.service.spec.ts`, `src/auth/auth.controller.spec.ts`, `src/config/env.validation.spec.ts`

**Interfaces:**
- **Env:**
  - `validate_environment` adds `JWT_SECRET` (required, ≥32 chars, else it throws `JWT_SECRET must be at least 32 characters`), `JWT_ACCESS_TTL` (default `'15m'`) and `JWT_REFRESH_TTL` (default `'1d'`). Both TTLs must match `^\d+[smhd]$`.
  - Export `parse_duration_ms(value: string): number`.
- **Types (`auth.types.ts`):**
  - `Role = 'user' | 'admin'`
  - `PublicUser { id: string; email: string; display_name: string | null; role: Role }`
  - `AuthUser { user_id: string; email: string; role: Role }`
  - `TokenPair { access_token: string; refresh_token: string }`
  - `AuthResult = TokenPair & { user: PublicUser }`
- **`users` schema:** `email` (unique, lowercase, trimmed), `password_hash`, `display_name` (string|null), `role` (enum, default `'user'`), timestamps.
- **`UsersService`:**
  - `create_user({ email, password_hash, display_name }): Promise<UserDocument>`
  - `find_by_email(email): Promise<UserDocument | null>`
  - `find_by_id(id): Promise<UserDocument | null>`
  - `count_users(): Promise<number>`
  - `to_public(user): PublicUser`
- **`TokenService`:**
  - `sign_access_token(user: AuthUser): Promise<string>`
  - `verify_access_token(token: string): Promise<AuthUser>` throws `UnauthorizedException`
  - `issue_tokens(user): Promise<TokenPair>`
  - In this task, `issue_tokens` returns a refresh token string generated by `create_refresh_token(user_id)`, which Task 4 implements.
  - Stub for now: return random base64url and persist nothing. Task 4 replaces it.
- **`AuthService`:**
  - `register({ email, password, display_name? }): Promise<AuthResult>` gives 409 `ConflictException` on a duplicate email.
  - `login({ email, password }): Promise<AuthResult>` gives 401 `Invalid email or password` for an unknown email or a wrong password alike.
  - `get_me(user_id): Promise<PublicUser>`
- **`parse_register(body)` / `parse_login(body)`** throw 400 when:
  - email doesn't match `^[^\s@]+@[^\s@]+\.[^\s@]+$` after trim, or is over 254 chars;
  - password is not 8–72 bytes (`Buffer.byteLength`);
  - `display_name` is not a string, or is over 50 chars after trim.
- **`JwtAuthGuard implements CanActivate`:** reads `Authorization: Bearer`, calls `verify_access_token` and sets `request.user: AuthUser`. A missing, malformed or expired token gives 401.
- **`CurrentUser`:** `createParamDecorator` returning `request.user`.
- **Routes:**
  - `POST /auth/register` → 201 `AuthResult`
  - `POST /auth/login` → 200 `AuthResult`
  - `GET /auth/me` (guarded) → `PublicUser`
- `AuthModule` exports `JwtAuthGuard` and `TokenService`, and registers `JwtModule.registerAsync` with secret and TTL from config.

- [ ] **Step 1: Write failing tests**
  - **Env:**
    - `requires JWT_SECRET ≥32 chars`
    - `defaults TTLs`
    - `rejects JWT_ACCESS_TTL "15 minutes"`
    - `parse_duration_ms('15m') === 900000` and `parse_duration_ms('1d') === 86400000`
  - **Service:**
    - `register hashes password (stored hash !== password, bcrypt.compare true)`
    - `register lowercases+trims email`
    - `duplicate email (different case) → 409` (Review Focus 5)
    - `login with differently cased email works`
    - `wrong password and unknown email give identical 401 message`
    - `AuthResult.user has no password_hash`
  - **Controller (supertest, real Mongo):**
    - `POST /auth/register 201 returns access_token, refresh_token, user`
    - `bad email/short password/73-byte password → 400`
    - `GET /auth/me without header → 401`
    - `with malformed token → 401`
    - `with token signed by another secret → 401`
    - `with expired token (JWT_ACCESS_TTL '1s', wait or sign with past exp) → 401` (Review Focus 2)
    - `with valid token → PublicUser`
- [ ] **Step 2:** Run `npm test -- src/auth src/config`. Expect FAIL.
- [ ] **Step 3:** Install the deps and implement.
- [ ] **Step 4:** Run the full `npm test`, `npm run lint` and `npm run build`. Expect PASS.
- [ ] **Step 5:** Commit `feat(auth): users, register/login/me, JWT guard`.

### Task 4: Refresh tokens (rotation, reuse detection, logout)

**Files:**
- Create: `src/auth/schemas/refresh-token.schema.ts`, `src/auth/refresh-token.service.ts`
- Modify: `token.service.ts`, `auth.service.ts`, `auth.controller.ts`, `auth.module.ts`
- Test: `src/auth/refresh-token.service.spec.ts`, extend `auth.controller.spec.ts`

**Interfaces:**
- **`refresh_tokens` schema:** `user_id` (ObjectId, indexed), `token_hash` (unique), `expires_at` (TTL index `expireAfterSeconds: 0`), `revoked_at` (Date|null), `replaced_by` (ObjectId|null), timestamps.
- **`RefreshTokenService`:**
  - `create_refresh_token(user_id): Promise<string>` returns the raw token and stores the sha256 hash with `expires_at = now + JWT_REFRESH_TTL`.
  - `rotate(raw): Promise<{ user_id: string; refresh_token: string }>` throws 401 on:
    - an unknown token;
    - an expired token;
    - a revoked token. If it was revoked with `replaced_by` **and** `now − revoked_at > 10_000 ms`, first revoke every non-revoked token of that user.
  - On success `rotate` revokes the old token, setting `revoked_at` and `replaced_by`, and returns a new one.
  - `revoke(raw): Promise<void>` is a no-op for an unknown or already revoked token.
- `REUSE_GRACE_MS = 10_000`, exported.
- **Routes:**
  - `POST /auth/refresh { refresh_token }` → 200 `TokenPair`, or 401
  - `POST /auth/logout { refresh_token }` → 204 always, if the body is a string; a non-string gives 400.
- `TokenService.issue_tokens` now uses `create_refresh_token`.

- [ ] **Step 1: Write failing tests**
  - `stores only sha256 hash (raw token not found in DB)`
  - `rotate returns new token and old one is revoked with replaced_by`
  - `rotate of expired token → 401`
  - `reuse within 10 s → 401 and the new token still works` (Review Focus 3)
  - `reuse after 10 s (fake timers or set revoked_at back 11 s) → 401 and the new token is revoked too`
  - `revoke unknown token resolves`
  - **Controller:**
    - `refresh → new pair, second use of old → 401`
    - `logout → 204 then refresh with that token → 401`
- [ ] **Step 2:** Run `npm test -- src/auth`. Expect FAIL.
- [ ] **Step 3:** Implement.
- [ ] **Step 4:** Run the full `npm test`, `npm run lint` and `npm run build`. Expect PASS.
- [ ] **Step 5:** Commit `feat(auth): refresh token rotation and logout`.

### Task 5: Per-user progress and protected vocabulary routes

**Files:**
- Modify: `src/vocabulary/schemas/word-progress.schema.ts`, `answer-log.schema.ts`, `progress/progress.service.ts`, `vocabulary.controller.ts`, `vocabulary.module.ts` (import `AuthModule`), `src/auth/auth.service.ts` (legacy claim), and specs
- Test: `progress.service.spec.ts`, `vocabulary.controller.spec.ts`, `auth.service.spec.ts`

**Interfaces:**
- **`wordprogresses`:** add `user_id` (ObjectId, required for new writes). The indexes become `{ user_id: 1, word_id: 1 }` unique and `{ user_id: 1, topic_id: 1, last_result: 1 }`. Remove the old `word_id` unique.
- **`answerlogs`:** add `user_id`. The indexes become `{ user_id: 1, at: -1 }` and `{ user_id: 1, word_id: 1, at: -1 }`.
- **Migration:** extend `run_snake_case_migration` (Task 2) so a confirmed run also drops the now-obsolete unique index `word_id_1` on `wordprogresses` if it exists. Mongoose never drops indexes on its own, and leaving it would block a second user from answering the same word. Add a test for this.
- **`ProgressService`:** `list_topics(user_id)`, `get_topic(user_id, topic_id)`, `submit_answer(user_id, input)`, `summary(user_id)`, `reset(user_id)`. Every query and write includes `user_id`.
- **`VocabularyController`:** `@UseGuards(JwtAuthGuard)` at class level, passing `CurrentUser().user_id`.
- **Legacy claim:** in `AuthService.register`, after insert, if `count_users() === 1`, then `updateMany({ user_id: { $exists: false } }, { $set: { user_id } })` on `wordprogresses` and `answerlogs`. Expose `ProgressService.claim_legacy_progress(user_id): Promise<{ progress: number; logs: number }>` and call it from there.

- [ ] **Step 1: Write failing tests**
  - `user A answers; user B list_topics shows 0 correct/0 wrong` (Review Focus 1)
  - `B reset does not delete A's progress`
  - `same word answered by A and B → two progress rows`
  - `first register claims legacy rows without user_id; second register claims nothing`
  - **Controller:**
    - `every /vocabulary route without token → 401`
    - `with token → works and scoped`
- [ ] **Step 2:** Run `npm test -- src/vocabulary src/auth`. Expect FAIL.
- [ ] **Step 3:** Implement.
- [ ] **Step 4:** Run the full `npm test`, `npm run lint` and `npm run build`. Expect PASS.
- [ ] **Step 5:** Commit `feat: scope vocabulary progress to the authenticated user`.

---

## Frontend (`/Users/hoaibao/Desktop/WorkSpace/personal-project/FE/study-english`, branch `feature/vocabulary-topics`)

The FE has no test runner. Verify each task with `npm run build` and `npm run lint` (both with zero errors), and list the manual browser checks for the human.

### Task 6: FE step 0 — clean tree and two pending fixes

**Precondition:** the owner approves discarding the uncommitted formatting noise in `src/features/vocabulary/pages/{FlashcardPage,QuizPage,VocabularyPage}.tsx` (`git checkout -- <those 3 files>`). The controller asks for this approval. Don't run it without approval.

- [ ] **Step 1:** After approval, `git status --short` is clean.
- [ ] **Step 2:** In the Enter handlers of `FlashcardPage.tsx` and `QuizPage.tsx`, return early when `event.nativeEvent.isComposing`.
- [ ] **Step 3:** In `QuizPage.tsx`, give the check/continue button `key={answered ? 'next' : 'check'}` plus `autoFocus`, so Enter advances after grading.
- [ ] **Step 4:** Run `npm run build` and `npm run lint`, then commit `fix(vocabulary): IME-safe Enter and quiz continue focus`.

### Task 7: FE snake_case alignment with the new API

**Files:** `src/features/vocabulary/**`, `src/App.tsx`

**Interfaces:**
- Types mirror the BE DTOs of Task 1 exactly: `title_vi`, `total_words`, `not_started`, `part_of_speech`, `example_meaning`, `is_correct`, `correct_answer`, `graded_by`, `learned_words`, `wrong_words`, and `TopicStatus = 'not_started'|'in_progress'|'completed'`.
- Route `/topics/:topic_id/...`.
- Service functions: `get_topics`, `get_topic`, `submit_answer`, `get_summary`, `reset_progress`.
- Utilities: `pick_quiz_words`, `to_direction`, … Hooks keep `useXxx` names but return snake_case keys, for example `{ topics, loading, error, reset_progress, reload }`.
- localStorage key `study_english:direction`. Read the old `study-english:direction` once as a fallback.

- [ ] **Step 1:** Rename everything. Run `grep -rnE "\b[a-z]+[A-Z][a-zA-Z]*\b" src/features | grep -vE "use[A-Z]|on[A-Z]|set[A-Z]|import|from|className|aria-|data-|React|Mui|sx="`, review what's left, and keep only library or framework names.
- [ ] **Step 2:** Run `npm run build` and `npm run lint`. Commit `refactor(fe): snake_case to match API`.

### Task 8: FE auth (login, register, guard, refresh)

**Files:**
- Create in `src/features/auth/`: `services/tokenStorage.ts`, `services/authService.ts`, `services/apiClient.ts`, `context/AuthProvider.tsx`, `hooks/useAuth.ts`, `pages/LoginPage.tsx`, `pages/RegisterPage.tsx`, `components/RequireAuth.tsx`
- Modify: `src/App.tsx`, `src/features/vocabulary/services/vocabularyService.ts` (use `api_fetch`), `components/AppNavigation.tsx` (user + Đăng xuất)

**Interfaces:**
- **`tokenStorage`:**
  - `get_access_token`, `set_access_token`, `get_refresh_token`, `set_refresh_token`, `clear_tokens`.
  - Keys `study_english:access_token` (localStorage) and `study_english:refresh_token` (sessionStorage).
  - Every access goes inside try/catch.
  - `is_access_token_expired(token): boolean` decodes `exp` with a 10 s skew.
- **`authService`:**
  - `register({ email, password, display_name? })` and `login({ email, password })` return `AuthResult` and store both tokens.
  - `refresh(): Promise<boolean>` is single-flight (it shares one in-flight promise) and stores the new pair, or calls `clear_tokens` on failure.
  - `logout()` calls the API best-effort, then `clear_tokens`.
  - `get_me()`.
- **`api_fetch(path, init)`:**
  - Adds the Bearer header.
  - On a 401 while a refresh token exists, it awaits `refresh()` and retries once.
  - If it's still 401, or there's no refresh token, it calls `clear_tokens()` and dispatches the window event `study_english:unauthorized`.
- **`AuthProvider`:** `{ user, status: 'loading'|'authenticated'|'anonymous', login, register, logout }`.
  - On mount: no access token, or an expired one with no refresh token, means anonymous. Otherwise it calls `get_me()`.
  - It listens to `study_english:unauthorized` and to the `storage` event (access token removed) to go anonymous.
- **`RequireAuth`:** if anonymous, it navigates to `/login` with `state.from`. Login and register redirect back to `from` (default `/`).
- **Copy:**
  - Pages: "Đăng nhập", "Đăng ký", "Email", "Mật khẩu", "Tên hiển thị (không bắt buộc)", "Chưa có tài khoản? Đăng ký", "Đã có tài khoản? Đăng nhập".
  - Errors: 401 → "Email hoặc mật khẩu không đúng", 409 → "Email đã được sử dụng", 400 → the message from the API.

- [ ] **Step 1:** Implement.
- [ ] **Step 2:** Run `npm run build` and `npm run lint`. Commit `feat(fe): login/register with JWT refresh`.
- [ ] **Step 3: Manual checks** (for the human):
  - Register, then land on the topics page.
  - Reload, and you're still logged in.
  - Wait more than 15 minutes, or set `JWT_ACCESS_TTL=1m`, and the app refreshes silently.
  - Close the browser and reopen it after expiry, and you're sent to login.
  - Log out in one tab, and the other tab goes to login.
  - Two accounts see separate progress.

### Task 9: End-to-end smoke (controller-run)

- [ ] Run the BE against an in-memory Mongo with `data/vocabulary.sample.json`. Use curl to check:
  - register, then `me`, then a vocabulary call without a token (401) and with a token (200);
  - answering scopes to the user;
  - refresh rotation, and reuse after 10 s revoking everything;
  - logout.
- [ ] Run the migration (`--confirm`) against an in-memory copy seeded with the pre-refactor camelCase sample, then check that the new code reads it.
- [ ] Hand the owner the steps for the real DB:
  - take an Atlas snapshot;
  - stop the BE;
  - run `npm run migrate:snake-case` (dry run) and then with `-- --confirm`;
  - add `JWT_SECRET` to `.env`;
  - start the BE;
  - register the owner's account first, so it claims the legacy progress.
