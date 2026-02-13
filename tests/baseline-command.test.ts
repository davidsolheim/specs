import { afterEach, describe, expect, mock, test } from 'bun:test';
import { mkdtemp, readFile, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { baselineCommand } from '../src/commands/baseline';

describe('baseline command', () => {
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

  test('missing --out: exits 2 and does not print BASELINE_SAVED', async () => {
    const exitMock = mock((code?: number) => {
      throw new Error(`EXIT_${code ?? 'undefined'}`);
    });
    process.exit = exitMock as typeof process.exit;

    const logMock = mock(() => {});
    console.log = logMock as typeof console.log;
    console.error = mock(() => {}) as typeof console.error;

    await expect(baselineCommand('example.com', {})).rejects.toThrow('EXIT_2');
    expect(exitMock).toHaveBeenCalledWith(2);
    expect(logMock).toHaveBeenCalledTimes(0);
  });

  test('happy path: writes baseline file and prints exactly one BASELINE_SAVED line', async () => {
    const payload = {
      domain: 'example.com',
      url: 'https://example.com',
      status: 'online',
      technologies: [],
    };

    const fetchMock = mock(async (input: RequestInfo | URL) => {
      // Should normalize like analyze: strip scheme, www, trailing slash.
      expect(String(input)).toContain('/api/public/analyze?url=Example.com');
      return new Response(JSON.stringify(payload), { status: 200 });
    });
    global.fetch = fetchMock as typeof fetch;

    const dir = await mkdtemp(join(tmpdir(), 'specs-tests-'));
    const outPath = join(dir, 'nested', 'baseline.json');

    const logMock = mock(() => {});
    console.log = logMock as typeof console.log;
    console.error = mock(() => {}) as typeof console.error;

    await baselineCommand('https://www.Example.com/', { out: outPath });

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(logMock).toHaveBeenCalledTimes(1);
    const line = String((logMock as any).mock.calls[0][0]);
    expect(line).toBe(`BASELINE_SAVED path=${outPath}`);
    expect(line.includes('{')).toBe(false);

    const saved = await readFile(outPath, 'utf8');
    expect(JSON.parse(saved)).toEqual(payload);
  });

  test('out path exists (no --force): exits 2, prints exists error, and does not fetch', async () => {
    const payload = {
      domain: 'example.com',
      url: 'https://example.com',
      status: 'online',
      technologies: [],
    };

    const fetchMock = mock(async () => new Response(JSON.stringify(payload), { status: 200 }));
    global.fetch = fetchMock as typeof fetch;

    // NOTE: We do not throw from process.exit here because Bun's process.exit behavior
    // can be inconsistent inside async flows; asserting the call is enough.
    const exitMock = mock((_code?: number) => undefined as never);
    process.exit = exitMock as typeof process.exit;

    const logMock = mock(() => {});
    console.log = logMock as typeof console.log;

    const errMock = mock(() => {});
    console.error = errMock as typeof console.error;

    const dir = await mkdtemp(join(tmpdir(), 'specs-tests-'));
    const outPath = join(dir, 'baseline.json');
    await writeFile(outPath, '{"old":true}', 'utf8');

    await baselineCommand('example.com', { out: outPath });

    expect(exitMock).toHaveBeenCalledWith(2);
    expect(fetchMock).toHaveBeenCalledTimes(0);
    expect(logMock).toHaveBeenCalledTimes(0);

    expect(errMock).toHaveBeenCalledTimes(1);
    const errLine = String((errMock as any).mock.calls[0][0]);
    expect(errLine).toBe(`BASELINE_OUT_EXISTS path=${outPath}`);
    expect(errLine.includes('EXISTS')).toBe(true);
  });

  test('out path exists (--force): overwrites and prints BASELINE_SAVED', async () => {
    const payload = {
      domain: 'example.com',
      url: 'https://example.com',
      status: 'online',
      technologies: [],
    };

    const fetchMock = mock(async () => new Response(JSON.stringify(payload), { status: 200 }));
    global.fetch = fetchMock as typeof fetch;

    const dir = await mkdtemp(join(tmpdir(), 'specs-tests-'));
    const outPath = join(dir, 'baseline.json');
    await writeFile(outPath, '{"old":true}', 'utf8');

    const logMock = mock(() => {});
    console.log = logMock as typeof console.log;
    console.error = mock(() => {}) as typeof console.error;

    await baselineCommand('example.com', { out: outPath, force: true });

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(logMock).toHaveBeenCalledTimes(1);
    const line = String((logMock as any).mock.calls[0][0]);
    expect(line).toBe(`BASELINE_SAVED path=${outPath}`);

    const saved = await readFile(outPath, 'utf8');
    expect(JSON.parse(saved)).toEqual(payload);
  });

  test('api failure: exits 1', async () => {
    global.fetch = mock(async () => new Response('boom', { status: 503, statusText: 'Service Unavailable' })) as typeof fetch;

    const exitMock = mock((code?: number) => {
      throw new Error(`EXIT_${code ?? 'undefined'}`);
    });
    process.exit = exitMock as typeof process.exit;

    console.log = mock(() => {}) as typeof console.log;
    console.error = mock(() => {}) as typeof console.error;

    const dir = await mkdtemp(join(tmpdir(), 'specs-tests-'));
    const outPath = join(dir, 'baseline.json');

    await expect(baselineCommand('example.com', { out: outPath })).rejects.toThrow('EXIT_1');
    expect(exitMock).toHaveBeenCalledWith(1);
  });

  test('profile provided: exits 2', async () => {
    const fetchMock = mock(async () => new Response('{}', { status: 200 }));
    global.fetch = fetchMock as typeof fetch;

    const exitMock = mock((code?: number) => {
      throw new Error(`EXIT_${code ?? 'undefined'}`);
    });
    process.exit = exitMock as typeof process.exit;

    const logMock = mock(() => {});
    console.log = logMock as typeof console.log;
    console.error = mock(() => {}) as typeof console.error;

    const dir = await mkdtemp(join(tmpdir(), 'specs-tests-'));
    const outPath = join(dir, 'baseline.json');

    await expect(baselineCommand('example.com', { out: outPath, profile: 'ci' })).rejects.toThrow('EXIT_2');
    expect(exitMock).toHaveBeenCalledWith(2);
    expect(fetchMock).toHaveBeenCalledTimes(0);
    expect(logMock).toHaveBeenCalledTimes(0);
  });
});
