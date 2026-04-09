import { afterEach, describe, expect, mock, test } from "bun:test";

import { fetchHostedAnalysis } from "../src/lib/api";

describe("fetchHostedAnalysis polling", () => {
  const originalFetch = global.fetch;
  const originalSetTimeout = globalThis.setTimeout;
  const originalDateNow = Date.now;

  afterEach(() => {
    global.fetch = originalFetch;
    (globalThis as typeof globalThis & { setTimeout: typeof setTimeout }).setTimeout = originalSetTimeout;
    Date.now = originalDateNow;
    mock.restore();
  });

  test("returns cached hosted analysis without polling", async () => {
    const fetchMock = mock(async () =>
      new Response(
        JSON.stringify({
          success: true,
          cached: true,
          scannedAt: "2026-04-08T00:00:00.000Z",
          data: {
            domain: "example.com",
            url: "https://example.com",
            status: "online",
            technologies: [],
          },
        }),
        { status: 200 },
      ),
    );
    global.fetch = fetchMock as typeof fetch;

    const result = await fetchHostedAnalysis("example.com");

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(result.pending).toBe(false);
    expect(result.completed).toBe(true);
    expect(result.cached).toBe(true);
    expect(result.scannedAt).toBe("2026-04-08T00:00:00.000Z");
    expect(result.analysis).toMatchObject({
      domain: "example.com",
      status: "online",
    });
  });

  test("polls a queued hosted analysis until completion", async () => {
    const setTimeoutMock = mock((handler: (...args: any[]) => void) => {
      handler();
      return 1 as unknown as Timer;
    });
    (globalThis as typeof globalThis & { setTimeout: typeof setTimeout }).setTimeout = setTimeoutMock as typeof setTimeout;

    const fetchMock = mock(async (input: RequestInfo | URL) => {
      const url = String(input);
      if (fetchMock.mock.calls.length === 1) {
        expect(url).toContain("/api/public/analyze?url=https%3A%2F%2Fexample.com");
        return new Response(
          JSON.stringify({
            success: true,
            cached: false,
            scanning: true,
            jobId: "job_123",
            statusUrl: "/api/public/analyze/status?jobId=job_123",
            message: "Scan initiated.",
            data: {
              domain: "example.com",
              url: "https://example.com",
              status: "analyzing",
              technologies: [],
              analyzing: true,
            },
          }),
          { status: 200 },
        );
      }

      expect(url).toBe("https://sitespecs.com/api/public/analyze/status?jobId=job_123");
      return new Response(
        JSON.stringify({
          success: true,
          jobId: "job_123",
          status: "completed",
          completed: true,
          data: {
            domain: "example.com",
            url: "https://example.com",
            status: "online",
            technologies: [{ name: "Next.js", category: "javascript-framework", confidence: "high" }],
          },
        }),
        { status: 200 },
      );
    });
    global.fetch = fetchMock as typeof fetch;

    const result = await fetchHostedAnalysis("example.com", {
      pollIntervalMs: 2_000,
      timeoutMs: 10_000,
    });

    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(setTimeoutMock).toHaveBeenCalledTimes(1);
    expect(result.pending).toBe(false);
    expect(result.completed).toBe(true);
    expect(result.jobId).toBe("job_123");
    expect(result.analysis.technologies).toHaveLength(1);
  });

  test("returns a pending hosted analysis when the polling budget is exhausted", async () => {
    let now = 0;
    Date.now = () => now;
    const setTimeoutMock = mock((handler: (...args: any[]) => void, timeout?: number) => {
      now += Number(timeout ?? 0);
      handler();
      return 1 as unknown as Timer;
    });
    (globalThis as typeof globalThis & { setTimeout: typeof setTimeout }).setTimeout = setTimeoutMock as typeof setTimeout;

    const fetchMock = mock(async () =>
      new Response(
        JSON.stringify({
          success: true,
          cached: false,
          scanning: true,
          jobId: "job_456",
          statusUrl: "/api/public/analyze/status?jobId=job_456",
          message: "Still processing.",
          data: {
            domain: "example.com",
            url: "https://example.com",
            status: "analyzing",
            technologies: [],
            analyzing: true,
          },
        }),
        { status: 200 },
      ),
    );
    global.fetch = fetchMock as typeof fetch;

    const result = await fetchHostedAnalysis("example.com", {
      pollIntervalMs: 2_000,
      timeoutMs: 2_000,
    });

    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(result.pending).toBe(true);
    expect(result.completed).toBe(false);
    expect(result.jobId).toBe("job_456");
    expect(result.statusUrl).toBe("https://sitespecs.com/api/public/analyze/status?jobId=job_456");
  });
});
