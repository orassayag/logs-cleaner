import { promises as fs } from 'node:fs';
import type { ProjectRepoEntry } from './types.js';

export async function loadProjectRepos(
  repoListPath: string,
  fileSystem: Pick<typeof fs, 'readFile'> = fs
): Promise<ProjectRepoEntry[]> {
  const content = await fileSystem.readFile(repoListPath, 'utf8');
  const parsed = JSON.parse(content) as unknown;

  if (!Array.isArray(parsed)) {
    throw new Error(`Repo list at ${repoListPath} must be a JSON array.`);
  }

  return parsed.filter(isActiveProjectRepoEntry);
}

export function isActiveProjectRepoEntry(
  entry: unknown
): entry is ProjectRepoEntry {
  return (
    typeof entry === 'object' &&
    entry !== null &&
    'name' in entry &&
    typeof (entry as { name?: unknown }).name === 'string' &&
    (entry as { type?: unknown }).type === 'active'
  );
}
