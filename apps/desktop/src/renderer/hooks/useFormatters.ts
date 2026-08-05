/**
 * useFormatters — shared formatting utilities for display values.
 *
 * Centralizes formatUptime, formatBytes, and other display helpers
 * previously duplicated across DashboardScreen, DiagnosticsScreen, etc.
 */
export function useFormatters() {
  /**
   * Format milliseconds into a human-readable uptime string.
   * e.g. 3661000ms → "1h 1m 1s"
   */
  const formatUptime = (ms?: number): string => {
    if (!ms || ms <= 0) return '0s';
    const sec = Math.floor(ms / 1000) % 60;
    const min = Math.floor(ms / (1000 * 60)) % 60;
    const hr = Math.floor(ms / (1000 * 60 * 60));
    return `${hr > 0 ? hr + 'h ' : ''}${min > 0 ? min + 'm ' : ''}${sec}s`;
  };

  /**
   * Format bytes into a human-readable size string.
   * e.g. 1536 → "1.5 KB"
   */
  const formatBytes = (bytes?: number): string => {
    if (!bytes || bytes <= 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'] as const;
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  return { formatUptime, formatBytes };
}
