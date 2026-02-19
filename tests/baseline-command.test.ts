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
      expect(String(input)).toContain('/api/public/analyze?url=https%3A%2F%2FExample.com');
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

  test('--stdout: prints exactly one JSON line and no other logs', async () => {
    const payload = {
      domain: 'example.com',
      url: 'https://example.com',
      status: 'online',
      technologies: [],
    };

    const fetchMock = mock(async (input: RequestInfo | URL) => {
      // Should normalize like analyze: strip scheme, www, trailing slash.
      expect(String(input)).toContain('/api/public/analyze?url=https%3A%2F%2FExample.com');
      return new Response(JSON.stringify(payload), { status: 200 });
    });
    global.fetch = fetchMock as typeof fetch;

    const exitMock = mock((code?: number) => {
      throw new Error(`EXIT_${code ?? 'undefined'}`);
    });
    process.exit = exitMock as typeof process.exit;

    const logMock = mock(() => {});
    console.log = logMock as typeof console.log;

    const errMock = mock(() => {});
    console.error = errMock as typeof console.error;

    await baselineCommand('https://www.Example.com/', { stdout: true });

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(errMock).toHaveBeenCalledTimes(0);
    expect(exitMock).toHaveBeenCalledTimes(0);

    expect(logMock).toHaveBeenCalledTimes(1);
    const line = String((logMock as any).mock.calls[0][0]);
    expect(line).toBe(JSON.stringify(payload));
    expect(JSON.parse(line)).toEqual(payload);
  });

  test('--stdout with --out: exits 2 with deterministic conflict stderr and does not fetch', async () => {
    const fetchMock = mock(async () => new Response('{}', { status: 200 }));
    global.fetch = fetchMock as typeof fetch;

    const exitMock = mock((code?: number) => {
      throw new Error(`EXIT_${code ?? 'undefined'}`);
    });
    process.exit = exitMock as typeof process.exit;

    const logMock = mock(() => {});
    console.log = logMock as typeof console.log;

    const errMock = mock(() => {});
    console.error = errMock as typeof console.error;

    await expect(baselineCommand('example.com', { out: 'baseline.json', stdout: true })).rejects.toThrow('EXIT_2');

    expect(exitMock).toHaveBeenCalledWith(2);
    expect(fetchMock).toHaveBeenCalledTimes(0);
    expect(logMock).toHaveBeenCalledTimes(0);

    expect(errMock).toHaveBeenCalledTimes(1);
    const errLine = String((errMock as any).mock.calls[0][0]);
    expect(errLine).toBe('BASELINE_OUTPUT_CONFLICT');
  });

  test('--stdout with --force: exits 2 with deterministic invalid-force stderr and does not fetch', async () => {
    const fetchMock = mock(async () => new Response('{}', { status: 200 }));
    global.fetch = fetchMock as typeof fetch;

    const exitMock = mock((code?: number) => {
      throw new Error(`EXIT_${code ?? 'undefined'}`);
    });
    process.exit = exitMock as typeof process.exit;

    const logMock = mock(() => {});
    console.log = logMock as typeof console.log;

    const errMock = mock(() => {});
    console.error = errMock as typeof console.error;

    await expect(baselineCommand('example.com', { stdout: true, force: true })).rejects.toThrow('EXIT_2');

    expect(exitMock).toHaveBeenCalledWith(2);
    expect(fetchMock).toHaveBeenCalledTimes(0);
    expect(logMock).toHaveBeenCalledTimes(0);

    expect(errMock).toHaveBeenCalledTimes(1);
    const errLine = String((errMock as any).mock.calls[0][0]);
    expect(errLine).toBe('BASELINE_FORCE_INVALID');
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

  test('api failure: repeated 503 exits 1 with upstream_unavailable marker', async () => {
    global.fetch = mock(async () =>
      new Response('boom', { status: 503, statusText: 'Service Unavailable' })
    ) as typeof fetch;

    const exitMock = mock((code?: number) => {
      throw new Error(`EXIT_${code ?? 'undefined'}`);
    });
    process.exit = exitMock as typeof process.exit;

    console.log = mock(() => {}) as typeof console.log;
    const errMock = mock(() => {});
    console.error = errMock as typeof console.error;

    const dir = await mkdtemp(join(tmpdir(), 'specs-tests-'));
    const outPath = join(dir, 'baseline.json');

    await expect(baselineCommand('example.com', { out: outPath })).rejects.toThrow('EXIT_1');
    expect(exitMock).toHaveBeenCalledWith(1);
    expect(errMock).toHaveBeenCalledTimes(1);
    expect(String((errMock as any).mock.calls[0][0])).toBe(
      'BASELINE_FETCH_FAILED error=upstream_unavailable'
    );
  });

  test('api failure: repeated 500 exits 1 with upstream_unavailable marker', async () => {
    global.fetch = mock(async () =>
      new Response('boom', { status: 500, statusText: 'Internal Server Error' })
    ) as typeof fetch;

    const exitMock = mock((code?: number) => {
      throw new Error(`EXIT_${code ?? 'undefined'}`);
    });
    process.exit = exitMock as typeof process.exit;

    console.log = mock(() => {}) as typeof console.log;
    const errMock = mock(() => {});
    console.error = errMock as typeof console.error;

    const dir = await mkdtemp(join(tmpdir(), 'specs-tests-'));
    const outPath = join(dir, 'baseline.json');

    await expect(baselineCommand('example.com', { out: outPath })).rejects.toThrow('EXIT_1');
    expect(exitMock).toHaveBeenCalledWith(1);
    expect(errMock).toHaveBeenCalledTimes(1);
    expect(String((errMock as any).mock.calls[0][0])).toBe(
      'BASELINE_FETCH_FAILED error=upstream_unavailable'
    );
  });

  test('api failure: repeated 408 exits 1 with upstream_unavailable marker', async () => {
    global.fetch = mock(async () =>
      new Response('timeout', { status: 408, statusText: 'Request Timeout' })
    ) as typeof fetch;

    const exitMock = mock((code?: number) => {
      throw new Error(`EXIT_${code ?? 'undefined'}`);
    });
    process.exit = exitMock as typeof process.exit;

    console.log = mock(() => {}) as typeof console.log;
    const errMock = mock(() => {});
    console.error = errMock as typeof console.error;

    const dir = await mkdtemp(join(tmpdir(), 'specs-tests-'));
    const outPath = join(dir, 'baseline.json');

    await expect(baselineCommand('example.com', { out: outPath })).rejects.toThrow('EXIT_1');
    expect(exitMock).toHaveBeenCalledWith(1);
    expect(errMock).toHaveBeenCalledTimes(1);
    expect(String((errMock as any).mock.calls[0][0])).toBe(
      'BASELINE_FETCH_FAILED error=upstream_unavailable'
    );
  });

  test('api failure: repeated 521 exits 1 with upstream_unavailable marker', async () => {
    global.fetch = mock(async () =>
      new Response('web server down', { status: 521, statusText: 'Web Server Is Down' })
    ) as typeof fetch;

    const exitMock = mock((code?: number) => {
      throw new Error(`EXIT_${code ?? 'undefined'}`);
    });
    process.exit = exitMock as typeof process.exit;

    console.log = mock(() => {}) as typeof console.log;
    const errMock = mock(() => {});
    console.error = errMock as typeof console.error;

    const dir = await mkdtemp(join(tmpdir(), 'specs-tests-'));
    const outPath = join(dir, 'baseline.json');

    await expect(baselineCommand('example.com', { out: outPath })).rejects.toThrow('EXIT_1');
    expect(exitMock).toHaveBeenCalledWith(1);
    expect(errMock).toHaveBeenCalledTimes(1);
    expect(String((errMock as any).mock.calls[0][0])).toBe(
      'BASELINE_FETCH_FAILED error=upstream_unavailable'
    );
  });

  test('api failure: repeated 522 exits 1 with upstream_unavailable marker', async () => {
    global.fetch = mock(async () =>
      new Response('origin timeout', { status: 522, statusText: 'Connection Timed Out' })
    ) as typeof fetch;

    const exitMock = mock((code?: number) => {
      throw new Error(`EXIT_${code ?? 'undefined'}`);
    });
    process.exit = exitMock as typeof process.exit;

    console.log = mock(() => {}) as typeof console.log;
    const errMock = mock(() => {});
    console.error = errMock as typeof console.error;

    const dir = await mkdtemp(join(tmpdir(), 'specs-tests-'));
    const outPath = join(dir, 'baseline.json');

    await expect(baselineCommand('example.com', { out: outPath })).rejects.toThrow('EXIT_1');
    expect(exitMock).toHaveBeenCalledWith(1);
    expect(errMock).toHaveBeenCalledTimes(1);
    expect(String((errMock as any).mock.calls[0][0])).toBe(
      'BASELINE_FETCH_FAILED error=upstream_unavailable'
    );
  });

  test('api failure: repeated 524 exits 1 with upstream_unavailable marker', async () => {
    global.fetch = mock(async () =>
      new Response('timeout occurred', { status: 524, statusText: 'A Timeout Occurred' })
    ) as typeof fetch;

    const exitMock = mock((code?: number) => {
      throw new Error(`EXIT_${code ?? 'undefined'}`);
    });
    process.exit = exitMock as typeof process.exit;

    console.log = mock(() => {}) as typeof console.log;
    const errMock = mock(() => {});
    console.error = errMock as typeof console.error;

    const dir = await mkdtemp(join(tmpdir(), 'specs-tests-'));
    const outPath = join(dir, 'baseline.json');

    await expect(baselineCommand('example.com', { out: outPath })).rejects.toThrow('EXIT_1');
    expect(exitMock).toHaveBeenCalledWith(1);
    expect(errMock).toHaveBeenCalledTimes(1);
    expect(String((errMock as any).mock.calls[0][0])).toBe(
      'BASELINE_FETCH_FAILED error=upstream_unavailable'
    );
  });

  test('api failure: repeated 523 exits 1 with upstream_unavailable marker', async () => {
    global.fetch = mock(async () =>
      new Response('origin unreachable', { status: 523, statusText: 'Origin Is Unreachable' })
    ) as typeof fetch;

    const exitMock = mock((code?: number) => {
      throw new Error(`EXIT_${code ?? 'undefined'}`);
    });
    process.exit = exitMock as typeof process.exit;

    console.log = mock(() => {}) as typeof console.log;
    const errMock = mock(() => {});
    console.error = errMock as typeof console.error;

    const dir = await mkdtemp(join(tmpdir(), 'specs-tests-'));
    const outPath = join(dir, 'baseline.json');

    await expect(baselineCommand('example.com', { out: outPath })).rejects.toThrow('EXIT_1');
    expect(exitMock).toHaveBeenCalledWith(1);
    expect(errMock).toHaveBeenCalledTimes(1);
    expect(String((errMock as any).mock.calls[0][0])).toBe(
      'BASELINE_FETCH_FAILED error=upstream_unavailable'
    );
  });

  test('api failure: repeated 525 exits 1 with upstream_unavailable marker', async () => {
    global.fetch = mock(async () =>
      new Response('ssl handshake failed', { status: 525, statusText: 'SSL Handshake Failed' })
    ) as typeof fetch;

    const exitMock = mock((code?: number) => {
      throw new Error(`EXIT_${code ?? 'undefined'}`);
    });
    process.exit = exitMock as typeof process.exit;

    console.log = mock(() => {}) as typeof console.log;
    const errMock = mock(() => {});
    console.error = errMock as typeof console.error;

    const dir = await mkdtemp(join(tmpdir(), 'specs-tests-'));
    const outPath = join(dir, 'baseline.json');

    await expect(baselineCommand('example.com', { out: outPath })).rejects.toThrow('EXIT_1');
    expect(exitMock).toHaveBeenCalledWith(1);
    expect(errMock).toHaveBeenCalledTimes(1);
    expect(String((errMock as any).mock.calls[0][0])).toBe(
      'BASELINE_FETCH_FAILED error=upstream_unavailable'
    );
  });


  test('api failure: repeated 526 exits 1 with upstream_unavailable marker', async () => {
    global.fetch = mock(async () =>
      new Response('invalid ssl cert', { status: 526, statusText: 'Invalid SSL Certificate' })
    ) as typeof fetch;

    const exitMock = mock((code?: number) => {
      throw new Error(`EXIT_${code ?? 'undefined'}`);
    });
    process.exit = exitMock as typeof process.exit;

    console.log = mock(() => {}) as typeof console.log;
    const errMock = mock(() => {});
    console.error = errMock as typeof console.error;

    const dir = await mkdtemp(join(tmpdir(), 'specs-tests-'));
    const outPath = join(dir, 'baseline.json');

    await expect(baselineCommand('example.com', { out: outPath })).rejects.toThrow('EXIT_1');
    expect(exitMock).toHaveBeenCalledWith(1);
    expect(errMock).toHaveBeenCalledTimes(1);
    expect(String((errMock as any).mock.calls[0][0])).toBe(
      'BASELINE_FETCH_FAILED error=upstream_unavailable'
    );
  });

  test('api failure: repeated 527 exits 1 with upstream_unavailable marker', async () => {
    global.fetch = mock(async () =>
      new Response('railgun listener timeout', { status: 527, statusText: 'Railgun Listener to Origin Error' })
    ) as typeof fetch;

    const exitMock = mock((code?: number) => {
      throw new Error(`EXIT_${code ?? 'undefined'}`);
    });
    process.exit = exitMock as typeof process.exit;

    console.log = mock(() => {}) as typeof console.log;
    const errMock = mock(() => {});
    console.error = errMock as typeof console.error;

    const dir = await mkdtemp(join(tmpdir(), 'specs-tests-'));
    const outPath = join(dir, 'baseline.json');

    await expect(baselineCommand('example.com', { out: outPath })).rejects.toThrow('EXIT_1');
    expect(exitMock).toHaveBeenCalledWith(1);
    expect(errMock).toHaveBeenCalledTimes(1);
    expect(String((errMock as any).mock.calls[0][0])).toBe(
      'BASELINE_FETCH_FAILED error=upstream_unavailable'
    );
  });

  test('api failure: repeated 530 exits 1 with upstream_unavailable marker', async () => {
    global.fetch = mock(async () =>
      new Response('origin dns error', { status: 530, statusText: 'Origin DNS Error' })
    ) as typeof fetch;

    const exitMock = mock((code?: number) => {
      throw new Error(`EXIT_${code ?? 'undefined'}`);
    });
    process.exit = exitMock as typeof process.exit;

    console.log = mock(() => {}) as typeof console.log;
    const errMock = mock(() => {});
    console.error = errMock as typeof console.error;

    const dir = await mkdtemp(join(tmpdir(), 'specs-tests-'));
    const outPath = join(dir, 'baseline.json');

    await expect(baselineCommand('example.com', { out: outPath })).rejects.toThrow('EXIT_1');
    expect(exitMock).toHaveBeenCalledWith(1);
    expect(errMock).toHaveBeenCalledTimes(1);
    expect(String((errMock as any).mock.calls[0][0])).toBe(
      'BASELINE_FETCH_FAILED error=upstream_unavailable'
    );
  });

  test('api failure: repeated 520 exits 1 with upstream_unavailable marker', async () => {
    global.fetch = mock(async () =>
      new Response('unknown edge error', { status: 520, statusText: 'Web Server Returned an Unknown Error' })
    ) as typeof fetch;

    const exitMock = mock((code?: number) => {
      throw new Error(`EXIT_${code ?? 'undefined'}`);
    });
    process.exit = exitMock as typeof process.exit;

    console.log = mock(() => {}) as typeof console.log;
    const errMock = mock(() => {});
    console.error = errMock as typeof console.error;

    const dir = await mkdtemp(join(tmpdir(), 'specs-tests-'));
    const outPath = join(dir, 'baseline.json');

    await expect(baselineCommand('example.com', { out: outPath })).rejects.toThrow('EXIT_1');
    expect(exitMock).toHaveBeenCalledWith(1);
    expect(errMock).toHaveBeenCalledTimes(1);
    expect(String((errMock as any).mock.calls[0][0])).toBe(
      'BASELINE_FETCH_FAILED error=upstream_unavailable'
    );
  });

  test('api failure: repeated 429 exits 1 with rate_limited marker', async () => {
    global.fetch = mock(async () => new Response('slow down', { status: 429, statusText: 'Too Many Requests' })) as typeof fetch;

    const exitMock = mock((code?: number) => {
      throw new Error(`EXIT_${code ?? 'undefined'}`);
    });
    process.exit = exitMock as typeof process.exit;

    console.log = mock(() => {}) as typeof console.log;
    const errMock = mock(() => {});
    console.error = errMock as typeof console.error;

    const dir = await mkdtemp(join(tmpdir(), 'specs-tests-'));
    const outPath = join(dir, 'baseline.json');

    await expect(baselineCommand('example.com', { out: outPath })).rejects.toThrow('EXIT_1');
    expect(exitMock).toHaveBeenCalledWith(1);
    expect(errMock).toHaveBeenCalledTimes(1);
    expect(String((errMock as any).mock.calls[0][0])).toBe('BASELINE_FETCH_FAILED error=rate_limited');
  });

  test('api failure: repeated EAI_AGAIN exits 1 with upstream_unavailable marker', async () => {
    global.fetch = mock(async () => {
      throw Object.assign(new TypeError('fetch failed'), { cause: { code: 'EAI_AGAIN' } });
    }) as typeof fetch;

    const exitMock = mock((code?: number) => {
      throw new Error(`EXIT_${code ?? 'undefined'}`);
    });
    process.exit = exitMock as typeof process.exit;

    console.log = mock(() => {}) as typeof console.log;
    const errMock = mock(() => {});
    console.error = errMock as typeof console.error;

    const dir = await mkdtemp(join(tmpdir(), 'specs-tests-'));
    const outPath = join(dir, 'baseline.json');

    await expect(baselineCommand('example.com', { out: outPath })).rejects.toThrow('EXIT_1');
    expect(exitMock).toHaveBeenCalledWith(1);
    expect(errMock).toHaveBeenCalledTimes(1);
    expect(String((errMock as any).mock.calls[0][0])).toBe(
      'BASELINE_FETCH_FAILED error=upstream_unavailable'
    );
  });

  test('api failure: ENOTFOUND exits 1 with upstream_unavailable marker', async () => {
    global.fetch = mock(async () => {
      throw Object.assign(new TypeError('fetch failed'), { cause: { code: 'ENOTFOUND' } });
    }) as typeof fetch;

    const exitMock = mock((code?: number) => {
      throw new Error(`EXIT_${code ?? 'undefined'}`);
    });
    process.exit = exitMock as typeof process.exit;

    console.log = mock(() => {}) as typeof console.log;
    const errMock = mock(() => {});
    console.error = errMock as typeof console.error;

    const dir = await mkdtemp(join(tmpdir(), 'specs-tests-'));
    const outPath = join(dir, 'baseline.json');

    await expect(baselineCommand('example.com', { out: outPath })).rejects.toThrow('EXIT_1');
    expect(exitMock).toHaveBeenCalledWith(1);
    expect(errMock).toHaveBeenCalledTimes(1);
    expect(String((errMock as any).mock.calls[0][0])).toBe(
      'BASELINE_FETCH_FAILED error=upstream_unavailable'
    );
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
