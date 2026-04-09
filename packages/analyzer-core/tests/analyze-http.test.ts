import { afterEach, describe, expect, test, vi } from "bun:test";

import { traceRedirects } from "../src/analyze-http";

describe("traceRedirects", () => {
  const originalFetch = global.fetch;

  afterEach(() => {
    global.fetch = originalFetch;
    vi.restoreAllMocks();
  });

  test("captures a cross-domain redirect chain and builds a host-level condensed chain", async () => {
    global.fetch = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      expect(init?.method).toBe("HEAD");
      const url = String(input);

      if (url === "https://linear.com") {
        return new Response(null, {
          status: 301,
          headers: { location: "https://www.linear.com" },
        });
      }

      if (url === "https://www.linear.com" || url === "https://www.linear.com/") {
        return new Response(null, {
          status: 301,
          headers: { location: "https://www.analog.com/en/index.html" },
        });
      }

      return new Response("<html></html>", {
        status: 200,
        headers: { "content-type": "text/html" },
      });
    }) as typeof fetch;

    const result = await traceRedirects("https://linear.com");

    expect(result).toEqual({
      occurred: true,
      finalUrl: "https://www.analog.com/en/index.html",
      finalHost: "www.analog.com",
      chain: [
        { url: "https://linear.com", host: "linear.com", statusCode: 301 },
        { url: "https://www.linear.com/", host: "www.linear.com", statusCode: 301 },
        { url: "https://www.analog.com/en/index.html", host: "www.analog.com", statusCode: 200 },
      ],
      condensedChain: "linear.com -> www.linear.com -> analog.com",
    });
  });

  test("returns a partial redirect chain when the final landing host times out after earlier redirects", async () => {
    global.fetch = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      expect(init?.method).toBe("HEAD");
      const url = String(input);

      if (url === "https://linear.com") {
        return new Response(null, {
          status: 301,
          headers: { location: "https://www.linear.com/" },
        });
      }

      if (url === "https://www.linear.com/") {
        return new Response(null, {
          status: 301,
          headers: { location: "https://www.analog.com" },
        });
      }

      throw new DOMException("This operation was aborted", "AbortError");
    }) as typeof fetch;

    const result = await traceRedirects("https://linear.com");

    expect(result).toEqual({
      occurred: true,
      finalUrl: "https://www.analog.com/",
      finalHost: "www.analog.com",
      chain: [
        { url: "https://linear.com", host: "linear.com", statusCode: 301 },
        { url: "https://www.linear.com/", host: "www.linear.com", statusCode: 301 },
        { url: "https://www.analog.com/", host: "www.analog.com" },
      ],
      condensedChain: "linear.com -> www.linear.com -> analog.com",
    });
  });

  test("uses URL-level condensation for same-host scheme upgrades", async () => {
    global.fetch = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      expect(init?.method).toBe("HEAD");
      const url = String(input);

      if (url === "http://example.com") {
        return new Response(null, {
          status: 301,
          headers: { location: "https://example.com" },
        });
      }

      return new Response("<html></html>", {
        status: 200,
        headers: { "content-type": "text/html" },
      });
    }) as typeof fetch;

    const result = await traceRedirects("http://example.com");

    expect(result.occurred).toBe(true);
    expect(result.condensedChain).toBe("http://example.com -> https://example.com");
    expect(result.chain).toEqual([
      { url: "http://example.com", host: "example.com", statusCode: 301 },
      { url: "https://example.com/", host: "example.com", statusCode: 200 },
    ]);
  });

  test("falls back to GET when the target does not support HEAD", async () => {
    const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);

      if (url === "https://headless.example" && init?.method === "HEAD") {
        return new Response(null, { status: 405 });
      }

      if (url === "https://headless.example" && init?.method === "GET") {
        return new Response("<html></html>", {
          status: 200,
          headers: { "content-type": "text/html" },
        });
      }

      throw new Error(`Unexpected request: ${init?.method} ${url}`);
    });
    global.fetch = fetchMock as typeof fetch;

    const result = await traceRedirects("https://headless.example");

    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(result).toEqual({
      occurred: false,
      finalUrl: "https://headless.example",
      finalHost: "headless.example",
      chain: [{ url: "https://headless.example", host: "headless.example", statusCode: 200 }],
      condensedChain: "https://headless.example",
    });
  });
});
