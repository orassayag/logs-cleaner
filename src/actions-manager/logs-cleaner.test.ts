import { beforeEach, describe, expect, it, vi } from 'vitest';

const spawnSyncMock = vi.fn();

vi.mock('node:child_process', () => ({
  spawnSync: (...args: unknown[]): unknown => spawnSyncMock(...args),
}));

const { default: logsCleaner } = await import('./logs-cleaner.js');

describe('actions-manager logs cleaner action', () => {
  beforeEach(() => {
    spawnSyncMock.mockReset();
  });

  it('calls the cleanup script without AUTO or dry-mode parameters', async () => {
    spawnSyncMock.mockReturnValueOnce({ error: undefined, status: 0 });

    await logsCleaner.run();

    expect(spawnSyncMock).toHaveBeenCalledWith('pnpm', ['run', 'start'], {
      cwd: 'C:\\Or\\web\\projects\\logs-cleaner',
      stdio: 'inherit',
      shell: process.platform === 'win32',
    });
  });

  it('throws when the cleanup process exits non-zero', async () => {
    spawnSyncMock.mockReturnValueOnce({ error: undefined, status: 1 });

    await expect(logsCleaner.run()).rejects.toThrow(
      'Process exited with code 1'
    );
  });

  it('throws when the cleanup process cannot spawn', async () => {
    const error = new Error('spawn failed');
    spawnSyncMock.mockReturnValueOnce({ error, status: null });

    await expect(logsCleaner.run()).rejects.toThrow(error);
  });
});
