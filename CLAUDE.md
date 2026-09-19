# repro-in-a-box

Autonomous QA CLI that finds bugs on a site, captures reproducible evidence (HAR files plus
screenshots), validates reproducibility by replaying network traffic, and exposes an MCP
server for Claude Desktop integration. Published npm package (bin: `repro`), current version
2.8.1 per `package.json`/`CHANGELOG.md` (README badges are stale, see CODE ISSUES).

Repo: https://github.com/forbiddenlink/repro-in-a-box

## Stack

- TypeScript 7.0.2 (ESM, `"type": "module"`), Node >=20 (`.nvmrc` pins 20)
- Playwright for browser automation, `@axe-core/playwright` / `axe-playwright` for
  accessibility scanning, `web-vitals` for performance metrics
- `@modelcontextprotocol/sdk` for the MCP server
- `commander` for the CLI, `inquirer` for interactive prompts, `adm-zip` for bundling
- Zod for config validation
- Vitest 4 for tests, ESLint (typescript-eslint, type-checked rules) plus Biome
- pnpm (pinned `pnpm@10.34.5`)

## Commands (pnpm)

- `pnpm run build` - `tsc` (compiles `src/` to `dist/`)
- `pnpm run dev` - run the CLI from source via `tsx src/cli/index.ts`
- `pnpm test` / `pnpm run test:run` / `pnpm run test:ui` - Vitest (with `--expose-gc` for
  memory-leak detector tests)
- `pnpm run lint` / `pnpm run lint:fix` - ESLint over `src/**/*.ts` and `tests/**/*.ts`
- `pnpm run biome:check` / `pnpm run biome:fix` / `pnpm run biome:format`
- `pnpm run mcp` - start the MCP server from `dist/mcp/index.js` (requires a build first)

### CLI usage (once built or installed)

- `repro scan <url>` / `repro init` / `repro validate` / `repro diff` - the four CLI commands
  (`src/cli/commands/{scan,init,validate,diff}.ts`)

## Layout

- `src/index.ts` - package entry point (`dist/index.js`, typed via `dist/index.d.ts`)
- `src/cli/` - CLI entry (`dist/cli/index.js` is the `repro` bin) and commands
- `src/detectors/` - 12 detectors: accessibility, broken-assets, broken-links,
  console-warnings, js-errors, memory-leak, mixed-content, network-errors, performance,
  security, seo, web-vitals; `registry.ts`/`catalog.ts` wire them up, `base.ts` is the shared
  detector interface
- `src/crawler/` - multi-page crawler (depth, rate limiting, same-domain filtering)
- `src/scanner/` - scan orchestration
- `src/bundler/` - reproducible ZIP bundling (HAR files + screenshots)
- `src/determinism/` - HAR replay validation logic (has its own `__tests__/`)
- `src/reporters/` - HTML and Markdown report generation
- `src/plugins/` - loader for `repro-plugin-*` packages or local detector/hook modules
- `src/config/` - config loading and schema (Zod)
- `src/mcp/` - MCP server (`server.ts`, `playwright-integration.ts`) for Claude Desktop
- `tests/` - unit tests mirror `src/` structure; `tests/integration/` covers the full scan
  workflow and MCP tool validation; `tests/helpers/browser.ts` is shared test setup
- `action.yml` - GitHub Action wrapper: scans a URL and uploads HTML/Markdown reports as CI
  artifacts

## Env vars

No API keys required; this runs entirely on local Playwright. Logging flags only:
`DEBUG`, `VERBOSE`, `SILENT`.

## Gotchas

- The README's version badge (2.9.0), test-count badge (247+), and the "Current Version:
  2.5.0" line near the bottom all disagree with each other and with `package.json` (2.8.1).
  Trust `package.json` and `CHANGELOG.md` over README prose/badges for version and test counts.
- Both ESLint (`.eslintrc.json`, type-checked rules via `tsconfig.eslint.json`) and Biome are
  configured; `pnpm run lint` uses ESLint, Biome commands are separate and not run by CI.
- `NODE_OPTIONS=--expose-gc` is required for the test scripts because the memory-leak detector
  tests force garbage collection; running `vitest` directly without that flag will fail those tests.
