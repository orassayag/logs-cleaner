import path from 'node:path';

export function isWindowsAbsolutePath(value: string): boolean {
  return /^[A-Za-z]:[\\/]/.test(value);
}

export function normalizeConfiguredPath(value: string): string {
  if (isWindowsAbsolutePath(value)) {
    return path.win32.normalize(value);
  }

  return path.normalize(value);
}

export function resolveProjectPath(
  projectsRoot: string,
  repoName: string
): string {
  const normalizedRoot = normalizeConfiguredPath(projectsRoot);

  if (isWindowsAbsolutePath(normalizedRoot)) {
    return path.win32.resolve(normalizedRoot, repoName);
  }

  return path.resolve(normalizedRoot, repoName);
}

export function resolveRelativePath(
  basePath: string,
  relativePath: string
): string {
  const normalizedBase = normalizeConfiguredPath(basePath);
  const normalizedRelative = normalizeConfiguredPath(relativePath);

  if (isWindowsAbsolutePath(normalizedBase)) {
    return path.win32.resolve(normalizedBase, normalizedRelative);
  }

  return path.resolve(normalizedBase, normalizedRelative);
}
