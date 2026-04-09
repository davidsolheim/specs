import { afterEach, expect, test, vi } from "bun:test";
import { mkdtemp, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

function createLocalAnalysis() {
  return {
    domain: "example.com",
    url: "https://example.com",
    status: "online" as const,
    technologies: [],
    execution: {
      mode: "local" as const,
      engine: "http" as const,
      degraded: true,
      fallbackReason: "agent-browser is not installed or not available on PATH",
      enrichmentStatus: "none" as const,
    },
  };
}

function createLocalRuntimeDependencyFailure() {
  return new Error(
    "Local analysis failed: fetch failed. Browser pass also failed: agent-browser is installed, but local Linux browser dependencies are missing. Run `agent-browser install --with-deps`.",
  );
}

const originalConsoleLog = console.log;
const originalConsoleError = console.error;
const originalProcessExit = process.exit;

afterEach(() => {
  console.log = originalConsoleLog;
  console.error = originalConsoleError;
  process.exit = originalProcessExit;
  vi.restoreAllMocks();
  vi.resetModules();
});

test("analyze command defaults to local mode when --mode is omitted", async () => {
  const resolveAnalysis = vi.fn(async () => createLocalAnalysis());
  vi.doMock("../src/lib/analysis.js", () => ({ resolveAnalysis }));

  const { analyzeCommand } = await import("../src/commands/analyze");
  const logMock = vi.fn();
  const errorMock = vi.fn();

  console.log = logMock as typeof console.log;
  console.error = errorMock as typeof console.error;

  await analyzeCommand("example.com", { summaryJson: true });

  expect(resolveAnalysis).toHaveBeenCalledWith("example.com", {
    mode: undefined,
    enrich: undefined,
  });
  expect(errorMock).not.toHaveBeenCalled();
  expect(JSON.parse(String(logMock.mock.calls[0][0]))).toMatchObject({
    execution_mode: "local",
    execution_engine: "http",
    degraded: true,
    enrichment_status: "none",
  });
});

test("baseline command defaults to local mode when --mode is omitted", async () => {
  const resolveAnalysis = vi.fn(async () => createLocalAnalysis());
  vi.doMock("../src/lib/analysis.js", () => ({ resolveAnalysis }));

  const { baselineCommand } = await import("../src/commands/baseline");
  const logMock = vi.fn();
  const errorMock = vi.fn();

  console.log = logMock as typeof console.log;
  console.error = errorMock as typeof console.error;

  await baselineCommand("example.com", { stdout: true });

  expect(resolveAnalysis).toHaveBeenCalledWith("example.com", {
    mode: undefined,
    enrich: undefined,
  });
  expect(errorMock).not.toHaveBeenCalled();
  expect(JSON.parse(String(logMock.mock.calls[0][0]))).toMatchObject({
    execution: {
      mode: "local",
      engine: "http",
      degraded: true,
      enrichmentStatus: "none",
    },
  });
});

test("ci command defaults to local mode when --mode is omitted", async () => {
  const resolveAnalysis = vi.fn(async () => createLocalAnalysis());
  vi.doMock("../src/lib/analysis.js", () => ({ resolveAnalysis }));

  const { ciCommand } = await import("../src/commands/ci");
  const logMock = vi.fn();
  const errorMock = vi.fn();

  console.log = logMock as typeof console.log;
  console.error = errorMock as typeof console.error;

  const dir = await mkdtemp(join(tmpdir(), "specs-local-default-"));
  const baselinePath = join(dir, "baseline.json");
  await writeFile(
    baselinePath,
    JSON.stringify({
      domain: "example.com",
      url: "https://example.com",
      status: "online",
      technologies: [],
    }),
    "utf8",
  );

  await ciCommand("example.com", { baseline: baselinePath });

  expect(resolveAnalysis).toHaveBeenCalledWith("example.com", {
    mode: undefined,
    enrich: undefined,
  });
  expect(errorMock).not.toHaveBeenCalled();
  expect(JSON.parse(String(logMock.mock.calls[0][0]))).toMatchObject({
    execution_mode: "local",
    execution_engine: "http",
    degraded: true,
    enrichment_status: "none",
  });
});

test("analyze summary-json reports local runtime dependency errors precisely", async () => {
  const resolveAnalysis = vi.fn(async () => {
    throw createLocalRuntimeDependencyFailure();
  });
  vi.doMock("../src/lib/analysis.js", () => ({ resolveAnalysis }));

  const { analyzeCommand } = await import("../src/commands/analyze");
  const logMock = vi.fn();
  const errorMock = vi.fn();
  const exitMock = vi.fn((code?: number) => {
    throw new Error(`EXIT_${code ?? "undefined"}`);
  });

  console.log = logMock as typeof console.log;
  console.error = errorMock as typeof console.error;
  process.exit = exitMock as typeof process.exit;

  await expect(analyzeCommand("example.com", { summaryJson: true })).rejects.toThrow("EXIT_1");

  expect(resolveAnalysis).toHaveBeenCalledWith("example.com", {
    mode: undefined,
    enrich: undefined,
  });
  expect(errorMock).not.toHaveBeenCalled();
  expect(JSON.parse(String(logMock.mock.calls[0][0]))).toMatchObject({
    ok: false,
    domain: "example.com",
    exit: 1,
    error: "local_runtime_dependency_error",
  });
});

test("baseline command reports local runtime dependency errors precisely", async () => {
  const resolveAnalysis = vi.fn(async () => {
    throw createLocalRuntimeDependencyFailure();
  });
  vi.doMock("../src/lib/analysis.js", () => ({ resolveAnalysis }));

  const { baselineCommand } = await import("../src/commands/baseline");
  const logMock = vi.fn();
  const errorMock = vi.fn();
  const exitMock = vi.fn((code?: number) => {
    throw new Error(`EXIT_${code ?? "undefined"}`);
  });

  console.log = logMock as typeof console.log;
  console.error = errorMock as typeof console.error;
  process.exit = exitMock as typeof process.exit;

  await expect(baselineCommand("example.com", { stdout: true })).rejects.toThrow("EXIT_1");

  expect(resolveAnalysis).toHaveBeenCalledWith("example.com", {
    mode: undefined,
    enrich: undefined,
  });
  expect(logMock).not.toHaveBeenCalled();
  expect(errorMock).toHaveBeenCalledWith(
    "BASELINE_FETCH_FAILED error=local_runtime_dependency_error",
  );
});

test("ci command reports local runtime dependency errors precisely", async () => {
  const resolveAnalysis = vi.fn(async () => {
    throw createLocalRuntimeDependencyFailure();
  });
  vi.doMock("../src/lib/analysis.js", () => ({ resolveAnalysis }));

  const { ciCommand } = await import("../src/commands/ci");
  const logMock = vi.fn();
  const errorMock = vi.fn();
  const exitMock = vi.fn((code?: number) => {
    throw new Error(`EXIT_${code ?? "undefined"}`);
  });

  console.log = logMock as typeof console.log;
  console.error = errorMock as typeof console.error;
  process.exit = exitMock as typeof process.exit;

  const dir = await mkdtemp(join(tmpdir(), "specs-local-runtime-"));
  const baselinePath = join(dir, "baseline.json");
  await writeFile(
    baselinePath,
    JSON.stringify({
      domain: "example.com",
      url: "https://example.com",
      status: "online",
      technologies: [],
    }),
    "utf8",
  );

  await expect(ciCommand("example.com", { baseline: baselinePath })).rejects.toThrow("EXIT_1");

  expect(resolveAnalysis).toHaveBeenCalledWith("example.com", {
    mode: undefined,
    enrich: undefined,
  });
  expect(errorMock).not.toHaveBeenCalled();
  expect(JSON.parse(String(logMock.mock.calls[0][0]))).toMatchObject({
    ok: false,
    domain: "example.com",
    exit: 1,
    error: "local_runtime_dependency_error",
  });
});
