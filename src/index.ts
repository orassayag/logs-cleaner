import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  DEFAULT_PROJECTS_ROOT,
  DEFAULT_REPO_LIST_PATH,
  OWN_LOGS_PATH,
  RETRY_ATTEMPTS,
  RETRY_DELAY_MS,
} from './config.js';
import { cleanDirectoryContents } from './cleanup.js';
import { resolveCleanupTargets } from './discovery.js';
import { log } from './logger.js';
import { resolveRelativePath } from './path-model.js';
import { loadProjectRepos } from './project-repos.js';
import type { CleanupSummary, RunCleanupOptions } from './types.js';

export async function runCleanup(
  options: RunCleanupOptions = {}
): Promise<CleanupSummary> {
  const repoListPath = options.repoListPath ?? DEFAULT_REPO_LIST_PATH;
  const projectsRoot = options.projectsRoot ?? DEFAULT_PROJECTS_ROOT;
  const ownLogsPath = options.ownLogsPath ?? OWN_LOGS_PATH;
  const currentLogFile = options.currentLogFile;
  const excludedPaths = currentLogFile ? new Set([currentLogFile]) : undefined;
  const ownLogsTarget = resolveRelativePath(process.cwd(), ownLogsPath);
  const ownLogsResult = await cleanDirectoryContents(ownLogsTarget, {
    maxAttempts: options.retryAttempts ?? RETRY_ATTEMPTS,
    retryDelayMs: options.retryDelayMs ?? RETRY_DELAY_MS,
    excludedPaths,
  });
  const summary: CleanupSummary = {
    repoListPath,
    projectsRoot,
    ownLogsPath,
    repositoriesProcessed: 0,
    targetsSkipped: ownLogsResult.skippedPaths.length,
    targetsCleaned: 0,
    targetsFailed: 0,
    ownLogsSkipped: ownLogsResult.skippedPaths,
    ownLogsFailures: ownLogsResult.failures,
  };

  if (ownLogsResult.skippedPaths.length > 0) {
    log({
      level: 'warn',
      message: 'Skipped own log entries.',
      detail: ownLogsResult.skippedPaths,
    });
  }

  if (ownLogsResult.failures.length > 0) {
    log({
      level: 'error',
      message: 'Failed to clean own log entries.',
      detail: ownLogsResult.failures,
    });
  }

  const repos = await loadProjectRepos(repoListPath);

  for (const repo of repos) {
    summary.repositoriesProcessed += 1;

    const targets = await resolveCleanupTargets(repo, projectsRoot);

    for (const target of targets) {
      if (target.status === 'skipped') {
        summary.targetsSkipped += 1;
        log({
          level: 'warn',
          message: 'Skipped cleanup target.',
          detail: target,
        });
        continue;
      }

      const result = await cleanDirectoryContents(target.resolvedPath, {
        maxAttempts: options.retryAttempts ?? RETRY_ATTEMPTS,
        retryDelayMs: options.retryDelayMs ?? RETRY_DELAY_MS,
      });

      if (result.failures.length > 0) {
        target.status = 'failed';
        summary.targetsFailed += 1;
        summary.ownLogsFailures.push(...result.failures);
        log({
          level: 'error',
          message: 'Failed to clean target.',
          detail: { target, failures: result.failures },
        });
        continue;
      }

      target.status = 'cleaned';
      summary.targetsCleaned += 1;
      log({
        level: 'info',
        message: 'Cleaned target.',
        detail: target,
      });

      for (const skippedPath of result.skippedPaths) {
        summary.targetsSkipped += 1;
        log({
          level: 'warn',
          message: 'Skipped locked cleanup entry.',
          detail: { target, skippedPath },
        });
      }
    }
  }

  log({
    level: summary.targetsFailed > 0 ? 'error' : 'info',
    message: 'Cleanup summary.',
    detail: summary,
  });

  return summary;
}

async function main(): Promise<void> {
  try {
    const summary = await runCleanup();

    if (summary.targetsFailed > 0) {
      process.exitCode = 1;
    }
  } catch (error) {
    log({
      level: 'error',
      message: 'Cleanup failed.',
      detail: toFailureDetail(error),
    });
    process.exitCode = 1;
  }
}

function toFailureDetail(error: unknown): { reason: string; code?: string } {
  const code = (error as NodeJS.ErrnoException).code;

  return {
    reason: error instanceof Error ? error.message : String(error),
    code: typeof code === 'string' ? code : undefined,
  };
}

const currentFilePath = fileURLToPath(import.meta.url);
const invokedPath =
  process.argv[1] === undefined ? undefined : path.resolve(process.argv[1]);

if (invokedPath !== undefined && currentFilePath === invokedPath) {
  void main();
}
