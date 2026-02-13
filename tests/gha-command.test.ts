import { afterEach, describe, expect, mock, test } from 'bun:test';
import { mkdir, mkdtemp, readFile, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
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

  test('workflow: prints full workflow YAML with trailing newline', async () => {
    const logMock = mock(() => {});
    console.log = logMock as typeof console.log;

    await ghaCommand('example.com', { baseline: 'baseline.json', workflow: true } as any);

    expect(logMock).toHaveBeenCalledTimes(1);
    expect(String((logMock as any).mock.calls[0][0])).toBe(
      'name: SiteSpecs\non: [push, pull_request]\njobs:\n  sitespecs:\n    runs-on: ubuntu-latest\n    steps:\n      - uses: actions/checkout@v4\n      - name: Specs CI\n        run: npx -y @sitespecs/specs@latest ci example.com --baseline baseline.json\n',
    );
  });

  test('write without workflow: exits 2 and prints deterministic stderr', async () => {
    const exitMock = mock((code?: number) => {
      throw new Error(`EXIT_${code ?? 'undefined'}`);
    });
    process.exit = exitMock as typeof process.exit;

    const logMock = mock(() => {});
    console.log = logMock as typeof console.log;

    const errMock = mock(() => {});
    console.error = errMock as typeof console.error;

    await expect(ghaCommand('example.com', { baseline: 'baseline.json', write: 'workflow.yml' } as any)).rejects.toThrow(
      'EXIT_2',
    );
    expect(logMock).toHaveBeenCalledTimes(0);
    expect(errMock).toHaveBeenCalledTimes(1);
    expect(String((errMock as any).mock.calls[0][0])).toBe('WORKFLOW_WRITE_REQUIRES_WORKFLOW');
  });

  test('workflow + write: writes YAML to disk and prints exactly one WORKFLOW_SAVED line', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'specs-tests-'));
    const outPath = join(dir, 'nested', 'workflow.yml');

    const logMock = mock(() => {});
    console.log = logMock as typeof console.log;

    const errMock = mock(() => {});
    console.error = errMock as typeof console.error;

    await ghaCommand('example.com', { baseline: 'baseline.json', workflow: true, write: outPath } as any);

    expect(errMock).toHaveBeenCalledTimes(0);
    expect(logMock).toHaveBeenCalledTimes(1);
    const line = String((logMock as any).mock.calls[0][0]);
    expect(line).toBe(`WORKFLOW_SAVED path=${outPath}`);
    expect(line.includes('name: SiteSpecs')).toBe(false);

    const saved = await readFile(outPath, 'utf8');
    expect(saved).toBe(
      'name: SiteSpecs\non: [push, pull_request]\njobs:\n  sitespecs:\n    runs-on: ubuntu-latest\n    steps:\n      - uses: actions/checkout@v4\n      - name: Specs CI\n        run: npx -y @sitespecs/specs@latest ci example.com --baseline baseline.json\n',
    );
  });

  test('workflow + write existing file (no --force): exits 2 with deterministic stderr and does not overwrite', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'specs-tests-'));
    const outPath = join(dir, 'workflow.yml');

    await writeFile(outPath, 'OLD', 'utf8');

    const exitMock = mock((code?: number) => {
      throw new Error(`EXIT_${code ?? 'undefined'}`);
    });
    process.exit = exitMock as typeof process.exit;

    const logMock = mock(() => {});
    console.log = logMock as typeof console.log;

    const errMock = mock(() => {});
    console.error = errMock as typeof console.error;

    await expect(
      ghaCommand('example.com', { baseline: 'baseline.json', workflow: true, write: outPath } as any),
    ).rejects.toThrow('EXIT_2');

    expect(logMock).toHaveBeenCalledTimes(0);
    expect((errMock as any).mock.calls.length).toBeGreaterThan(0);
    const errs = (errMock as any).mock.calls.map((c: any[]) => String(c[0]));
    for (const e of errs) expect(e).toBe(`WORKFLOW_OUT_EXISTS path=${outPath}`);

    const saved = await readFile(outPath, 'utf8');
    expect(saved).toBe('OLD');
  });

  test('workflow + write existing file (--force): overwrites and prints WORKFLOW_SAVED', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'specs-tests-'));
    const outPath = join(dir, 'workflow.yml');

    await writeFile(outPath, 'OLD', 'utf8');

    const logMock = mock(() => {});
    console.log = logMock as typeof console.log;

    const errMock = mock(() => {});
    console.error = errMock as typeof console.error;

    await ghaCommand('example.com', {
      baseline: 'baseline.json',
      workflow: true,
      write: outPath,
      force: true,
    } as any);

    expect(errMock).toHaveBeenCalledTimes(0);
    expect(logMock).toHaveBeenCalledTimes(1);
    expect(String((logMock as any).mock.calls[0][0])).toBe(`WORKFLOW_SAVED path=${outPath}`);

    const saved = await readFile(outPath, 'utf8');
    expect(saved).not.toBe('OLD');
    expect(saved).toContain('name: SiteSpecs');
    expect(saved).toContain('name: Specs CI');
  });

  test('workflow + --force without --write: exits 2 with deterministic stderr', async () => {
    const exitMock = mock((code?: number) => {
      throw new Error(`EXIT_${code ?? 'undefined'}`);
    });
    process.exit = exitMock as typeof process.exit;

    const logMock = mock(() => {});
    console.log = logMock as typeof console.log;

    const errMock = mock(() => {});
    console.error = errMock as typeof console.error;

    await expect(
      ghaCommand('example.com', { baseline: 'baseline.json', workflow: true, force: true } as any),
    ).rejects.toThrow('EXIT_2');

    expect(logMock).toHaveBeenCalledTimes(0);
    expect(errMock).toHaveBeenCalledTimes(1);
    expect(String((errMock as any).mock.calls[0][0])).toBe('WORKFLOW_FORCE_INVALID');
  });

  test('workflow + write failure: exits 2 with deterministic stderr', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'specs-tests-'));
    const outPath = join(dir, 'as-a-directory');
    // Deterministic failure: attempting to write to a directory path.
    await mkdir(outPath);

    const exitMock = mock((code?: number) => {
      throw new Error(`EXIT_${code ?? 'undefined'}`);
    });
    process.exit = exitMock as typeof process.exit;

    const logMock = mock(() => {});
    console.log = logMock as typeof console.log;

    const errMock = mock(() => {});
    console.error = errMock as typeof console.error;

    await expect(
      ghaCommand('example.com', { baseline: 'baseline.json', workflow: true, write: outPath } as any),
    ).rejects.toThrow('EXIT_2');

    expect(logMock).toHaveBeenCalledTimes(0);
    expect(errMock).toHaveBeenCalledTimes(1);
    expect(String((errMock as any).mock.calls[0][0])).toBe(`WORKFLOW_WRITE_FAILED path=${outPath}`);
  });

  test('pinned version snippet: uses @<version> in npx', async () => {
    const exitMock = mock((code?: number) => {
      throw new Error(`EXIT_${code ?? 'undefined'}`);
    });
    process.exit = exitMock as typeof process.exit;

    const logMock = mock(() => {});
    console.log = logMock as typeof console.log;

    const errMock = mock(() => {});
    console.error = errMock as typeof console.error;

    await ghaCommand('example.com', { baseline: 'baseline.json', version: '0.1.0' } as any);

    const lines = (logMock as any).mock.calls.map((c: any[]) => String(c[0]));
    expect(lines).toContain('  run: npx -y @sitespecs/specs@0.1.0 ci example.com --baseline baseline.json');
  });

  test('pinned version workflow: uses @<version> in YAML', async () => {
    const logMock = mock(() => {});
    console.log = logMock as typeof console.log;

    await ghaCommand('example.com', {
      baseline: 'baseline.json',
      workflow: true,
      version: '0.1.0',
    } as any);

    const calls = (logMock as any).mock.calls;
    const last = String(calls[calls.length - 1][0]);
    expect(last).toContain('run: npx -y @sitespecs/specs@0.1.0 ci example.com --baseline baseline.json');
  });
});
