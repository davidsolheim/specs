import type {
  AnalysisDns,
  AnalysisExecution,
  AnalysisExecutionEngine,
  AnalysisPerformance,
  AnalysisRedirects,
  AnalysisResponse,
  AnalysisSeo,
  AnalysisTechnology,
  AnalysisTls,
} from "@sitespecs/contracts";

import {
  AgentBrowserError,
  analyzeWithAgentBrowser,
  type AgentBrowserExecutor,
  type AgentBrowserPageSnapshot,
} from "./agent-browser.js";
import {
  analyzeHttpPass,
  buildRequestedTarget,
  extractDomain,
  extractHost,
  normalizeInputUrl,
  traceRedirects,
  type HttpAnalysisPass,
} from "./analyze-http.js";
import { analyzeDns, analyzeTls } from "./network-analyzer.js";
import { detectTechnologies, getFramework, getHostingProvider } from "./technology-detector.js";

type LocalAnalyzerOptions = {
  agentBrowserBin?: string;
  agentBrowserExecutor?: AgentBrowserExecutor;
  httpTimeoutMs?: number;
  browserAnalyzer?: typeof analyzeWithAgentBrowser;
  httpAnalyzer?: typeof analyzeHttpPass;
  redirectTracer?: typeof traceRedirects;
  networkArtifactAnalyzer?: (targetUrl: string) => Promise<{ dns?: AnalysisDns; tls?: AnalysisTls }>;
};

function rankConfidence(value?: string): number {
  if (value === "high") return 3;
  if (value === "medium") return 2;
  if (value === "low") return 1;
  return 0;
}

function mergeTechnologies(...collections: Array<AnalysisTechnology[] | undefined>): AnalysisTechnology[] {
  const byKey = new Map<string, AnalysisTechnology>();

  for (const collection of collections) {
    for (const technology of collection ?? []) {
      const key = [
        technology.name.toLowerCase(),
        technology.category.toLowerCase(),
        technology.version?.toLowerCase() ?? "",
      ].join("|");
      const existing = byKey.get(key);

      if (!existing || rankConfidence(technology.confidence) > rankConfidence(existing.confidence)) {
        byKey.set(key, technology);
      }
    }
  }

  return Array.from(byKey.values());
}

function mergeSeo(
  baseSeo: AnalysisSeo | undefined,
  browserSnapshot: AgentBrowserPageSnapshot | undefined,
): AnalysisSeo | undefined {
  const sitemapUrls = Array.from(
    new Set([...(baseSeo?.sitemapUrls ?? []), ...(browserSnapshot?.sitemapUrls ?? [])]),
  );

  const merged: Exclude<AnalysisSeo, undefined> = {
    ...(baseSeo ?? {}),
    ...(browserSnapshot?.title ? { title: browserSnapshot.title } : {}),
    ...(browserSnapshot?.description ? { description: browserSnapshot.description } : {}),
    ...(browserSnapshot?.canonicalUrl ? { canonicalUrl: browserSnapshot.canonicalUrl } : {}),
    ...(browserSnapshot?.robots ? { robots: browserSnapshot.robots } : {}),
    ...(sitemapUrls.length > 0 ? { sitemapUrls } : {}),
  };

  return Object.keys(merged).length > 0 ? merged : undefined;
}

function mergePerformance(
  basePerformance: AnalysisPerformance | undefined,
  browserSnapshot: AgentBrowserPageSnapshot | undefined,
): AnalysisPerformance | undefined {
  const merged: Exclude<AnalysisPerformance, undefined> = {
    ...(basePerformance ?? {}),
    ...(browserSnapshot?.performance.domContentLoadedMs !== undefined
      ? { domContentLoadedMs: browserSnapshot.performance.domContentLoadedMs }
      : {}),
    ...(browserSnapshot?.performance.loadEventMs !== undefined
      ? { loadEventMs: browserSnapshot.performance.loadEventMs }
      : {}),
  };

  return Object.keys(merged).length > 0 ? merged : undefined;
}

function toFallbackReason(error: unknown): string | undefined {
  if (error instanceof Error && error.message.trim().length > 0) {
    return error.message.trim();
  }

  return undefined;
}

function buildExecution(options: {
  browserSnapshot?: AgentBrowserPageSnapshot;
  browserError?: unknown;
  httpPass?: HttpAnalysisPass;
  httpError?: unknown;
}): AnalysisExecution {
  const { browserSnapshot, browserError, httpPass, httpError } = options;
  let engine: AnalysisExecutionEngine = "http";
  let degraded = false;
  let fallbackReason: string | undefined;

  if (browserSnapshot && httpPass) {
    engine = "agent-browser+http";
    degraded = false;
  } else if (browserSnapshot) {
    engine = "agent-browser";
    degraded = httpError !== undefined;
    fallbackReason = degraded ? toFallbackReason(httpError) : undefined;
  } else if (httpPass) {
    engine = "http";
    degraded = true;
    fallbackReason = toFallbackReason(browserError);
  } else {
    engine = "http";
    degraded = true;
    fallbackReason = toFallbackReason(browserError) ?? toFallbackReason(httpError);
  }

  return {
    mode: "local",
    engine,
    degraded,
    ...(fallbackReason ? { fallbackReason } : {}),
    enrichmentStatus: "none",
  };
}

function resolveLocalFailure(browserError: unknown, httpError: unknown): never {
  const browserReason = toFallbackReason(browserError);
  const httpReason = toFallbackReason(httpError);

  if (httpReason && browserReason) {
    throw new Error(`Local analysis failed: ${httpReason}. Browser pass also failed: ${browserReason}`);
  }

  if (httpReason) {
    throw new Error(`Local analysis failed: ${httpReason}`);
  }

  if (browserReason) {
    throw new Error(`Local analysis failed: ${browserReason}`);
  }

  throw new Error("Local analysis failed");
}

async function detectRenderedTechnologies(options: {
  url: string;
  browserSnapshot?: AgentBrowserPageSnapshot;
  httpPass?: HttpAnalysisPass;
}): Promise<AnalysisTechnology[]> {
  const { url, browserSnapshot, httpPass } = options;
  const html = browserSnapshot?.html || httpPass?.html || "";

  if (!html) {
    return mergeTechnologies(httpPass?.analysis.technologies);
  }

  const detected = await detectTechnologies({
    url,
    html,
    headers: httpPass?.headers ?? {},
  });

  return mergeTechnologies(detected, httpPass?.analysis.technologies);
}

async function analyzeOptionalNetworkArtifacts(
  targetUrl: string,
): Promise<{ dns?: AnalysisDns; tls?: AnalysisTls }> {
  const [dnsResult, tlsResult] = await Promise.allSettled([
    analyzeDns(targetUrl),
    analyzeTls(targetUrl),
  ]);

  return {
    ...(dnsResult.status === "fulfilled" && dnsResult.value ? { dns: dnsResult.value } : {}),
    ...(tlsResult.status === "fulfilled" && tlsResult.value ? { tls: tlsResult.value } : {}),
  };
}

function buildRedirectMetadata(options: {
  tracedRedirects?: AnalysisRedirects;
  finalUrl: string;
}): AnalysisRedirects | undefined {
  const { tracedRedirects, finalUrl } = options;
  if (!tracedRedirects) {
    return undefined;
  }

  return {
    ...tracedRedirects,
    finalUrl,
    finalHost: extractHost(finalUrl),
  };
}

export async function analyzeUrl(
  domainOrUrl: string,
  options?: LocalAnalyzerOptions,
): Promise<AnalysisResponse> {
  const normalizedUrl = normalizeInputUrl(domainOrUrl);
  const requested = buildRequestedTarget(domainOrUrl, normalizedUrl);
  const browserAnalyzer = options?.browserAnalyzer ?? analyzeWithAgentBrowser;
  const httpAnalyzer = options?.httpAnalyzer ?? analyzeHttpPass;
  const redirectTracer = options?.redirectTracer ?? traceRedirects;
  const networkArtifactAnalyzer = options?.networkArtifactAnalyzer ?? analyzeOptionalNetworkArtifacts;

  let tracedRedirects: AnalysisRedirects | undefined;
  try {
    tracedRedirects = await redirectTracer(normalizedUrl, {
      timeoutMs: options?.httpTimeoutMs,
    });
  } catch {
    tracedRedirects = undefined;
  }

  let browserSnapshot: AgentBrowserPageSnapshot | undefined;
  let browserError: unknown;
  try {
    browserSnapshot = await browserAnalyzer(normalizedUrl, {
      bin: options?.agentBrowserBin,
      executor: options?.agentBrowserExecutor,
    });
  } catch (error) {
    browserError = error;
  }

  let httpPass: HttpAnalysisPass | undefined;
  let httpError: unknown;
  try {
    httpPass = await httpAnalyzer(normalizedUrl, {
      timeoutMs: options?.httpTimeoutMs,
    });
  } catch (error) {
    httpError = error;
  }

  if (!browserSnapshot && !httpPass) {
    resolveLocalFailure(browserError, httpError);
  }

  const finalUrl = browserSnapshot?.finalUrl || httpPass?.finalUrl || tracedRedirects?.finalUrl || normalizedUrl;
  const technologies = await detectRenderedTechnologies({
    url: finalUrl,
    browserSnapshot,
    httpPass,
  });
  const seo = mergeSeo(httpPass?.analysis.seo, browserSnapshot);
  const performance = mergePerformance(httpPass?.analysis.performance, browserSnapshot);
  const execution = buildExecution({
    browserSnapshot,
    browserError,
    httpPass,
    httpError,
  });
  const redirectMetadata = buildRedirectMetadata({
    tracedRedirects,
    finalUrl,
  });
  const { dns, tls } = await networkArtifactAnalyzer(finalUrl);
  const framework = getFramework(technologies) ?? httpPass?.analysis.framework;
  const host = getHostingProvider(technologies) ?? httpPass?.analysis.host;

  return {
    domain: extractDomain(finalUrl),
    url: finalUrl,
    status: httpPass?.analysis.status ?? "online",
    technologies,
    requested,
    ...(redirectMetadata ? { redirects: redirectMetadata } : {}),
    ...(framework ? { framework } : {}),
    ...(host ? { host } : {}),
    ...(seo ? { seo } : {}),
    ...(performance ? { performance } : {}),
    ...(dns ? { dns } : {}),
    ...(tls ? { tls } : {}),
    ...(httpPass?.analysis.lastAnalyzed ? { lastAnalyzed: httpPass.analysis.lastAnalyzed } : {}),
    execution,
  };
}

export function isAgentBrowserFailure(error: unknown): error is AgentBrowserError {
  return error instanceof AgentBrowserError;
}
