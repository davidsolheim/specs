import { analyzeUrl } from "@sitespecs/analyzer-core";
import type { AnalysisResponse } from "@sitespecs/contracts";

import { fetchHostedAnalysis } from "./api.js";

export type AnalysisMode = "local" | "cloud";

type ResolveAnalysisOptions = {
  mode?: string;
  enrich?: boolean;
};

function withEnrichmentStatus(
  analysis: AnalysisResponse,
  enrichmentStatus: NonNullable<AnalysisResponse["execution"]>["enrichmentStatus"],
): AnalysisResponse {
  return {
    ...analysis,
    execution: {
      ...analysis.execution,
      mode: analysis.execution?.mode ?? "local",
      engine: analysis.execution?.engine ?? "http",
      degraded: analysis.execution?.degraded ?? false,
      enrichmentStatus,
    },
  };
}

function asCloudAnalysis(analysis: AnalysisResponse): AnalysisResponse {
  return {
    ...analysis,
    execution: {
      ...analysis.execution,
      mode: "cloud",
      engine: "sitespecs",
      degraded: false,
      enrichmentStatus: analysis.execution?.enrichmentStatus ?? "none",
    },
  };
}

export function normalizeAnalysisMode(mode?: string): AnalysisMode {
  if (mode === undefined || mode === null || mode === "") {
    return "local";
  }

  if (mode === "local" || mode === "cloud") {
    return mode;
  }

  throw new Error(`Invalid --mode value: ${mode} (expected: local|cloud)`);
}

function applySitespecsEnrichment(
  analysis: AnalysisResponse,
  result: Awaited<ReturnType<typeof fetchHostedAnalysis>>,
): AnalysisResponse {
  if (!result.pending) {
    return withEnrichmentStatus(
      {
        ...analysis,
        enrichment: {
          ...analysis.enrichment,
          sitespecs: {
            status: "complete",
            ...(result.jobId ? { jobId: result.jobId } : {}),
            ...(result.statusUrl ? { statusUrl: result.statusUrl } : {}),
            ...(result.cached !== undefined ? { cached: result.cached } : {}),
            ...(result.scannedAt ? { scannedAt: result.scannedAt } : {}),
            ...(result.message ? { message: result.message } : {}),
            analysis: asCloudAnalysis(result.analysis),
          },
        },
      },
      "complete",
    );
  }

  return withEnrichmentStatus(
    {
      ...analysis,
      enrichment: {
        ...analysis.enrichment,
        sitespecs: {
          status: "pending",
          ...(result.jobId ? { jobId: result.jobId } : {}),
          ...(result.statusUrl ? { statusUrl: result.statusUrl } : {}),
          ...(result.cached !== undefined ? { cached: result.cached } : {}),
          ...(result.scannedAt ? { scannedAt: result.scannedAt } : {}),
          ...(result.message ? { message: result.message } : {}),
          analysis: asCloudAnalysis(result.analysis),
        },
      },
    },
    "pending",
  );
}

export async function resolveAnalysis(
  domainOrUrl: string,
  options?: ResolveAnalysisOptions,
): Promise<AnalysisResponse> {
  const mode = normalizeAnalysisMode(options?.mode);

  if (mode === "cloud") {
    const hosted = await fetchHostedAnalysis(domainOrUrl);
    if (hosted.pending) {
      throw new Error(
        `Cloud analysis timed out: SiteSpecs scan is still processing${
          hosted.jobId ? ` (job ${hosted.jobId})` : ""
        }. Retry shortly or use --enrich for local-first output.`,
      );
    }

    return asCloudAnalysis(hosted.analysis);
  }

  let analysis = await analyzeUrl(domainOrUrl);

  if (!options?.enrich) {
    return withEnrichmentStatus(analysis, analysis.execution?.enrichmentStatus ?? "none");
  }

  try {
    const hosted = await fetchHostedAnalysis(domainOrUrl);
    analysis = applySitespecsEnrichment(analysis, hosted);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    analysis = withEnrichmentStatus(
      {
        ...analysis,
        enrichment: {
          ...analysis.enrichment,
          sitespecs: {
            status: "failed",
            error: message,
          },
        },
      },
      "failed",
    );
  }

  return analysis;
}
