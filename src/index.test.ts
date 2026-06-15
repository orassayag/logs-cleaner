import { mkdtemp, mkdir, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { runCleanup } from './index.js';
import { promises as fs } from 'node:fs';

const tempDirs: string[] = [];

afterEach(async () => {
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

async function createTempDir(): Promise<string> {
  const tempDir = await mkdtemp(path.join(tmpdir(), 'logs-cleaner-'));
  tempDirs.push(tempDir);
  return tempDir;
}
