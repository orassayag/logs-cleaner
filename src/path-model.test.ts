import { describe, expect, it } from 'vitest';
import {
  isWindowsAbsolutePath,
  normalizeConfiguredPath,
  resolveProjectPath,
  resolveRelativePath,
} from './path-model.js';

describe('path model', () => {
  it('detects Windows absolute paths', () => {
    expect(isWindowsAbsolutePath('C:\\Or\\web\\projects')).toBe(true);
    expect(isWindowsAbsolutePath('projects')).toBe(false);
  });

  it('normalizes Windows paths with win32 rules', () => {
    expect(
      normalizeConfiguredPath(
        'C:\\Or\\web\\projects\\actions-manager\\..\\logs-cleaner'
      )
    ).toBe('C:\\Or\\web\\projects\\logs-cleaner');
  });

  it('resolves project paths under the configured projects root', () => {
    expect(resolveProjectPath('C:\\Or\\web\\projects', 'actions-manager')).toBe(
      'C:\\Or\\web\\projects\\actions-manager'
    );
  });

  it('resolves cleanup paths relative to a repository', () => {
    expect(
      resolveRelativePath('C:\\Or\\web\\projects\\actions-manager', 'src\\logs')
    ).toBe('C:\\Or\\web\\projects\\actions-manager\\src\\logs');
  });
});
