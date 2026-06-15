export type LogLevel = 'info' | 'warn' | 'error';

export type LogMessage = {
  level: LogLevel;
  message: string;
  detail?: unknown;
};

export function log(message: LogMessage): void {
  console.log(JSON.stringify(message));
}
