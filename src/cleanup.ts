import path from 'node:path';
import { promises as fs } from 'node:fs';
import { RETRY_ATTEMPTS, RETRY_DELAY_MS } from './config.js';
import type { CleanupFailure, CleanupOptions, CleanupResult } from './types.js';

type FileSystem = Pick<typeof fs, 'lstat' | 'readdir' | 'unlink' | 'rmdir'>;

export async function cleanDirectoryContents(
  targetPath: string,
  options: CleanupOptions = {},
  fileSystem: FileSystem = fs
): Promise<CleanupResult> {
  const result: CleanupResult = {
    cleanedPaths: [],
    skippedPaths: [],
    failures: [],
  };

  try {
    await cleanEntry(
      targetPath,
      targetPath,
      result,
      {
        maxAttempts: options.maxAttempts ?? RETRY_ATTEMPTS,
        retryDelayMs: options.retryDelayMs ?? RETRY_DELAY_MS,
        excludedPaths: options.excludedPaths,
      },
      fileSystem
    );
  } catch (error) {
    result.failures.push(toFailure(targetPath, error));
  }

  return result;
}

async function cleanEntry(
  targetPath: string,
  entryPath: string,
  result: CleanupResult,
  options: Required<Pick<CleanupOptions, 'maxAttempts' | 'retryDelayMs'>> &
    Pick<CleanupOptions, 'excludedPaths'>,
  fileSystem: FileSystem
): Promise<void> {
  let stats;

  try {
    stats = await fileSystem.lstat(entryPath);
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
      return;
    }

    if (isLockedError(error)) {
      result.skippedPaths.push(entryPath);
      return;
    }

    result.failures.push(toFailure(entryPath, error));
    return;
  }

  if (stats.isSymbolicLink()) {
    await removePathWithRetry(entryPath, result, options, fileSystem);
    return;
  }

  if (stats.isDirectory()) {
    let entries;

    try {
      entries = await fileSystem.readdir(entryPath, { withFileTypes: true });
    } catch (error) {
      if (isLockedError(error)) {
        result.skippedPaths.push(entryPath);
        return;
      }

      result.failures.push(toFailure(entryPath, error));
      return;
    }

    for (const entry of entries) {
      await cleanEntry(
        targetPath,
        path.join(entryPath, entry.name),
        result,
        options,
        fileSystem
      );
    }

    if (entryPath !== targetPath) {
      await removePathWithRetry(entryPath, result, options, fileSystem);
    }
    return;
  }

  await removePathWithRetry(entryPath, result, options, fileSystem);
}

async function removePathWithRetry(
  entryPath: string,
  result: CleanupResult,
  options: Required<Pick<CleanupOptions, 'maxAttempts' | 'retryDelayMs'>> &
    Pick<CleanupOptions, 'excludedPaths'>,
  fileSystem: FileSystem
): Promise<void> {
  if (options.excludedPaths?.has(entryPath)) {
    return;
  }

  try {
    await withRetry(() => removePath(entryPath, fileSystem), options);
    result.cleanedPaths.push(entryPath);
  } catch (error) {
    if (isLockedError(error)) {
      result.skippedPaths.push(entryPath);
      return;
    }

    result.failures.push(toFailure(entryPath, error));
  }
}

async function removePath(
  entryPath: string,
  fileSystem: FileSystem
): Promise<void> {
  const stats = await fileSystem.lstat(entryPath);

  if (stats.isDirectory() && !stats.isSymbolicLink()) {
    await fileSystem.rmdir(entryPath);
    return;
  }

  await fileSystem.unlink(entryPath);
}

async function withRetry<T>(
  operation: () => Promise<T>,
  options: Required<Pick<CleanupOptions, 'maxAttempts' | 'retryDelayMs'>>
): Promise<T> {
  let lastError: unknown;

  for (let attempt = 1; attempt <= options.maxAttempts; attempt += 1) {
    try {
      return await operation();
    } catch (error) {
      lastError = error;

      if (isLockedError(error) || attempt === options.maxAttempts) {
        throw error;
      }

      await delay(options.retryDelayMs);
    }
  }

  throw lastError;
}

function delay(milliseconds: number): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, milliseconds);
  });
}

function isLockedError(error: unknown): boolean {
  return (
    (error as NodeJS.ErrnoException).code === 'EBUSY' ||
    (error as NodeJS.ErrnoException).code === 'EPERM'
  );
}

function toFailure(entryPath: string, error: unknown): CleanupFailure {
  const code = (error as NodeJS.ErrnoException).code;

  return {
    path: entryPath,
    reason: error instanceof Error ? error.message : String(error),
    code: typeof code === 'string' ? code : undefined,
  };
}
