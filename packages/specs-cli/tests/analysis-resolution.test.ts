import { afterEach, describe, expect, test, vi } from "bun:test";

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

function createHostedResult(overrides: Record<string, unknown> = {}) {
  return {
    analysis: {
      domain: "example.com",
      url: "https://example.com",
      status: "online" as const,
      technologies: [],
    },
    pending: false,
    completed: true,
    ...overrides,
  };
}

describe("resolveAnalysis", () => {
  afterEach(() => {
    vi.restoreAllMocks();
    vi.resetModules();
  });

  test("defaults to local analysis when no mode is provided", async () => {
    const analyzeUrl = vi.fn(async () => createLocalAnalysis());
    const fetchHostedAnalysis = vi.fn();

    vi.doMock("@sitespecs/analyzer-core", () => ({ analyzeUrl }));
    vi.doMock("../src/lib/api.js", () => ({ fetchHostedAnalysis }));

    const { resolveAnalysis } = await import("../src/lib/analysis");
    const result = await resolveAnalysis("example.com");

    expect(analyzeUrl).toHaveBeenCalledWith("example.com");
    expect(fetchHostedAnalysis).not.toHaveBeenCalled();
    expect(result.execution?.mode).toBe("local");
    expect(result.execution?.enrichmentStatus).toBe("none");
  });

  test("adds pending hosted enrichment without replacing the local result", async () => {
    const analyzeUrl = vi.fn(async () => createLocalAnalysis());
    const fetchHostedAnalysis = vi.fn(async () =>
      createHostedResult({
        pending: true,
        completed: false,
        jobId: "job_123",
        statusUrl: "https://sitespecs.com/api/public/analyze/status?jobId=job_123",
        message: "Scan initiated.",
      }),
    );

    vi.doMock("@sitespecs/analyzer-core", () => ({ analyzeUrl }));
    vi.doMock("../src/lib/api.js", () => ({ fetchHostedAnalysis }));

    const { resolveAnalysis } = await import("../src/lib/analysis");
    const result = await resolveAnalysis("example.com", { enrich: true });

    expect(result.execution?.mode).toBe("local");
    expect(result.execution?.enrichmentStatus).toBe("pending");
    expect(result.enrichment?.sitespecs?.status).toBe("pending");
    expect(result.enrichment?.sitespecs?.jobId).toBe("job_123");
    expect(result.enrichment?.sitespecs?.analysis?.execution?.mode).toBe("cloud");
  });

  test("records enrichment failure without failing the local analysis", async () => {
    const analyzeUrl = vi.fn(async () => createLocalAnalysis());
    const fetchHostedAnalysis = vi.fn(async () => {
      throw new Error("Rate limited: SiteSpecs API throttled this request (HTTP 429)");
    });

    vi.doMock("@sitespecs/analyzer-core", () => ({ analyzeUrl }));
    vi.doMock("../src/lib/api.js", () => ({ fetchHostedAnalysis }));

    const { resolveAnalysis } = await import("../src/lib/analysis");
    const result = await resolveAnalysis("example.com", { enrich: true });

    expect(result.execution?.mode).toBe("local");
    expect(result.execution?.enrichmentStatus).toBe("failed");
    expect(result.enrichment?.sitespecs?.status).toBe("failed");
    expect(result.enrichment?.sitespecs?.error).toContain("Rate limited:");
  });

  test("legacy cloud mode waits for hosted completion and fails when it stays pending", async () => {
    const analyzeUrl = vi.fn(async () => createLocalAnalysis());
    const fetchHostedAnalysis = vi.fn(async () =>
      createHostedResult({
        pending: true,
        completed: false,
        jobId: "job_789",
      }),
    );

    vi.doMock("@sitespecs/analyzer-core", () => ({ analyzeUrl }));
    vi.doMock("../src/lib/api.js", () => ({ fetchHostedAnalysis }));

    const { resolveAnalysis } = await import("../src/lib/analysis");

    await expect(resolveAnalysis("example.com", { mode: "cloud" })).rejects.toThrow(
      "Cloud analysis timed out: SiteSpecs scan is still processing (job job_789). Retry shortly or use --enrich for local-first output.",
    );
    expect(analyzeUrl).not.toHaveBeenCalled();
  });
});
