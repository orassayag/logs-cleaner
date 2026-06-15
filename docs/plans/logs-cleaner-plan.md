# Logs Cleaner Plan

## Context

`logs-cleaner` is a Node.js/TypeScript command-line utility that scans configured local repositories, finds configured cleanup paths, removes their contents, and supports being triggered from the actions-manager Windows Scheduler integration.

The product requirements come from `misc/logs-cleaner.txt`. The existing `README.md` and `INSTRUCTIONS.md` files belong to another project and should not be treated as source of truth for this implementation.

## Requirements

- Scan repositories from `C:\Or\web\project-repos-names.json`.
- The repo-list file must exist. If it is missing or unreadable, throw an error and exit.
- Parse the repo-list file as JSON.
- Filter only entries where `type === "active"`.
- Resolve each project by local directory name: the entry `name` matches the same directory name under the local projects root.
- Each repo entry may include a `clear` array. Each path in `clear` is a cleanup target relative to that repository.
- Example repo entry shape:

```json
{
  "name": "actions-manager",
  "url": "https://github.com/orassayag/actions-manager",
  "type": "active",
  "purpose": "personal",
  "structure": "single",
  "clear": ["logs", "db", "src/other-path"]
}
```

- If `clear` is absent, default to `["logs"]`.
- If a configured cleanup target is missing or is not an existing directory, skip that target.
- Clean the contents of discovered target directories, preserving the target directory itself.
- Delete the entire content of each target directory regardless of what is inside it.
- Do not follow symlinked directories. Unlink symlink entries without traversing into their targets, and reject symlinked cleanup targets.
- Clean this tool's own previous logs before the current session starts. This app's logs live in the root `logs` folder.
- Do not target the currently open log file.
- Retry failed cleanup operations with bounded attempts and backoff.
- Treat locked/in-use files as skipped rather than fatal.
- Process repositories one by one, not in parallel.
- Support Windows and macOS paths through a path model appropriate for the current operating system.

## Resolved decisions

- Cleanup targets must be existing directories. Missing or non-directory targets are skipped.
- The CLI has no dry/live mode distinction and no `AUTO` flag.
- The repo-list file is required and must exist before cleanup starts.
- The `clear` array is the source of truth for cleanup targets. If it is absent, `logs` is cleaned.
- The actions-manager integration file should call the cleanup script directly, without `AUTO` or dry-mode parameters.

## Recommended implementation approach

Create a small, service-oriented CLI structure:

- `src/index.ts`: parse CLI args, load configuration, orchestrate the cleanup flow, and exit with an error if required inputs are missing.
- `src/types.ts`: shared domain types for project repo entries, cleanup targets, cleanup results, and action definitions.
- `src/config.ts`: constants and path resolution for the repo-list path, local projects root, default `clear` paths, own log path, retry settings, and concurrency settings.
- `src/project-repos.ts`: load, validate, and filter `project-repos-names.json`.
- `src/path-model.ts`: normalize and resolve local paths for the current OS using a small path-normalization layer.
- `src/discovery.ts`: resolve configured `clear` paths under each matched repository and reject unsafe symlinked targets.
- `src/cleanup.ts`: recursively clean directory contents with retries, locked-file handling, symlink-safe traversal, and sequential per-repository processing.
- `src/logger.ts`: simple structured console output for skipped, cleaned, failed, and summary results.
- `src/actions-manager/logs-cleaner.ts`: action-manager integration file to copy into the actions-manager repo later.

Tests should be colocated with source as `*.test.ts` or grouped under `src/__tests__`, matching the existing Vitest setup.

## Important implementation details

- Use Node `fs/promises` for async filesystem traversal and deletion.
- Use `lstat`/`symlink` checks during traversal so symlinked directories are not followed.
- For cleanup targets:
  - If the target is missing, mark it skipped.
  - If it is not a directory, mark it skipped.
  - If it is a symlinked cleanup target, mark it skipped.
  - If it is a safe directory, delete its entries recursively and preserve the directory itself.
- Retry transient cleanup failures with a bounded attempt count, a small fixed backoff delay, and a summary of partial failures.
- Treat `EBUSY` / `EPERM` as locked/skipped rather than fatal.
- Process repositories sequentially to avoid IO thrashing and locked-file storms.
- The actions-manager integration file should call the cleanup script directly and throw only if the child process exits non-zero or fails to spawn.
- Normalize paths with Node path utilities and keep Windows/macOS-specific paths configurable through the repo-list file and local project directory names.

## Verification plan

1. Run `pnpm install` if dependencies are not installed.
2. Run `pnpm build` for TypeScript validation.
3. Run `pnpm lint` for ESLint validation.
4. Run `pnpm format:check` for formatting validation.
5. Run `pnpm test` for Vitest coverage.
6. Add fixture-based tests for:
   - missing repo-list file exits with an error,
   - filtering active vs inactive project entries,
   - resolving local repositories by matching entry `name` to directory name,
   - resolving `clear` paths relative to each repository,
   - defaulting missing `clear` to `logs`,
   - skipping missing or non-directory cleanup targets,
   - deleting all contents of target directories while preserving the directory itself,
   - rejecting symlinked cleanup targets,
   - unlinking symlink entries without following symlinked directories,
   - retrying transient cleanup failures,
   - skipping locked files,
   - cleaning this app's root `logs` folder before repository cleanup,
   - processing repositories sequentially.
7. Manually verify the actions-manager integration file calls the correct script without `AUTO` or dry-mode parameters and handles nonzero exit codes.
