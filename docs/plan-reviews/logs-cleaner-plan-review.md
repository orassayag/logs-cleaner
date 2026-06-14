### ✅ What the Plan Gets Right

| # | Category | Severity | Title | Description |
|---|----------|----------|-------|-------------|
| G1 | Architecture | 🟢 Good | Service-oriented CLI split is appropriate | The proposed modules separate concerns cleanly: repo loading, path cache, discovery, cleanup, logging, and actions-manager integration. |
| G2 | Correctness | 🟢 Good | Dry mode is recognized as the default | Keeping `pnpm start` dry by default and requiring `pnpm start:live` for deletion is the right safety posture for a destructive filesystem utility. |
| G3 | Correctness | 🟢 Good | Cache-first discovery matches the requirement | Using `db/paths.json` first, falling back to root and `src/logs`, and removing stale entries directly reflects the product requirement. |
| G4 | Correctness | 🟢 Good | Preserving target directories is explicit | The plan correctly states that cleanup should delete contents while preserving the `logs` directory itself. |
| G5 | DX | 🟢 Good | Verification plan includes fixture-based tests | The test plan covers the core behaviors: filtering, discovery, cache staleness, dry/live mode, retries, locked files, and the extra `daily-events-bot/db` path. |
| G6 | Architecture | 🟢 Good | Extra cleanup path is treated as configurable | The plan avoids hard-coding the special `db` path into the cleanup implementation and instead points toward a generic extra-path mechanism. |

---

### ⚠️ Issues Found

| # | Category | Severity | Title | Description |
|---|----------|----------|-------|-------------|
| I1 | Security | 🟣 Blocker | Destructive live mode boundary is underspecified | The plan says `AUTO` means non-interactive mode and proposes an actions-manager file that runs `spawnSync('pnpm', ['run', 'start', '--', 'AUTO'])`. Since `pnpm start` is dry by default, this may not clean anything; if `AUTO` is later interpreted as live, the tool could delete files non-interactively without an explicit live-mode authorization boundary. |
| I2 | Security | 🟣 Blocker | Symlink traversal risk is not addressed | Recursive cleanup under `logs` or `db` must never follow symlinked directories. The plan only says “delete entries recursively,” which is unsafe unless it explicitly unlinks symlinks as entries and rejects symlink targets. |
| I3 | Bug | 🟣 Blocker | Cleanup target type is inconsistent with requirements | The requirement is to clean a `logs` directory. The plan says “if it is a file, unlink it,” which would allow a file named `logs` to be deleted even though the product requirement says to skip projects without a logs directory. |
| I4 | Correctness | 🟣 Blocker | Repository path model is ambiguous | `misc/logs-cleaner.txt` describes an array of repo objects with `name`, `url`, `type`, etc., but also talks about local repository paths. The plan does not define whether local paths come from `name`, `url`, an additional field, or a separate mapping. This blocks correct discovery and cache key design. |
| I5 | Security | 🔴 High | `--repos <path>` has no containment or validation policy | A configurable repo-list path is useful, but the plan does not say whether the file path must exist, be absolute, be JSON, or be trusted. If repo entries can contain arbitrary or relative paths, the cleaner could delete contents outside intended repositories. |
| I6 | Bug | 🔴 High | Cache writes can corrupt state | `db/paths.json` is central to future runs, but the plan does not specify atomic writes, schema validation, or recovery from malformed cache files. A failed write or interrupted process can leave the cache unreadable or partially updated. |
| I7 | Correctness | 🔴 High | Cross-platform path handling is underspecified | “Normalize paths with Node path utilities” is not enough. Windows paths, macOS paths, JSON entries, cache paths, and extra cleanup paths need a clear model; using `path` incorrectly across OS boundaries can turn valid Windows paths into relative macOS paths or vice versa. |
| I8 | Correctness | 🔴 High | Own-log cleanup path is undefined | The product requires cleaning this tool’s previous logs before current-session logs, but the plan never defines where those previous logs live, how current-session logs are protected, or how locked log files are skipped. |
| I9 | Architecture | 🟡 Medium | Extra cleanup configuration is still vague | The plan says “generic extra cleanup path” and mentions `daily-events-bot/db`, but it does not define the data shape, matching key, or whether extra paths are project-specific, path-specific, or name-specific. |
| I10 | Bug | 🟡 Medium | Retry and backoff behavior is incomplete | “Bounded attempts and backoff” is not specific enough for tests or user expectations. The plan should define attempt count, delay strategy, whether retries apply to directories and files, and how partial cleanup results are reported. |
| I11 | Scale | 🟡 Medium | No concurrency or backpressure model | A large repo list could trigger many recursive filesystem operations at once. The plan should define sequential or limited-concurrency cleanup to avoid IO thrashing, locked-file storms, and noisy failures. |
| I12 | Bug | 🟡 Medium | Dry mode cache mutation is unspecified | The verification plan says dry mode must not mutate fixtures, but the product also wants to cache discovered paths. The plan must state whether discovery updates `db/paths.json` in dry mode, only in live mode, or via a separate cache-refresh mode. |
| I3 | Correctness | 🟡 Medium | Actions-manager integration conflicts with default dry mode | The proposed `src/actions-manager/logs-cleaner.ts` runs `pnpm start -- AUTO`, but `pnpm start` is dry. If the scheduler expects actual cleanup, the integration file is wrong; if it should be dry, the name and purpose are misleading. |
| I14 | DX | 🟡 Medium | Verification does not cover actions-manager output | The test plan covers CLI behavior but not the generated actions-manager file, `AUTO` parsing, `stdio: 'inherit'`, or process exit-code handling. |
| I15 | DX | 🟵 Low | Plan source path is stale | The requested plan path `docs/logs-cleaner-plan.md` no longer exists; the readable plan is at `docs/plans/logs-cleaner-plan.md`. This is not a product blocker, but it creates review ambiguity. |
| I16 | DX | ⚫ Nice to have | Verification could include malformed input cases | The verification plan should eventually add malformed repo-list JSON, malformed cache JSON, missing default repo-list path, and unreadable cache-file cases. |

---

### 🛠️ Recommendations

| # | Severity | How to Fix |
|---|----------|------------|
| R1 | 🟣 Blocker | Define an explicit destructive-operation model before implementation: `pnpm start` stays dry, `pnpm start:live` is the only live cleanup path, and `AUTO` means non-interactive only. The actions-manager file should call the live script only if actual deletion is intended, e.g. `pnpm run start:live -- --auto`, and should reject ambiguous combinations such as `--auto` without an explicit live flag. This addresses I1. |
| R2 | 🟣 Blocker | Add symlink safety rules to `cleanup.ts` and `discovery.ts`: reject symlinked cleanup targets, unlink symlink entries without traversing into them, and add tests using symlink fixtures. This addresses I2. |
| R3 | 🟣 Blocker | Change cleanup semantics so discovered `logs` and configured extra paths must resolve to existing directories. If a target is a file or missing, report it as skipped rather than unlinking it. This addresses I3. |
| R4 | 🟣 Blocker | Define the repo-list schema and local-path resolution contract. For example, require each active entry to have a `path` field, reject entries without it, and use a stable `cacheKey` such as the normalized absolute repository path or an explicit project ID. This addresses I4. |
| R5 | 🔴 High | Validate configured paths at system boundaries: repo-list file must exist and be JSON; repository paths should resolve to absolute local directories; `--repos` should not be used to infer cleanup targets outside configured repositories; extra paths should resolve under the matched repository unless explicitly configured otherwise. This addresses I5. |
| R6 | 🔴 High | Make cache I/O atomic and schema-checked: read with JSON parse errors reported as cache unavailable, write via temp file plus rename, and validate cache records before merging them with discovered paths. This addresses I6. |
| R7 | 🔴 High | Introduce a small path-normalization layer with tests for Windows and macOS cases. Avoid treating Windows path strings as valid macOS paths; instead, document that paths are local paths for the current OS or provide explicit cross-OS config mapping. This addresses I7. |
| R8 | 🔴 High | Define the tool’s own log directory and cleanup order in `config.ts`: clean previous log files before the current run starts, never target the currently open log file, and skip locked log files. This addresses I8. |
| R9 | 🟡 Medium | Define extra cleanup paths as project-specific config, e.g. `{ projectKey: 'daily-events-bot', path: 'db', required: false }`, and resolve them relative to the matched repository path. This addresses I9. |
| R10 | 🟡 Medium | Specify retry behavior: attempt count, backoff duration, which errors are retried, which errors are skipped, and how partial failures are summarized. This addresses I10. |
| R11 | 🟡 Medium | Add a cleanup concurrency limit, such as sequential repository processing with bounded concurrent file deletion per directory, and expose it only if tests show it is needed. This addresses I11. |
| R12 | 🟡 Medium | Decide cache write policy for dry mode. The safest default is: dry mode never writes `db/paths.json`; live mode updates it after successful discovery. Add tests for both modes. This addresses I12. |
| R13 | 🟡 Medium | Fix the actions-manager integration decision: either make it dry-run reporting or live cleanup, then add tests that parse `AUTO`, call the correct script, and handle nonzero exit codes. This addresses I13 and I14. |
| R14 | 🟵 Low | Update documentation links and plan paths so future reviews point at `docs/plans/logs-cleaner-plan.md` instead of the deleted `docs/logs-cleaner-plan.md`. This addresses I15. |
| R15 | ⚫ Nice to have | Expand verification with malformed repo-list JSON, malformed cache JSON, missing default repo-list path, unreadable cache files, and permission-denied fixtures. This addresses I16. |

---

### ✅ Overall Confidence: 🔴 Do not proceed
