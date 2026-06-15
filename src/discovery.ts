import { promises as fs } from 'node:fs';
import { DEFAULT_CLEAR_PATHS } from './config.js';
import { resolveProjectPath, resolveRelativePath } from './path-model.js';
import type { CleanupTarget, ProjectRepoEntry } from './types.js';

export async function resolveCleanupTargets(
  repo: ProjectRepoEntry,
  projectsRoot: string,
  fileSystem: Pick<typeof fs, 'lstat'> = fs
): Promise<CleanupTarget[]> {
  const repoPath = resolveProjectPath(projectsRoot, repo.name);
  const configuredPaths = getClearPaths(repo);
  const targets: CleanupTarget[] = [];

  for (const configuredPath of configuredPaths) {
    const resolvedPath = resolveRelativePath(repoPath, configuredPath);
    const target: CleanupTarget = {
      repoName: repo.name,
      repoPath,
      configuredPath,
      resolvedPath,
      status: 'pending',
    };

    try {
      const stats = await fileSystem.lstat(resolvedPath);

      if (stats.isSymbolicLink()) {
        target.status = 'skipped';
        target.reason = 'symlink-target';
      } else if (!stats.isDirectory()) {
        target.status = 'skipped';
        target.reason = 'not-directory';
      }

      targets.push(target);
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
        target.status = 'skipped';
        target.reason = 'missing';
      } else {
        throw error;
      }

      targets.push(target);
    }
  }

  return targets;
}

function getClearPaths(repo: ProjectRepoEntry): string[] {
  if (Array.isArray(repo.clear) && repo.clear.length > 0) {
    return repo.clear.filter(
      (clearPath): clearPath is string => typeof clearPath === 'string'
    );
  }

  return DEFAULT_CLEAR_PATHS;
}
