# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Overview

Study English API — a NestJS 12 REST API backed by MongoDB (Mongoose 9), written in TypeScript and run as **native ESM** (`"type": "module"`). The project is at an early scaffold stage: only the root `AppModule`, a hello-world controller/service, and env validation exist so far.

## Commands

```bash
cp .env.example .env        # then set MONGODB_URI (Atlas connection string)
npm run start:dev           # watch mode; API at http://localhost:3000/api, Swagger at /docs
npm run build               # nest build -> dist/
npm run start:prod          # node dist/main
npm run lint                # oxlint --type-aware src/ test/
npm run format              # prettier (singleQuote, trailingComma: all)
npm test                    # unit tests (src/**/*.spec.ts)
npm run test:e2e            # e2e tests (test/**/*.e2e-spec.ts)
npm run test:cov
```

Run a single test file or test name (args after `--` are passed to Jest):

```bash
npm test -- src/app.controller.spec.ts
npm test -- -t "should return"
npm run test:e2e -- -t "/ (GET)"
```

Jest is invoked through `node --experimental-vm-modules` because the code is ESM; don't call `npx jest` directly.

## Architecture & conventions

- **ESM import paths**: relative imports must use the `.js` extension (e.g. `import { AppService } from './app.service.js'`), as required by `module: nodenext`. Jest's `moduleNameMapper` strips `.js` so ts-jest resolves the `.ts` source.
- **Bootstrap (`src/main.ts`)**: uses top-level `await bootstrap()`. Sets the global prefix `api`, enables CORS and shutdown hooks, mounts Swagger at `/docs` (outside the `api` prefix), and listens on `PORT` from `ConfigService` on `0.0.0.0`.
- **Config**: `ConfigModule` is global and cached; `src/config/env.validation.ts` is a hand-written validator (no Joi/class-validator) that enforces `MONGODB_URI` (`mongodb://` or `mongodb+srv://`), `PORT` (default 3000) and `NODE_ENV` (default `development`). Add new env vars there and to `.env.example`. Read config with `configService.getOrThrow(...)`.
- **Database**: `MongooseModule.forRootAsync` in `AppModule` reads `MONGODB_URI`. New feature modules should register schemas via `MongooseModule.forFeature` and be imported into `AppModule`.
- **Tests**: unit specs live next to source in `src/`; e2e specs live in `test/` with their own config `test/jest-e2e.config.js`. The e2e test imports the full `AppModule`, so it needs a valid `.env`/reachable MongoDB, and it hits routes **without** the `api` prefix (the prefix is only applied in `main.ts`).
- **Lint**: oxlint with type-aware rules; `typescript/no-floating-promises` is an error, `no-explicit-any` is off.
