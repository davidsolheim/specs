import { afterEach, describe, expect, mock, test } from 'bun:test';
import { formatBytes, formatRelativeTime } from '../src/lib/api';
import { formatOutput } from '../src/lib/formatter';

describe('specs api helpers', () => {
  const originalConsoleLog = console.log;

  afterEach(() => {
    console.log = originalConsoleLog;
  });

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

  test('formatOutput prints a redirect note for unexpected redirect destinations', () => {
    const logMock = mock(() => {});
    console.log = logMock as typeof console.log;

    formatOutput(
      {
        domain: 'analog.com',
        url: 'https://www.analog.com/en/index.html',
        status: 'online',
        technologies: [],
        requested: {
          input: 'linear.com',
          url: 'https://linear.com',
          host: 'linear.com',
        },
        redirects: {
          occurred: true,
          finalUrl: 'https://www.analog.com/en/index.html',
          finalHost: 'www.analog.com',
          chain: [
            { url: 'https://linear.com', host: 'linear.com', statusCode: 301 },
            { url: 'https://www.linear.com', host: 'www.linear.com', statusCode: 301 },
            { url: 'https://www.analog.com/en/index.html', host: 'www.analog.com', statusCode: 200 },
          ],
          condensedChain: 'linear.com -> www.linear.com -> analog.com',
        },
      },
      {},
    );

    const output = logMock.mock.calls.map((call) => String(call[0])).join('\n');
    expect(output).toContain('Redirected: linear.com -> www.linear.com -> analog.com');
  });

  test('formatOutput suppresses the human redirect note for pure same-host scheme upgrades', () => {
    const logMock = mock(() => {});
    console.log = logMock as typeof console.log;

    formatOutput(
      {
        domain: 'example.com',
        url: 'https://example.com',
        status: 'online',
        technologies: [],
        requested: {
          input: 'http://example.com',
          url: 'http://example.com',
          host: 'example.com',
        },
        redirects: {
          occurred: true,
          finalUrl: 'https://example.com',
          finalHost: 'example.com',
          chain: [
            { url: 'http://example.com', host: 'example.com', statusCode: 301 },
            { url: 'https://example.com', host: 'example.com', statusCode: 200 },
          ],
          condensedChain: 'http://example.com -> https://example.com',
        },
      },
      {},
    );

    const output = logMock.mock.calls.map((call) => String(call[0])).join('\n');
    expect(output).not.toContain('Redirected');
  });
});
