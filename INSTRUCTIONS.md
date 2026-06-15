# Instructions

## Setup Instructions

1. Open the project in your IDE (VSCode recommended)
2. Install dependencies:
   ```bash
   pnpm install
   ```
3. Prepare a repository list JSON file with an array of project entries
4. Confirm that each active repository exists under the configured projects root

## Prerequisites

- Node.js v20 or higher
- pnpm v8 or higher
- Local access to the repository list file
- Local access to each repository path resolved from the projects root
- No MongoDB, Puppeteer, or search-engine access is required

## Configuration

### Main Settings

Configuration is defined by constants in `src/config.ts` and by the repository list JSON file. The app does not currently read a separate settings file.

#### Production vs Development Mode

`logs-cleaner` does not have production and development modes. `pnpm start` runs the cleanup CLI directly, and `pnpm dev` runs it in watch mode.

#### Goal Settings

There are no goal settings. The CLI processes every active repository in the configured list and cleans every discovered cleanup target.

#### Method Settings

There are no link-crawling or email-extraction methods. The only active method is filesystem cleanup of configured directory targets.

#### MongoDB Settings

MongoDB is not used by this project.

#### Search Settings

Search engines and search keys are not used by this project. The repository list is a local JSON file, not a web-search result set.

#### Process Limits

Retry behavior is controlled by constants in `src/config.ts`:

- `RETRY_ATTEMPTS`: Number of cleanup attempts for a path, default `3`
- `RETRY_DELAY_MS`: Delay between retry attempts in milliseconds, default `100`

#### Logging Options

Logging is handled by `src/logger.ts`. Every message is emitted as a JSON line with:

- `level`: `info`, `warn`, or `error`
- `message`: Human-readable event name
- `detail`: Optional structured event data

### Search Engines Configuration

Search engine configuration is not applicable. Repository discovery uses the local repository list instead.

### Search Keys Configuration

Search key configuration is not applicable. Cleanup targets come from each repository's `clear` array or from the default `logs` path.

### Filter Configurations

Filtering is applied to repository entries and cleanup targets:

- `project-repos.ts` keeps only entries where `type` is `active`
- `discovery.ts` skips missing paths, non-directory paths, and symlinked cleanup targets
- `cleanup.ts` skips locked entries reported as `EBUSY` or `EPERM`

#### Email Address Filters

Email address filters are not applicable. The project does not collect or validate email addresses.

#### Link Filters

Link filters are not applicable. The project does not crawl web links.

#### File Extension Filters

File extension filters are not applicable. Cleanup removes all contents inside configured directory targets.

### Email Domain Configurations

Email domain configuration is not applicable. The project does not perform email validation or typo correction.

## Running Scripts

### Main Crawler (with Monitor)

Starts the cleanup CLI:

```bash
pnpm start
```

This command:

- Cleans the app's own log directory first
- Loads the configured repository list
- Filters repository entries to active projects only
- Resolves cleanup targets for each active repository
- Recursively removes contents inside each valid cleanup directory
- Logs structured JSON messages for skipped, cleaned, failed, and summary events
- Exits with code `1` if any cleanup target fails for a non-locked reason

### Backup

A backup script is not implemented.

### Domain Counter

A domain counter script is not implemented.

### Tests

#### Validate Single Email

Email validation is not implemented. Run the cleanup tests instead:

```bash
pnpm test:no-coverage
```

#### Validate Multiple Emails

Email validation is not implemented. The Vitest suite runs all repository, discovery, cleanup, and CLI tests.

```bash
pnpm test:no-coverage
```

#### Debug Email Validation

Email validation is not implemented. Use `pnpm dev` to run the CLI in watch mode while debugging cleanup behavior.

```bash
pnpm dev
```

#### Test Typos

Typo correction is not implemented. Path normalization is tested in `path-model.test.ts`.

```bash
pnpm test:no-coverage src/path-model.test.ts
```

#### Test Link Crawling

Link crawling is not implemented. Cleanup behavior is tested in `cleanup.test.ts`.

```bash
pnpm test:no-coverage src/cleanup.test.ts
```

#### Test Session Links

Session link crawling is not implemented. Cleanup orchestration is tested in `index.test.ts`.

```bash
pnpm test:no-coverage src/index.test.ts
```

#### Email Generator Test

Email generation is not implemented. Repository target discovery is tested in `discovery.test.ts`.

```bash
pnpm test:no-coverage src/discovery.test.ts
```

#### Test Cases

Run the full test suite:

```bash
pnpm test:no-coverage
```

#### Sandbox

Use temporary repository and project roots when manually testing cleanup behavior. Avoid running the default CLI against real repositories until the configured paths are correct.

## Quick Start Guide

### For Testing (Development Mode)

1. Run the test suite:

```bash
pnpm test:no-coverage
```

2. Create a temporary repository list containing an active repository object
3. Create a temporary projects root containing that repository
4. Create a `logs` directory inside the repository
5. Call `runCleanup` with the temporary `repoListPath`, `projectsRoot`, and `ownLogsPath` values

### For Production Crawling

Production crawling is not applicable. For live cleanup, configure the repository list and run:

```bash
pnpm start
```

A repository entry can use the default cleanup path:

```json
[
  {
    "name": "actions-manager",
    "type": "active"
  }
]
```

Or it can specify explicit cleanup paths:

```json
[
  {
    "name": "daily-events-bot",
    "type": "active",
    "clear": ["db", "logs"]
  }
]
```

## File Structure

### Source Files (`src/`)

- `index.ts` - CLI entry point and cleanup orchestration
- `config.ts` - Default paths and retry settings
- `types.ts` - Shared TypeScript types
- `project-repos.ts` - Repository list loading and active-entry filtering
- `discovery.ts` - Cleanup target resolution
- `cleanup.ts` - Recursive directory-content cleanup
- `path-model.ts` - Windows and POSIX path normalization
- `logger.ts` - JSON line logging helper
- `actions-manager/logs-cleaner.ts` - Actions-manager task wrapper
- `*.test.ts` - Vitest coverage for source modules

### Output Files (`dist/`)

The current implementation does not generate crawler output files in `dist/`. Its runtime output is the filesystem cleanup it performs plus JSON log lines written to the console.

## Understanding the Console Status Line

When running, you'll see JSON log lines rather than animated status rows:

```
{"level":"info","message":"Cleaned target.","detail":{"repoName":"actions-manager","repoPath":"C:\\Or\\web\\projects\\actions-manager","configuredPath":"logs","resolvedPath":"C:\\Or\\web\\projects\\actions-manager\\logs","status":"cleaned"}}
{"level":"info","message":"Cleanup summary.","detail":{"repositoriesProcessed":1,"targetsSkipped":0,"targetsCleaned":1,"targetsFailed":0}}
```

- **`level`**: Log severity, either `info`, `warn`, or `error`
- **`message`**: Event type, such as `Skipped cleanup target.`, `Cleaned target.`, or `Cleanup summary.`
- **`detail`**: Structured data for the event, including target paths, failure details, or summary counters

## Troubleshooting

### Application Won't Start

- Check Node version: `node --version` should be v20 or higher
- Check pnpm version: `pnpm --version` should be v8 or higher
- Confirm dependencies are installed: `pnpm install`
- Confirm the repository list file exists at the configured path
- Confirm the repository list root JSON value is an array

### No Email Addresses Being Found

Email collection is not implemented. If no cleanup targets are found, check that:

- The repository entry has `type: "active"`
- The repository name resolves under the configured projects root
- The cleanup target exists
- The cleanup target is a directory
- The cleanup target is not a symlink

### Puppeteer Errors

Puppeteer is not used by this project.

### MongoDB Connection Errors

MongoDB is not used by this project.

### Application Keeps Restarting

The current CLI does not include an auto-restart monitor. If it is invoked by Windows Task Scheduler or an actions-manager task, check the scheduler logs and the JSON error detail emitted by the CLI.

## Important Notes

- Only repository entries with `type: "active"` are processed
- Repositories without a `clear` field clean the default `logs` path
- Repositories with a `clear` array clean exactly those relative paths
- Cleanup removes contents recursively while preserving the cleanup target directory itself
- Symlinked cleanup targets are skipped and are not followed
- Locked entries are skipped instead of failing the whole cleanup
- Non-locked cleanup failures are recorded and cause the CLI to exit with code `1`
- The app logs JSON lines, which is useful for scheduled task output

## Author

- **Or Assayag** - _Initial work_ - [orassayag](https://github.com/orassayag)
- Or Assayag <orassayag@gmail.com>
- GitHub: https://github.com/orassayag
- StackOverflow: https://stackoverflow.com/users/4442606/or-assayag?tab=profile
- LinkedIn: https://linkedin.com/in/orassayag
