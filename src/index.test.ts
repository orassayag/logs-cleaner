import { chmod, mkdtemp, mkdir, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { runCleanup } from './index.js';
import { promises as fs } from 'node:fs';

const tempDirs: string[] = [];
const readonlyDirs: string[] = [];

afterEach(async () => {
  await Promise.all(
    readonlyDirs
      .splice(0)
      .map((dir) => chmod(dir, 0o700).catch(() => undefined))
  );
  await Promise.all(
    tempDirs
      .splice(0)
      .map((tempDir) => rm(tempDir, { recursive: true, force: true }))
  );
});

describe('runCleanup', () => {
  it('loads repos sequentially and cleans discovered targets', async () => {
    const projectsRoot = await createTempDir();
    const repoListPath = await writeRepoList(projectsRoot, [
      { name: 'actions-manager', type: 'active' },
      { name: 'inactive-repo', type: 'inactive' },
    ]);
    const activeRepo = await createRepo(projectsRoot, 'actions-manager');
    await createRepo(projectsRoot, 'inactive-repo');
    await writeFile(path.join(activeRepo, 'logs', 'old.txt'), 'old');

    const summary = await runCleanup({
      repoListPath,
      projectsRoot,
      ownLogsPath: 'own-logs',
      retryDelayMs: 0,
    });

    expect(summary.repositoriesProcessed).toBe(1);
    expect(summary.targetsCleaned).toBe(1);
    expect(summary.targetsSkipped).toBe(0);
    await expect(fs.readdir(path.join(activeRepo, 'logs'))).resolves.toEqual(
      []
    );
  });

  it('cleans the app logs before repository cleanup', async () => {
    const projectsRoot = await createTempDir();
    const repoListPath = await writeRepoList(projectsRoot, []);
    const ownLogsPath = await createOwnLogs();
    await writeFile(path.join(ownLogsPath, 'previous.log'), 'previous');

    const summary = await runCleanup({
      repoListPath,
      projectsRoot,
      ownLogsPath,
      retryDelayMs: 0,
    });

    expect(summary.ownLogsFailures).toEqual([]);
    await expect(fs.readdir(ownLogsPath)).resolves.toEqual([]);
  });

  it('cleans configured custom absolute paths', async () => {
    const projectsRoot = await createTempDir();
    const repoListPath = await writeRepoList(projectsRoot, []);
    const customPath = await createTempDir();
    await mkdir(path.join(customPath, 'nested'), { recursive: true });
    await writeFile(path.join(customPath, 'old.log'), 'old');
    await writeFile(path.join(customPath, 'nested', 'inner.log'), 'inner');

    const summary = await runCleanup({
      repoListPath,
      projectsRoot,
      ownLogsPath: 'own-logs',
      customCleanPaths: [customPath],
      retryDelayMs: 0,
    });

    expect(summary.customCleanPaths).toEqual([customPath]);
    expect(summary.customPathsFailures).toEqual([]);
    await expect(fs.readdir(customPath)).resolves.toEqual([]);
  });

  it('records failures for unwritable paths and skips missing targets', async () => {
    const projectsRoot = await createTempDir();
    const repoListPath = await writeRepoList(projectsRoot, [
      { name: 'daily-events-bot', type: 'active', clear: ['missing'] },
    ]);
    await createRepo(projectsRoot, 'daily-events-bot');
    const ownLogsPath = await createUnwritableLogs();
    const customPath = await createUnwritableLogs();

    const summary = await runCleanup({
      repoListPath,
      projectsRoot,
      ownLogsPath,
      customCleanPaths: [customPath],
      retryDelayMs: 0,
    });

    expect(summary.ownLogsFailures.length).toBeGreaterThan(0);
    expect(summary.customPathsFailures.length).toBeGreaterThan(0);
    expect(summary.targetsSkipped).toBeGreaterThan(0);
  });

  it('rejects a missing repo-list file', async () => {
    await expect(
      runCleanup({
        repoListPath: path.join(await createTempDir(), 'missing.json'),
        projectsRoot: await createTempDir(),
        ownLogsPath: 'own-logs',
      })
    ).rejects.toMatchObject({ code: 'ENOENT' });
  });
});

async function writeRepoList(
  projectsRoot: string,
  repos: unknown[]
): Promise<string> {
  const repoListPath = path.join(projectsRoot, 'project-repos-names.json');
  await writeFile(repoListPath, JSON.stringify(repos));
  return repoListPath;
}

async function createRepo(projectsRoot: string, name: string): Promise<string> {
  const repoPath = path.join(projectsRoot, name);
  await mkdir(path.join(repoPath, 'logs'), { recursive: true });
  return repoPath;
}

async function createOwnLogs(): Promise<string> {
  const tempDir = await createTempDir();
  const ownLogsPath = path.join(tempDir, 'logs');
  await mkdir(ownLogsPath);
  return ownLogsPath;
}

async function createUnwritableLogs(): Promise<string> {
  const tempDir = await createTempDir();
  const logsPath = path.join(tempDir, 'logs');
  await mkdir(logsPath);
  await writeFile(path.join(logsPath, 'locked.log'), 'content');
  await chmod(logsPath, 0o500);
  readonlyDirs.push(logsPath);
  return logsPath;
}

async function createTempDir(): Promise<string> {
  const tempDir = await mkdtemp(path.join(tmpdir(), 'logs-cleaner-'));
  tempDirs.push(tempDir);
  return tempDir;
}
