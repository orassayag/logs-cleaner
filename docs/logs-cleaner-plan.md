# Logs Cleaner Plan

## Context

`logs-cleaner` is a Node.js/TypeScript command-line utility that scans configured local repositories, finds log directories, removes their contents, and records discovered cleanup paths in a local cache for faster future runs.

The product requirements come from `misc/logs-cleaner.txt`. The existing `README.md` and `INSTRUCTIONS.md` files belong to another project and should not be treated as source of truth for this implementation.

## Requirements

- Scan repositories from `C:\Or\web\project-repos-names.json`.
- Filter only entries where `type === "active"`.
- For each active project, find a `logs` directory in either:
  - repository root, or
  - `src/logs`.
- If no logs path exists, skip the project.
- Clean the contents of discovered logs paths, preserving the target directory itself.
- Retry failed cleanup operations; if a file is locked/in use, skip that path/file.
- Clean this tool's own previous logs before the current session logs.
- Support a generic extra cleanup path for `daily-events-bot`, specifically its `db` directory.
- Support Windows and macOS paths.
- Cache discovered cleanup paths in `db/paths.json`, keyed by project name with arrays of paths.
- On later runs, use cached paths first; if a cached path is missing, rescan root and `src/logs`, then remove stale cache entries.
- Provide an actions-manager integration file pattern using `spawnSync('pnpm', ['run', 'start', '--', 'AUTO'])`.

## Resolved decisions

- `db/paths.json` should be generated locally and ignored by git.
- Cleanup should delete only the contents of each target directory, preserving the target directory itself.
- The CLI should default to the Windows-specific repo list path `C:\Or\web\project-repos-names.json`, with an optional `--repos <path>` override.

## Recommended implementation approach

Create a small, service-oriented CLI structure:

- `src/index.ts`: parse CLI args, select dry/live mode, and orchestrate the cleanup flow.
- `src/types.ts`: shared domain types for project repo entries, cleanup targets, cache records, results, and action definitions.
- `src/config.ts`: constants and path resolution for the repo list path, cache path, default logs candidates, and extra cleanup paths.
- `src/project-repos.ts`: load and filter `project-repos-names.json`.
- `src/path-cache.ts`: read/write `db/paths.json`, add discovered paths, and remove stale entries.
- `src/discovery.ts`: discover `logs` paths from cache or filesystem scan, including extra paths such as `daily-events-bot/db`.
- `src/cleanup.ts`: recursively clean path contents with retries, locked-file handling, and dry-mode reporting.
- `src/logger.ts`: simple structured console output for skipped, cleaned, failed, and summary results.
- `src/actions-manager/logs-cleaner.ts`: action-manager integration file to copy into the actions-manager repo later.

Tests should be colocated with source as `*.test.ts` or grouped under `src/__tests__`, matching the existing Vitest setup.

## Important implementation details

- Use Node `fs/promises` for async filesystem traversal and deletion.
- For cleanup paths:
  - If the path is missing, mark it skipped.
  - If it is a directory, delete its entries recursively but preserve the directory itself.
  - If it is a file, unlink it.
  - Retry failures with bounded attempts and backoff.
  - Treat `EBUSY` / `EPERM` as locked/skipped rather than fatal.
- Default CLI scripts should remain:
  - `pnpm start`: dry mode by default.
  - `pnpm start:live`: actual deletion.
  - `pnpm start:no-cache`: force rescanning.
  - `pnpm sync`: run with `AUTO`.
- Treat `AUTO` as non-interactive mode for actions-manager.
- Add a future-friendly optional config override, for example `--repos <path>`, but do not overbuild configuration beyond the mini-plan.
- Normalize paths with Node path utilities and keep Windows/macOS-specific paths configurable rather than hard-coded into cleanup logic.
- Add `db/` to `.gitignore` so the generated cache file is not committed.

## Verification plan

1. Run `pnpm install` if dependencies are not installed.
2. Run `pnpm build` for TypeScript validation.
3. Run `pnpm lint` for ESLint validation.
4. Run `pnpm format:check` for formatting validation.
5. Run `pnpm test` for Vitest coverage.
6. Add fixture-based tests for:
   - filtering active vs inactive project entries,
   - discovering root `logs` and `src/logs`,
   - using cached paths and removing stale entries,
   - dry mode not mutating fixtures,
   - live mode deleting only contents,
   - retrying transient cleanup failures,
   - skipping locked files,
   - adding the `daily-events-bot/db` extra cleanup path.
7. Manually verify `pnpm start` logs planned cleanup without deleting, then verify `pnpm start:live` deletes expected fixture contents.
