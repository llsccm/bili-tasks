# AGENTS.md

TypeScript Bilibili daily-task script for Qinglong, Baihu, and plain Node.js environments. The project uses ESM TypeScript, `tough-cookie` based cookie management, Bilibili web APIs, and esbuild bundling.

## Repository

- GitHub: https://github.com/llsccm/bili-tasks

## Commands

```bash
pnpm install # Install dependencies
pnpm build # Bundle src/index.ts and src/login.ts to dist/*.mjs with esbuild
pnpm dev # Run the daily-task entrypoint with .env in development
pnpm login:dev # Run QR-code login with .env in development
pnpm login # Run bundled dist/login.mjs with .env after build
pnpm test # Run all Node test files under test/*.test.ts
pnpm test:share # Run the share task focused test
pnpm typecheck # Run TypeScript strict type checking
pnpm lint # Run ESLint over the repository
pnpm format # Format source files under src/ with Prettier
```

- Package manager: pnpm only.
- Runtime requirements: Node.js >= 22.0.0, pnpm >= 11.1.3.
- Before submitting code changes, run `pnpm typecheck`, `pnpm lint`, and relevant tests. Run `pnpm build` when entrypoints, bundling, or runtime imports changed.

## Config

- Local development loads `.env` through Node's `--env-file=.env` in the package scripts.
- Runtime config file: `bilitask.config.json` in the current working directory. It is created or updated by local login/config persistence flows.
- Main environment variables:
  - `BILI_TASK_COOKIES` — full Bilibili cookie string; required for task execution.
  - `BILI_UA` — browser user agent used by requests.
  - `BILI_BUVID_FP` — browser `buvid_fp`; recommended for login stability.
  - `BH_SECRET_TOKEN` — Baihu OpenAPI token when running in Baihu.
  - `BH_OPENAPI_BASE_URL` — optional Baihu OpenAPI base URL override.
- Runtime environment detection:
  - Qinglong: reads and writes panel envs through QL API when available.
  - Baihu: uses Baihu OpenAPI and Baihu notification SDK.
  - Plain Node.js: reads process env and persists fallback values to local config.
- Asset-changing tasks must stay guarded by `dryRun` defaults unless the user explicitly opts in.

## Architecture

- `src/index.ts` — Daily-task entrypoint. Loads config, initializes context, then runs all tasks.
- `src/login.ts` — QR-code login entrypoint. Prepares browser-like cookies/fingerprints, polls login status, and saves `BILI_TASK_COOKIES`.
- `src/config.ts` — Default `AppConfig`, including safe task defaults and `dryRun` values.
- `src/storage.ts` — Config loading/persistence and environment override merging.
- `src/context.ts` — Runtime context initialization: CookieJar, CSRF, WBI salt, user info, daily reward state, dynamic videos, fan medals, and bili_ticket handling.
- `src/api/` — Bilibili and panel API layer.
  - `src/api/index.ts` — `BiliApi` aggregate over feature-specific APIs.
  - `src/api/request.ts` — Shared fetch wrapper with `CookieJar` request cookies and response `Set-Cookie` collection.
  - `src/api/passport.ts` — Login/passport APIs.
  - `src/api/user.ts` — Navigation, reward, and user-related APIs.
  - `src/api/video.ts` — Video view, heartbeat, share, relation, and coin APIs.
  - `src/api/live.ts` — Live room, medal, danmu, and like APIs.
  - `src/api/live-trace.ts` — Live heartbeat trace APIs.
  - `src/api/exchange.ts` — Silver/coin exchange APIs.
  - `src/api/vip.ts` — VIP privilege APIs.
  - `src/api/wbi.ts` — WBI signing helper for API parameters.
  - `src/api/baihu.ts` — Baihu OpenAPI client.
- `src/tasks/` — Task implementations.
  - `src/tasks/index.ts` — Task runner and per-task error notification wrapper.
  - `src/tasks/dailyTask.ts` — Main-site login, watch, share, and coin tasks.
  - `src/tasks/liveTask.ts` — Fan-medal light, live-like, and live-watch tasks.
  - `src/tasks/live-heart.ts` — Live room heartbeat protocol implementation.
  - `src/tasks/vipTask.ts` — Yearly VIP privilege claiming.
  - `src/tasks/convertTask.ts` — Silver-to-coin and coin-to-silver conversion tasks.
- `src/types/` — Shared TypeScript interfaces for app config, context, API responses, Bilibili data, Qinglong API, and domain models.
- `src/utils/` — Shared utilities.
  - `src/utils/cookie.ts` — `tough-cookie` helpers and cookie field extraction/merge/export.
  - `src/utils/env.ts` — Environment detection and env read/write abstraction.
  - `src/utils/file.ts` — Config file path and JSON read/write helpers.
  - `src/utils/notify.ts` — Qinglong/Baihu notification abstraction.
  - `src/utils/wbi.ts` — WBI salt generation.
  - `src/utils/check.ts` — Daily reward status refresh/check helpers.
  - `src/utils/index.ts` — Time, random, hashing, logger, query, and Qinglong helper utilities.
- `scripts/build.js` — esbuild bundling script producing ESM `.mjs` files in `dist/`.
- `test/` — Node test runner based `.test.ts` files and helper scripts.

## Code Conventions

- Keep changes small, simple, and focused.
- Use TypeScript strict mode and ESM imports.
- Use `import type` for type-only imports; ESLint enforces this.
- Formatting style: 2 spaces, single quotes, no semicolons, no trailing commas, print width 100.
- Prefer typed interfaces from `src/types/` over ad-hoc object shapes when data crosses modules.
- Task functions should follow `(env: TaskEnv) => Promise<void>` and read enablement from `env.config` before doing work.
- API modules should return typed `BiliResponse<T>`-style values and let task/context code decide task-level behavior.
- Wrap failed external/API operations with meaningful error messages that include returned `message`, `msg`, or status details where available.
- Use `createLogger(scope)` for task and module logging. Avoid leaking cookies, CSRF tokens, refresh tokens, tickets, or other secrets in logs.
- Manage cookies only through `CookieJar` helpers in `src/utils/cookie.ts`; do not manually concatenate persisted cookies outside those helpers unless exporting the final cookie string.
- `b_lsid` is session-scoped and should be generated for the current flow, not treated as stable persisted state.
- WBI signing and salt logic should remain centralized in WBI helpers/API modules.
- Preserve randomized sleeps and rate-limiting behavior around Bilibili operations unless intentionally changing anti-risk behavior.
- Any real asset-changing operation, such as coin, silver, or privilege tasks, must respect `dryRun` and safe defaults.
- Do not hard-code credentials, cookies, tokens, user IDs, room IDs, or environment-specific secrets in source or tests.
- Prefer adding or updating focused tests under `test/` when changing login, cookie, WBI, request, or task behavior.
- Build outputs (`dist/`, `build/`, `out/`, coverage, lockfiles, and environment files) should not be edited as part of normal source changes.
