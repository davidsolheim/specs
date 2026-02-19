import { afterEach, describe, expect, mock, test } from 'bun:test';
import { mkdtemp, readFile, writeFile } from 'node:fs/promises';
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

  test('rate-limited API failure exits 1 with rate_limited marker', async () => {
    const analysis = { tech: { a: 1 } };

    const dir = await mkdtemp(join(tmpdir(), 'specs-tests-'));
    const baselinePath = join(dir, 'baseline.json');
    await writeFile(baselinePath, JSON.stringify(analysis), 'utf8');

    const fetchMock = mock(async () => new Response('rate limited', { status: 429, statusText: 'Too Many Requests' }));
    global.fetch = fetchMock as typeof fetch;

    const logMock = mock(() => {});
    console.log = logMock as typeof console.log;
    console.error = mock(() => {}) as typeof console.error;

    const exitMock = mock((code?: number) => {
      throw new Error(`EXIT_${code ?? 'undefined'}`);
    });
    process.exit = exitMock as typeof process.exit;

    await expect(ciCommand('example.com', { baseline: baselinePath })).rejects.toThrow('EXIT_1');
    expect(exitMock).toHaveBeenCalledWith(1);

    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(logMock).toHaveBeenCalledTimes(1);
    const out = JSON.parse(String((logMock as any).mock.calls[0][0]));
    expect(out.ok).toBe(false);
    expect(out.error).toBe('rate_limited');
    expect(out.exit).toBe(1);
  });

  test('repeated transient 503 API failure exits 1 with upstream_unavailable marker', async () => {
    const analysis = { tech: { a: 1 } };

    const dir = await mkdtemp(join(tmpdir(), 'specs-tests-'));
    const baselinePath = join(dir, 'baseline.json');
    await writeFile(baselinePath, JSON.stringify(analysis), 'utf8');

    const fetchMock = mock(async () => new Response('down', { status: 503, statusText: 'Service Unavailable' }));
    global.fetch = fetchMock as typeof fetch;

    const logMock = mock(() => {});
    console.log = logMock as typeof console.log;
    console.error = mock(() => {}) as typeof console.error;

    const exitMock = mock((code?: number) => {
      throw new Error(`EXIT_${code ?? 'undefined'}`);
    });
    process.exit = exitMock as typeof process.exit;

    await expect(ciCommand('example.com', { baseline: baselinePath })).rejects.toThrow('EXIT_1');
    expect(exitMock).toHaveBeenCalledWith(1);

    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(logMock).toHaveBeenCalledTimes(1);
    const out = JSON.parse(String((logMock as any).mock.calls[0][0]));
    expect(out.ok).toBe(false);
    expect(out.error).toBe('upstream_unavailable');
    expect(out.exit).toBe(1);
  });

  test('repeated transient 500 API failure exits 1 with upstream_unavailable marker', async () => {
    const analysis = { tech: { a: 1 } };

    const dir = await mkdtemp(join(tmpdir(), 'specs-tests-'));
    const baselinePath = join(dir, 'baseline.json');
    await writeFile(baselinePath, JSON.stringify(analysis), 'utf8');

    const fetchMock = mock(async () => new Response('down', { status: 500, statusText: 'Internal Server Error' }));
    global.fetch = fetchMock as typeof fetch;

    const logMock = mock(() => {});
    console.log = logMock as typeof console.log;
    console.error = mock(() => {}) as typeof console.error;

    const exitMock = mock((code?: number) => {
      throw new Error(`EXIT_${code ?? 'undefined'}`);
    });
    process.exit = exitMock as typeof process.exit;

    await expect(ciCommand('example.com', { baseline: baselinePath })).rejects.toThrow('EXIT_1');
    expect(exitMock).toHaveBeenCalledWith(1);

    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(logMock).toHaveBeenCalledTimes(1);
    const out = JSON.parse(String((logMock as any).mock.calls[0][0]));
    expect(out.ok).toBe(false);
    expect(out.error).toBe('upstream_unavailable');
    expect(out.exit).toBe(1);
  });

  test('repeated transient 408 API failure exits 1 with upstream_unavailable marker', async () => {
    const analysis = { tech: { a: 1 } };

    const dir = await mkdtemp(join(tmpdir(), 'specs-tests-'));
    const baselinePath = join(dir, 'baseline.json');
    await writeFile(baselinePath, JSON.stringify(analysis), 'utf8');

    const fetchMock = mock(async () => new Response('timeout', { status: 408, statusText: 'Request Timeout' }));
    global.fetch = fetchMock as typeof fetch;

    const logMock = mock(() => {});
    console.log = logMock as typeof console.log;
    console.error = mock(() => {}) as typeof console.error;

    const exitMock = mock((code?: number) => {
      throw new Error(`EXIT_${code ?? 'undefined'}`);
    });
    process.exit = exitMock as typeof process.exit;

    await expect(ciCommand('example.com', { baseline: baselinePath })).rejects.toThrow('EXIT_1');
    expect(exitMock).toHaveBeenCalledWith(1);

    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(logMock).toHaveBeenCalledTimes(1);
    const out = JSON.parse(String((logMock as any).mock.calls[0][0]));
    expect(out.ok).toBe(false);
    expect(out.error).toBe('upstream_unavailable');
    expect(out.exit).toBe(1);
  });

  test('repeated transient 521 API failure exits 1 with upstream_unavailable marker', async () => {
    const analysis = { tech: { a: 1 } };

    const dir = await mkdtemp(join(tmpdir(), 'specs-tests-'));
    const baselinePath = join(dir, 'baseline.json');
    await writeFile(baselinePath, JSON.stringify(analysis), 'utf8');

    const fetchMock = mock(async () => new Response('web server down', { status: 521, statusText: 'Web Server Is Down' }));
    global.fetch = fetchMock as typeof fetch;

    const logMock = mock(() => {});
    console.log = logMock as typeof console.log;
    console.error = mock(() => {}) as typeof console.error;

    const exitMock = mock((code?: number) => {
      throw new Error(`EXIT_${code ?? 'undefined'}`);
    });
    process.exit = exitMock as typeof process.exit;

    await expect(ciCommand('example.com', { baseline: baselinePath })).rejects.toThrow('EXIT_1');
    expect(exitMock).toHaveBeenCalledWith(1);

    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(logMock).toHaveBeenCalledTimes(1);
    const out = JSON.parse(String((logMock as any).mock.calls[0][0]));
    expect(out.ok).toBe(false);
    expect(out.error).toBe('upstream_unavailable');
    expect(out.exit).toBe(1);
  });

  test('repeated transient 522 API failure exits 1 with upstream_unavailable marker', async () => {
    const analysis = { tech: { a: 1 } };

    const dir = await mkdtemp(join(tmpdir(), 'specs-tests-'));
    const baselinePath = join(dir, 'baseline.json');
    await writeFile(baselinePath, JSON.stringify(analysis), 'utf8');

    const fetchMock = mock(async () => new Response('origin timeout', { status: 522, statusText: 'Connection Timed Out' }));
    global.fetch = fetchMock as typeof fetch;

    const logMock = mock(() => {});
    console.log = logMock as typeof console.log;
    console.error = mock(() => {}) as typeof console.error;

    const exitMock = mock((code?: number) => {
      throw new Error(`EXIT_${code ?? 'undefined'}`);
    });
    process.exit = exitMock as typeof process.exit;

    await expect(ciCommand('example.com', { baseline: baselinePath })).rejects.toThrow('EXIT_1');
    expect(exitMock).toHaveBeenCalledWith(1);

    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(logMock).toHaveBeenCalledTimes(1);
    const out = JSON.parse(String((logMock as any).mock.calls[0][0]));
    expect(out.ok).toBe(false);
    expect(out.error).toBe('upstream_unavailable');
    expect(out.exit).toBe(1);
  });

  test('repeated transient 524 API failure exits 1 with upstream_unavailable marker', async () => {
    const analysis = { tech: { a: 1 } };

    const dir = await mkdtemp(join(tmpdir(), 'specs-tests-'));
    const baselinePath = join(dir, 'baseline.json');
    await writeFile(baselinePath, JSON.stringify(analysis), 'utf8');

    const fetchMock = mock(async () => new Response('timeout occurred', { status: 524, statusText: 'A Timeout Occurred' }));
    global.fetch = fetchMock as typeof fetch;

    const logMock = mock(() => {});
    console.log = logMock as typeof console.log;
    console.error = mock(() => {}) as typeof console.error;

    const exitMock = mock((code?: number) => {
      throw new Error(`EXIT_${code ?? 'undefined'}`);
    });
    process.exit = exitMock as typeof process.exit;

    await expect(ciCommand('example.com', { baseline: baselinePath })).rejects.toThrow('EXIT_1');
    expect(exitMock).toHaveBeenCalledWith(1);

    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(logMock).toHaveBeenCalledTimes(1);
    const out = JSON.parse(String((logMock as any).mock.calls[0][0]));
    expect(out.ok).toBe(false);
    expect(out.error).toBe('upstream_unavailable');
    expect(out.exit).toBe(1);
  });

  test('repeated transient 523 API failure exits 1 with upstream_unavailable marker', async () => {
    const analysis = { tech: { a: 1 } };

    const dir = await mkdtemp(join(tmpdir(), 'specs-tests-'));
    const baselinePath = join(dir, 'baseline.json');
    await writeFile(baselinePath, JSON.stringify(analysis), 'utf8');

    const fetchMock = mock(async () => new Response('origin unreachable', { status: 523, statusText: 'Origin Is Unreachable' }));
    global.fetch = fetchMock as typeof fetch;

    const logMock = mock(() => {});
    console.log = logMock as typeof console.log;
    console.error = mock(() => {}) as typeof console.error;

    const exitMock = mock((code?: number) => {
      throw new Error(`EXIT_${code ?? 'undefined'}`);
    });
    process.exit = exitMock as typeof process.exit;

    await expect(ciCommand('example.com', { baseline: baselinePath })).rejects.toThrow('EXIT_1');
    expect(exitMock).toHaveBeenCalledWith(1);

    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(logMock).toHaveBeenCalledTimes(1);
    const out = JSON.parse(String((logMock as any).mock.calls[0][0]));
    expect(out.ok).toBe(false);
    expect(out.error).toBe('upstream_unavailable');
    expect(out.exit).toBe(1);
  });

  test('repeated transient 525 API failure exits 1 with upstream_unavailable marker', async () => {
    const analysis = { tech: { a: 1 } };

    const dir = await mkdtemp(join(tmpdir(), 'specs-tests-'));
    const baselinePath = join(dir, 'baseline.json');
    await writeFile(baselinePath, JSON.stringify(analysis), 'utf8');

    const fetchMock = mock(async () => new Response('ssl handshake failed', { status: 525, statusText: 'SSL Handshake Failed' }));
    global.fetch = fetchMock as typeof fetch;

    const logMock = mock(() => {});
    console.log = logMock as typeof console.log;
    console.error = mock(() => {}) as typeof console.error;

    const exitMock = mock((code?: number) => {
      throw new Error(`EXIT_${code ?? 'undefined'}`);
    });
    process.exit = exitMock as typeof process.exit;

    await expect(ciCommand('example.com', { baseline: baselinePath })).rejects.toThrow('EXIT_1');
    expect(exitMock).toHaveBeenCalledWith(1);

    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(logMock).toHaveBeenCalledTimes(1);
    const out = JSON.parse(String((logMock as any).mock.calls[0][0]));
    expect(out.ok).toBe(false);
    expect(out.error).toBe('upstream_unavailable');
    expect(out.exit).toBe(1);
  });


  test('repeated transient 526 API failure exits 1 with upstream_unavailable marker', async () => {
    const analysis = { tech: { a: 1 } };

    const dir = await mkdtemp(join(tmpdir(), 'specs-tests-'));
    const baselinePath = join(dir, 'baseline.json');
    await writeFile(baselinePath, JSON.stringify(analysis), 'utf8');

    const fetchMock = mock(async () => new Response('invalid ssl cert', { status: 526, statusText: 'Invalid SSL Certificate' }));
    global.fetch = fetchMock as typeof fetch;

    const logMock = mock(() => {});
    console.log = logMock as typeof console.log;
    console.error = mock(() => {}) as typeof console.error;

    const exitMock = mock((code?: number) => {
      throw new Error(`EXIT_${code ?? 'undefined'}`);
    });
    process.exit = exitMock as typeof process.exit;

    await expect(ciCommand('example.com', { baseline: baselinePath })).rejects.toThrow('EXIT_1');
    expect(exitMock).toHaveBeenCalledWith(1);

    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(logMock).toHaveBeenCalledTimes(1);
    const out = JSON.parse(String((logMock as any).mock.calls[0][0]));
    expect(out.ok).toBe(false);
    expect(out.error).toBe('upstream_unavailable');
    expect(out.exit).toBe(1);
  });

  test('repeated transient 527 API failure exits 1 with upstream_unavailable marker', async () => {
    const analysis = { tech: { a: 1 } };

    const dir = await mkdtemp(join(tmpdir(), 'specs-tests-'));
    const baselinePath = join(dir, 'baseline.json');
    await writeFile(baselinePath, JSON.stringify(analysis), 'utf8');

    const fetchMock = mock(async () =>
      new Response('railgun listener timeout', { status: 527, statusText: 'Railgun Listener to Origin Error' })
    );
    global.fetch = fetchMock as typeof fetch;

    const logMock = mock(() => {});
    console.log = logMock as typeof console.log;
    console.error = mock(() => {}) as typeof console.error;

    const exitMock = mock((code?: number) => {
      throw new Error(`EXIT_${code ?? 'undefined'}`);
    });
    process.exit = exitMock as typeof process.exit;

    await expect(ciCommand('example.com', { baseline: baselinePath })).rejects.toThrow('EXIT_1');
    expect(exitMock).toHaveBeenCalledWith(1);

    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(logMock).toHaveBeenCalledTimes(1);
    const out = JSON.parse(String((logMock as any).mock.calls[0][0]));
    expect(out.ok).toBe(false);
    expect(out.error).toBe('upstream_unavailable');
    expect(out.exit).toBe(1);
  });

  test('repeated transient 528 API failure exits 1 with upstream_unavailable marker', async () => {
    const analysis = { tech: { a: 1 } };

    const dir = await mkdtemp(join(tmpdir(), 'specs-tests-'));
    const baselinePath = join(dir, 'baseline.json');
    await writeFile(baselinePath, JSON.stringify(analysis), 'utf8');

    const fetchMock = mock(async () =>
      new Response('site overloaded', { status: 528, statusText: 'Site is Overloaded' })
    );
    global.fetch = fetchMock as typeof fetch;

    const logMock = mock(() => {});
    console.log = logMock as typeof console.log;
    console.error = mock(() => {}) as typeof console.error;

    const exitMock = mock((code?: number) => {
      throw new Error(`EXIT_${code ?? 'undefined'}`);
    });
    process.exit = exitMock as typeof process.exit;

    await expect(ciCommand('example.com', { baseline: baselinePath })).rejects.toThrow('EXIT_1');
    expect(exitMock).toHaveBeenCalledWith(1);

    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(logMock).toHaveBeenCalledTimes(1);
    const out = JSON.parse(String((logMock as any).mock.calls[0][0]));
    expect(out.ok).toBe(false);
    expect(out.error).toBe('upstream_unavailable');
    expect(out.exit).toBe(1);
  });

  test('repeated transient 530 API failure exits 1 with upstream_unavailable marker', async () => {
    const analysis = { tech: { a: 1 } };

    const dir = await mkdtemp(join(tmpdir(), 'specs-tests-'));
    const baselinePath = join(dir, 'baseline.json');
    await writeFile(baselinePath, JSON.stringify(analysis), 'utf8');

    const fetchMock = mock(async () =>
      new Response('origin dns error', { status: 530, statusText: 'Origin DNS Error' })
    );
    global.fetch = fetchMock as typeof fetch;

    const logMock = mock(() => {});
    console.log = logMock as typeof console.log;
    console.error = mock(() => {}) as typeof console.error;

    const exitMock = mock((code?: number) => {
      throw new Error(`EXIT_${code ?? 'undefined'}`);
    });
    process.exit = exitMock as typeof process.exit;

    await expect(ciCommand('example.com', { baseline: baselinePath })).rejects.toThrow('EXIT_1');
    expect(exitMock).toHaveBeenCalledWith(1);

    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(logMock).toHaveBeenCalledTimes(1);
    const out = JSON.parse(String((logMock as any).mock.calls[0][0]));
    expect(out.ok).toBe(false);
    expect(out.error).toBe('upstream_unavailable');
    expect(out.exit).toBe(1);
  });

  test('repeated transient 520 API failure exits 1 with upstream_unavailable marker', async () => {
    const analysis = { tech: { a: 1 } };

    const dir = await mkdtemp(join(tmpdir(), 'specs-tests-'));
    const baselinePath = join(dir, 'baseline.json');
    await writeFile(baselinePath, JSON.stringify(analysis), 'utf8');

    const fetchMock = mock(async () =>
      new Response('unknown edge error', { status: 520, statusText: 'Web Server Returned an Unknown Error' })
    );
    global.fetch = fetchMock as typeof fetch;

    const logMock = mock(() => {});
    console.log = logMock as typeof console.log;
    console.error = mock(() => {}) as typeof console.error;

    const exitMock = mock((code?: number) => {
      throw new Error(`EXIT_${code ?? 'undefined'}`);
    });
    process.exit = exitMock as typeof process.exit;

    await expect(ciCommand('example.com', { baseline: baselinePath })).rejects.toThrow('EXIT_1');
    expect(exitMock).toHaveBeenCalledWith(1);

    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(logMock).toHaveBeenCalledTimes(1);
    const out = JSON.parse(String((logMock as any).mock.calls[0][0]));
    expect(out.ok).toBe(false);
    expect(out.error).toBe('upstream_unavailable');
    expect(out.exit).toBe(1);
  });

  test('repeated EAI_AGAIN DNS failure exits 1 with upstream_unavailable marker', async () => {
    const analysis = { tech: { a: 1 } };

    const dir = await mkdtemp(join(tmpdir(), 'specs-tests-'));
    const baselinePath = join(dir, 'baseline.json');
    await writeFile(baselinePath, JSON.stringify(analysis), 'utf8');

    const fetchMock = mock(async () => {
      throw Object.assign(new TypeError('fetch failed'), { cause: { code: 'EAI_AGAIN' } });
    });
    global.fetch = fetchMock as typeof fetch;

    const logMock = mock(() => {});
    console.log = logMock as typeof console.log;
    console.error = mock(() => {}) as typeof console.error;

    const exitMock = mock((code?: number) => {
      throw new Error(`EXIT_${code ?? 'undefined'}`);
    });
    process.exit = exitMock as typeof process.exit;

    await expect(ciCommand('example.com', { baseline: baselinePath })).rejects.toThrow('EXIT_1');
    expect(exitMock).toHaveBeenCalledWith(1);

    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(logMock).toHaveBeenCalledTimes(1);
    const out = JSON.parse(String((logMock as any).mock.calls[0][0]));
    expect(out.ok).toBe(false);
    expect(out.error).toBe('upstream_unavailable');
    expect(out.exit).toBe(1);
  });

  test('ENOTFOUND DNS failure exits 1 with upstream_unavailable marker', async () => {
    const analysis = { tech: { a: 1 } };

    const dir = await mkdtemp(join(tmpdir(), 'specs-tests-'));
    const baselinePath = join(dir, 'baseline.json');
    await writeFile(baselinePath, JSON.stringify(analysis), 'utf8');

    const fetchMock = mock(async () => {
      throw Object.assign(new TypeError('fetch failed'), { cause: { code: 'ENOTFOUND' } });
    });
    global.fetch = fetchMock as typeof fetch;

    const logMock = mock(() => {});
    console.log = logMock as typeof console.log;
    console.error = mock(() => {}) as typeof console.error;

    const exitMock = mock((code?: number) => {
      throw new Error(`EXIT_${code ?? 'undefined'}`);
    });
    process.exit = exitMock as typeof process.exit;

    await expect(ciCommand('example.com', { baseline: baselinePath })).rejects.toThrow('EXIT_1');
    expect(exitMock).toHaveBeenCalledWith(1);

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(logMock).toHaveBeenCalledTimes(1);
    const out = JSON.parse(String((logMock as any).mock.calls[0][0]));
    expect(out.ok).toBe(false);
    expect(out.error).toBe('upstream_unavailable');
    expect(out.exit).toBe(1);
  });

  test('happy path: baseline equals fetched analysis -> ok=true exit=0 and single JSON stdout line', async () => {
    const analysis = { tech: { a: 1 } };

    const dir = await mkdtemp(join(tmpdir(), 'specs-tests-'));
    const baselinePath = join(dir, 'baseline.json');
    await writeFile(baselinePath, JSON.stringify(analysis), 'utf8');

    const fetchMock = mock(async (input: RequestInfo | URL) => {
      expect(String(input)).toContain('/api/public/analyze?url=https%3A%2F%2Fexample.com');
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

  test('drift path + --fail-on-diff: baseline differs -> ok=false exit=1 and single JSON stdout line', async () => {
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

    await expect(ciCommand('example.com', { baseline: baselinePath, failOnDiff: true })).rejects.toThrow('EXIT_1');
    expect(exitMock).toHaveBeenCalledWith(1);

    expect(logMock).toHaveBeenCalledTimes(1);
    const line = String((logMock as any).mock.calls[0][0]);
    expect(line.includes('\n')).toBe(false);

    const out = JSON.parse(line);
    expect(out.ok).toBe(false);
    expect(out.domain).toBe('example.com');
    expect(out.exit).toBe(1);
  });

  test('drift path without --fail-on-diff: emits drift but exits 0', async () => {
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

    await ciCommand('example.com', { baseline: baselinePath });

    expect(exitMock).toHaveBeenCalledTimes(0);
    expect(logMock).toHaveBeenCalledTimes(1);
    const out = JSON.parse(String((logMock as any).mock.calls[0][0]));
    expect(out.ok).toBe(false);
    expect(out.exit).toBe(0);
    expect(out.drift_changed).toBe(1);
  });

  test('happy path saves file (stdout unchanged)', async () => {
    const analysis = { tech: { a: 1 } };

    const dir = await mkdtemp(join(tmpdir(), 'specs-tests-'));
    const baselinePath = join(dir, 'baseline.json');
    const outPath = join(dir, 'out.json');
    await writeFile(baselinePath, JSON.stringify(analysis), 'utf8');

    global.fetch = mock(async () => new Response(JSON.stringify(analysis), { status: 200 })) as typeof fetch;

    const logMock = mock(() => {});
    console.log = logMock as typeof console.log;
    console.error = mock(() => {}) as typeof console.error;

    const exitMock = mock((code?: number) => {
      throw new Error(`EXIT_${code ?? 'undefined'}`);
    });
    process.exit = exitMock as typeof process.exit;

    await ciCommand('example.com', { baseline: baselinePath });
    const lineWithoutSave = String((logMock as any).mock.calls[0][0]);

    const logMock2 = mock(() => {});
    console.log = logMock2 as typeof console.log;

    await ciCommand('example.com', { baseline: baselinePath, save: outPath, saveFlagPresent: true });
    const lineWithSave = String((logMock2 as any).mock.calls[0][0]);

    expect(lineWithSave).toBe(lineWithoutSave);

    const saved = await readFile(outPath, 'utf8');
    expect(() => JSON.parse(saved)).not.toThrow();

    expect(exitMock).toHaveBeenCalledTimes(0);
  });

  test('--save present but missing arg exits 2 and prints CI_SAVE_INVALID', async () => {
    const analysis = { tech: { a: 1 } };

    const dir = await mkdtemp(join(tmpdir(), 'specs-tests-'));
    const baselinePath = join(dir, 'baseline.json');
    await writeFile(baselinePath, JSON.stringify(analysis), 'utf8');

    const errMock = mock(() => {});
    console.error = errMock as typeof console.error;
    console.log = mock(() => {}) as typeof console.log;

    const exitMock = mock((code?: number) => {
      throw new Error(`EXIT_${code ?? 'undefined'}`);
    });
    process.exit = exitMock as typeof process.exit;

    await expect(
      ciCommand('example.com', { baseline: baselinePath, save: '', saveFlagPresent: true })
    ).rejects.toThrow('EXIT_2');

    expect(errMock).toHaveBeenCalledTimes(1);
    expect(String((errMock as any).mock.calls[0][0])).toBe('CI_SAVE_INVALID');
  });

  test('write failure exits 2 and prints CI_SAVE_FAILED (stdout still printed)', async () => {
    const analysis = { tech: { a: 1 } };

    const dir = await mkdtemp(join(tmpdir(), 'specs-tests-'));
    const baselinePath = join(dir, 'baseline.json');
    await writeFile(baselinePath, JSON.stringify(analysis), 'utf8');

    global.fetch = mock(async () => new Response(JSON.stringify(analysis), { status: 200 })) as typeof fetch;

    const logMock = mock(() => {});
    const errMock = mock(() => {});
    console.log = logMock as typeof console.log;
    console.error = errMock as typeof console.error;

    const exitMock = mock((code?: number) => {
      throw new Error(`EXIT_${code ?? 'undefined'}`);
    });
    process.exit = exitMock as typeof process.exit;

    // Writing to an existing directory should deterministically fail (EISDIR).
    await expect(
      ciCommand('example.com', { baseline: baselinePath, save: dir, saveFlagPresent: true })
    ).rejects.toThrow('EXIT_2');

    expect(logMock).toHaveBeenCalledTimes(1);
    const line = String((logMock as any).mock.calls[0][0]);
    expect(line.includes('\n')).toBe(false);
    expect(JSON.parse(line).domain).toBe('example.com');

    expect(errMock).toHaveBeenCalledTimes(1);
    const errLine = String((errMock as any).mock.calls[0][0]);
    expect(errLine.startsWith(`CI_SAVE_FAILED path=${dir} error=`)).toBe(true);
  });
});

