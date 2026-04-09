import { execFile } from "node:child_process";
import { randomUUID } from "node:crypto";
import { existsSync, readFileSync } from "node:fs";
import { createRequire } from "node:module";
import path from "node:path";

const DEFAULT_AGENT_BROWSER_BIN = "agent-browser";
const DEFAULT_COMMAND_TIMEOUT_MS = 30_000;
const EVAL_MAX_BUFFER = 50 * 1024 * 1024;
const require = createRequire(import.meta.url);

export type AgentBrowserExecutor = (
  args: string[],
  options?: { input?: string; timeoutMs?: number; bin?: string },
) => Promise<{ stdout: string; stderr: string }>;

export type AgentBrowserPageSnapshot = {
  finalUrl: string;
  html: string;
  title?: string;
  description?: string;
  canonicalUrl?: string;
  robots?: string;
  sitemapUrls: string[];
  performance: {
    domContentLoadedMs?: number;
    loadEventMs?: number;
  };
};

export class AgentBrowserError extends Error {
  constructor(
    message: string,
    readonly kind: "missing" | "runtime" | "navigation" | "command",
  ) {
    super(message);
    this.name = "AgentBrowserError";
  }
}

function uniqueBins(values: Array<string | undefined>): string[] {
  const seen = new Set<string>();
  const bins: string[] = [];

  for (const value of values) {
    if (!value || seen.has(value)) {
      continue;
    }

    seen.add(value);
    bins.push(value);
  }

  return bins;
}

export function resolveBundledAgentBrowserBin(): string | undefined {
  try {
    const manifestPath = require.resolve("agent-browser/package.json");
    const manifest = JSON.parse(readFileSync(manifestPath, "utf8")) as {
      bin?: string | Record<string, string>;
    };
    const binEntry =
      typeof manifest.bin === "string" ? manifest.bin : manifest.bin?.["agent-browser"];

    if (!binEntry) {
      return undefined;
    }

    const resolvedBin = path.resolve(path.dirname(manifestPath), binEntry);
    return existsSync(resolvedBin) ? resolvedBin : undefined;
  } catch {
    return undefined;
  }
}

function resolveAgentBrowserBins(options?: {
  bin?: string;
  binCandidates?: string[];
}): string[] {
  return uniqueBins([
    ...(options?.binCandidates ?? []),
    options?.bin,
    process.env.AGENT_BROWSER_BIN,
    DEFAULT_AGENT_BROWSER_BIN,
    resolveBundledAgentBrowserBin(),
  ]);
}

const SNAPSHOT_SCRIPT = `
(() => {
  const navEntry = performance.getEntriesByType("navigation")[0];
  const normalizeUrl = (value) => {
    if (!value || typeof value !== "string") return null;
    try {
      return new URL(value, window.location.href).toString();
    } catch {
      return value;
    }
  };

  const sitemapUrls = Array.from(
    new Set(
      [
        ...Array.from(document.querySelectorAll('link[rel="sitemap"]')).map((node) => node.getAttribute("href")),
        ...Array.from(document.querySelectorAll('a[href*="sitemap"]')).map((node) => node.getAttribute("href")),
      ]
        .map((value) => normalizeUrl(value))
        .filter(Boolean),
    ),
  );

  return {
    finalUrl: window.location.href,
    title: document.title || null,
    description: document.querySelector('meta[name="description"]')?.getAttribute("content") || null,
    canonicalUrl: normalizeUrl(document.querySelector('link[rel="canonical"]')?.getAttribute("href")) || null,
    robots: document.querySelector('meta[name="robots"]')?.getAttribute("content") || null,
    sitemapUrls,
    html: document.documentElement?.outerHTML || "",
    performance: navEntry
      ? {
          domContentLoadedMs: Number.isFinite(navEntry.domContentLoadedEventEnd)
            ? navEntry.domContentLoadedEventEnd
            : null,
          loadEventMs: Number.isFinite(navEntry.loadEventEnd) ? navEntry.loadEventEnd : null,
        }
      : null,
  };
})();
`.trim();

function defaultExecutor(
  args: string[],
  options?: { input?: string; timeoutMs?: number; bin?: string },
): Promise<{ stdout: string; stderr: string }> {
  return new Promise((resolve, reject) => {
    const child = execFile(
      options?.bin || DEFAULT_AGENT_BROWSER_BIN,
      args,
      {
        env: process.env,
        timeout: options?.timeoutMs ?? DEFAULT_COMMAND_TIMEOUT_MS,
        maxBuffer: EVAL_MAX_BUFFER,
      },
      (error, stdout, stderr) => {
        if (error) {
          const enriched = Object.assign(error, { stdout, stderr });
          reject(enriched);
          return;
        }

        resolve({ stdout, stderr });
      },
    );

    if (options?.input) {
      child.stdin?.end(options.input);
    }
  });
}

function classifyAgentBrowserError(error: unknown): AgentBrowserError {
  if (error instanceof AgentBrowserError) {
    return error;
  }

  const err = error as Error & {
    code?: string;
    killed?: boolean;
    stdout?: string;
    stderr?: string;
  };
  const output = [err.stderr, err.stdout, err.message].filter(Boolean).join("\n");

  if (err.code === "ENOENT") {
    return new AgentBrowserError(
      "agent-browser is not installed or not available on PATH",
      "missing",
    );
  }

  if (err.killed || err.message?.includes("timed out")) {
    return new AgentBrowserError("agent-browser timed out while loading the page", "navigation");
  }

  if (/error while loading shared libraries|cannot open shared object file|libnspr4\.so|libnss3\.so/i.test(output)) {
    return new AgentBrowserError(
      "agent-browser is installed, but local Linux browser dependencies are missing. Run `agent-browser install --with-deps`.",
      "runtime",
    );
  }

  if (
    /install browser binaries|download chromium|browser binaries|failed to launch|browser executable/i.test(output)
  ) {
    return new AgentBrowserError(
      "agent-browser is installed, but its browser runtime is not ready. Run `agent-browser install` (or `agent-browser install --with-deps` on Linux).",
      "runtime",
    );
  }

  if (/networkidle|domcontentloaded|navigation|ERR_/i.test(output)) {
    return new AgentBrowserError(`agent-browser could not finish loading the page: ${output}`, "navigation");
  }

  return new AgentBrowserError(`agent-browser command failed: ${output || "unknown error"}`, "command");
}

function normalizeString(value: unknown): string | undefined {
  return typeof value === "string" && value.trim().length > 0 ? value.trim() : undefined;
}

function normalizeNumber(value: unknown): number | undefined {
  return typeof value === "number" && Number.isFinite(value) ? value : undefined;
}

async function runJsonCommand<T>(
  executor: AgentBrowserExecutor,
  args: string[],
  options?: { input?: string; timeoutMs?: number; bin?: string },
): Promise<T> {
  try {
    const { stdout } = await executor(args, options);
    const payload = JSON.parse(stdout) as {
      success?: boolean;
      data?: { result?: T };
      error?: string | null;
    };

    if (payload.success === false) {
      throw new AgentBrowserError(payload.error || "agent-browser returned an error", "command");
    }

    return payload.data?.result as T;
  } catch (error) {
    throw classifyAgentBrowserError(error);
  }
}

async function runCommand(
  executor: AgentBrowserExecutor,
  args: string[],
  options?: { timeoutMs?: number; bin?: string },
): Promise<void> {
  try {
    await executor(args, options);
  } catch (error) {
    throw classifyAgentBrowserError(error);
  }
}

async function analyzeWithResolvedBin(
  url: string,
  executor: AgentBrowserExecutor,
  bin: string,
): Promise<AgentBrowserPageSnapshot> {
  const session = `sitespecs-${randomUUID()}`;

  try {
    await runCommand(executor, ["--session", session, "open", url], { bin, timeoutMs: 30_000 });

    try {
      await runCommand(executor, ["--session", session, "wait", "--load", "networkidle"], {
        bin,
        timeoutMs: 20_000,
      });
    } catch {
      await runCommand(executor, ["--session", session, "wait", "--load", "domcontentloaded"], {
        bin,
        timeoutMs: 20_000,
      });
    }

    const result = await runJsonCommand<{
      finalUrl?: string | null;
      html?: string | null;
      title?: string | null;
      description?: string | null;
      canonicalUrl?: string | null;
      robots?: string | null;
      sitemapUrls?: unknown;
      performance?: { domContentLoadedMs?: number | null; loadEventMs?: number | null } | null;
    }>(
      executor,
      ["--session", session, "eval", "--json", "--stdin"],
      { bin, timeoutMs: 30_000, input: SNAPSHOT_SCRIPT },
    );

    return {
      finalUrl: normalizeString(result.finalUrl) || url,
      html: normalizeString(result.html) || "",
      title: normalizeString(result.title),
      description: normalizeString(result.description),
      canonicalUrl: normalizeString(result.canonicalUrl),
      robots: normalizeString(result.robots),
      sitemapUrls: Array.isArray(result.sitemapUrls)
        ? result.sitemapUrls
            .filter((value): value is string => typeof value === "string" && value.trim().length > 0)
            .map((value) => value.trim())
        : [],
      performance: {
        domContentLoadedMs: normalizeNumber(result.performance?.domContentLoadedMs),
        loadEventMs: normalizeNumber(result.performance?.loadEventMs),
      },
    };
  } catch (error) {
    throw classifyAgentBrowserError(error);
  } finally {
    try {
      await executor(["--session", session, "close"], { bin, timeoutMs: 10_000 });
    } catch {
      // Best-effort cleanup only.
    }
  }
}

export async function analyzeWithAgentBrowser(
  url: string,
  options?: { bin?: string; binCandidates?: string[]; executor?: AgentBrowserExecutor },
): Promise<AgentBrowserPageSnapshot> {
  const executor = options?.executor || defaultExecutor;
  const bins = resolveAgentBrowserBins(options);
  let lastError: AgentBrowserError | undefined;

  for (const bin of bins) {
    try {
      return await analyzeWithResolvedBin(url, executor, bin);
    } catch (error) {
      const classifiedError = classifyAgentBrowserError(error);
      if (classifiedError.kind === "missing") {
        lastError = classifiedError;
        continue;
      }

      throw classifiedError;
    }
  }

  throw lastError ?? new AgentBrowserError("agent-browser is not installed or not available on PATH", "missing");
}
