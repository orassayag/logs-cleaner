import { mkdtemp, mkdir, rm, symlink, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { resolveCleanupTargets } from './discovery.js';

const tempDirs: string[] = [];

afterEach(async () => {
  await Promise.all(
    tempDirs
      .splice(0)
      .map((tempDir) => rm(tempDir, { recursive: true, force: true }))
  );
});

describe('resolveCleanupTargets', () => {
  it('defaults missing clear paths to logs', async () => {
    const projectsRoot = await createTempDir();
    const repoPath = await createRepo(projectsRoot, 'actions-manager');
    await mkdir(path.join(repoPath, 'logs'));

    const targets = await resolveCleanupTargets(
      { name: 'actions-manager', type: 'active' },
      projectsRoot
    );

    expect(targets).toHaveLength(1);
    expect(targets[0].resolvedPath).toBe(path.join(repoPath, 'logs'));
  });

  it('resolves configured clear paths relative to each repository', async () => {
    const projectsRoot = await createTempDir();
    const repoPath = await createRepo(projectsRoot, 'daily-events-bot');
    await mkdir(path.join(repoPath, 'db'));
    await mkdir(path.join(repoPath, 'logs'));

    const targets = await resolveCleanupTargets(
      { name: 'daily-events-bot', type: 'active', clear: ['db', 'logs'] },
      projectsRoot
    );

    expect(targets.map((target) => target.configuredPath)).toEqual([
      'db',
      'logs',
    ]);
    expect(targets.every((target) => target.status === 'pending')).toBe(true);
  });

  it('skips missing and non-directory cleanup targets', async () => {
    const projectsRoot = await createTempDir();
    const repoPath = await createRepo(projectsRoot, 'actions-manager');
    await writeFile(path.join(repoPath, 'logs.txt'), 'not a directory');

    const targets = await resolveCleanupTargets(
      {
        name: 'actions-manager',
        type: 'active',
        clear: ['missing', 'logs.txt'],
      },
      projectsRoot
    );

    expect(targets).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          configuredPath: 'missing',
          status: 'skipped',
          reason: 'missing',
        }),
        expect.objectContaining({
          configuredPath: 'logs.txt',
          status: 'skipped',
          reason: 'not-directory',
        }),
      ])
    );
  });

  it('skips symlinked cleanup targets', async () => {
    const projectsRoot = await createTempDir();
    const repoPath = await createRepo(projectsRoot, 'actions-manager');
    const externalPath = await createTempDir();
    await symlink(externalPath, path.join(repoPath, 'logs'), 'dir');

    const targets = await resolveCleanupTargets(
      { name: 'actions-manager', type: 'active' },
      projectsRoot
    );

    expect(targets).toEqual([
      expect.objectContaining({
        configuredPath: 'logs',
        status: 'skipped',
        reason: 'symlink-target',
      }),
    ]);
  });
});

async function createRepo(projectsRoot: string, name: string): Promise<string> {
  const repoPath = path.join(projectsRoot, name);
  await mkdir(repoPath, { recursive: true });
  return repoPath;
}

async function createTempDir(): Promise<string> {
  const tempDir = await mkdtemp(path.join(tmpdir(), 'logs-cleaner-'));
  tempDirs.push(tempDir);
  return tempDir;
}
