import { afterEach, describe, expect, test, vi } from "bun:test";

import { AgentBrowserError, analyzeWithAgentBrowser } from "../src/agent-browser";

describe("agent-browser wrapper", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  test("uses domcontentloaded fallback when networkidle fails and returns the parsed snapshot", async () => {
    const executor = vi.fn(async (args: string[], options?: { input?: string }) => {
      if (args.includes("open")) {
        return { stdout: "", stderr: "" };
      }

      if (args.includes("wait") && args.includes("networkidle")) {
        throw Object.assign(new Error("networkidle timed out"), { stderr: "networkidle timed out" });
      }

      if (args.includes("wait") && args.includes("domcontentloaded")) {
        return { stdout: "", stderr: "" };
      }

      if (args.includes("eval")) {
        expect(options?.input).toContain("document.documentElement?.outerHTML");
        return {
          stdout: JSON.stringify({
            success: true,
            data: {
              result: {
                finalUrl: "https://example.com/final",
                html: "<html><head><title>Example</title></head><body>Hello</body></html>",
                title: "Example",
                description: "Example description",
                canonicalUrl: "https://example.com/final",
                robots: "index,follow",
                sitemapUrls: ["https://example.com/sitemap.xml"],
                performance: {
                  domContentLoadedMs: 120,
                  loadEventMs: 240,
                },
              },
            },
          }),
          stderr: "",
        };
      }

      return { stdout: "", stderr: "" };
    });

    const snapshot = await analyzeWithAgentBrowser("https://example.com", {
      executor,
      bin: "agent-browser",
    });

    expect(snapshot).toEqual({
      finalUrl: "https://example.com/final",
      html: "<html><head><title>Example</title></head><body>Hello</body></html>",
      title: "Example",
      description: "Example description",
      canonicalUrl: "https://example.com/final",
      robots: "index,follow",
      sitemapUrls: ["https://example.com/sitemap.xml"],
      performance: {
        domContentLoadedMs: 120,
        loadEventMs: 240,
      },
    });
    expect(executor).toHaveBeenCalled();
  });

  test("classifies ENOENT as a missing agent-browser dependency", async () => {
    const executor = vi.fn(async () => {
      throw Object.assign(new Error("spawn agent-browser ENOENT"), { code: "ENOENT" });
    });

    await expect(
      analyzeWithAgentBrowser("https://example.com", {
        executor,
        bin: "agent-browser",
      }),
    ).rejects.toMatchObject({
      name: "AgentBrowserError",
      kind: "missing",
    } satisfies Partial<AgentBrowserError>);
  });

  test("falls back to a later candidate bin when the first one is missing", async () => {
    const executor = vi.fn(async (args: string[], options?: { input?: string; bin?: string }) => {
      if (options?.bin === "agent-browser") {
        throw Object.assign(new Error("spawn agent-browser ENOENT"), { code: "ENOENT" });
      }

      if (args.includes("open")) {
        return { stdout: "", stderr: "" };
      }

      if (args.includes("wait")) {
        return { stdout: "", stderr: "" };
      }

      if (args.includes("eval")) {
        expect(options?.bin).toBe("/tmp/bundled-agent-browser");
        return {
          stdout: JSON.stringify({
            success: true,
            data: {
              result: {
                finalUrl: "https://example.com",
                html: "<html><body>Example</body></html>",
                sitemapUrls: [],
                performance: {},
              },
            },
          }),
          stderr: "",
        };
      }

      return { stdout: "", stderr: "" };
    });

    const snapshot = await analyzeWithAgentBrowser("https://example.com", {
      executor,
      binCandidates: ["agent-browser", "/tmp/bundled-agent-browser"],
    });

    expect(snapshot.finalUrl).toBe("https://example.com");
    expect(executor).toHaveBeenCalled();
  });

  test("classifies browser runtime installation failures with install guidance", async () => {
    const executor = vi.fn(async (args: string[]) => {
      if (args.includes("close")) {
        return { stdout: "", stderr: "" };
      }

      throw Object.assign(new Error("failed to launch"), {
        stderr: "failed to launch browser executable. install browser binaries first",
      });
    });

    await expect(
      analyzeWithAgentBrowser("https://example.com", {
        executor,
        bin: "agent-browser",
      }),
    ).rejects.toMatchObject({
      name: "AgentBrowserError",
      kind: "runtime",
      message: expect.stringContaining("agent-browser install"),
    });
  });

  test("classifies missing shared libraries as a Linux runtime dependency error", async () => {
    const executor = vi.fn(async (args: string[]) => {
      if (args.includes("close")) {
        return { stdout: "", stderr: "" };
      }

      throw Object.assign(new Error("Chrome exited early"), {
        stderr:
          "chrome: error while loading shared libraries: libnspr4.so: cannot open shared object file: No such file or directory",
      });
    });

    await expect(
      analyzeWithAgentBrowser("https://example.com", {
        executor,
        bin: "agent-browser",
      }),
    ).rejects.toMatchObject({
      name: "AgentBrowserError",
      kind: "runtime",
      message: expect.stringContaining("install --with-deps"),
    });
  });

  test("classifies navigation timeouts separately from generic command failures", async () => {
    const executor = vi.fn(async (args: string[]) => {
      if (args.includes("open")) {
        return { stdout: "", stderr: "" };
      }

      if (args.includes("wait")) {
        throw Object.assign(new Error("timed out"), {
          killed: true,
        });
      }

      return { stdout: "", stderr: "" };
    });

    await expect(
      analyzeWithAgentBrowser("https://example.com", {
        executor,
        bin: "agent-browser",
      }),
    ).rejects.toMatchObject({
      name: "AgentBrowserError",
      kind: "navigation",
    } satisfies Partial<AgentBrowserError>);
  });
});
