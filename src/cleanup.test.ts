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
