import { afterEach, describe, expect, mock, test } from 'bun:test';
import { mkdir, mkdtemp, readFile, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { ghaCommand } from '../src/commands/gha';

describe('gha command', () => {
  async function readFixture(name: string): Promise<string> {
    return await readFile(new URL(`./fixtures/gha/${name}`, import.meta.url), 'utf8');
  }

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
      '  run: npx -y @sitespecs/specs@latest ci example.com --baseline baseline.json --fail-on-diff',
    );
  });

  test('workflow: prints full workflow YAML with trailing newline', async () => {
    const logMock = mock(() => {});
    console.log = logMock as typeof console.log;

    await ghaCommand('example.com', { baseline: 'baseline.json', workflow: true } as any);

    expect(logMock).toHaveBeenCalledTimes(1);
    expect(String((logMock as any).mock.calls[0][0])).toBe(
      await readFixture('workflow.yml'),
    );
  });

  test('workflow + --artifact specs-analysis.json: emits fixture', async () => {
    const logMock = mock(() => {});
    console.log = logMock as typeof console.log;

    await ghaCommand('example.com', {
      baseline: 'baseline.json',
      workflow: true,
      artifact: 'specs-analysis.json',
    } as any);

    expect(logMock).toHaveBeenCalledTimes(1);
    expect(String((logMock as any).mock.calls[0][0])).toBe(
      await readFixture('workflow-artifact.yml'),
    );
  });

  test('workflow + --artifact + --artifact-retention-days 7: emits fixture', async () => {
    const logMock = mock(() => {});
    console.log = logMock as typeof console.log;

    await ghaCommand('example.com', {
      baseline: 'baseline.json',
      workflow: true,
      artifact: 'specs-analysis.json',
      artifactRetentionDays: 7,
    } as any);

    expect(logMock).toHaveBeenCalledTimes(1);
    expect(String((logMock as any).mock.calls[0][0])).toBe(
      await readFixture('workflow-artifact-retention-days.yml'),
    );
  });

  test('workflow + --concurrency: emits fixture', async () => {
    const logMock = mock(() => {});
    console.log = logMock as typeof console.log;

    await ghaCommand('example.com', {
      baseline: 'baseline.json',
      workflow: true,
      concurrency: 'specs-ci-example',
    } as any);

    expect(logMock).toHaveBeenCalledTimes(1);
    expect(String((logMock as any).mock.calls[0][0])).toBe(
      await readFixture('workflow-concurrency.yml'),
    );
  });

  test('workflow + --runs-on self-hosted: prints workflow YAML with custom runner', async () => {
    const logMock = mock(() => {});
    console.log = logMock as typeof console.log;

    await ghaCommand('example.com', {
      baseline: 'baseline.json',
      workflow: true,
      runsOn: 'self-hosted',
    } as any);

    expect(logMock).toHaveBeenCalledTimes(1);
    expect(String((logMock as any).mock.calls[0][0])).toBe(
      await readFixture('workflow-runs-on-self-hosted.yml'),
    );
  });

  test('workflow + --node-version 20: prints workflow YAML with setup-node step', async () => {
    const logMock = mock(() => {});
    console.log = logMock as typeof console.log;

    await ghaCommand('example.com', {
      baseline: 'baseline.json',
      workflow: true,
      nodeVersion: '20',
    } as any);

    expect(logMock).toHaveBeenCalledTimes(1);
    expect(String((logMock as any).mock.calls[0][0])).toBe(
      await readFixture('workflow-node-version-20.yml'),
    );
  });

  test('--fetch-depth without --workflow: exits 2 and prints deterministic stderr', async () => {
    const exitMock = mock((code?: number) => {
      throw new Error(`EXIT_${code ?? 'undefined'}`);
    });
    process.exit = exitMock as typeof process.exit;

    const logMock = mock(() => {});
    console.log = logMock as typeof console.log;

    const errMock = mock(() => {});
    console.error = errMock as typeof console.error;

    await expect(
      ghaCommand('example.com', { baseline: 'baseline.json', fetchDepth: 2 } as any),
    ).rejects.toThrow('EXIT_2');

    expect(logMock).toHaveBeenCalledTimes(0);
    expect(errMock).toHaveBeenCalledTimes(1);
    expect(String((errMock as any).mock.calls[0][0])).toBe('WORKFLOW_FETCH_DEPTH_REQUIRES_WORKFLOW');
  });

  test('--artifact without --workflow: exits 2 and prints deterministic stderr', async () => {
    const exitMock = mock((code?: number) => {
      throw new Error(`EXIT_${code ?? 'undefined'}`);
    });
    process.exit = exitMock as typeof process.exit;

    const errMock = mock(() => {});
    console.error = errMock as typeof console.error;

    await expect(
      ghaCommand('example.com', { baseline: 'baseline.json', artifact: 'specs-analysis.json' } as any),
    ).rejects.toThrow('EXIT_2');
    expect(errMock).toHaveBeenCalledTimes(1);
    expect(String((errMock as any).mock.calls[0][0])).toBe('WORKFLOW_ARTIFACT_REQUIRES_WORKFLOW');
  });

  test('--artifact-retention-days without --workflow: exits 2 and prints deterministic stderr', async () => {
    const exitMock = mock((code?: number) => {
      throw new Error(`EXIT_${code ?? 'undefined'}`);
    });
    process.exit = exitMock as typeof process.exit;

    const errMock = mock(() => {});
    console.error = errMock as typeof console.error;

    await expect(
      ghaCommand('example.com', { baseline: 'baseline.json', artifactRetentionDays: 7 } as any),
    ).rejects.toThrow('EXIT_2');
    expect(errMock).toHaveBeenCalledTimes(1);
    expect(String((errMock as any).mock.calls[0][0])).toBe('WORKFLOW_ARTIFACT_RETENTION_DAYS_REQUIRES_WORKFLOW');
  });

  test('--artifact-retention-days without --artifact: exits 2 and prints deterministic stderr', async () => {
    const exitMock = mock((code?: number) => {
      throw new Error(`EXIT_${code ?? 'undefined'}`);
    });
    process.exit = exitMock as typeof process.exit;

    const errMock = mock(() => {});
    console.error = errMock as typeof console.error;

    await expect(
      ghaCommand('example.com', { baseline: 'baseline.json', workflow: true, artifactRetentionDays: 7 } as any),
    ).rejects.toThrow('EXIT_2');
    expect(errMock).toHaveBeenCalledTimes(1);
    expect(String((errMock as any).mock.calls[0][0])).toBe('WORKFLOW_ARTIFACT_RETENTION_DAYS_REQUIRES_ARTIFACT');
  });

  test('workflow + invalid --fetch-depth: exits 2 and prints deterministic stderr', async () => {
    const exitMock = mock((code?: number) => {
      throw new Error(`EXIT_${code ?? 'undefined'}`);
    });
    process.exit = exitMock as typeof process.exit;

    const logMock = mock(() => {});
    console.log = logMock as typeof console.log;

    const errMock = mock(() => {});
    console.error = errMock as typeof console.error;

    await expect(
      ghaCommand('example.com', { baseline: 'baseline.json', workflow: true, fetchDepth: -1 } as any),
    ).rejects.toThrow('EXIT_2');

    await expect(
      ghaCommand('example.com', { baseline: 'baseline.json', workflow: true, fetchDepth: 'nope' } as any),
    ).rejects.toThrow('EXIT_2');

    expect(logMock).toHaveBeenCalledTimes(0);
    expect(errMock).toHaveBeenCalledTimes(2);
    expect(String((errMock as any).mock.calls[0][0])).toBe('WORKFLOW_FETCH_DEPTH_INVALID');
    expect(String((errMock as any).mock.calls[1][0])).toBe('WORKFLOW_FETCH_DEPTH_INVALID');
  });

  test('--artifact invalid: exits 2 and prints deterministic stderr', async () => {
    const exitMock = mock((code?: number) => {
      throw new Error(`EXIT_${code ?? 'undefined'}`);
    });
    process.exit = exitMock as typeof process.exit;

    const errMock = mock(() => {});
    console.error = errMock as typeof console.error;

    await expect(
      ghaCommand('example.com', { baseline: 'baseline.json', workflow: true, artifact: '' } as any),
    ).rejects.toThrow('EXIT_2');
    expect(errMock).toHaveBeenCalledTimes(1);
    expect(String((errMock as any).mock.calls[0][0])).toBe('WORKFLOW_ARTIFACT_INVALID');
  });

  test('--artifact-retention-days invalid: exits 2 and prints deterministic stderr', async () => {
    const exitMock = mock((code?: number) => {
      throw new Error(`EXIT_${code ?? 'undefined'}`);
    });
    process.exit = exitMock as typeof process.exit;

    const logMock = mock(() => {});
    console.log = logMock as typeof console.log;

    const errMock = mock(() => {});
    console.error = errMock as typeof console.error;

    await expect(
      ghaCommand('example.com', {
        baseline: 'baseline.json',
        workflow: true,
        artifact: 'specs-analysis.json',
        artifactRetentionDays: 0,
      } as any),
    ).rejects.toThrow('EXIT_2');

    await expect(
      ghaCommand('example.com', {
        baseline: 'baseline.json',
        workflow: true,
        artifact: 'specs-analysis.json',
        artifactRetentionDays: 91,
      } as any),
    ).rejects.toThrow('EXIT_2');

    await expect(
      ghaCommand('example.com', {
        baseline: 'baseline.json',
        workflow: true,
        artifact: 'specs-analysis.json',
        artifactRetentionDays: 'nope',
      } as any),
    ).rejects.toThrow('EXIT_2');

    expect(logMock).toHaveBeenCalledTimes(0);
    expect(errMock).toHaveBeenCalledTimes(3);
    expect(String((errMock as any).mock.calls[0][0])).toBe('WORKFLOW_ARTIFACT_RETENTION_DAYS_INVALID');
    expect(String((errMock as any).mock.calls[1][0])).toBe('WORKFLOW_ARTIFACT_RETENTION_DAYS_INVALID');
    expect(String((errMock as any).mock.calls[2][0])).toBe('WORKFLOW_ARTIFACT_RETENTION_DAYS_INVALID');
  });

  test('workflow + --fetch-depth 0: emits fixture', async () => {
    const logMock = mock(() => {});
    console.log = logMock as typeof console.log;

    await ghaCommand('example.com', {
      baseline: 'baseline.json',
      workflow: true,
      fetchDepth: 0,
    } as any);

    expect(logMock).toHaveBeenCalledTimes(1);
    expect(String((logMock as any).mock.calls[0][0])).toBe(
      await readFixture('workflow-fetch-depth-0.yml'),
    );
  });

  test('workflow + --fetch-depth 2: emits fixture', async () => {
    const logMock = mock(() => {});
    console.log = logMock as typeof console.log;

    await ghaCommand('example.com', {
      baseline: 'baseline.json',
      workflow: true,
      fetchDepth: 2,
    } as any);

    expect(logMock).toHaveBeenCalledTimes(1);
    expect(String((logMock as any).mock.calls[0][0])).toBe(
      await readFixture('workflow-fetch-depth-2.yml'),
    );
  });

  test('--working-directory without --workflow: exits 2 and prints deterministic stderr', async () => {
    const exitMock = mock((code?: number) => {
      throw new Error(`EXIT_${code ?? 'undefined'}`);
    });
    process.exit = exitMock as typeof process.exit;

    const logMock = mock(() => {});
    console.log = logMock as typeof console.log;

    const errMock = mock(() => {});
    console.error = errMock as typeof console.error;

    await expect(
      ghaCommand('example.com', { baseline: 'baseline.json', workingDirectory: 'specs' } as any),
    ).rejects.toThrow('EXIT_2');

    expect(logMock).toHaveBeenCalledTimes(0);
    expect(errMock).toHaveBeenCalledTimes(1);
    expect(String((errMock as any).mock.calls[0][0])).toBe('WORKFLOW_WORKING_DIRECTORY_REQUIRES_WORKFLOW');
  });

  test('workflow + --working-directory specs: emits fixture', async () => {
    const logMock = mock(() => {});
    console.log = logMock as typeof console.log;

    await ghaCommand('example.com', {
      baseline: 'baseline.json',
      workflow: true,
      workingDirectory: 'specs',
    } as any);

    expect(logMock).toHaveBeenCalledTimes(1);
    expect(String((logMock as any).mock.calls[0][0])).toBe(
      await readFixture('workflow-working-directory-specs.yml'),
    );
  });

  test('--permissions without --workflow: exits 2 and prints deterministic stderr', async () => {
    const exitMock = mock((code?: number) => {
      throw new Error(`EXIT_${code ?? 'undefined'}`);
    });
    process.exit = exitMock as typeof process.exit;

    const logMock = mock(() => {});
    console.log = logMock as typeof console.log;

    const errMock = mock(() => {});
    console.error = errMock as typeof console.error;

    await expect(
      ghaCommand('example.com', { baseline: 'baseline.json', permissions: 'minimal' } as any),
    ).rejects.toThrow('EXIT_2');

    expect(logMock).toHaveBeenCalledTimes(0);
    expect(errMock).toHaveBeenCalledTimes(1);
    expect(String((errMock as any).mock.calls[0][0])).toBe('WORKFLOW_PERMISSIONS_REQUIRES_WORKFLOW');
  });

  test('workflow + --permissions invalid: exits 2 and prints deterministic stderr', async () => {
    const exitMock = mock((code?: number) => {
      throw new Error(`EXIT_${code ?? 'undefined'}`);
    });
    process.exit = exitMock as typeof process.exit;

    const logMock = mock(() => {});
    console.log = logMock as typeof console.log;

    const errMock = mock(() => {});
    console.error = errMock as typeof console.error;

    await expect(
      ghaCommand('example.com', { baseline: 'baseline.json', workflow: true, permissions: 'write-all' } as any),
    ).rejects.toThrow('EXIT_2');

    expect(logMock).toHaveBeenCalledTimes(0);
    expect(errMock).toHaveBeenCalledTimes(1);
    expect(String((errMock as any).mock.calls[0][0])).toBe('WORKFLOW_PERMISSIONS_INVALID');
  });

  test('workflow + --permissions minimal: emits fixture', async () => {
    const logMock = mock(() => {});
    console.log = logMock as typeof console.log;

    await ghaCommand('example.com', {
      baseline: 'baseline.json',
      workflow: true,
      permissions: 'minimal',
    } as any);

    expect(logMock).toHaveBeenCalledTimes(1);
    expect(String((logMock as any).mock.calls[0][0])).toBe(
      await readFixture('workflow-permissions-minimal.yml'),
    );
  });

  test('workflow + --concurrency + --permissions minimal: emits fixture', async () => {
    const logMock = mock(() => {});
    console.log = logMock as typeof console.log;

    await ghaCommand('example.com', {
      baseline: 'baseline.json',
      workflow: true,
      concurrency: 'specs-ci-example',
      permissions: 'minimal',
    } as any);

    expect(logMock).toHaveBeenCalledTimes(1);
    expect(String((logMock as any).mock.calls[0][0])).toBe(
      await readFixture('workflow-concurrency-permissions-minimal.yml'),
    );
  });

  test('--runs-on without --workflow: exits 2 and prints deterministic stderr', async () => {
    const exitMock = mock((code?: number) => {
      throw new Error(`EXIT_${code ?? 'undefined'}`);
    });
    process.exit = exitMock as typeof process.exit;

    const logMock = mock(() => {});
    console.log = logMock as typeof console.log;

    const errMock = mock(() => {});
    console.error = errMock as typeof console.error;

    await expect(
      ghaCommand('example.com', { baseline: 'baseline.json', runsOn: 'foo' } as any),
    ).rejects.toThrow('EXIT_2');

    expect(logMock).toHaveBeenCalledTimes(0);
    expect(errMock).toHaveBeenCalledTimes(1);
    expect(String((errMock as any).mock.calls[0][0])).toBe('WORKFLOW_RUNS_ON_REQUIRES_WORKFLOW');
  });

  test('--concurrency without --workflow: exits 2 and prints deterministic stderr', async () => {
    const exitMock = mock((code?: number) => {
      throw new Error(`EXIT_${code ?? 'undefined'}`);
    });
    process.exit = exitMock as typeof process.exit;

    const logMock = mock(() => {});
    console.log = logMock as typeof console.log;

    const errMock = mock(() => {});
    console.error = errMock as typeof console.error;

    await expect(
      ghaCommand('example.com', { baseline: 'baseline.json', concurrency: 'specs-ci-example' } as any),
    ).rejects.toThrow('EXIT_2');

    expect(logMock).toHaveBeenCalledTimes(0);
    expect(errMock).toHaveBeenCalledTimes(1);
    expect(String((errMock as any).mock.calls[0][0])).toBe('WORKFLOW_CONCURRENCY_REQUIRES_WORKFLOW');
  });

  test('--node-version without --workflow: exits 2 and prints deterministic stderr', async () => {
    const exitMock = mock((code?: number) => {
      throw new Error(`EXIT_${code ?? 'undefined'}`);
    });
    process.exit = exitMock as typeof process.exit;

    const logMock = mock(() => {});
    console.log = logMock as typeof console.log;

    const errMock = mock(() => {});
    console.error = errMock as typeof console.error;

    await expect(
      ghaCommand('example.com', { baseline: 'baseline.json', nodeVersion: '20' } as any),
    ).rejects.toThrow('EXIT_2');

    expect(logMock).toHaveBeenCalledTimes(0);
    expect(errMock).toHaveBeenCalledTimes(1);
    expect(String((errMock as any).mock.calls[0][0])).toBe('WORKFLOW_NODE_VERSION_REQUIRES_WORKFLOW');
  });

  test('workflow + --concurrency blank: exits 2 and prints deterministic stderr', async () => {
    const exitMock = mock((code?: number) => {
      throw new Error(`EXIT_${code ?? 'undefined'}`);
    });
    process.exit = exitMock as typeof process.exit;

    const logMock = mock(() => {});
    console.log = logMock as typeof console.log;

    const errMock = mock(() => {});
    console.error = errMock as typeof console.error;

    await expect(
      ghaCommand('example.com', { baseline: 'baseline.json', workflow: true, concurrency: '   ' } as any),
    ).rejects.toThrow('EXIT_2');

    expect(logMock).toHaveBeenCalledTimes(0);
    expect(errMock).toHaveBeenCalledTimes(1);
    expect(String((errMock as any).mock.calls[0][0])).toBe('WORKFLOW_CONCURRENCY_INVALID');
  });

  test('workflow + --node-version blank: exits 2 and prints deterministic stderr', async () => {
    const exitMock = mock((code?: number) => {
      throw new Error(`EXIT_${code ?? 'undefined'}`);
    });
    process.exit = exitMock as typeof process.exit;

    const logMock = mock(() => {});
    console.log = logMock as typeof console.log;

    const errMock = mock(() => {});
    console.error = errMock as typeof console.error;

    await expect(
      ghaCommand('example.com', { baseline: 'baseline.json', workflow: true, nodeVersion: '   ' } as any),
    ).rejects.toThrow('EXIT_2');

    expect(logMock).toHaveBeenCalledTimes(0);
    expect(errMock).toHaveBeenCalledTimes(1);
    expect(String((errMock as any).mock.calls[0][0])).toBe('WORKFLOW_NODE_VERSION_INVALID');
  });

  test('workflow + --runs-on blank: exits 2 and prints deterministic stderr', async () => {
    const exitMock = mock((code?: number) => {
      throw new Error(`EXIT_${code ?? 'undefined'}`);
    });
    process.exit = exitMock as typeof process.exit;

    const logMock = mock(() => {});
    console.log = logMock as typeof console.log;

    const errMock = mock(() => {});
    console.error = errMock as typeof console.error;

    await expect(
      ghaCommand('example.com', { baseline: 'baseline.json', workflow: true, runsOn: '   ' } as any),
    ).rejects.toThrow('EXIT_2');

    expect(logMock).toHaveBeenCalledTimes(0);
    expect(errMock).toHaveBeenCalledTimes(1);
    expect(String((errMock as any).mock.calls[0][0])).toBe('WORKFLOW_RUNS_ON_INVALID');
  });

  test('workflow + timeoutMinutes: emits fixture', async () => {
    const logMock = mock(() => {});
    console.log = logMock as typeof console.log;

    await ghaCommand('example.com', {
      baseline: 'baseline.json',
      workflow: true,
      timeoutMinutes: 10,
    } as any);

    expect(logMock).toHaveBeenCalledTimes(1);
    expect(String((logMock as any).mock.calls[0][0])).toBe(
      await readFixture('workflow-timeout-minutes-10.yml'),
    );
  });

  test('--timeout-minutes without --workflow: exits 2 and prints deterministic stderr', async () => {
    const exitMock = mock((code?: number) => {
      throw new Error(`EXIT_${code ?? 'undefined'}`);
    });
    process.exit = exitMock as typeof process.exit;

    const logMock = mock(() => {});
    console.log = logMock as typeof console.log;

    const errMock = mock(() => {});
    console.error = errMock as typeof console.error;

    await expect(
      ghaCommand('example.com', { baseline: 'baseline.json', timeoutMinutes: 10 } as any),
    ).rejects.toThrow('EXIT_2');

    expect(logMock).toHaveBeenCalledTimes(0);
    expect(errMock).toHaveBeenCalledTimes(1);
    expect(String((errMock as any).mock.calls[0][0])).toBe('WORKFLOW_TIMEOUT_MINUTES_REQUIRES_WORKFLOW');
  });

  test('workflow + --timeout-minutes invalid: exits 2 and prints deterministic stderr', async () => {
    const exitMock = mock((code?: number) => {
      throw new Error(`EXIT_${code ?? 'undefined'}`);
    });
    process.exit = exitMock as typeof process.exit;

    const logMock = mock(() => {});
    console.log = logMock as typeof console.log;

    const errMock = mock(() => {});
    console.error = errMock as typeof console.error;

    await expect(
      ghaCommand('example.com', { baseline: 'baseline.json', workflow: true, timeoutMinutes: 0 } as any),
    ).rejects.toThrow('EXIT_2');

    await expect(
      ghaCommand('example.com', { baseline: 'baseline.json', workflow: true, timeoutMinutes: 'abc' } as any),
    ).rejects.toThrow('EXIT_2');

    expect(logMock).toHaveBeenCalledTimes(0);
    expect(errMock).toHaveBeenCalledTimes(2);
    expect(String((errMock as any).mock.calls[0][0])).toBe('WORKFLOW_TIMEOUT_MINUTES_INVALID');
    expect(String((errMock as any).mock.calls[1][0])).toBe('WORKFLOW_TIMEOUT_MINUTES_INVALID');
  });

  test('--pull-request without --workflow: exits 2 and prints deterministic stderr', async () => {
    const exitMock = mock((code?: number) => {
      throw new Error(`EXIT_${code ?? 'undefined'}`);
    });
    process.exit = exitMock as typeof process.exit;

    const logMock = mock(() => {});
    console.log = logMock as typeof console.log;

    const errMock = mock(() => {});
    console.error = errMock as typeof console.error;

    await expect(
      ghaCommand('example.com', { baseline: 'baseline.json', pullRequest: true } as any),
    ).rejects.toThrow('EXIT_2');

    expect(logMock).toHaveBeenCalledTimes(0);
    expect(errMock).toHaveBeenCalledTimes(1);
    expect(String((errMock as any).mock.calls[0][0])).toBe('WORKFLOW_PULL_REQUEST_REQUIRES_WORKFLOW');
  });

  test('--schedule without --workflow: exits 2 and prints deterministic stderr', async () => {
    const exitMock = mock((code?: number) => {
      throw new Error(`EXIT_${code ?? 'undefined'}`);
    });
    process.exit = exitMock as typeof process.exit;

    const logMock = mock(() => {});
    console.log = logMock as typeof console.log;

    const errMock = mock(() => {});
    console.error = errMock as typeof console.error;

    await expect(ghaCommand('example.com', { baseline: 'baseline.json', schedule: '0 3 * * *' } as any)).rejects.toThrow(
      'EXIT_2',
    );

    expect(logMock).toHaveBeenCalledTimes(0);
    expect(errMock).toHaveBeenCalledTimes(1);
    expect(String((errMock as any).mock.calls[0][0])).toBe('WORKFLOW_SCHEDULE_REQUIRES_WORKFLOW');
  });

  test('--push without --workflow: exits 2 and prints deterministic stderr', async () => {
    const exitMock = mock((code?: number) => {
      throw new Error(`EXIT_${code ?? 'undefined'}`);
    });
    process.exit = exitMock as typeof process.exit;

    const logMock = mock(() => {});
    console.log = logMock as typeof console.log;

    const errMock = mock(() => {});
    console.error = errMock as typeof console.error;

    await expect(ghaCommand('example.com', { baseline: 'baseline.json', push: true } as any)).rejects.toThrow('EXIT_2');

    expect(logMock).toHaveBeenCalledTimes(0);
    expect(errMock).toHaveBeenCalledTimes(1);
    expect(String((errMock as any).mock.calls[0][0])).toBe('WORKFLOW_PUSH_REQUIRES_WORKFLOW');
  });

  test('--branch without --workflow: exits 2 and prints deterministic stderr', async () => {
    const exitMock = mock((code?: number) => {
      throw new Error(`EXIT_${code ?? 'undefined'}`);
    });
    process.exit = exitMock as typeof process.exit;

    const logMock = mock(() => {});
    console.log = logMock as typeof console.log;

    const errMock = mock(() => {});
    console.error = errMock as typeof console.error;

    await expect(
      ghaCommand('example.com', { baseline: 'baseline.json', branch: 'main' } as any),
    ).rejects.toThrow('EXIT_2');

    expect(logMock).toHaveBeenCalledTimes(0);
    expect(errMock).toHaveBeenCalledTimes(1);
    expect(String((errMock as any).mock.calls[0][0])).toBe('WORKFLOW_BRANCH_REQUIRES_WORKFLOW');
  });

  test('--name without --workflow: exits 2 and prints deterministic stderr', async () => {
    const exitMock = mock((code?: number) => {
      throw new Error(`EXIT_${code ?? 'undefined'}`);
    });
    process.exit = exitMock as typeof process.exit;

    const logMock = mock(() => {});
    console.log = logMock as typeof console.log;

    const errMock = mock(() => {});
    console.error = errMock as typeof console.error;

    await expect(
      ghaCommand('example.com', { baseline: 'baseline.json', name: 'My Specs CI' } as any),
    ).rejects.toThrow('EXIT_2');

    expect(logMock).toHaveBeenCalledTimes(0);
    expect(errMock).toHaveBeenCalledTimes(1);
    expect(String((errMock as any).mock.calls[0][0])).toBe('WORKFLOW_NAME_REQUIRES_WORKFLOW');
  });

  test('manual without workflow: exits 2 and prints deterministic stderr', async () => {
    const exitMock = mock((code?: number) => {
      throw new Error(`EXIT_${code ?? 'undefined'}`);
    });
    process.exit = exitMock as typeof process.exit;

    const logMock = mock(() => {});
    console.log = logMock as typeof console.log;

    const errMock = mock(() => {});
    console.error = errMock as typeof console.error;

    await expect(
      ghaCommand('example.com', { baseline: 'baseline.json', manual: true } as any),
    ).rejects.toThrow('EXIT_2');

    expect(logMock).toHaveBeenCalledTimes(0);
    expect(errMock).toHaveBeenCalledTimes(1);
    expect(String((errMock as any).mock.calls[0][0])).toBe('WORKFLOW_MANUAL_REQUIRES_WORKFLOW');
  });

  test('workflow + --name: prints workflow YAML with custom top-level name', async () => {
    const logMock = mock(() => {});
    console.log = logMock as typeof console.log;

    await ghaCommand('example.com', {
      baseline: 'baseline.json',
      workflow: true,
      name: 'My Specs CI',
    } as any);

    expect(logMock).toHaveBeenCalledTimes(1);
    expect(String((logMock as any).mock.calls[0][0])).toBe(
      await readFixture('workflow-name-my-specs-ci.yml'),
    );
  });

  test('workflow + manual: prints workflow.yml fixture', async () => {
    const logMock = mock(() => {});
    console.log = logMock as typeof console.log;

    const errMock = mock(() => {});
    console.error = errMock as typeof console.error;

    await ghaCommand('example.com', { baseline: 'baseline.json', workflow: true, manual: true } as any);

    expect(errMock).not.toHaveBeenCalled();
    expect(logMock).toHaveBeenCalledTimes(1);
    expect(String((logMock as any).mock.calls[0][0])).toBe(await readFixture('workflow.yml'));
  });

  test('workflow + schedule: prints full workflow YAML with schedule block', async () => {
    const logMock = mock(() => {});
    console.log = logMock as typeof console.log;

    await ghaCommand('example.com', {
      baseline: 'baseline.json',
      workflow: true,
      schedule: '0 3 * * *',
    } as any);

    expect(logMock).toHaveBeenCalledTimes(1);
    expect(String((logMock as any).mock.calls[0][0])).toBe(
      await readFixture('workflow-schedule.yml'),
    );
  });

  test('workflow + push: prints full workflow YAML with push trigger', async () => {
    const logMock = mock(() => {});
    console.log = logMock as typeof console.log;

    await ghaCommand('example.com', { baseline: 'baseline.json', workflow: true, push: true } as any);

    expect(logMock).toHaveBeenCalledTimes(1);
    expect(String((logMock as any).mock.calls[0][0])).toBe(await readFixture('workflow-push.yml'));
  });

  test('workflow + push + branch: prints YAML with push.branches=[release] and workflow_dispatch', async () => {
    const logMock = mock(() => {});
    console.log = logMock as typeof console.log;

    await ghaCommand('example.com', {
      baseline: 'baseline.json',
      workflow: true,
      push: true,
      branch: 'release',
    } as any);

    expect(logMock).toHaveBeenCalledTimes(1);
    expect(String((logMock as any).mock.calls[0][0])).toBe(await readFixture('workflow-push-branch-release.yml'));
  });

  test('workflow + push + branch=master: prints workflow-push-branch-master.yml fixture', async () => {
    const logMock = mock(() => {});
    console.log = logMock as typeof console.log;

    await ghaCommand('example.com', { baseline: 'baseline.json', workflow: true, push: true, branch: 'master' } as any);

    expect(logMock).toHaveBeenCalledTimes(1);
    expect(String((logMock as any).mock.calls[0][0])).toBe(await readFixture('workflow-push-branch-master.yml'));
  });

  test('workflow + pull-request + branch: prints YAML with pull_request.branches=[release] and workflow_dispatch', async () => {
    const logMock = mock(() => {});
    console.log = logMock as typeof console.log;

    await ghaCommand('example.com', {
      baseline: 'baseline.json',
      workflow: true,
      pullRequest: true,
      branch: 'release',
    } as any);

    expect(logMock).toHaveBeenCalledTimes(1);
    expect(String((logMock as any).mock.calls[0][0])).toBe(await readFixture('workflow-pull-request-branch-release.yml'));
  });

  test('workflow + pull-request + branch=develop: prints workflow-pull-request-branch-develop.yml fixture', async () => {
    const logMock = mock(() => {});
    console.log = logMock as typeof console.log;

    await ghaCommand('example.com', {
      baseline: 'baseline.json',
      workflow: true,
      pullRequest: true,
      branch: 'develop',
    } as any);

    expect(logMock).toHaveBeenCalledTimes(1);
    expect(String((logMock as any).mock.calls[0][0])).toBe(await readFixture('workflow-pull-request-branch-develop.yml'));
  });

  test('workflow + branch (no push/pull-request): prints normal workflow.yml fixture', async () => {
    const logMock = mock(() => {});
    console.log = logMock as typeof console.log;

    await ghaCommand('example.com', { baseline: 'baseline.json', workflow: true, branch: 'release' } as any);

    expect(logMock).toHaveBeenCalledTimes(1);
    expect(String((logMock as any).mock.calls[0][0])).toBe(await readFixture('workflow.yml'));
  });

  test('workflow + schedule + pull-request: prints full workflow YAML with pull_request trigger', async () => {
    const logMock = mock(() => {});
    console.log = logMock as typeof console.log;

    await ghaCommand('example.com', {
      baseline: 'baseline.json',
      workflow: true,
      schedule: '0 3 * * *',
      pullRequest: true,
    } as any);

    expect(logMock).toHaveBeenCalledTimes(1);
    expect(String((logMock as any).mock.calls[0][0])).toBe(await readFixture('workflow-schedule-pull-request.yml'));
  });

  test('workflow + schedule + write: writes YAML with schedule block to disk', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'specs-tests-'));
    const outPath = join(dir, 'workflow.yml');

    const logMock = mock(() => {});
    console.log = logMock as typeof console.log;

    const errMock = mock(() => {});
    console.error = errMock as typeof console.error;

    await ghaCommand('example.com', {
      baseline: 'baseline.json',
      workflow: true,
      schedule: '0 3 * * *',
      write: outPath,
    } as any);

    expect(errMock).toHaveBeenCalledTimes(0);
    expect(logMock).toHaveBeenCalledTimes(1);
    expect(String((logMock as any).mock.calls[0][0])).toBe(`WORKFLOW_SAVED path=${outPath}`);

    const saved = await readFile(outPath, 'utf8');
    expect(saved).toBe(
      await readFixture('workflow-schedule.yml'),
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
      await readFixture('workflow.yml'),
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
    expect(lines).toContain('  run: npx -y @sitespecs/specs@0.1.0 ci example.com --baseline baseline.json --fail-on-diff');
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
    expect(last).toContain('run: npx -y @sitespecs/specs@0.1.0 ci example.com --baseline baseline.json --fail-on-diff');
  });

  test('--job without --workflow: exits 2 and prints deterministic stderr', async () => {
    const exitMock = mock((code?: number) => {
      throw new Error(`EXIT_${code ?? 'undefined'}`);
    });
    process.exit = exitMock as typeof process.exit;

    const logMock = mock(() => {});
    console.log = logMock as typeof console.log;

    const errMock = mock(() => {});
    console.error = errMock as typeof console.error;

    await expect(
      ghaCommand('example.com', { baseline: 'baseline.json', job: 'specs_ci' } as any),
    ).rejects.toThrow('EXIT_2');

    expect(logMock).toHaveBeenCalledTimes(0);
    expect(errMock).toHaveBeenCalledTimes(1);
    expect(String((errMock as any).mock.calls[0][0])).toBe('WORKFLOW_JOB_REQUIRES_WORKFLOW');
  });

  test('workflow + invalid --job id: exits 2 and prints deterministic stderr', async () => {
    const exitMock = mock((code?: number) => {
      throw new Error(`EXIT_${code ?? 'undefined'}`);
    });
    process.exit = exitMock as typeof process.exit;

    const logMock = mock(() => {});
    console.log = logMock as typeof console.log;

    const errMock = mock(() => {});
    console.error = errMock as typeof console.error;

    await expect(
      ghaCommand('example.com', { baseline: 'baseline.json', workflow: true, job: '-bad' } as any),
    ).rejects.toThrow('EXIT_2');

    expect(logMock).toHaveBeenCalledTimes(0);
    expect(errMock).toHaveBeenCalledTimes(1);
    expect(String((errMock as any).mock.calls[0][0])).toBe('WORKFLOW_JOB_INVALID');
  });

  test('--job-name without --workflow: exits 2 and prints deterministic stderr', async () => {
    const exitMock = mock((code?: number) => {
      throw new Error(`EXIT_${code ?? 'undefined'}`);
    });
    process.exit = exitMock as typeof process.exit;

    const logMock = mock(() => {});
    console.log = logMock as typeof console.log;

    const errMock = mock(() => {});
    console.error = errMock as typeof console.error;

    await expect(
      ghaCommand('example.com', { baseline: 'baseline.json', jobName: 'My Specs CI' } as any),
    ).rejects.toThrow('EXIT_2');

    expect(logMock).toHaveBeenCalledTimes(0);
    expect(errMock).toHaveBeenCalledTimes(1);
    expect(String((errMock as any).mock.calls[0][0])).toBe('WORKFLOW_JOB_NAME_REQUIRES_WORKFLOW');
  });

  test('workflow + invalid --job-name: exits 2 and prints deterministic stderr', async () => {
    const exitMock = mock((code?: number) => {
      throw new Error(`EXIT_${code ?? 'undefined'}`);
    });
    process.exit = exitMock as typeof process.exit;

    const logMock = mock(() => {});
    console.log = logMock as typeof console.log;

    const errMock = mock(() => {});
    console.error = errMock as typeof console.error;

    await expect(
      ghaCommand('example.com', { baseline: 'baseline.json', workflow: true, jobName: '' } as any),
    ).rejects.toThrow('EXIT_2');

    await expect(
      ghaCommand('example.com', { baseline: 'baseline.json', workflow: true, jobName: 'a'.repeat(65) } as any),
    ).rejects.toThrow('EXIT_2');

    expect(logMock).toHaveBeenCalledTimes(0);
    expect(errMock).toHaveBeenCalledTimes(2);
    expect(String((errMock as any).mock.calls[0][0])).toBe('WORKFLOW_JOB_NAME_INVALID');
    expect(String((errMock as any).mock.calls[1][0])).toBe('WORKFLOW_JOB_NAME_INVALID');
  });

  test('workflow + --job specs_ci: prints workflow YAML with custom job id', async () => {
    const logMock = mock(() => {});
    console.log = logMock as typeof console.log;

    await ghaCommand('example.com', {
      baseline: 'baseline.json',
      workflow: true,
      job: 'specs_ci',
    } as any);

    expect(logMock).toHaveBeenCalledTimes(1);
    expect(String((logMock as any).mock.calls[0][0])).toBe(
      await readFixture('workflow-job-custom-id.yml'),
    );
  });

  test('workflow + --job-name \"My Specs CI\": prints workflow YAML with custom job name', async () => {
    const logMock = mock(() => {});
    console.log = logMock as typeof console.log;

    await ghaCommand('example.com', {
      baseline: 'baseline.json',
      workflow: true,
      jobName: 'My Specs CI',
    } as any);

    expect(logMock).toHaveBeenCalledTimes(1);
    expect(String((logMock as any).mock.calls[0][0])).toBe(
      await readFixture('workflow-job-custom-name.yml'),
    );
  });
});
