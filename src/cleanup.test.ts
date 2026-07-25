import { mkdtemp, mkdir, rm, symlink, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { cleanDirectoryContents } from './cleanup.js';
import { promises as fs } from 'node:fs';

const tempDirs: string[] = [];

afterEach(async () => {
  await Promise.all(
    tempDirs
      .splice(0)
      .map((tempDir) => rm(tempDir, { recursive: true, force: true }))
  );
});

describe('cleanDirectoryContents', () => {
  it('deletes all contents while preserving the target directory', async () => {
    const targetPath = await createTarget();
    await mkdir(path.join(targetPath, 'nested'));
    await writeFile(path.join(targetPath, 'file.txt'), 'content');
    await writeFile(
      path.join(targetPath, 'nested', 'nested-file.txt'),
      'nested'
    );

    const result = await cleanDirectoryContents(targetPath, {
      retryDelayMs: 0,
    });

    await expect(fs.access(targetPath)).resolves.toBeUndefined();
    await expect(fs.readdir(targetPath)).resolves.toEqual([]);
    expect(result.cleanedPaths.sort()).toEqual(
      [
        path.join(targetPath, 'file.txt'),
        path.join(targetPath, 'nested', 'nested-file.txt'),
        path.join(targetPath, 'nested'),
      ].sort()
    );
  });

  it('unlinks symlink entries without following symlinked directories', async () => {
    const targetPath = await createTarget();
    const externalPath = await createTempDir();
    const externalFile = path.join(externalPath, 'external.txt');
    await writeFile(externalFile, 'external');
    await symlink(externalFile, path.join(targetPath, 'link.txt'));

    const result = await cleanDirectoryContents(targetPath, {
      retryDelayMs: 0,
    });

    await expect(fs.access(externalFile)).resolves.toBeUndefined();
    await expect(fs.readdir(targetPath)).resolves.toEqual([]);
    expect(result.cleanedPaths).toEqual([path.join(targetPath, 'link.txt')]);
  });

  it('retries transient cleanup failures', async () => {
    const targetPath = await createTarget();
    const filePath = path.join(targetPath, 'file.txt');
    await writeFile(filePath, 'content');
    let unlinkAttempts = 0;

    const result = await cleanDirectoryContents(
      targetPath,
      { retryDelayMs: 0 },
      {
        ...fs,
        unlink: (entryPath) => {
          if (entryPath === filePath && unlinkAttempts === 0) {
            unlinkAttempts += 1;
            const error = new Error(
              'temporary failure'
            ) as NodeJS.ErrnoException;
            error.code = 'EAGAIN';
            return Promise.reject(error);
          }

          return fs.unlink(entryPath);
        },
      }
    );

    expect(unlinkAttempts).toBe(1);
    expect(result.failures).toEqual([]);
    await expect(fs.readdir(targetPath)).resolves.toEqual([]);
  });

  it('skips locked files instead of failing the cleanup', async () => {
    const targetPath = await createTarget();
    const filePath = path.join(targetPath, 'locked.txt');
    await writeFile(filePath, 'content');

    const result = await cleanDirectoryContents(
      targetPath,
      { retryDelayMs: 0 },
      {
        ...fs,
        unlink: () => {
          const error = new Error('locked') as NodeJS.ErrnoException;
          error.code = 'EPERM';
          return Promise.reject(error);
        },
      }
    );

    expect(result.skippedPaths).toEqual([filePath]);
    expect(result.failures).toEqual([]);
  });

  it('skips entries whose lstat reports a locked resource', async () => {
    const targetPath = await createTarget();
    const filePath = path.join(targetPath, 'locked.txt');
    await writeFile(filePath, 'content');

    const result = await cleanDirectoryContents(
      targetPath,
      { retryDelayMs: 0 },
      {
        ...fs,
        lstat: (entryPath) => {
          if (entryPath === filePath) {
            const error = new Error('busy') as NodeJS.ErrnoException;
            error.code = 'EBUSY';
            return Promise.reject(error);
          }

          return fs.lstat(entryPath);
        },
      }
    );

    expect(result.skippedPaths).toEqual([filePath]);
    expect(result.failures).toEqual([]);
  });

  it('records a failure when lstat fails unexpectedly', async () => {
    const targetPath = await createTarget();
    const filePath = path.join(targetPath, 'file.txt');
    await writeFile(filePath, 'content');

    const result = await cleanDirectoryContents(
      targetPath,
      { retryDelayMs: 0 },
      {
        ...fs,
        lstat: (entryPath) => {
          if (entryPath === filePath) {
            const error = new Error('io failure') as NodeJS.ErrnoException;
            error.code = 'EIO';
            return Promise.reject(error);
          }

          return fs.lstat(entryPath);
        },
      }
    );

    expect(result.failures).toEqual([
      { path: filePath, reason: 'io failure', code: 'EIO' },
    ]);
  });

  it('skips a directory whose contents cannot be listed due to a lock', async () => {
    const targetPath = await createTarget();
    const nestedPath = path.join(targetPath, 'nested');
    await mkdir(nestedPath);

    const result = await cleanDirectoryContents(
      targetPath,
      { retryDelayMs: 0 },
      {
        ...fs,
        readdir: ((entryPath: string, options: unknown) => {
          if (entryPath === nestedPath) {
            const error = new Error('busy') as NodeJS.ErrnoException;
            error.code = 'EBUSY';
            return Promise.reject(error);
          }

          return fs.readdir(entryPath, options as never);
        }) as typeof fs.readdir,
      }
    );

    expect(result.skippedPaths).toEqual([nestedPath]);
    expect(result.failures).toEqual([]);
  });

  it('records a failure when a directory cannot be listed unexpectedly', async () => {
    const targetPath = await createTarget();
    const nestedPath = path.join(targetPath, 'nested');
    await mkdir(nestedPath);

    const result = await cleanDirectoryContents(
      targetPath,
      { retryDelayMs: 0 },
      {
        ...fs,
        readdir: ((entryPath: string, options: unknown) => {
          if (entryPath === nestedPath) {
            const error = new Error('io failure') as NodeJS.ErrnoException;
            error.code = 'EIO';
            return Promise.reject(error);
          }

          return fs.readdir(entryPath, options as never);
        }) as typeof fs.readdir,
      }
    );

    expect(result.failures).toEqual([
      { path: nestedPath, reason: 'io failure', code: 'EIO' },
    ]);
  });

  it('leaves excluded paths untouched', async () => {
    const targetPath = await createTarget();
    const excludedFile = path.join(targetPath, 'current.log');
    await writeFile(excludedFile, 'active');

    const result = await cleanDirectoryContents(targetPath, {
      retryDelayMs: 0,
      excludedPaths: new Set([excludedFile]),
    });

    expect(result.cleanedPaths).toEqual([]);
    await expect(fs.access(excludedFile)).resolves.toBeUndefined();
  });

  it('records a failure when a deletion keeps failing', async () => {
    const targetPath = await createTarget();
    const filePath = path.join(targetPath, 'file.txt');
    await writeFile(filePath, 'content');

    const result = await cleanDirectoryContents(
      targetPath,
      { retryDelayMs: 0, maxAttempts: 2 },
      {
        ...fs,
        unlink: () => {
          const error = new Error('io failure') as NodeJS.ErrnoException;
          error.code = 'EIO';
          return Promise.reject(error);
        },
      }
    );

    expect(result.failures).toEqual([
      { path: filePath, reason: 'io failure', code: 'EIO' },
    ]);
  });
});

async function createTarget(): Promise<string> {
  const tempDir = await createTempDir();
  const targetPath = path.join(tempDir, 'logs');
  await mkdir(targetPath);
  return targetPath;
}

async function createTempDir(): Promise<string> {
  const tempDir = await mkdtemp(path.join(tmpdir(), 'logs-cleaner-'));
  tempDirs.push(tempDir);
  return tempDir;
}
