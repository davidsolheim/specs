import { afterEach, describe, expect, mock, test } from 'bun:test';
import { mkdtemp, readFile, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
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

  test('summary+diff: prints drift counts and exit=0 (single-line)', async () => {
    const payload = {
      domain: 'example.com',
      url: 'https://example.com',
      status: 'online',
      technologies: [{ name: 'Bun' }, { name: 'TypeScript' }],
      seo: { score: 92 },
      host: 'ExampleHost',
    };

    const baseline = { ...payload, seo: { score: 91 } };

    const dir = await mkdtemp(join(tmpdir(), 'specs-tests-'));
    const baselinePath = join(dir, 'baseline.json');
    await writeFile(baselinePath, JSON.stringify(baseline), 'utf8');

    const fetchMock = mock(async () => new Response(JSON.stringify(payload), { status: 200 }));
    global.fetch = fetchMock as typeof fetch;
    console.error = mock(() => {}) as typeof console.error;

    const logMock = mock(() => {});
    console.log = logMock as typeof console.log;

    await analyzeCommand('example.com', { summary: true, diff: baselinePath });

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(logMock).toHaveBeenCalledTimes(1);

    const line = String((logMock as any).mock.calls[0][0]);
    expect(line.startsWith('SUMMARY ')).toBe(true);
    expect(line).toContain('drift_changed=1');
    expect(line).toContain('drift_added=0');
    expect(line).toContain('drift_removed=0');
    expect(line).toContain('exit=0');
  });

  test('summary+diff+top-changes: prints drift counts and top leaf paths (single-line)', async () => {
    const payload = {
      domain: 'example.com',
      url: 'https://example.com',
      status: 'online',
      technologies: [{ name: 'Bun' }, { name: 'TypeScript' }],
      seo: { score: 92 },
      extraField: 123,
    };

    const baseline = { ...payload, seo: { score: 91 }, host: 'ExampleHost' } as any;
    delete baseline.extraField;

    const dir = await mkdtemp(join(tmpdir(), 'specs-tests-'));
    const baselinePath = join(dir, 'baseline.json');
    await writeFile(baselinePath, JSON.stringify(baseline), 'utf8');

    const fetchMock = mock(async () => new Response(JSON.stringify(payload), { status: 200 }));
    global.fetch = fetchMock as typeof fetch;
    console.error = mock(() => {}) as typeof console.error;

    const logMock = mock(() => {});
    console.log = logMock as typeof console.log;

    await analyzeCommand('example.com', { summary: true, diff: baselinePath, topChanges: 3 });

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(logMock).toHaveBeenCalledTimes(1);

    const line = String((logMock as any).mock.calls[0][0]);
    expect(line.startsWith('SUMMARY ')).toBe(true);
    expect(line).toContain('drift_changed=1');
    expect(line).toContain('drift_added=1');
    expect(line).toContain('drift_removed=1');
    expect(line).toContain('exit=0');
    expect(line).toContain('top_changed=seo.score');
    expect(line).toContain('top_added=extraField');
    expect(line).toContain('top_removed=host');
  });

  test('summary+diff+top-changes invalid n: exits 2 and prints exactly SUMMARY <domain> exit=2', async () => {
    const payload = {
      domain: 'example.com',
      url: 'https://example.com',
      status: 'online',
      technologies: [],
      seo: { score: 92 },
    };

    const baseline = { ...payload, seo: { score: 91 } };

    const dir = await mkdtemp(join(tmpdir(), 'specs-tests-'));
    const baselinePath = join(dir, 'baseline.json');
    await writeFile(baselinePath, JSON.stringify(baseline), 'utf8');

    global.fetch = mock(async () => new Response(JSON.stringify(payload), { status: 200 })) as typeof fetch;

    const exitMock = mock((code?: number) => {
      throw new Error(`EXIT_${code ?? 'undefined'}`);
    });

    process.exit = exitMock as typeof process.exit;

    const logMock = mock(() => {});
    console.log = logMock as typeof console.log;
    console.error = mock(() => {}) as typeof console.error;

    await expect(
      analyzeCommand('example.com', { summary: true, diff: baselinePath, topChanges: 0 })
    ).rejects.toThrow('EXIT_2');

    expect(logMock).toHaveBeenCalledTimes(1);
    expect((logMock as any).mock.calls[0][0]).toBe('SUMMARY example.com exit=2');
    expect(exitMock).toHaveBeenCalledWith(2);
  });

  test('summary+diff+fail-on-diff: exits 1 when drift>0', async () => {
    const payload = {
      domain: 'example.com',
      url: 'https://example.com',
      status: 'online',
      technologies: [],
      seo: { score: 92 },
      host: 'ExampleHost',
    };

    const baseline = { ...payload, seo: { score: 91 } };

    const dir = await mkdtemp(join(tmpdir(), 'specs-tests-'));
    const baselinePath = join(dir, 'baseline.json');
    await writeFile(baselinePath, JSON.stringify(baseline), 'utf8');

    global.fetch = mock(async () => new Response(JSON.stringify(payload), { status: 200 })) as typeof fetch;

    const exitMock = mock((code?: number) => {
      throw new Error(`EXIT_${code ?? 'undefined'}`);
    });

    process.exit = exitMock as typeof process.exit;
    console.log = mock(() => {}) as typeof console.log;
    console.error = mock(() => {}) as typeof console.error;

    await expect(
      analyzeCommand('example.com', { summary: true, diff: baselinePath, failOnDiff: true })
    ).rejects.toThrow('EXIT_1');

    expect(exitMock).toHaveBeenCalledWith(1);
  });

  test('summary+diff: missing baseline exits 2 and prints single-line SUMMARY with exit=2', async () => {
    global.fetch = mock(async () => new Response('{}', { status: 200 })) as typeof fetch;

    const exitMock = mock((code?: number) => {
      throw new Error(`EXIT_${code ?? 'undefined'}`);
    });

    process.exit = exitMock as typeof process.exit;

    const logMock = mock(() => {});
    console.log = logMock as typeof console.log;
    console.error = mock(() => {}) as typeof console.error;

    await expect(
      analyzeCommand('example.com', { summary: true, diff: '/no/such/file.json' })
    ).rejects.toThrow('EXIT_2');

    expect(logMock).toHaveBeenCalledTimes(1);
    const line = String((logMock as any).mock.calls[0][0]);
    expect(line.startsWith('SUMMARY ')).toBe(true);
    expect(line).toContain('exit=2');

    expect(exitMock).toHaveBeenCalledWith(2);
  });

  test('summary+save: writes file but preserves SUMMARY output', async () => {
    const payload = {
      domain: 'example.com',
      url: 'https://example.com',
      status: 'online',
      technologies: [{ name: 'Bun' }, { name: 'TypeScript' }],
      seo: { score: 92 },
      host: 'ExampleHost',
    };

    const dir = await mkdtemp(join(tmpdir(), 'specs-tests-'));
    const savePath = join(dir, 'saved.json');

    const fetchMock = mock(async () => new Response(JSON.stringify(payload), { status: 200 }));
    global.fetch = fetchMock as typeof fetch;
    console.error = mock(() => {}) as typeof console.error;

    const logMock = mock(() => {});
    console.log = logMock as typeof console.log;

    await analyzeCommand('example.com', { summary: true, save: savePath });

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(logMock).toHaveBeenCalledTimes(1);
    expect(logMock).toHaveBeenCalledWith(
      'SUMMARY example.com status=online tech=2 seo=92 perf=na hosting=ExampleHost'
    );

    const saved = await readFile(savePath, 'utf8');
    expect(JSON.parse(saved)).toEqual(payload);
  });

  test('json+save: writes file but preserves JSON output', async () => {
    const payload = {
      domain: 'example.com',
      url: 'https://example.com',
      status: 'online',
      technologies: [],
    };

    const dir = await mkdtemp(join(tmpdir(), 'specs-tests-'));
    const savePath = join(dir, 'saved.json');

    const fetchMock = mock(async () => new Response(JSON.stringify(payload), { status: 200 }));
    global.fetch = fetchMock as typeof fetch;
    console.error = mock(() => {}) as typeof console.error;

    const logMock = mock(() => {});
    console.log = logMock as typeof console.log;

    await analyzeCommand('example.com', { json: true, save: savePath });

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(logMock).toHaveBeenCalledTimes(1);
    expect(logMock).toHaveBeenCalledWith(JSON.stringify(payload, null, 2));

    const saved = await readFile(savePath, 'utf8');
    expect(JSON.parse(saved)).toEqual(payload);
  });

  test('summary-json: prints exactly one JSON line to stdout and overrides other output modes', async () => {
    const payload = {
      domain: 'example.com',
      url: 'https://example.com',
      status: 'online',
      technologies: [{ name: 'Bun' }],
    };

    const fetchMock = mock(async () => new Response(JSON.stringify(payload), { status: 200 }));
    global.fetch = fetchMock as typeof fetch;

    const logMock = mock(() => {});
    const errMock = mock(() => {});
    console.log = logMock as typeof console.log;
    console.error = errMock as typeof console.error;

    await analyzeCommand('example.com', { summaryJson: true, summary: true, json: true, verbose: true });

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(errMock).toHaveBeenCalledTimes(0);
    expect(logMock).toHaveBeenCalledTimes(1);

    const out = String((logMock as any).mock.calls[0][0]);
    expect(out.includes('\n')).toBe(false);
    expect(JSON.parse(out)).toEqual({
      ok: true,
      domain: 'example.com',
      drift_changed: 0,
      drift_added: 0,
      drift_removed: 0,
      exit: 0,
      error: null,
    });
  });

  test('summary-json+diff: when baseline equals current, drift counts are 0', async () => {
    const payload = {
      domain: 'example.com',
      url: 'https://example.com',
      status: 'online',
      technologies: [],
      seo: { score: 92 },
    };

    const baseline = { ...payload };

    const dir = await mkdtemp(join(tmpdir(), 'specs-tests-'));
    const baselinePath = join(dir, 'baseline.json');
    await writeFile(baselinePath, JSON.stringify(baseline), 'utf8');

    global.fetch = mock(async () => new Response(JSON.stringify(payload), { status: 200 })) as typeof fetch;
    console.error = mock(() => {}) as typeof console.error;

    const logMock = mock(() => {});
    console.log = logMock as typeof console.log;

    await analyzeCommand('example.com', { summaryJson: true, diff: baselinePath });

    expect(logMock).toHaveBeenCalledTimes(1);
    const out = JSON.parse(String((logMock as any).mock.calls[0][0]));
    expect(out).toEqual({
      ok: true,
      domain: 'example.com',
      drift_changed: 0,
      drift_added: 0,
      drift_removed: 0,
      exit: 0,
      error: null,
    });
  });

  test('summary-json+diff: includes baseline and drift counts', async () => {
    const payload = {
      domain: 'example.com',
      url: 'https://example.com',
      status: 'online',
      technologies: [],
      seo: { score: 92 },
    };

    const baseline = { ...payload, seo: { score: 91 } };

    const dir = await mkdtemp(join(tmpdir(), 'specs-tests-'));
    const baselinePath = join(dir, 'baseline.json');
    await writeFile(baselinePath, JSON.stringify(baseline), 'utf8');

    global.fetch = mock(async () => new Response(JSON.stringify(payload), { status: 200 })) as typeof fetch;
    console.error = mock(() => {}) as typeof console.error;

    const logMock = mock(() => {});
    console.log = logMock as typeof console.log;

    await analyzeCommand('example.com', { summaryJson: true, diff: baselinePath });

    expect(logMock).toHaveBeenCalledTimes(1);
    const out = JSON.parse(String((logMock as any).mock.calls[0][0]));
    expect(out).toEqual({
      ok: true,
      domain: 'example.com',
      exit: 0,
      drift_changed: 1,
      drift_added: 0,
      drift_removed: 0,
      error: null,
    });
  });

  test('summary-json+diff+top-changes: includes top paths arrays and top_n', async () => {
    const payload = {
      domain: 'example.com',
      url: 'https://example.com',
      status: 'online',
      technologies: [],
      seo: { score: 92 },
      extraField: 123,
    };

    const baseline = { ...payload, seo: { score: 91 }, host: 'ExampleHost' } as any;
    delete baseline.extraField;

    const dir = await mkdtemp(join(tmpdir(), 'specs-tests-'));
    const baselinePath = join(dir, 'baseline.json');
    await writeFile(baselinePath, JSON.stringify(baseline), 'utf8');

    global.fetch = mock(async () => new Response(JSON.stringify(payload), { status: 200 })) as typeof fetch;
    console.error = mock(() => {}) as typeof console.error;

    const logMock = mock(() => {});
    console.log = logMock as typeof console.log;

    await analyzeCommand('example.com', { summaryJson: true, diff: baselinePath, topChanges: 3 });

    expect(logMock).toHaveBeenCalledTimes(1);
    const out = JSON.parse(String((logMock as any).mock.calls[0][0]));
    expect(out).toEqual({
      ok: true,
      domain: 'example.com',
      exit: 0,
      drift_changed: 1,
      drift_added: 1,
      drift_removed: 1,
      top_changed: ['seo.score'],
      top_added: ['extraField'],
      top_removed: ['host'],
      error: null,
    });
  });

  test('summary-json+diff+fail-on-diff: exits 1 but still prints JSON', async () => {
    const payload = {
      domain: 'example.com',
      url: 'https://example.com',
      status: 'online',
      technologies: [],
      seo: { score: 92 },
    };

    const baseline = { ...payload, seo: { score: 91 } };

    const dir = await mkdtemp(join(tmpdir(), 'specs-tests-'));
    const baselinePath = join(dir, 'baseline.json');
    await writeFile(baselinePath, JSON.stringify(baseline), 'utf8');

    global.fetch = mock(async () => new Response(JSON.stringify(payload), { status: 200 })) as typeof fetch;
    console.error = mock(() => {}) as typeof console.error;

    const logMock = mock(() => {});
    console.log = logMock as typeof console.log;

    const exitMock = mock((code?: number) => {
      throw new Error(`EXIT_${code ?? 'undefined'}`);
    });
    process.exit = exitMock as typeof process.exit;

    await expect(
      analyzeCommand('example.com', { summaryJson: true, diff: baselinePath, failOnDiff: true })
    ).rejects.toThrow('EXIT_1');

    expect(logMock).toHaveBeenCalledTimes(1);
    const out = JSON.parse(String((logMock as any).mock.calls[0][0]));
    expect(out).toEqual({
      ok: false,
      domain: 'example.com',
      exit: 1,
      drift_changed: 1,
      drift_added: 0,
      drift_removed: 0,
      error: null,
    });
  });

  test('summary-json+diff+top-changes invalid n: exits 2 and prints JSON (no fetch)', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'specs-tests-'));
    const baselinePath = join(dir, 'baseline.json');
    await writeFile(baselinePath, JSON.stringify({ ok: true }), 'utf8');

    const fetchMock = mock(async () => new Response('{}', { status: 200 }));
    global.fetch = fetchMock as typeof fetch;

    const logMock = mock(() => {});
    console.log = logMock as typeof console.log;
    console.error = mock(() => {}) as typeof console.error;

    const exitMock = mock((code?: number) => {
      throw new Error(`EXIT_${code ?? 'undefined'}`);
    });
    process.exit = exitMock as typeof process.exit;

    await expect(
      analyzeCommand('example.com', { summaryJson: true, diff: baselinePath, topChanges: 0 })
    ).rejects.toThrow('EXIT_2');

    expect(fetchMock).toHaveBeenCalledTimes(0);
    expect(logMock).toHaveBeenCalledTimes(1);
    const out = JSON.parse(String((logMock as any).mock.calls[0][0]));
    expect(out).toEqual({
      ok: false,
      domain: 'example.com',
      exit: 2,
      drift_changed: 0,
      drift_added: 0,
      drift_removed: 0,
      error: 'invalid_top_changes: 0',
    });
  });

  test('summary-json+diff: missing baseline exits 2 and prints JSON (no fetch)', async () => {
    const fetchMock = mock(async () => new Response('{}', { status: 200 }));
    global.fetch = fetchMock as typeof fetch;

    const logMock = mock(() => {});
    console.log = logMock as typeof console.log;
    console.error = mock(() => {}) as typeof console.error;

    const exitMock = mock((code?: number) => {
      throw new Error(`EXIT_${code ?? 'undefined'}`);
    });
    process.exit = exitMock as typeof process.exit;

    await expect(
      analyzeCommand('example.com', { summaryJson: true, diff: '/no/such/file.json' })
    ).rejects.toThrow('EXIT_2');

    expect(fetchMock).toHaveBeenCalledTimes(0);
    expect(logMock).toHaveBeenCalledTimes(1);
    const out = JSON.parse(String((logMock as any).mock.calls[0][0]));
    expect(out).toEqual({
      ok: false,
      domain: 'example.com',
      exit: 2,
      drift_changed: 0,
      drift_added: 0,
      drift_removed: 0,
      error: 'baseline_missing: /no/such/file.json',
    });
  });

  test('summary-json+diff: baseline parse error exits 2 and prints JSON (no fetch)', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'specs-tests-'));
    const baselinePath = join(dir, 'baseline.json');
    await writeFile(baselinePath, '{', 'utf8');

    const fetchMock = mock(async () => new Response('{}', { status: 200 }));
    global.fetch = fetchMock as typeof fetch;

    const logMock = mock(() => {});
    console.log = logMock as typeof console.log;
    console.error = mock(() => {}) as typeof console.error;

    const exitMock = mock((code?: number) => {
      throw new Error(`EXIT_${code ?? 'undefined'}`);
    });
    process.exit = exitMock as typeof process.exit;

    await expect(
      analyzeCommand('example.com', { summaryJson: true, diff: baselinePath })
    ).rejects.toThrow('EXIT_2');

    expect(fetchMock).toHaveBeenCalledTimes(0);
    expect(logMock).toHaveBeenCalledTimes(1);
    const out = JSON.parse(String((logMock as any).mock.calls[0][0]));
    expect(out).toEqual({
      ok: false,
      domain: 'example.com',
      exit: 2,
      drift_changed: 0,
      drift_added: 0,
      drift_removed: 0,
      error: `baseline_parse_error: ${baselinePath}`,
    });
  });

  test('summary-json: api error exits 1 and prints JSON verdict', async () => {
    const fetchMock = mock(async () => new Response('boom', { status: 503, statusText: 'Service Unavailable' }));
    global.fetch = fetchMock as typeof fetch;

    const logMock = mock(() => {});
    console.log = logMock as typeof console.log;
    console.error = mock(() => {}) as typeof console.error;

    const exitMock = mock((code?: number) => {
      throw new Error(`EXIT_${code ?? 'undefined'}`);
    });
    process.exit = exitMock as typeof process.exit;

    await expect(analyzeCommand('example.com', { summaryJson: true })).rejects.toThrow('EXIT_1');

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(logMock).toHaveBeenCalledTimes(1);
    const out = JSON.parse(String((logMock as any).mock.calls[0][0]));
    expect(out).toEqual({
      ok: false,
      domain: 'example.com',
      drift_changed: 0,
      drift_added: 0,
      drift_removed: 0,
      exit: 1,
      error: 'api_error',
    });
  });
});
