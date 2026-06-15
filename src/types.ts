export type ProjectRepoEntry = {
  name: string;
  url?: string;
  type?: string;
  purpose?: string;
  structure?: string;
  clear?: string[];
  [key: string]: unknown;
};

export type CleanupTargetStatus = 'pending' | 'skipped' | 'cleaned' | 'failed';

export type CleanupTarget = {
  repoName: string;
  repoPath: string;
  configuredPath: string;
  resolvedPath: string;
  status: CleanupTargetStatus;
  reason?: string;
};

export type CleanupFailure = {
  path: string;
  reason: string;
  code?: string;
};

export type CleanupResult = {
  cleanedPaths: string[];
  skippedPaths: string[];
  failures: CleanupFailure[];
};

export type CleanupSummary = {
  repoListPath: string;
  projectsRoot: string;
  ownLogsPath: string;
  repositoriesProcessed: number;
  targetsSkipped: number;
  targetsCleaned: number;
  targetsFailed: number;
  ownLogsSkipped: string[];
  ownLogsFailures: CleanupFailure[];
};

export type CleanupOptions = {
  maxAttempts?: number;
  retryDelayMs?: number;
  excludedPaths?: Set<string>;
};

export type RunCleanupOptions = {
  repoListPath?: string;
  projectsRoot?: string;
  ownLogsPath?: string;
  currentLogFile?: string;
  retryAttempts?: number;
  retryDelayMs?: number;
};

export type ActionDefinition = {
  name: string;
  label: string;
  taskName: string;
  schedulePeriod: string;
  pauseAfterRun: boolean;
  run: () => Promise<void>;
};
