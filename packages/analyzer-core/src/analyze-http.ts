import type {
  AnalysisRedirectHop,
  AnalysisRedirects,
  AnalysisRequestedTarget,
  AnalysisResponse,
  AnalysisTechnology,
} from "@sitespecs/contracts";

import { analyzeSeoPage } from "./seo-analysis.js";
import { detectTechnologies, getFramework, getHostingProvider } from "./technology-detector.js";

const DEFAULT_USER_AGENT = "Mozilla/5.0 (compatible; SiteSpecsBot/1.0; +https://sitespecs.com/bot)";
const DEFAULT_TIMEOUT_MS = 15_000;
const DEFAULT_REDIRECT_TIMEOUT_MS = 5_000;
const MAX_REDIRECT_HOPS = 10;

const REDIRECT_STATUS_CODES = new Set([300, 301, 302, 303, 307, 308]);
const HEAD_FALLBACK_STATUS_CODES = new Set([405, 501]);

export function normalizeInputUrl(domainOrUrl: string): string {
  const trimmed = domainOrUrl.trim();
  if (!trimmed) {
    throw new Error("Domain or URL is required");
  }

  return /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`;
}

export function extractDomain(value: string): string {
  try {
    return new URL(value).hostname.replace(/^www\./i, "");
  } catch {
    return value.replace(/^https?:\/\//i, "").replace(/^www\./i, "").replace(/\/$/, "");
  }
}

export function extractHost(value: string): string {
  try {
    return new URL(value).hostname;
  } catch {
    return value.replace(/^https?:\/\//i, "").replace(/\/.*$/, "");
  }
}

function compactDisplayUrl(value: string): string {
  try {
    const url = new URL(value);
    const pathname = url.pathname === "/" ? "" : url.pathname;
    return `${url.protocol}//${url.host}${pathname}${url.search}${url.hash}`;
  } catch {
    return value;
  }
}

function dedupeAdjacent(values: string[]): string[] {
  return values.filter((value, index) => index === 0 || value !== values[index - 1]);
}

export function buildRequestedTarget(input: string, normalizedUrl: string = normalizeInputUrl(input)): AnalysisRequestedTarget {
  return {
    input: input.trim(),
    url: normalizedUrl,
    host: extractHost(normalizedUrl),
  };
}

export function buildCondensedRedirectChain(chain: AnalysisRedirectHop[]): string {
  if (chain.length === 0) {
    return "";
  }

  const hostLabels = dedupeAdjacent(
    chain.map((hop, index) => {
      if (index === chain.length - 1) {
        return hop.host.replace(/^www\./i, "");
      }

      return hop.host;
    }),
  );
  const distinctHosts = new Set(hostLabels.map((value) => value.toLowerCase()));

  if (hostLabels.length > 1 && distinctHosts.size > 1) {
    return hostLabels.join(" -> ");
  }

  return dedupeAdjacent(chain.map((hop) => compactDisplayUrl(hop.url))).join(" -> ");
}

export function headersToRecord(headers: Headers): Record<string, string> {
  const out: Record<string, string> = {};
  headers.forEach((value, key) => {
    out[key] = value;
  });
  return out;
}

export type HttpAnalysisPass = {
  analysis: AnalysisResponse;
  finalUrl: string;
  html: string;
  headers: Record<string, string>;
  technologies: AnalysisTechnology[];
};

async function fetchWithTimeout(
  url: string,
  options: {
    method: "GET" | "HEAD";
    timeoutMs: number;
    userAgent?: string;
  },
): Promise<Response> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), options.timeoutMs);

  try {
    return await fetch(url, {
      method: options.method,
      redirect: "manual",
      signal: controller.signal,
      headers: {
        "User-Agent": options.userAgent ?? DEFAULT_USER_AGENT,
        Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
      },
    });
  } finally {
    clearTimeout(timeout);
  }
}

async function fetchRedirectProbe(
  url: string,
  options?: { timeoutMs?: number; userAgent?: string },
): Promise<Response> {
  const timeoutMs = options?.timeoutMs ?? DEFAULT_REDIRECT_TIMEOUT_MS;
  const headResponse = await fetchWithTimeout(url, {
    method: "HEAD",
    timeoutMs,
    userAgent: options?.userAgent,
  });

  if (!HEAD_FALLBACK_STATUS_CODES.has(headResponse.status)) {
    return headResponse;
  }

  headResponse.body?.cancel();
  return fetchWithTimeout(url, {
    method: "GET",
    timeoutMs,
    userAgent: options?.userAgent,
  });
}

export async function traceRedirects(
  domainOrUrl: string,
  options?: { timeoutMs?: number; userAgent?: string },
): Promise<AnalysisRedirects> {
  const requested = normalizeInputUrl(domainOrUrl);
  let currentUrl = requested;
  const chain: AnalysisRedirectHop[] = [];

  for (let hop = 0; hop <= MAX_REDIRECT_HOPS; hop += 1) {
    try {
      const response = await fetchRedirectProbe(currentUrl, options);

      chain.push({
        url: currentUrl,
        host: extractHost(currentUrl),
        statusCode: response.status,
      });

      const location = response.headers.get("location");
      if (!REDIRECT_STATUS_CODES.has(response.status) || !location) {
        response.body?.cancel();
        break;
      }

      const nextUrl = new URL(location, currentUrl).toString();
      response.body?.cancel();

      if (nextUrl === currentUrl) {
        break;
      }

      currentUrl = nextUrl;
    } catch (error) {
      const lastHopUrl = chain[chain.length - 1]?.url;
      if (chain.length > 0 && currentUrl !== lastHopUrl) {
        chain.push({
          url: currentUrl,
          host: extractHost(currentUrl),
        });
        break;
      }

      throw error;
    }

    if (hop === MAX_REDIRECT_HOPS) {
      throw new Error(`Redirect trace exceeded ${MAX_REDIRECT_HOPS} hops`);
    }
  }

  const finalUrl = chain[chain.length - 1]?.url ?? requested;

  return {
    occurred: chain.length > 1,
    finalUrl,
    finalHost: extractHost(finalUrl),
    chain,
    condensedChain: buildCondensedRedirectChain(chain),
  };
}

export async function analyzeHttpPass(
  domainOrUrl: string,
  options?: { timeoutMs?: number; userAgent?: string },
): Promise<HttpAnalysisPass> {
  const url = normalizeInputUrl(domainOrUrl);
  const startedAt = Date.now();
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), options?.timeoutMs ?? DEFAULT_TIMEOUT_MS);

  try {
    const response = await fetch(url, {
      method: "GET",
      redirect: "follow",
      signal: controller.signal,
      headers: {
        "User-Agent": options?.userAgent ?? DEFAULT_USER_AGENT,
        Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
      },
    });

    const html = await response.text();
    const headers = headersToRecord(response.headers);
    const responseTime = Date.now() - startedAt;
    const finalUrl = response.url || url;
    const technologies = await detectTechnologies({
      url: finalUrl,
      html,
      headers,
    });
    const seo = analyzeSeoPage(finalUrl, html, headers);
    const pageSize = Buffer.byteLength(html, "utf8");
    const framework = getFramework(technologies);
    const host = getHostingProvider(technologies);
    const requested = buildRequestedTarget(domainOrUrl, url);

    const analysis: AnalysisResponse = {
      domain: extractDomain(finalUrl),
      url: finalUrl,
      status: response.status >= 200 && response.status < 400 ? "online" : "offline",
      technologies,
      requested,
      ...(framework ? { framework } : {}),
      ...(host ? { host } : {}),
      seo: {
        score: seo.score,
        title: seo.title ?? null,
        description: seo.description ?? null,
        hasSSL: seo.hasSSL,
        mobileOptimized: seo.mobileOptimized,
        wordCount: seo.wordCount,
        canonicalUrl: seo.canonicalUrl ?? null,
        robots: seo.robots ?? null,
        ...(seo.sitemapUrls.length > 0 ? { sitemapUrls: seo.sitemapUrls } : {}),
      },
      performance: {
        responseTime,
        pageSize,
        statusCode: response.status,
      },
      lastAnalyzed: new Date().toISOString(),
    };

    return {
      analysis,
      finalUrl,
      html,
      headers,
      technologies,
    };
  } finally {
    clearTimeout(timeout);
  }
}

export async function analyzeHttpUrl(
  domainOrUrl: string,
  options?: { timeoutMs?: number; userAgent?: string },
): Promise<AnalysisResponse> {
  return (await analyzeHttpPass(domainOrUrl, options)).analysis;
}
