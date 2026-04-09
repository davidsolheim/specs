import { z } from "zod";

export const analysisStatusSchema = z.enum(["online", "offline", "unknown", "analyzing"]);
export const analysisExecutionModeSchema = z.enum(["local", "cloud"]);
export const analysisExecutionEngineSchema = z.enum([
  "agent-browser",
  "http",
  "agent-browser+http",
  "sitespecs",
]);
export const analysisEnrichmentStatusSchema = z.enum(["none", "pending", "complete", "failed"]);

export const analysisTechnologySchema = z.object({
  name: z.string(),
  version: z.string().nullable().optional(),
  category: z.string(),
  confidence: z.string(),
  icon: z.string().nullable().optional(),
  website: z.string().nullable().optional(),
});

export const analysisRequestedTargetSchema = z
  .object({
    input: z.string(),
    url: z.string(),
    host: z.string(),
  })
  .optional();

export const analysisRedirectHopSchema = z.object({
  url: z.string(),
  host: z.string(),
  statusCode: z.number().optional(),
});

export const analysisRedirectsSchema = z
  .object({
    occurred: z.boolean(),
    finalUrl: z.string(),
    finalHost: z.string(),
    chain: z.array(analysisRedirectHopSchema),
    condensedChain: z.string(),
  })
  .optional();

export const analysisSeoSchema = z
  .object({
    score: z.number().nullable().optional(),
    title: z.string().nullable().optional(),
    description: z.string().nullable().optional(),
    hasSSL: z.boolean().nullable().optional(),
    mobileOptimized: z.boolean().nullable().optional(),
    wordCount: z.number().nullable().optional(),
    canonicalUrl: z.string().nullable().optional(),
    robots: z.string().nullable().optional(),
    sitemapUrls: z.array(z.string()).optional(),
  })
  .optional();

export const analysisPerformanceSchema = z
  .object({
    responseTime: z.number().nullable().optional(),
    pageSize: z.number().nullable().optional(),
    statusCode: z.number().nullable().optional(),
    domContentLoadedMs: z.number().nullable().optional(),
    loadEventMs: z.number().nullable().optional(),
  })
  .optional();

export const analysisDnsSchema = z
  .object({
    addresses: z.array(z.string()).optional(),
    cname: z.array(z.string()).optional(),
  })
  .optional();

export const analysisTlsSchema = z
  .object({
    authorized: z.boolean().nullable().optional(),
    authorizationError: z.string().nullable().optional(),
    protocol: z.string().nullable().optional(),
    issuer: z.string().nullable().optional(),
    subject: z.string().nullable().optional(),
    validFrom: z.string().nullable().optional(),
    validTo: z.string().nullable().optional(),
    daysRemaining: z.number().nullable().optional(),
  })
  .optional();

export const analysisExecutionSchema = z
  .object({
    mode: analysisExecutionModeSchema,
    engine: analysisExecutionEngineSchema,
    degraded: z.boolean().optional(),
    fallbackReason: z.string().optional(),
    enrichmentStatus: analysisEnrichmentStatusSchema.optional(),
  })
  .optional();

export const analysisSnapshotSchema = z.object({
  domain: z.string(),
  url: z.string(),
  status: analysisStatusSchema,
  technologies: z.array(analysisTechnologySchema),
  requested: analysisRequestedTargetSchema,
  redirects: analysisRedirectsSchema,
  framework: z.string().optional(),
  host: z.string().optional(),
  seo: analysisSeoSchema,
  performance: analysisPerformanceSchema,
  onlineSince: z.string().optional(),
  lastAnalyzed: z.string().optional(),
  analyzing: z.boolean().optional(),
});

export const analysisSitespecsEnrichmentSchema = z
  .object({
    status: z.enum(["pending", "complete", "failed"]),
    jobId: z.string().optional(),
    statusUrl: z.string().optional(),
    cached: z.boolean().optional(),
    scannedAt: z.string().optional(),
    message: z.string().optional(),
    error: z.string().optional(),
    analysis: analysisSnapshotSchema.optional(),
  })
  .optional();

export const analysisEnrichmentSchema = z
  .object({
    sitespecs: analysisSitespecsEnrichmentSchema,
  })
  .optional();

export const analysisResponseSchema = analysisSnapshotSchema.extend({
  dns: analysisDnsSchema,
  tls: analysisTlsSchema,
  execution: analysisExecutionSchema,
  enrichment: analysisEnrichmentSchema,
});

export const publicAnalyzeRequestSchema = z.object({
  url: z.string().min(1, "URL is required"),
  type: z.enum(["http", "browser", "seo"]).optional().default("http"),
  forceRefresh: z.boolean().optional().default(false),
});

export type AnalysisStatus = z.infer<typeof analysisStatusSchema>;
export type AnalysisExecutionMode = z.infer<typeof analysisExecutionModeSchema>;
export type AnalysisExecutionEngine = z.infer<typeof analysisExecutionEngineSchema>;
export type AnalysisEnrichmentStatus = z.infer<typeof analysisEnrichmentStatusSchema>;
export type AnalysisTechnology = z.infer<typeof analysisTechnologySchema>;
export type AnalysisRequestedTarget = z.infer<NonNullable<typeof analysisRequestedTargetSchema>>;
export type AnalysisRedirectHop = z.infer<typeof analysisRedirectHopSchema>;
export type AnalysisRedirects = z.infer<NonNullable<typeof analysisRedirectsSchema>>;
export type AnalysisSeo = z.infer<NonNullable<typeof analysisSeoSchema>>;
export type AnalysisPerformance = z.infer<NonNullable<typeof analysisPerformanceSchema>>;
export type AnalysisDns = z.infer<NonNullable<typeof analysisDnsSchema>>;
export type AnalysisTls = z.infer<NonNullable<typeof analysisTlsSchema>>;
export type AnalysisExecution = z.infer<NonNullable<typeof analysisExecutionSchema>>;
export type AnalysisSnapshot = z.infer<typeof analysisSnapshotSchema>;
export type AnalysisSitespecsEnrichment = z.infer<NonNullable<typeof analysisSitespecsEnrichmentSchema>>;
export type AnalysisEnrichment = z.infer<NonNullable<typeof analysisEnrichmentSchema>>;
export type AnalysisResponse = z.infer<typeof analysisResponseSchema>;
export type PublicAnalyzeRequest = z.infer<typeof publicAnalyzeRequestSchema>;
