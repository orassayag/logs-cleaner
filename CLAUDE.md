# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project overview

`logs-cleaner` is a Node.js/TypeScript command-line utility that scans configured local repositories, finds log directories, removes their contents, and records discovered cleanup paths in a local cache for faster future runs.

The app is currently minimal: `src/index.ts` is the CLI entry point and the implementation is expected to grow from the requirements in `misc/logs-cleaner.txt`.

## Commands

Use `pnpm` for package management.

- Install dependencies: `pnpm install`
- Type-check: `pnpm build`
- Lint: `pnpm lint`
- Format: `pnpm format`
- Check formatting: `pnpm format:check`
- Run CLI in dry mode by default: `pnpm start`
- Run live cleanup: `pnpm start:live`
- Run without cached paths: `pnpm start:no-cache`
- Watch mode: `pnpm dev`
- Run tests: `pnpm test`
- Run tests without coverage: `pnpm test:no-coverage`
- Run a single test file: `pnpm vitest run path/to/file.test.ts`

## Architecture and conventions

- Runtime entry point: `src/index.ts`
- Tests use Vitest and are excluded from the TypeScript build by `tsconfig.json`.
- `misc/logs-cleaner.txt` contains the current product requirements and should be treated as the source of truth over unrelated `README.md` / `INSTRUCTIONS.md` files.
- The package uses ES modules (`type: "module"`) and NodeNext module resolution.
- The coding style enforces semicolons, explicit function return types, no useless constructors, no floating promises, and Prettier-compatible formatting.
- Runtime data is expected under `db/`, including `db/paths.json`, and should be ignored by the build and lint paths.
