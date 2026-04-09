import { describe, expect, test } from "bun:test";

import type { AnalysisDns, AnalysisRedirects, AnalysisResponse, AnalysisTls } from "@sitespecs/contracts";

import { analyzeUrl } from "../src/analyze-url";

function createBrowserSnapshot(finalUrl: string) {
  return {
    finalUrl,
    html: "<html><head><title>Example</title></head><body>Hello</body></html>",
    title: "Example",
    description: "Example description",
    canonicalUrl: finalUrl,
    robots: "index,follow",
    sitemapUrls: ["https://example.com/sitemap.xml"],
    performance: {
      domContentLoadedMs: 120,
      loadEventMs: 240,
    },
  };
}

function createHttpPass(finalUrl: string): {
  analysis: AnalysisResponse;
  finalUrl: string;
  html: string;
  headers: Record<string, string>;
  technologies: [];
} {
  return {
    analysis: {
      domain: "example.com",
      url: finalUrl,
      status: "online",
      technologies: [],
      requested: {
        input: "example.com",
        url: "https://example.com",
        host: "example.com",
      },
      seo: {
        score: 90,
        title: "Example",
        description: "Example description",
        hasSSL: true,
        mobileOptimized: true,
        wordCount: 100,
      },
      performance: {
        responseTime: 100,
        pageSize: 1024,
        statusCode: 200,
      },
      lastAnalyzed: "2026-04-08T00:00:00.000Z",
    },
    finalUrl,
    html: "<html><head><title>Example</title></head><body>Hello</body></html>",
    headers: {
      "content-type": "text/html",
    },
    technologies: [],
  };
}

function noNetworkArtifacts(): Promise<{ dns?: AnalysisDns; tls?: AnalysisTls }> {
  return Promise.resolve({});
}

describe("analyzeUrl redirect metadata", () => {
  test("includes requested and redirects metadata when redirect tracing succeeds", async () => {
    const redirects: AnalysisRedirects = {
      occurred: false,
      finalUrl: "https://example.com",
      finalHost: "example.com",
      chain: [{ url: "https://example.com", host: "example.com", statusCode: 200 }],
      condensedChain: "https://example.com",
    };

    const result = await analyzeUrl("example.com", {
      browserAnalyzer: async () => createBrowserSnapshot("https://example.com"),
      httpAnalyzer: async () => createHttpPass("https://example.com"),
      redirectTracer: async () => redirects,
      networkArtifactAnalyzer: noNetworkArtifacts,
    });

    expect(result.requested).toEqual({
      input: "example.com",
      url: "https://example.com",
      host: "example.com",
    });
    expect(result.redirects).toEqual(redirects);
  });

  test("omits redirect metadata when tracing fails but analysis still succeeds", async () => {
    const result = await analyzeUrl("example.com", {
      browserAnalyzer: async () => createBrowserSnapshot("https://example.com"),
      httpAnalyzer: async () => createHttpPass("https://example.com"),
      redirectTracer: async () => {
        throw new Error("redirect trace failed");
      },
      networkArtifactAnalyzer: noNetworkArtifacts,
    });

    expect(result.requested).toEqual({
      input: "example.com",
      url: "https://example.com",
      host: "example.com",
    });
    expect(result.redirects).toBeUndefined();
    expect(result.execution).toMatchObject({
      mode: "local",
      engine: "agent-browser+http",
      degraded: false,
    });
  });
});
