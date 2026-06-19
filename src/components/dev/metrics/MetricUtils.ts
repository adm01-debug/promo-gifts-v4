export function latencyClass(ms: number): string {
  if (ms < 200) return 'text-green-400';
  if (ms < 500) return 'text-yellow-400';
  return 'text-red-400';
}

const BYTE_UNITS = ['B', 'KB', 'MB', 'GB', 'TB'];

export function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const i = Math.min(Math.floor(Math.log(bytes) / Math.log(k)), BYTE_UNITS.length - 1);
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${BYTE_UNITS[i]}`;
}
