import { afterEach, describe, expect, mock, test } from 'bun:test';
import { ghaCommand } from '../src/commands/gha';

describe('gha command', () => {
  const originalConsoleLog = console.log;
  const originalConsoleError = console.error;
  const originalProcessExit = process.exit;

  afterEach(() => {
    console.log = originalConsoleLog;
    console.error = originalConsoleError;
    process.exit = originalProcessExit;
    mock.restore();
  });

  test('missing baseline: exits 2 and prints deterministic stderr', async () => {
    const exitMock = mock((code?: number) => {
      throw new Error(`EXIT_${code ?? 'undefined'}`);
    });
    process.exit = exitMock as typeof process.exit;

    const errMock = mock(() => {});
    console.error = errMock as typeof console.error;

    await expect(ghaCommand('example.com', {})).rejects.toThrow('EXIT_2');
    expect(errMock).toHaveBeenCalledTimes(1);
    expect(String((errMock as any).mock.calls[0][0])).toBe('GHA_BASELINE_REQUIRED');
  });

  test('missing domain: exits 2 and prints deterministic stderr', async () => {
    const exitMock = mock((code?: number) => {
      throw new Error(`EXIT_${code ?? 'undefined'}`);
    });
    process.exit = exitMock as typeof process.exit;

    const errMock = mock(() => {});
    console.error = errMock as typeof console.error;

    await expect(ghaCommand('', { baseline: 'baseline.json' })).rejects.toThrow('EXIT_2');
    expect(errMock).toHaveBeenCalledTimes(1);
    expect(String((errMock as any).mock.calls[0][0])).toBe('GHA_DOMAIN_REQUIRED');
  });

  test('success: prints exactly two YAML-ish lines', async () => {
    const exitMock = mock((code?: number) => {
      throw new Error(`EXIT_${code ?? 'undefined'}`);
    });
    process.exit = exitMock as typeof process.exit;

    const logMock = mock(() => {});
    console.log = logMock as typeof console.log;

    const errMock = mock(() => {});
    console.error = errMock as typeof console.error;

    await ghaCommand('example.com', { baseline: 'baseline.json' });

    expect(errMock).not.toHaveBeenCalled();
    expect(logMock).toHaveBeenCalledTimes(2);
    expect(String((logMock as any).mock.calls[0][0])).toBe('- name: Specs CI');
    expect(String((logMock as any).mock.calls[1][0])).toBe(
      '  run: npx -y @sitespecs/specs@latest ci example.com --baseline baseline.json',
    );
  });
});
