import { afterEach, describe, expect, mock, test } from 'bun:test';
import { analyzeCommand } from '../src/commands/analyze';

describe('analyze command deterministic fixtures', () => {
  const originalFetch = global.fetch;
  const originalConsoleLog = console.log;
  const originalConsoleError = console.error;
  const originalProcessExit = process.exit;

  afterEach(() => {
    global.fetch = originalFetch;
    console.log = originalConsoleLog;
    console.error = originalConsoleError;
    process.exit = originalProcessExit;
    mock.restore();
  });

  test('smoke: normalizes domain and emits JSON payload with --json option', async () => {
    const payload = {
      domain: 'example.com',
      url: 'https://example.com',
      status: 'online',
      technologies: [],
    };

    const fetchMock = mock(async (input: RequestInfo | URL) => {
      expect(String(input)).toContain('/api/public/analyze?url=Example.com');
      return new Response(JSON.stringify(payload), { status: 200 });
    });

    const logMock = mock(() => {});
    console.log = logMock as typeof console.log;
    console.error = mock(() => {}) as typeof console.error;
    global.fetch = fetchMock as typeof fetch;

    await analyzeCommand('https://www.Example.com/', { json: true });

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(logMock).toHaveBeenCalledWith(JSON.stringify(payload, null, 2));
  });

  test('failure: exits with code 1 for API failure path', async () => {
    global.fetch = mock(async () => new Response('boom', { status: 503, statusText: 'Service Unavailable' })) as typeof fetch;

    const exitMock = mock((code?: number) => {
      throw new Error(`EXIT_${code ?? 'undefined'}`);
    });

    process.exit = exitMock as typeof process.exit;
    console.log = mock(() => {}) as typeof console.log;
    console.error = mock(() => {}) as typeof console.error;

    await expect(analyzeCommand('example.com', { json: true })).rejects.toThrow('EXIT_1');
    expect(exitMock).toHaveBeenCalledWith(1);
  });

  test('summary: prints single-line SUMMARY output and overrides other output modes', async () => {
    const payload = {
      domain: 'example.com',
      url: 'https://example.com',
      status: 'online',
      technologies: [{ name: 'Bun' }, { name: 'TypeScript' }],
      seo: { score: 92 },
      host: 'ExampleHost',
    };

    const fetchMock = mock(async (input: RequestInfo | URL) => {
      expect(String(input)).toContain('/api/public/analyze?url=example.com');
      return new Response(JSON.stringify(payload), { status: 200 });
    });

    const logMock = mock(() => {});
    console.log = logMock as typeof console.log;
    console.error = mock(() => {}) as typeof console.error;
    global.fetch = fetchMock as typeof fetch;

    await analyzeCommand('example.com', { summary: true, json: true });

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(logMock).toHaveBeenCalledTimes(1);
    expect(logMock).toHaveBeenCalledWith(
      'SUMMARY example.com status=online tech=2 seo=92 perf=na hosting=ExampleHost'
    );
  });
});
