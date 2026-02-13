import { afterEach, describe, expect, mock, test } from 'bun:test';
import { mkdtemp, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { ciCommand } from '../src/commands/ci';

describe('ci command deterministic fixtures', () => {
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

  test('missing baseline exits 2 and prints CI_BASELINE_REQUIRED', async () => {
    const errMock = mock(() => {});
    console.error = errMock as typeof console.error;

    const exitMock = mock((code?: number) => {
      throw new Error(`EXIT_${code ?? 'undefined'}`);
    });
    process.exit = exitMock as typeof process.exit;

    await expect(ciCommand('example.com', {})).rejects.toThrow('EXIT_2');
    expect(exitMock).toHaveBeenCalledWith(2);

    expect(errMock).toHaveBeenCalledTimes(1);
    expect(String((errMock as any).mock.calls[0][0])).toContain('CI_BASELINE_REQUIRED');
  });

  test('happy path: baseline equals fetched analysis -> ok=true exit=0 and single JSON stdout line', async () => {
    const analysis = { tech: { a: 1 } };

    const dir = await mkdtemp(join(tmpdir(), 'specs-tests-'));
    const baselinePath = join(dir, 'baseline.json');
    await writeFile(baselinePath, JSON.stringify(analysis), 'utf8');

    const fetchMock = mock(async (input: RequestInfo | URL) => {
      expect(String(input)).toContain('/api/public/analyze?url=example.com');
      return new Response(JSON.stringify(analysis), { status: 200 });
    });
    global.fetch = fetchMock as typeof fetch;

    const logMock = mock(() => {});
    console.log = logMock as typeof console.log;
    console.error = mock(() => {}) as typeof console.error;

    const exitMock = mock((code?: number) => {
      throw new Error(`EXIT_${code ?? 'undefined'}`);
    });
    process.exit = exitMock as typeof process.exit;

    await ciCommand('example.com', { baseline: baselinePath });

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(exitMock).toHaveBeenCalledTimes(0);

    expect(logMock).toHaveBeenCalledTimes(1);
    const line = String((logMock as any).mock.calls[0][0]);
    expect(line.includes('\n')).toBe(false);

    const out = JSON.parse(line);
    expect(out.ok).toBe(true);
    expect(out.domain).toBe('example.com');
    expect(out.exit).toBe(0);
    expect(out.drift_changed).toBe(0);
    expect(out.drift_added).toBe(0);
    expect(out.drift_removed).toBe(0);
  });

  test('drift path: baseline differs -> ok=false exit=1 and single JSON stdout line', async () => {
    const baseline = { tech: { a: 1 } };
    const analysis = { tech: { a: 2 } };

    const dir = await mkdtemp(join(tmpdir(), 'specs-tests-'));
    const baselinePath = join(dir, 'baseline.json');
    await writeFile(baselinePath, JSON.stringify(baseline), 'utf8');

    global.fetch = mock(async () => new Response(JSON.stringify(analysis), { status: 200 })) as typeof fetch;

    const logMock = mock(() => {});
    console.log = logMock as typeof console.log;
    console.error = mock(() => {}) as typeof console.error;

    const exitMock = mock((code?: number) => {
      throw new Error(`EXIT_${code ?? 'undefined'}`);
    });
    process.exit = exitMock as typeof process.exit;

    await expect(ciCommand('example.com', { baseline: baselinePath })).rejects.toThrow('EXIT_1');
    expect(exitMock).toHaveBeenCalledWith(1);

    expect(logMock).toHaveBeenCalledTimes(1);
    const line = String((logMock as any).mock.calls[0][0]);
    expect(line.includes('\n')).toBe(false);

    const out = JSON.parse(line);
    expect(out.ok).toBe(false);
    expect(out.domain).toBe('example.com');
    expect(out.exit).toBe(1);
  });
});

