import { describe, expect, test } from 'bun:test';
import { formatBytes, formatRelativeTime } from '../src/lib/api';

describe('specs api helpers', () => {
  test('formatBytes returns human readable values', () => {
    expect(formatBytes(1024)).toBe('1.00 KB');
    expect(formatBytes(1048576)).toBe('1.00 MB');
    expect(formatBytes(null)).toBe('N/A');
  });

  test('formatRelativeTime handles null and recent timestamps', () => {
    expect(formatRelativeTime(null)).toBe('Unknown');

    const now = new Date().toISOString();
    const result = formatRelativeTime(now);
    expect(['Just now', '0 minute ago', '0 minutes ago']).toContain(result);
  });
});
