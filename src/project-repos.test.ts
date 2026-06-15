import { promises as fs } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { loadProjectRepos } from './project-repos.js';

describe('loadProjectRepos', () => {
  it('filters only active project entries', async () => {
    const repos = await loadProjectRepos('repo-list.json', {
      readFile: () =>
        Promise.resolve(
          JSON.stringify([
            { name: 'actions-manager', type: 'active' },
            { name: 'archive', type: 'inactive' },
            { name: 'missing-type' },
          ])
        ),
    } as unknown as Pick<typeof fs, 'readFile'>);

    expect(repos).toEqual([{ name: 'actions-manager', type: 'active' }]);
  });

  it('rejects a missing repo-list file', async () => {
    await expect(
      loadProjectRepos('missing.json', {
        readFile: () => {
          const error = new Error('missing') as NodeJS.ErrnoException;
          error.code = 'ENOENT';
          return Promise.reject(error);
        },
      } as unknown as Pick<typeof fs, 'readFile'>)
    ).rejects.toMatchObject({ code: 'ENOENT' });
  });

  it('rejects a repo-list file that is not an array', async () => {
    await expect(
      loadProjectRepos('repo-list.json', {
        readFile: () => Promise.resolve(JSON.stringify({ repos: [] })),
      } as unknown as Pick<typeof fs, 'readFile'>)
    ).rejects.toThrow('must be a JSON array');
  });
});
